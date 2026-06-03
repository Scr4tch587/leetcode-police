/**
 * Scheduled job: poll Codeforces + LeetCode for new accepted submissions.
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { db } from "./lib/admin";
import { REGION, DEFAULT_TIMEZONE } from "./config";
import { Collections, Group, User } from "./types";
import { fetchAcceptedSubmissions } from "./codeforcesClient";
import { fetchRecentAccepted } from "./leetcodeScraper";
import {
  ingestSubmission,
  updateLastProcessed,
} from "./lib/submissions";

const scheduleOpts = {
  region: REGION,
  timeZone: DEFAULT_TIMEZONE,
  memory: "512MiB" as const,
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

async function collectForUser(user: User): Promise<number> {
  if (!user.groupId) return 0;

  const tz = await getGroupTimezone(user.groupId);
  // On first sync, only look back 60 days to avoid ingesting entire history.
  const sixtyDaysAgo = Math.floor(Date.now() / 1000) - 60 * 86400;
  const since = Math.max(user.lastProcessedTimestamp ?? 0, sixtyDaysAgo);
  let ingested = 0;
  let maxTs = since;

  if (user.codeforcesHandle?.trim()) {
    try {
      const subs = await fetchAcceptedSubmissions(
        user.codeforcesHandle.trim(),
        since
      );
      for (const s of subs) {
        const added = await ingestSubmission(user, {
          platform: "codeforces",
          problemId: s.problemId,
          problemName: s.problemName,
          timestampSeconds: s.timestamp,
        }, tz);
        if (added) ingested++;
        maxTs = Math.max(maxTs, s.timestamp);
      }
    } catch (err) {
      logger.error("Codeforces collect failed", {
        userId: user.id,
        handle: user.codeforcesHandle,
        err,
      });
    }
  }

  if (user.leetcodeUsername?.trim()) {
    try {
      const subs = await fetchRecentAccepted(
        user.leetcodeUsername.trim(),
        since
      );
      for (const s of subs) {
        const added = await ingestSubmission(user, {
          platform: "leetcode",
          problemId: s.problemId,
          problemName: s.problemName,
          timestampSeconds: s.timestamp,
        }, tz);
        if (added) ingested++;
        maxTs = Math.max(maxTs, s.timestamp);
      }
    } catch (err) {
      logger.error("LeetCode collect failed", {
        userId: user.id,
        username: user.leetcodeUsername,
        err,
      });
    }
  }

  if (maxTs > since) {
    await updateLastProcessed(user.id, maxTs);
  }

  return ingested;
}

/** Every 30 minutes — ingest new accepted submissions for all group members. */
export const submissionCollector = onSchedule(
  { ...scheduleOpts, schedule: "every 30 minutes" },
  async () => {
    const users = await getActiveUsers();
    let total = 0;

    for (const user of users) {
      if (!user.leetcodeUsername?.trim() && !user.codeforcesHandle?.trim()) {
        continue;
      }
      total += await collectForUser(user);
    }

    logger.info("Submission collector finished", {
      users: users.length,
      ingested: total,
    });
  }
);
