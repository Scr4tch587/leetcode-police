/**
 * Codeforces API client — fetches accepted submissions for a handle.
 * https://codeforces.com/api/user.status?handle=HANDLE
 */
import * as logger from "firebase-functions/logger";

const API_BASE = "https://codeforces.com/api/user.status";

export interface CodeforcesSubmission {
  problemId: string;
  problemName?: string;
  timestamp: number;
}

interface CfProblem {
  contestId?: number;
  index: string;
  name?: string;
}

interface CfSubmission {
  id: number;
  creationTimeSeconds: number;
  verdict?: string;
  problem: CfProblem;
}

interface CfResponse {
  status: string;
  result?: CfSubmission[];
  comment?: string;
}

function problemKey(problem: CfProblem): string {
  const contest = problem.contestId ?? 0;
  return `${contest}${problem.index}`;
}

export async function fetchAcceptedSubmissions(
  handle: string,
  sinceSeconds = 0
): Promise<CodeforcesSubmission[]> {
  const url = `${API_BASE}?handle=${encodeURIComponent(handle)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Codeforces API HTTP ${res.status} for ${handle}`);
  }

  const body = (await res.json()) as CfResponse;
  if (body.status !== "OK") {
    throw new Error(
      `Codeforces API error for ${handle}: ${body.comment ?? body.status}`
    );
  }

  const out: CodeforcesSubmission[] = [];
  for (const row of body.result ?? []) {
    if (row.verdict !== "OK") continue;
    if (row.creationTimeSeconds < sinceSeconds) continue;
    out.push({
      problemId: problemKey(row.problem),
      problemName: row.problem.name,
      timestamp: row.creationTimeSeconds,
    });
  }

  logger.debug("Codeforces submissions fetched", {
    handle,
    accepted: out.length,
  });
  return out;
}

/** Most recent accepted submission for a handle (full history scan). */
export async function fetchLatestAccepted(
  handle: string
): Promise<CodeforcesSubmission | null> {
  const url = `${API_BASE}?handle=${encodeURIComponent(handle)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Codeforces API HTTP ${res.status} for ${handle}`);
  }

  const body = (await res.json()) as CfResponse;
  if (body.status !== "OK") {
    throw new Error(
      `Codeforces API error for ${handle}: ${body.comment ?? body.status}`
    );
  }

  let best: CodeforcesSubmission | null = null;
  for (const row of body.result ?? []) {
    if (row.verdict !== "OK") continue;
    if (!best || row.creationTimeSeconds > best.timestamp) {
      best = {
        problemId: problemKey(row.problem),
        problemName: row.problem.name,
        timestamp: row.creationTimeSeconds,
      };
    }
  }
  return best;
}
