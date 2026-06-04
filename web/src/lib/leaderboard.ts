import { localDateKey } from "@/lib/format";
import { userScore } from "@/lib/userScore";
import { effectiveSolvedToday } from "@/lib/dailyStatus";
import type { DailyStatus, Submission, User } from "@/types";

export type MemberRow = User & {
  todayStatus?: DailyStatus;
  solveTimeMs: number;
  solvedToday: boolean;
  /** Earliest accepted submission today (race time), if any. */
  todaySolve: Submission | null;
};

/** Earliest submission timestamp today (group TZ), or +∞ if none. */
export function solveTimeTodayMs(
  userId: string,
  todayStr: string,
  timeZone: string,
  submissions: Submission[]
): number {
  let min = Number.POSITIVE_INFINITY;
  for (const s of submissions) {
    if (s.userId !== userId) continue;
    if (localDateKey(s.timestamp, timeZone) !== todayStr) continue;
    const ms = s.timestamp?.toDate?.()?.getTime();
    if (ms != null && ms < min) min = ms;
  }
  return min;
}

/** First submission accepted today for a user. */
export function firstSubmissionToday(
  userId: string,
  todayStr: string,
  timeZone: string,
  submissions: Submission[]
): Submission | null {
  let best: Submission | null = null;
  let bestMs = Number.POSITIVE_INFINITY;
  for (const s of submissions) {
    if (s.userId !== userId) continue;
    if (localDateKey(s.timestamp, timeZone) !== todayStr) continue;
    const ms = s.timestamp?.toDate?.()?.getTime();
    if (ms == null || ms >= bestMs) continue;
    bestMs = ms;
    best = s;
  }
  return best;
}

export function buildMemberRows(
  members: User[],
  todayStr: string,
  timeZone: string,
  todayStatus: Map<string, DailyStatus>,
  submissions: Submission[]
): MemberRow[] {
  return members.map((m) => {
    const ds = todayStatus.get(`${m.id}_${todayStr}`);
    const solvedToday = effectiveSolvedToday(ds);
    const todaySolve = firstSubmissionToday(
      m.id,
      todayStr,
      timeZone,
      submissions
    );
    const solveMsFromSub = todaySolve?.timestamp?.toDate?.()?.getTime();
    const solveTimeMs =
      solveMsFromSub != null
        ? solveMsFromSub
        : solvedToday
          ? solveTimeTodayMs(m.id, todayStr, timeZone, submissions)
          : Number.POSITIVE_INFINITY;
    return {
      ...m,
      todayStatus: ds,
      solveTimeMs,
      solvedToday,
      todaySolve,
    };
  });
}

/** Two-week cycle: lowest score → highest bank. */
export function sortCycleLeaderboard(rows: MemberRow[]): MemberRow[] {
  return [...rows].sort((a, b) => {
    const scoreDiff = userScore(a) - userScore(b);
    if (scoreDiff !== 0) return scoreDiff;
    return b.bankedProblems - a.bankedProblems;
  });
}

/** Today: earliest solve first; unsolved last. */
export function sortDailyLeaderboard(rows: MemberRow[]): MemberRow[] {
  return [...rows].sort((a, b) => {
    if (a.solvedToday !== b.solvedToday) return a.solvedToday ? -1 : 1;
    return a.solveTimeMs - b.solveTimeMs;
  });
}

export function formatSolveTime(
  solveTimeMs: number,
  timeZone: string
): string {
  if (!Number.isFinite(solveTimeMs)) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(solveTimeMs));
}

/** Time shown in today's race (from submission when available). */
export function raceSolveTimeLabel(
  member: MemberRow,
  timeZone: string
): string | null {
  const ms =
    member.todaySolve?.timestamp?.toDate?.()?.getTime() ??
    (Number.isFinite(member.solveTimeMs) ? member.solveTimeMs : null);
  if (ms == null) return null;
  return formatSolveTime(ms, timeZone);
}
