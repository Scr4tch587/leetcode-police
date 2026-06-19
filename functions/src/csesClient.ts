/**
 * CSES (cses.fi) activity client.
 *
 * Unlike Codeforces and AtCoder, CSES exposes NO public accepted-submission
 * feed: the problemset/statistics pages require login, and the only public page
 * — the account page `https://cses.fi/user/<id>` — shows just the account's
 * total submission count and its *last submission* time. There is no public
 * per-problem solve list and no per-problem timestamps.
 *
 * So CSES support is an ACTIVITY signal, not an accepted-submission feed: we
 * treat "this account submitted something newer than we last saw" as the day's
 * solve. Caveats vs Codeforces/AtCoder:
 *   - counts ANY submission, including wrong answers (CSES doesn't expose the
 *     verdict on the public page);
 *   - there is no real problem id/name — the collector synthesizes a
 *     one-per-game-day key from the submission time;
 *   - only the single latest submission is visible, so there is no history to
 *     backfill and no way to bank multiple "extra" solves in a day.
 *
 * Users are identified by their numeric CSES account id (the `<id>` in the
 * profile URL), since CSES has no public username -> id lookup.
 */
import * as logger from "firebase-functions/logger";

const USER_PAGE = "https://cses.fi/user";
const MIN_INTERVAL_MS = 1100;

/**
 * CSES renders the account page's timestamps in its server-local timezone
 * (the site is hosted in Finland). We only get a wall-clock string, so we parse
 * it against this zone. If CSES ever switches to UTC, flip this single constant.
 */
const CSES_TIME_ZONE = "Europe/Helsinki";

export interface CsesSubmission {
  /** Placeholder instant key; the collector rewrites this to a per-day key. */
  problemId: string;
  problemName?: string;
  timestamp: number;
}

export interface CsesActivity {
  username?: string;
  submissionCount: number;
  /** Unix seconds of the account's most recent submission. */
  timestamp: number;
}

let lastRequestAt = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const wait = MIN_INTERVAL_MS - (now - lastRequestAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

/** Milliseconds `timeZone` is ahead of UTC at the given instant. */
function tzOffsetMs(epochMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(epochMs));
  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  const asUTC = Date.UTC(
    Number(m.year),
    Number(m.month) - 1,
    Number(m.day),
    m.hour === "24" ? 0 : Number(m.hour),
    Number(m.minute),
    Number(m.second)
  );
  return asUTC - epochMs;
}

/** Convert a CSES wall-clock "YYYY-MM-DD HH:MM:SS" (CSES_TIME_ZONE) to seconds. */
function parseCsesTime(wall: string): number {
  const m = wall.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return 0;
  const [, y, mo, d, h, mi, s] = m;
  const naiveUTC = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s)
  );
  const offset = tzOffsetMs(naiveUTC, CSES_TIME_ZONE);
  return Math.floor((naiveUTC - offset) / 1000);
}

function isNumericId(userId: string): boolean {
  return /^\d+$/.test(userId.trim());
}

/**
 * Read the public account page and extract its latest-submission activity.
 * Returns null when the id is invalid, the page 404s, or the account has never
 * submitted (no "Last submission" row).
 */
export async function fetchActivity(
  userId: string
): Promise<CsesActivity | null> {
  const id = userId.trim();
  if (!isNumericId(id)) {
    throw new Error(`CSES user id "${userId}" is not numeric`);
  }

  await rateLimit();
  const res = await fetch(`${USER_PAGE}/${id}`, {
    headers: { "User-Agent": "leetcode-police/1.0" },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`CSES HTTP ${res.status} for user ${id}`);
  }

  const html = await res.text();
  const lastMatch = html.match(
    /Last submission:<\/td>\s*<td[^>]*>\s*(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/
  );
  if (!lastMatch) return null; // No submissions yet.

  const countMatch = html.match(/Submission count:<\/td>\s*<td[^>]*>\s*(\d+)/);
  const nameMatch = html.match(/<title>CSES - User ([^<]+)<\/title>/);

  const timestamp = parseCsesTime(lastMatch[1]);
  if (timestamp <= 0) return null;

  return {
    username: nameMatch?.[1]?.trim(),
    submissionCount: countMatch ? Number(countMatch[1]) : 0,
    timestamp,
  };
}

/**
 * Mirror of the other clients' `fetchAcceptedSubmissions` shape. Returns at most
 * one synthetic submission (the latest activity) when it is at/after
 * `sinceSeconds`, so the collector's existing per-platform loop can ingest it.
 */
export async function fetchRecentActivity(
  userId: string,
  sinceSeconds = 0
): Promise<CsesSubmission[]> {
  const activity = await fetchActivity(userId);
  if (!activity || activity.timestamp < sinceSeconds) {
    logger.debug("CSES activity fetched", { userId, found: 0 });
    return [];
  }
  logger.debug("CSES activity fetched", {
    userId,
    timestamp: activity.timestamp,
    submissionCount: activity.submissionCount,
  });
  return [
    {
      problemId: String(activity.timestamp),
      problemName: "CSES activity",
      timestamp: activity.timestamp,
    },
  ];
}

/** Most recent activity as a single synthetic submission (manual-check peek). */
export async function fetchLatestActivity(
  userId: string
): Promise<CsesSubmission | null> {
  const subs = await fetchRecentActivity(userId, 0);
  return subs[0] ?? null;
}
