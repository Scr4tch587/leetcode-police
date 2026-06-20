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
import {
  fetchAcceptedSubmissions as fetchAtcoderAccepted,
  fetchLatestAccepted as fetchAtcoderLatest,
} from "../atcoderClient";
import { fetchSolvedTasks } from "../csesClient";
import { getCsesCredential, recordCsesError } from "./csesCredentials";
import { decryptSecret } from "./csesCrypto";
import { fetchRecentAccepted } from "../leetcodeScraper";
import { liftVoidIfSubmissionsToday } from "./adminDailyStatus";
import { reconcilePendingDays } from "./game";
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
  hasAtcoderHandle?: boolean;
  hasCsesHandle?: boolean;
  /** Most recent AC per configured platform (manual check debug only). */
  latestSeenByPlatform?: LatestSeen[];
  /** CSES login/scrape summary (manual check debug only). */
  csesDebug?: string;
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

  if (user.atcoderHandle?.trim()) {
    try {
      const latest = await fetchAtcoderLatest(user.atcoderHandle.trim());
      if (latest) {
        const inDb = await submissionExists(
          user.id,
          "atcoder",
          latest.problemId
        );
        out.push({
          platform: "atcoder",
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
      logger.error("AtCoder latest-AC peek failed", {
        userId: user.id,
        err,
      });
    }
  }

  // CSES requires a login, which the collector already performs; its debug is
  // reported via CollectResult.csesDebug rather than this read-only peek.

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
  const seenAc = Boolean(
    r.latestSeenByPlatform?.some((x) => x.platform === "atcoder")
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
  if (r.hasAtcoderHandle && !seenAc) {
    lines.push("  atcoder: no accepted submissions found");
  }
  if (r.csesDebug) {
    lines.push(`  ${r.csesDebug}`);
  }

  if (
    !r.hasLeetcodeHandle &&
    !r.hasCodeforcesHandle &&
    !r.hasAtcoderHandle &&
    !r.hasCsesHandle
  ) {
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

/** Poll Codeforces + LeetCode + AtCoder + CSES for one user. */
export async function collectForUser(
  user: User,
  options?: CollectOptions
): Promise<{
  ingested: number;
  latestSeenByPlatform?: LatestSeen[];
  csesDebug?: string;
  lastIngestError?: string;
}> {
  if (!user.groupId) return { ingested: 0 };

  const tz = await getGroupTimezone(user.groupId);
  const sixtyDaysAgo = Math.floor(Date.now() / 1000) - 60 * 86400;
  const cfSince = Math.max(user.lastProcessedTimestamp ?? 0, sixtyDaysAgo);
  let ingested = 0;
  let maxNewTs = 0;
  let lastIngestError: string | undefined;
  let csesDebug: string | undefined;

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

  // AtCoder: scan a fixed recent window, NOT the shared forward cursor.
  // kenkoooo's crawler lags, so a submission can surface in their API with an
  // epoch_second earlier than lastProcessedTimestamp (which advances on any
  // LeetCode/Codeforces solve). Using the cursor would skip those late-indexed
  // solves permanently. Dedup is handled by ingestSubmission's existence check.
  if (user.atcoderHandle?.trim()) {
    try {
      const subs = await fetchAtcoderAccepted(
        user.atcoderHandle.trim(),
        sixtyDaysAgo
      );
      for (const s of subs) {
        try {
          const added = await ingestSubmission(
            user,
            {
              platform: "atcoder",
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
          lastIngestError = `atcoder/${s.problemId}: ${errMessage(err)}`;
          logger.error("Ingest failed", {
            userId: user.id,
            platform: "atcoder",
            problemId: s.problemId,
            error: lastIngestError,
          });
        }
      }
    } catch (err) {
      lastIngestError = `atcoder API: ${errMessage(err)}`;
      logger.error("AtCoder collect failed", {
        userId: user.id,
        handle: user.atcoderHandle,
        error: lastIngestError,
      });
    }
  }

  // CSES: log in with stored (encrypted) credentials and read the user's solved
  // tasks from the problemset list. Each task solved *after* linking (i.e. not in
  // the baseline) is a real accepted submission, stamped at detection time so it
  // counts for the current game day; banking works like any other platform.
  // Dedup is by Firestore doc id + baseline, so CSES never touches the shared
  // forward cursor (we don't advance maxNewTs here).
  if (user.csesLinked) {
    try {
      const cred = await getCsesCredential(user.id);
      if (!cred) {
        csesDebug = "cses: linked but no stored credentials were found.";
      } else {
        const password = decryptSecret(cred.encPassword);
        const solved = await fetchSolvedTasks(cred.username, password);
        const baseline = new Set(cred.baselineTaskIds);
        const nowSeconds = Math.floor(Date.now() / 1000);
        let newCount = 0;
        for (const t of solved) {
          if (baseline.has(t.id)) continue;
          try {
            const added = await ingestSubmission(
              user,
              {
                platform: "cses",
                problemId: t.id,
                problemName: t.name,
                timestampSeconds: nowSeconds,
              },
              tz
            );
            if (added) {
              ingested++;
              newCount++;
            }
          } catch (err) {
            lastIngestError = `cses/${t.id}: ${errMessage(err)}`;
            logger.error("Ingest failed", {
              userId: user.id,
              platform: "cses",
              problemId: t.id,
              error: lastIngestError,
            });
          }
        }
        const sinceLink = solved.filter((t) => !baseline.has(t.id)).length;
        csesDebug =
          `cses: logged in as ${cred.username}; ${solved.length} solved task(s), ` +
          `${sinceLink} since linking, ${newCount} ingested this run.`;
      }
    } catch (err) {
      lastIngestError = `cses login/scrape: ${errMessage(err)}`;
      logger.error("CSES collect failed", {
        userId: user.id,
        error: lastIngestError,
      });
      await recordCsesError(user.id, errMessage(err)).catch(() => undefined);
      csesDebug = `cses: ${errMessage(err)}`;
    }
  }

  if (ingested > 0 && maxNewTs > 0) {
    await updateLastProcessed(user.id, maxNewTs);
  }

  await liftVoidIfSubmissionsToday(user, tz);

  // Backfill banking for historical days left unresolved (e.g. ingest after 4 AM cutoff).
  const reconciled = await reconcilePendingDays(user, tz);
  if (reconciled.length > 0) {
    logger.info("Reconciled pending days after collect", {
      userId: user.id,
      days: reconciled.map((r) => ({
        date: r.date,
        count: r.submissionCount,
        extrasBanked: r.extrasBanked,
      })),
    });
  }

  const latestSeenByPlatform = options?.includeLatestSeen
    ? await resolveLatestSeenPerPlatform(user, tz)
    : undefined;

  return { ingested, latestSeenByPlatform, csesDebug, lastIngestError };
}

export async function collectForUsers(
  users: User[],
  options?: CollectOptions
): Promise<CollectResult[]> {
  const results: CollectResult[] = [];
  const debug = options?.includeLatestSeen === true;

  for (const user of users) {
    if (
      !user.leetcodeUsername?.trim() &&
      !user.codeforcesHandle?.trim() &&
      !user.atcoderHandle?.trim() &&
      !user.csesLinked
    ) {
      const row: CollectResult = {
        userId: user.id,
        displayName: user.displayName,
        ingested: 0,
        skipped: true,
        skipReason: "No LeetCode, Codeforces, AtCoder, or CSES handle",
        hasLeetcodeHandle: false,
        hasCodeforcesHandle: false,
        hasAtcoderHandle: false,
        hasCsesHandle: false,
        latestSeenByPlatform: debug ? [] : undefined,
      };
      if (debug) row.debugMessage = formatUserCheckDebug(row);
      results.push(row);
      continue;
    }

    const { ingested, latestSeenByPlatform, csesDebug, lastIngestError } =
      await collectForUser(user, options);
    const row: CollectResult = {
      userId: user.id,
      displayName: user.displayName,
      ingested,
      skipped: false,
      hasLeetcodeHandle: Boolean(user.leetcodeUsername?.trim()),
      hasCodeforcesHandle: Boolean(user.codeforcesHandle?.trim()),
      hasAtcoderHandle: Boolean(user.atcoderHandle?.trim()),
      hasCsesHandle: Boolean(user.csesLinked),
      latestSeenByPlatform,
      csesDebug: debug ? csesDebug : undefined,
      lastIngestError,
    };
    if (debug) row.debugMessage = formatUserCheckDebug(row);
    results.push(row);
  }

  return results;
}
