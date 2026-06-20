/**
 * CSES (cses.fi) authenticated client.
 *
 * CSES exposes NO public accepted-submission feed, so to track accurately we log
 * in as the user (with their stored, encrypted credentials) and read the
 * server-rendered problemset list, which marks each task with the logged-in
 * user's score. A task whose score icon is "full" is solved/accepted.
 *
 * Login flow:
 *   1. GET  /login          -> sets a PHPSESSID cookie + a session-bound
 *                              csrf_token hidden field.
 *   2. POST /login          -> form fields csrf_token, nick (username), pass.
 *      The session cookie becomes authenticated.
 *
 * We identify accepted *tasks* (not individual submissions), so the collector
 * attributes a newly-appearing solved task to the time we detect it. CSES does
 * not give us a reliable per-task accept timestamp without scraping each task
 * page, and a ~30-minute poll attributes the game day correctly anyway.
 */
import * as logger from "firebase-functions/logger";

const BASE = "https://cses.fi";
const LOGIN_URL = `${BASE}/login`;
const LIST_URL = `${BASE}/problemset/list/`;
const MIN_INTERVAL_MS = 1100;
const UA = "leetcode-police/1.0";

export interface CsesTask {
  /** CSES task id, e.g. "1068". */
  id: string;
  /** Task name, e.g. "Weird Algorithm". */
  name?: string;
}

let lastRequestAt = 0;
async function rateLimit(): Promise<void> {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

/** Pull cookie name=value pairs out of a response's Set-Cookie headers. */
function readCookies(res: Response): Record<string, string> {
  const out: Record<string, string> = {};
  // undici exposes getSetCookie(); fall back to the combined header.
  const raw: string[] =
    typeof (res.headers as { getSetCookie?: () => string[] }).getSetCookie ===
    "function"
      ? (res.headers as { getSetCookie: () => string[] }).getSetCookie()
      : res.headers.get("set-cookie")
        ? [res.headers.get("set-cookie") as string]
        : [];
  for (const line of raw) {
    const m = line.match(/^\s*([^=]+)=([^;]*)/);
    if (m) out[m[1].trim()] = m[2].trim();
  }
  return out;
}

function cookieHeader(jar: Record<string, string>): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

/**
 * Log in to CSES and return the authenticated cookie header string.
 * Throws on bad credentials or unexpected responses.
 */
export async function csesLogin(
  username: string,
  password: string
): Promise<string> {
  await rateLimit();
  const formRes = await fetch(LOGIN_URL, { headers: { "User-Agent": UA } });
  if (!formRes.ok) {
    throw new Error(`CSES login page HTTP ${formRes.status}`);
  }
  const jar = readCookies(formRes);
  const formHtml = await formRes.text();
  const csrf = formHtml.match(
    /name="csrf_token"\s+value="([0-9a-f]+)"/
  )?.[1];
  if (!csrf) throw new Error("CSES login: csrf_token not found.");
  if (!jar.PHPSESSID) throw new Error("CSES login: session cookie not set.");

  const body = new URLSearchParams({
    csrf_token: csrf,
    nick: username,
    pass: password,
  }).toString();

  await rateLimit();
  const postRes = await fetch(LOGIN_URL, {
    method: "POST",
    redirect: "manual",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader(jar),
    },
    body,
  });
  // Merge any rotated session cookie from the POST response.
  Object.assign(jar, readCookies(postRes));

  // A successful login redirects (3xx); a failed one re-renders the form (200).
  if (postRes.status === 200) {
    const html = await postRes.text();
    if (!/\/logout/.test(html)) {
      throw new Error("CSES login failed — check the username and password.");
    }
  }

  // Confirm authentication on a real page (header shows a logout link).
  await rateLimit();
  const check = await fetch(LIST_URL, {
    headers: { "User-Agent": UA, Cookie: cookieHeader(jar) },
  });
  const checkHtml = await check.text();
  if (!/\/logout/.test(checkHtml)) {
    throw new Error("CSES login failed — check the username and password.");
  }
  return cookieHeader(jar);
}

/**
 * Parse the problemset list HTML into the set of solved (full-score) tasks.
 * Each task block looks like:
 *   <li class="task"><a href="/problemset/task/1068">Weird Algorithm</a>
 *     <span class="detail">.../...</span> <span class="task-score icon full">
 */
export function parseSolvedTasks(html: string): CsesTask[] {
  const tasks: CsesTask[] = [];
  const statusSeen: Record<string, number> = {};
  const blocks = html.split('<li class="task">');
  for (let i = 1; i < blocks.length; i++) {
    const chunk = blocks[i];
    const link = chunk.match(/<a href="\/problemset\/task\/(\d+)">([^<]*)<\/a>/);
    if (!link) continue;
    const score = chunk.match(/<span class="task-score icon ([^"]*)">/);
    const status = (score?.[1] ?? "").trim();
    statusSeen[status || "(none)"] = (statusSeen[status || "(none)"] ?? 0) + 1;
    if (status.split(/\s+/).includes("full")) {
      tasks.push({ id: link[1], name: link[2].trim() || undefined });
    }
  }
  logger.debug("CSES task-score statuses parsed", statusSeen);
  return tasks;
}

/** Log in and return the user's currently-solved tasks. */
export async function fetchSolvedTasks(
  username: string,
  password: string
): Promise<CsesTask[]> {
  const cookie = await csesLogin(username, password);
  await rateLimit();
  const res = await fetch(LIST_URL, {
    headers: { "User-Agent": UA, Cookie: cookie },
  });
  if (!res.ok) throw new Error(`CSES problemset HTTP ${res.status}`);
  const tasks = parseSolvedTasks(await res.text());
  logger.debug("CSES solved tasks fetched", {
    username,
    solved: tasks.length,
  });
  return tasks;
}
