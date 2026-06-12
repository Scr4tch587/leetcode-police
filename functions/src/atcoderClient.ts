/**
 * AtCoder submissions client.
 *
 * AtCoder has no official public submissions API, so we use the de-facto
 * standard third-party API from AtCoder Problems (kenkoooo):
 *   https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=USER&from_second=UNIX
 * It returns up to 500 submissions at/after from_second in ascending order, so
 * we paginate forward until a short page. Maintainer asks for ≥1s between hits.
 */
import * as logger from "firebase-functions/logger";

const API_BASE =
  "https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions";
const PAGE_SIZE = 500;
const MIN_INTERVAL_MS = 1100;

export interface AtcoderSubmission {
  problemId: string;
  problemName?: string;
  timestamp: number;
}

interface AcApiSubmission {
  id: number;
  epoch_second: number;
  problem_id: string;
  contest_id?: string;
  user_id?: string;
  result?: string;
}

let lastRequestAt = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const wait = MIN_INTERVAL_MS - (now - lastRequestAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

async function fetchPage(
  handle: string,
  fromSecond: number
): Promise<AcApiSubmission[]> {
  await rateLimit();
  const url = `${API_BASE}?user=${encodeURIComponent(
    handle
  )}&from_second=${Math.max(0, Math.floor(fromSecond))}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "leetcode-police/1.0" },
  });
  if (!res.ok) {
    throw new Error(`AtCoder API HTTP ${res.status} for ${handle}`);
  }
  return (await res.json()) as AcApiSubmission[];
}

/**
 * Fetch accepted submissions for a handle at/after `sinceSeconds`, ascending.
 * Paginates forward through the 500-row window so very active users aren't
 * truncated.
 */
export async function fetchAcceptedSubmissions(
  handle: string,
  sinceSeconds = 0
): Promise<AtcoderSubmission[]> {
  const out: AtcoderSubmission[] = [];
  let cursor = sinceSeconds;

  // Guard against pathological loops while still allowing deep history scans.
  for (let page = 0; page < 50; page++) {
    const rows = await fetchPage(handle, cursor);
    if (rows.length === 0) break;

    for (const row of rows) {
      if (row.result === "AC" && row.epoch_second >= sinceSeconds) {
        out.push({
          problemId: row.problem_id,
          timestamp: row.epoch_second,
        });
      }
    }

    if (rows.length < PAGE_SIZE) break;
    // Advance past the last row of this page (rows are ascending by time).
    const lastSecond = rows[rows.length - 1].epoch_second;
    cursor = lastSecond + 1;
  }

  logger.debug("AtCoder submissions fetched", {
    handle,
    accepted: out.length,
  });
  return out;
}

/**
 * Most recent accepted submission for a handle. Scans the last ~60 days, which
 * is all the manual-check "latest AC" peek cares about.
 */
export async function fetchLatestAccepted(
  handle: string
): Promise<AtcoderSubmission | null> {
  const sixtyDaysAgo = Math.floor(Date.now() / 1000) - 60 * 86400;
  const subs = await fetchAcceptedSubmissions(handle, sixtyDaysAgo);

  let best: AtcoderSubmission | null = null;
  for (const s of subs) {
    if (!best || s.timestamp > best.timestamp) best = s;
  }
  return best;
}
