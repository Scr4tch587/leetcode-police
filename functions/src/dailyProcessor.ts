/**
 * After each group's 4 AM cutoff — resolve the previous game day (bank / penalty / extras).
 * Runs hourly (UTC); only processes groups in their local 4:00 hour.
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { db } from "./lib/admin";
import { REGION, DEFAULT_TIMEZONE } from "./config";
import { Collections, Group, User } from "./types";
import { gameDayJustClosed } from "./lib/dates";
import { resolveUserDay } from "./lib/game";

const scheduleOpts = {
  region: REGION,
  /** Cron is UTC; per-group timezone checked in code. */
  timeZone: "UTC",
  memory: "256MiB" as const,
};

async function getActiveUsers(): Promise<User[]> {
  const snap = await db
    .collection(Collections.users)
    .where("groupId", "!=", null)
    .get();
  return snap.docs.map((d) => d.data() as User);
}

async function getGroupTimezone(groupId: string): Promise<string> {
  const snap = await db.collection(Collections.groups).doc(groupId).get();
  return (snap.data() as Group | undefined)?.timezone ?? DEFAULT_TIMEZONE.value();
}

export const dailyProcessor = onSchedule(
  { ...scheduleOpts, schedule: "5 * * * *" },
  async () => {
    const now = new Date();
    const users = await getActiveUsers();

    const outcomes = await Promise.all(
      users.map(async (u) => {
        if (!u.groupId) {
          return { userId: u.id, status: "skipped" as const };
        }
        const gtz = await getGroupTimezone(u.groupId);
        const date = gameDayJustClosed(gtz, now);
        if (!date) {
          return { userId: u.id, status: "skipped" as const };
        }
        return resolveUserDay(u, date, gtz);
      })
    );

    const processed = outcomes.filter((o) => o.status !== "skipped");

    logger.info("Daily processor finished", {
      users: users.length,
      processed: processed.length,
      solved: processed.filter((o) => o.status === "solved").length,
      bankUsed: processed.filter((o) => o.status === "bankUsed").length,
      penalty: processed.filter((o) => o.status === "penalty").length,
    });
  }
);
