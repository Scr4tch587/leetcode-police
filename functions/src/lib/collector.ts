/**
 * Shared submission polling logic (scheduled job + admin manual trigger).
 */
import * as logger from "firebase-functions/logger";
import { db } from "./admin";
import { DEFAULT_TIMEZONE } from "../config";
import { Collections, Group, Platform, User } from "../types";
import {
  fetchAcceptedSubmissions,
  fetchLatestAccepted,
} from "../codeforcesClient";
import { fetchRecentAccepted } from "../leetcodeScraper";
import { ingestSubmission, submissionExists, updateLastProcessed } from "./submissions";
import { localDateString } from "./dates";

export interface LatestSeen {
  platform: Platform;
  problemId: string;
  problemName?: string;
  timestampSeconds: number;
  /** YYYY-MM-DD in the group's timezone. */
  localDate: string;
  /** Already stored in Firestore (not new this run). */
  alreadyInDb: boolean;
}

export interface CollectResult {
  userId: string;
  displayName: string;
  ingested: number;
  skipped: boolean;
  skipReason?: string;
  latestSeen?: LatestSeen;
}

export interface CollectOptions {
  /** Attach most recent AC from APIs (for admin debug messages). */
  includeLatestSeen?: boolean;
}

async function getGroupTimezone(groupId: string): Promise<string> {
  const snap = await db.collection(Collections.groups).doc(groupId).get();
  return (snap.data() as Group | undefined)?.timezone ?? DEFAULT_TIMEZONE.value();
}

async function resolveLatestSeen(
  user: User,
  timeZone: string
): Promise<LatestSeen | undefined> {
  const candidates: LatestSeen[] = [];

  if (user.codeforcesHandle?.trim()) {
    try {
      const latest = await fetchLatestAccepted(user.codeforcesHandle.trim());
      if (latest) {
        const inDb = await submissionExists(
          user.id,
          "codeforces",
          latest.problemId
        );
        candidates.push({
          platform: "codeforces",
          problemId: latest.problemId,
          problemName: latest.problemName,
          timestampSeconds: latest.timestamp,
          localDate: localDateString(
            new Date(latest.timestamp * 1000),
            timeZone
          ),
          alreadyInDb: inDb,
        });
      }
    } catch (err) {
      logger.error("Codeforces latest-AC peek failed", {
        userId: user.id,
        err,
      });
    }
  }

  if (user.leetcodeUsername?.trim()) {
    try {
      const subs = await fetchRecentAccepted(
        user.leetcodeUsername.trim(),
        0,
        1
      );
      const latest = subs[0];
      if (latest) {
        const inDb = await submissionExists(
          user.id,
          "leetcode",
          latest.problemId
        );
        candidates.push({
          platform: "leetcode",
          problemId: latest.problemId,
          problemName: latest.problemName,
          timestampSeconds: latest.timestamp,
          localDate: localDateString(
            new Date(latest.timestamp * 1000),
            timeZone
          ),
          alreadyInDb: inDb,
        });
      }
    } catch (err) {
      logger.error("LeetCode latest-AC peek failed", {
        userId: user.id,
        err,
      });
    }
  }

  if (candidates.length === 0) return undefined;
  return candidates.reduce((a, b) =>
    a.timestampSeconds >= b.timestampSeconds ? a : b
  );
}

/** Poll Codeforces + LeetCode for one user. */
export async function collectForUser(
  user: User,
  options?: CollectOptions
): Promise<{ ingested: number; latestSeen?: LatestSeen }> {
  if (!user.groupId) return { ingested: 0 };

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

  const latestSeen = options?.includeLatestSeen
    ? await resolveLatestSeen(user, tz)
    : undefined;

  return { ingested, latestSeen };
}

export async function collectForUsers(
  users: User[],
  options?: CollectOptions
): Promise<CollectResult[]> {
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

    const { ingested, latestSeen } = await collectForUser(user, options);
    results.push({
      userId: user.id,
      displayName: user.displayName,
      ingested,
      skipped: false,
      latestSeen,
    });
  }

  return results;
}

/** Human-readable debug line for admin UI messages. */
export function formatLatestSeen(latest?: LatestSeen): string {
  if (!latest) return "Latest AC: none found from APIs.";
  const when = new Date(latest.timestampSeconds * 1000).toISOString();
  const label = latest.problemName
    ? `${latest.problemId} (${latest.problemName})`
    : latest.problemId;
  const status = latest.alreadyInDb ? "already recorded" : "not in DB yet";
  return (
    `Latest AC: ${latest.platform} ${label} on ${latest.localDate} ` +
    `(${when}, ${status})`
  );
}
