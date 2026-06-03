/**
 * Scheduled jobs (Cloud Scheduler + Pub/Sub, provisioned automatically by the
 * Firebase CLI from these onSchedule declarations — no manual dashboard work).
 *
 *   - reminders        : 23:00 local — nudge users who haven't submitted.
 *   - midnightRollover : 00:05 local — resolve the previous day & send results.
 *   - biweeklySummary  : 09:00 local daily — emits a group summary every 14 days.
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { db } from "../lib/admin";
import { REGION, DEFAULT_TIMEZONE, TWILIO_AUTH_TOKEN } from "../config";
import { Collections, DailyStatus, User } from "../types";
import { addDays, today } from "../lib/dates";
import { dailyStatusId, resolveUserDay } from "../lib/game";
import { broadcastSms, sendSms } from "../lib/twilio";
import {
  buildBiweeklySummary,
  buildDailySummary,
  getAllGroups,
  getGroupMembers,
} from "../lib/summary";

const scheduleOpts = {
  region: REGION,
  timeZone: DEFAULT_TIMEZONE,
  secrets: [TWILIO_AUTH_TOKEN],
  memory: "256MiB" as const,
};

/** All users that belong to some group. */
async function getActiveUsers(): Promise<User[]> {
  const snap = await db
    .collection(Collections.users)
    .where("groupId", "!=", null)
    .get();
  return snap.docs.map((d) => d.data() as User);
}

// ---- 23:00 reminders -------------------------------------------------------
export const reminders = onSchedule(
  { ...scheduleOpts, schedule: "0 23 * * *" },
  async () => {
    const tz = DEFAULT_TIMEZONE.value();
    const date = today(tz);
    const users = await getActiveUsers();

    await Promise.all(
      users.map(async (u) => {
        if (!u.phoneNumber) return;
        const dsSnap = await db
          .collection(Collections.dailyStatus)
          .doc(dailyStatusId(u.id, date))
          .get();
        const ds = dsSnap.data() as DailyStatus | undefined;
        if (ds?.satisfied) return; // already done today
        await sendSms(
          u.phoneNumber,
          "⏰ Reminder: submit today's problem before midnight."
        );
      })
    );
    logger.info("Reminders processed", { count: users.length, date });
  }
);

// ---- 00:05 midnight rollover ----------------------------------------------
export const midnightRollover = onSchedule(
  { ...scheduleOpts, schedule: "5 0 * * *" },
  async () => {
    const tz = DEFAULT_TIMEZONE.value();
    // The day that just ended.
    const date = addDays(today(tz), -1);

    const users = await getActiveUsers();
    await Promise.all(users.map((u) => resolveUserDay(u, date)));
    logger.info("Midnight rollover resolved", { count: users.length, date });

    // Send per-group result summaries (after all users resolved so totals are
    // final).
    const groups = await getAllGroups();
    await Promise.all(
      groups.map(async (g) => {
        const members = await getGroupMembers(g.id);
        const phones = members.map((m) => m.phoneNumber).filter(Boolean);
        if (phones.length === 0) return;
        const body = await buildDailySummary(g, date);
        await broadcastSms(phones, body);
      })
    );
  }
);

// ---- biweekly summary (gated daily) ---------------------------------------
export const biweeklySummary = onSchedule(
  { ...scheduleOpts, schedule: "0 9 * * *" },
  async () => {
    const tz = DEFAULT_TIMEZONE.value();
    const date = today(tz);
    const groups = await getAllGroups();

    await Promise.all(
      groups.map(async (g) => {
        const metaRef = db
          .collection(Collections.meta)
          .doc(`biweekly_${g.id}`);
        const meta = await metaRef.get();
        const last = (meta.data()?.lastSent as string | undefined) ?? null;

        // Send if we've never sent, or 14+ days have elapsed.
        const due =
          !last ||
          Math.floor(
            (Date.parse(`${date}T00:00:00Z`) -
              Date.parse(`${last}T00:00:00Z`)) /
              86400000
          ) >= 14;
        if (!due) return;

        const members = await getGroupMembers(g.id);
        const phones = members.map((m) => m.phoneNumber).filter(Boolean);
        if (phones.length > 0) {
          const body = await buildBiweeklySummary(g);
          await broadcastSms(phones, body);
        }
        await metaRef.set({ lastSent: date }, { merge: true });
      })
    );
  }
);
