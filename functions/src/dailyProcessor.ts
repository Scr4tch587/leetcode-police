/**
 * Midnight job — resolve the previous calendar day (bank / penalty / extras).
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { db } from "./lib/admin";
import { REGION, DEFAULT_TIMEZONE } from "./config";
import { Collections, Group, User } from "./types";
import { addDays, today } from "./lib/dates";
import { resolveUserDay } from "./lib/game";

const scheduleOpts = {
  region: REGION,
  timeZone: DEFAULT_TIMEZONE,
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
  { ...scheduleOpts, schedule: "5 0 * * *" },
  async () => {
    const tz = DEFAULT_TIMEZONE.value();
    const date = addDays(today(tz), -1);
    const users = await getActiveUsers();

    const outcomes = await Promise.all(
      users.map(async (u) => {
        const gtz = u.groupId
          ? await getGroupTimezone(u.groupId)
          : tz;
        return resolveUserDay(u, date, gtz);
      })
    );

    logger.info("Daily processor finished", {
      date,
      users: users.length,
      solved: outcomes.filter((o) => o.status === "solved").length,
      bankUsed: outcomes.filter((o) => o.status === "bankUsed").length,
      penalty: outcomes.filter((o) => o.status === "penalty").length,
    });
  }
);
