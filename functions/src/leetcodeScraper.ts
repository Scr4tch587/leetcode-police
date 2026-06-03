/**
 * LeetCode unofficial GraphQL client for recent accepted submissions.
 * Uses the same endpoint as the LeetCode web app (no official API).
 */
import * as logger from "firebase-functions/logger";

const GRAPHQL_URL = "https://leetcode.com/graphql";

const RECENT_AC_QUERY = `
  query recentAcSubmissions($username: String!, $limit: Int!) {
    recentAcSubmissionList(username: $username, limit: $limit) {
      id
      title
      titleSlug
      timestamp
    }
  }
`;

export interface LeetCodeSubmission {
  problemId: string;
  problemName?: string;
  timestamp: number;
}

const MIN_INTERVAL_MS = 1200;
let lastRequestAt = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const wait = MIN_INTERVAL_MS - (now - lastRequestAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

async function graphqlRequest<T>(
  username: string,
  limit: number,
  attempt = 1
): Promise<T> {
  await rateLimit();

  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Referer: `https://leetcode.com/${username}/`,
    },
    body: JSON.stringify({
      query: RECENT_AC_QUERY,
      variables: { username, limit },
    }),
  });

  if (!res.ok) {
    if (attempt < 3 && (res.status === 429 || res.status >= 500)) {
      const backoff = attempt * 2000;
      logger.warn("LeetCode GraphQL retry", { status: res.status, attempt });
      await new Promise((r) => setTimeout(r, backoff));
      return graphqlRequest(username, limit, attempt + 1);
    }
    throw new Error(`LeetCode GraphQL HTTP ${res.status}`);
  }

  const json = (await res.json()) as {
    data?: { recentAcSubmissionList?: Array<{
      id: string;
      title: string;
      titleSlug: string;
      timestamp: string;
    }> };
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    throw new Error(
      `LeetCode GraphQL: ${json.errors.map((e) => e.message).join("; ")}`
    );
  }

  return json.data as T;
}

/**
 * Fetch recent accepted submissions for a LeetCode username.
 * @param sinceSeconds Only return submissions at or after this Unix time.
 */
export async function fetchRecentAccepted(
  username: string,
  sinceSeconds = 0,
  limit = 50
): Promise<LeetCodeSubmission[]> {
  const data = await graphqlRequest<{
    recentAcSubmissionList: Array<{
      id: string;
      title: string;
      titleSlug: string;
      timestamp: string;
    }>;
  }>(username, limit);

  const rows = data?.recentAcSubmissionList ?? [];
  const out: LeetCodeSubmission[] = [];

  for (const row of rows) {
    const ts = parseInt(row.timestamp, 10);
    if (!Number.isFinite(ts) || ts < sinceSeconds) continue;
    out.push({
      problemId: row.titleSlug || row.id,
      problemName: row.title,
      timestamp: ts,
    });
  }

  logger.debug("LeetCode submissions fetched", {
    username,
    accepted: out.length,
  });
  return out;
}
