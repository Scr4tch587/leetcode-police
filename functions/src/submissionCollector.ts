/**
 * Scheduled job: poll Codeforces + LeetCode for new accepted submissions.
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { db } from "./lib/admin";
import { REGION, DEFAULT_TIMEZONE, CSES_ENC_KEY } from "./config";
import { Collections, User } from "./types";
import { collectForUsers } from "./lib/collector";

const scheduleOpts = {
  region: REGION,
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
  { ...scheduleOpts, schedule: "every 30 minutes" },
  async () => {
    const users = await getActiveUsers();
    const results = await collectForUsers(users);
    const ingested = results.reduce((s, r) => s + r.ingested, 0);

    logger.info("Submission collector finished", {
      users: users.length,
      ingested,
    });
  }
);
