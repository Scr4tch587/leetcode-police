import type { DailyStatus } from "@/types";

export function effectiveSolvedToday(ds: DailyStatus | undefined): boolean {
  if (!ds) return false;
  if (ds.adminVoidToday) return false;
  return ds.solvedToday;
}
