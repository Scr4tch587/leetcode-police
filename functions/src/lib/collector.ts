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
  hasLeetcodeHandle?: boolean;
  hasCodeforcesHandle?: boolean;
  /** Most recent AC per configured platform (manual check debug only). */
  latestSeenByPlatform?: LatestSeen[];
  /** Last ingest error this run (manual debugging). */
  lastIngestError?: string;
  /** Set on manual checks — full per-user debug text. */
  debugMessage?: string;
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export interface CollectOptions {
  /** Peek latest AC per platform; build debugMessage (manual admin checks only). */
  includeLatestSeen?: boolean;
}

async function getGroupTimezone(groupId: string): Promise<string> {
  const snap = await db.collection(Collections.groups).doc(groupId).get();
  return (snap.data() as Group | undefined)?.timezone ?? DEFAULT_TIMEZONE.value();
}

/** Latest accepted submission per platform that has a handle configured. */
async function resolveLatestSeenPerPlatform(
  user: User,
  timeZone: string
): Promise<LatestSeen[]> {
  const out: LatestSeen[] = [];

  if (user.codeforcesHandle?.trim()) {
    try {
      const latest = await fetchLatestAccepted(user.codeforcesHandle.trim());
      if (latest) {
        const inDb = await submissionExists(
          user.id,
          "codeforces",
          latest.problemId
        );
        out.push({
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
        out.push({
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

  return out.sort((a, b) => a.platform.localeCompare(b.platform));
}

function formatOneLatest(ls: LatestSeen): string {
  const when = new Date(ls.timestampSeconds * 1000).toISOString();
  const label = ls.problemName
    ? `${ls.problemId} (${ls.problemName})`
    : ls.problemId;
  const status = ls.alreadyInDb
    ? "in database"
    : "not in database (was not written this run)";
  return (
    `${ls.platform}: ${label} on ${ls.localDate} (${when}, ${status})`
  );
}

/** Per-user debug block for manual admin checks. */
export function formatUserCheckDebug(r: CollectResult): string {
  const lines: string[] = [];

  if (r.skipped) {
    lines.push(`${r.displayName}: skipped — ${r.skipReason ?? "unknown"}.`);
    lines.push("  Latest AC: n/a (no platform handles).");
    return lines.join("\n");
  }

  lines.push(
    `${r.displayName}: ${r.ingested} new problem(s) written to Firestore this run.`
  );

  const seenLc = Boolean(
    r.latestSeenByPlatform?.some((x) => x.platform === "leetcode")
  );
  const seenCf = Boolean(
    r.latestSeenByPlatform?.some((x) => x.platform === "codeforces")
  );

  if (r.latestSeenByPlatform?.length) {
    for (const ls of r.latestSeenByPlatform) {
      lines.push(`  ${formatOneLatest(ls)}`);
    }
  }

  if (r.hasLeetcodeHandle && !seenLc) {
    lines.push("  leetcode: no accepted submissions found");
  }
  if (r.hasCodeforcesHandle && !seenCf) {
    lines.push("  codeforces: no accepted submissions found");
  }

  if (!r.hasLeetcodeHandle && !r.hasCodeforcesHandle) {
    lines.push("  Latest AC: none found from APIs.");
  }

  if (r.lastIngestError) {
    lines.push(`  ⚠️ Ingest error: ${r.lastIngestError}`);
  }

  return lines.join("\n");
}

/** Full manual group-check message — one block per member. */
export function formatGroupCheckDebug(
  results: CollectResult[],
  totalIngested: number
): string {
  return [
    `Manual check — ${totalIngested} new problem(s) written across ${results.length} member(s).`,
    "",
    ...results.map((r) => r.debugMessage ?? formatUserCheckDebug(r)),
  ].join("\n");
}

/** Poll Codeforces + LeetCode for one user. */
export async function collectForUser(
  user: User,
  options?: CollectOptions
): Promise<{
  ingested: number;
  latestSeenByPlatform?: LatestSeen[];
  lastIngestError?: string;
}> {
  if (!user.groupId) return { ingested: 0 };

  const tz = await getGroupTimezone(user.groupId);
  const sixtyDaysAgo = Math.floor(Date.now() / 1000) - 60 * 86400;
  const cfSince = Math.max(user.lastProcessedTimestamp ?? 0, sixtyDaysAgo);
  let ingested = 0;
  let maxNewTs = 0;
  let lastIngestError: string | undefined;

  if (user.codeforcesHandle?.trim()) {
    try {
      const subs = await fetchAcceptedSubmissions(
        user.codeforcesHandle.trim(),
        cfSince
      );
      for (const s of subs) {
        try {
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
          if (added) {
            ingested++;
            maxNewTs = Math.max(maxNewTs, s.timestamp);
          }
        } catch (err) {
          lastIngestError = `codeforces/${s.problemId}: ${errMessage(err)}`;
          logger.error("Ingest failed", {
            userId: user.id,
            platform: "codeforces",
            problemId: s.problemId,
            error: lastIngestError,
          });
        }
      }
    } catch (err) {
      lastIngestError = `codeforces API: ${errMessage(err)}`;
      logger.error("Codeforces collect failed", {
        userId: user.id,
        handle: user.codeforcesHandle,
        error: lastIngestError,
      });
    }
  }

  // LeetCode: always scan recent AC list; dedupe via Firestore doc id only.
  if (user.leetcodeUsername?.trim()) {
    try {
      const subs = await fetchRecentAccepted(
        user.leetcodeUsername.trim(),
        0,
        50
      );
      for (const s of subs) {
        try {
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
          if (added) {
            ingested++;
            maxNewTs = Math.max(maxNewTs, s.timestamp);
          }
        } catch (err) {
          lastIngestError = `leetcode/${s.problemId}: ${errMessage(err)}`;
          logger.error("Ingest failed", {
            userId: user.id,
            platform: "leetcode",
            problemId: s.problemId,
            error: lastIngestError,
          });
        }
      }
    } catch (err) {
      lastIngestError = `leetcode API: ${errMessage(err)}`;
      logger.error("LeetCode collect failed", {
        userId: user.id,
        username: user.leetcodeUsername,
        error: lastIngestError,
      });
    }
  }

  if (ingested > 0 && maxNewTs > 0) {
    await updateLastProcessed(user.id, maxNewTs);
  }

  const latestSeenByPlatform = options?.includeLatestSeen
    ? await resolveLatestSeenPerPlatform(user, tz)
    : undefined;

  return { ingested, latestSeenByPlatform, lastIngestError };
}

export async function collectForUsers(
  users: User[],
  options?: CollectOptions
): Promise<CollectResult[]> {
  const results: CollectResult[] = [];
  const debug = options?.includeLatestSeen === true;

  for (const user of users) {
    if (!user.leetcodeUsername?.trim() && !user.codeforcesHandle?.trim()) {
      const row: CollectResult = {
        userId: user.id,
        displayName: user.displayName,
        ingested: 0,
        skipped: true,
        skipReason: "No LeetCode username or Codeforces handle",
        hasLeetcodeHandle: false,
        hasCodeforcesHandle: false,
        latestSeenByPlatform: debug ? [] : undefined,
      };
      if (debug) row.debugMessage = formatUserCheckDebug(row);
      results.push(row);
      continue;
    }

    const { ingested, latestSeenByPlatform, lastIngestError } =
      await collectForUser(user, options);
    const row: CollectResult = {
      userId: user.id,
      displayName: user.displayName,
      ingested,
      skipped: false,
      hasLeetcodeHandle: Boolean(user.leetcodeUsername?.trim()),
      hasCodeforcesHandle: Boolean(user.codeforcesHandle?.trim()),
      latestSeenByPlatform,
      lastIngestError,
    };
    if (debug) row.debugMessage = formatUserCheckDebug(row);
    results.push(row);
  }

  return results;
}
