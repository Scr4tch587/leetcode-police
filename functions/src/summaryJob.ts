/**
 * Daily summary (after midnight processing) and optional biweekly leaderboard SMS.
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { db } from "./lib/admin";
import { REGION, DEFAULT_TIMEZONE, TWILIO_AUTH_TOKEN } from "./config";
import { Collections } from "./types";
import { addDays, today } from "./lib/dates";
import { broadcastSms } from "./lib/twilio";
import {
  buildBiweeklySummary,
  buildDailySummary,
  getAllGroups,
  getGroupMembers,
} from "./lib/summary";

const scheduleOpts = {
  region: REGION,
  timeZone: DEFAULT_TIMEZONE,
  secrets: [TWILIO_AUTH_TOKEN],
  memory: "256MiB" as const,
};

/** 12:10 AM — send yesterday's results after dailyProcessor (00:05). */
export const dailySummaryJob = onSchedule(
  { ...scheduleOpts, schedule: "10 0 * * *" },
  async () => {
    const tz = DEFAULT_TIMEZONE.value();
    const date = addDays(today(tz), -1);
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

    logger.info("Daily summary sent", { date, groups: groups.length });
  }
);

/** 9 AM daily — biweekly leaderboard when 14+ days since last send. */
export const biweeklySummaryJob = onSchedule(
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

    logger.info("Biweekly summary check finished", { date });
  }
);
