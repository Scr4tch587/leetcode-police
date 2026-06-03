/**
 * Shared submission polling logic (scheduled job + admin manual trigger).
 */
import * as logger from "firebase-functions/logger";
import { db } from "./admin";
import { DEFAULT_TIMEZONE } from "../config";
import { Collections, Group, User } from "../types";
import { fetchAcceptedSubmissions } from "../codeforcesClient";
import { fetchRecentAccepted } from "../leetcodeScraper";
import { ingestSubmission, updateLastProcessed } from "./submissions";

export interface CollectResult {
  userId: string;
  displayName: string;
  ingested: number;
  skipped: boolean;
  skipReason?: string;
}

async function getGroupTimezone(groupId: string): Promise<string> {
  const snap = await db.collection(Collections.groups).doc(groupId).get();
  return (snap.data() as Group | undefined)?.timezone ?? DEFAULT_TIMEZONE.value();
}

/** Poll Codeforces + LeetCode for one user; return count of newly ingested submissions. */
export async function collectForUser(user: User): Promise<number> {
  if (!user.groupId) return 0;

  const tz = await getGroupTimezone(user.groupId);
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
        const added = await ingestSubmission(
          user,
          {
            platform: "codeforces",
            problemId: s.problemId,
            problemName: s.problemName,
            timestampSeconds: s.timestamp,
          },
          tz
        );
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
        const added = await ingestSubmission(
          user,
          {
            platform: "leetcode",
            problemId: s.problemId,
            problemName: s.problemName,
            timestampSeconds: s.timestamp,
          },
          tz
        );
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

export async function collectForUsers(users: User[]): Promise<CollectResult[]> {
  const results: CollectResult[] = [];

  for (const user of users) {
    if (!user.leetcodeUsername?.trim() && !user.codeforcesHandle?.trim()) {
      results.push({
        userId: user.id,
        displayName: user.displayName,
        ingested: 0,
        skipped: true,
        skipReason: "No LeetCode username or Codeforces handle",
      });
      continue;
    }

    const ingested = await collectForUser(user);
    results.push({
      userId: user.id,
      displayName: user.displayName,
      ingested,
      skipped: false,
    });
  }

  return results;
}
