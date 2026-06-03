/**
 * Daily summary (after midnight processing) and biweekly punishment day.
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { db } from "./lib/admin";
import { REGION, DEFAULT_TIMEZONE, TWILIO_AUTH_TOKEN } from "./config";
import { Collections } from "./types";
import { addDays, today } from "./lib/dates";
import { broadcastSms } from "./lib/twilio";
import {
  buildDailySummary,
  getAllGroups,
  getGroupMembers,
} from "./lib/summary";
import {
  buildPunishmentDayAdminSms,
  isBiweeklyDue,
  lastBiweeklyResetDate,
  runBiweeklyPunishment,
} from "./lib/biweeklyPunishment";

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

/** 9 AM daily — every 14 days: SMS admin with word tallies, then reset counts. */
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
        const metaLast = (meta.data()?.lastSent as string | undefined) ?? null;

        if (!isBiweeklyDue(g, metaLast, date)) return;

        const members = await getGroupMembers(g.id);
        const admins = members.filter((m) => m.isAdmin && m.phoneNumber);
        if (admins.length > 0) {
          const body = buildPunishmentDayAdminSms(g, members);
          await broadcastSms(
            admins.map((a) => a.phoneNumber),
            body
          );
        } else {
          logger.warn("Biweekly punishment: no admin phone on file", {
            groupId: g.id,
            lastReset: lastBiweeklyResetDate(g, metaLast),
          });
        }

        await runBiweeklyPunishment(g, date);
      })
    );

    logger.info("Biweekly punishment check finished", { date });
  }
);
