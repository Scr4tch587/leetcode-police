import type { DailyStatus } from "../types";

/** Admin void overrides solved for reminders, UI, and game-day resolution. */
export function effectiveSolvedToday(ds: DailyStatus | undefined): boolean {
  if (!ds) return false;
  if (ds.adminVoidToday) return false;
  return ds.solvedToday;
}
