import type { DailyStatus } from "@/types";

/**
 * Solved for the current game day (4 AM cutoff).
 * Needs a submission on this game day, or an active admin grant.
 */
export function effectiveSolvedToday(ds: DailyStatus | undefined): boolean {
  if (!ds) return false;
  if (ds.adminVoidToday) return false;
  if (ds.adminGrantedToday) return true;
  return (ds.submissionCount ?? 0) >= 1;
}
