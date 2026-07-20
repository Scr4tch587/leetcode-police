/**
 * Scheduled job: poll Codeforces + LeetCode for new accepted submissions.
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { db } from "./lib/admin";
import { SCHEDULE_REGION, DEFAULT_TIMEZONE, CSES_ENC_KEY } from "./config";
import { Collections, User } from "./types";
import { collectForUsers } from "./lib/collector";
import { localTime } from "./lib/dates";

const scheduleOpts = {
  region: SCHEDULE_REGION,
  timeZone: DEFAULT_TIMEZONE,
  memory: "512MiB" as const,
  // Needed to decrypt stored CSES passwords during collection.
  secrets: [CSES_ENC_KEY],
};

async function getActiveUsers(): Promise<User[]> {
  const snap = await db
    .collection(Collections.users)
    .where("groupId", "!=", null)
    .get();
  return snap.docs.map((d) => d.data() as User);
}

export const submissionCollector = onSchedule(
  // Explicit cron so ticks land on :00/:30 (in scheduleOpts.timeZone).
  { ...scheduleOpts, schedule: "*/30 * * * *" },
  async () => {
    // Half-hourly only overnight (21:00–4:59 local — the solve rush plus the
    // 4 AM cutoff); during the day the :30 tick is skipped, i.e. hourly polls.
    const { hour, minute } = localTime(DEFAULT_TIMEZONE.value());
    const overnight = hour >= 21 || hour < 5;
    if (!overnight && minute >= 15 && minute < 45) {
      return;
    }

    const users = await getActiveUsers();
    const results = await collectForUsers(users);
    const ingested = results.reduce((s, r) => s + r.ingested, 0);

    logger.info("Submission collector finished", {
      users: users.length,
      ingested,
    });
  }
);
