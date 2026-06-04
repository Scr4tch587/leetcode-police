import type { DailyStatus } from "../types";

/**
 * Live "solved" for the current game day (4 AM cutoff).
 * Requires a submission counted on this game day, or an active admin grant.
 * Submissions before 4 AM belong to the previous game day and do not count here.
 */
export function effectiveSolvedToday(ds: DailyStatus | undefined): boolean {
  if (!ds) return false;
  if (ds.adminVoidToday) return false;
  if (ds.adminGrantedToday) return true;
  return (ds.submissionCount ?? 0) >= 1;
}
