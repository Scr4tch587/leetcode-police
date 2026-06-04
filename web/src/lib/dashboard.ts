import { effectiveSolvedToday } from "@/lib/dailyStatus";
import type { DailyStatus } from "@/types";

import { gameToday } from "@/lib/gameDay";

/** Current game day (YYYY-MM-DD), rolls at 4:00 AM in `tz`. */
export function localDate(tz: string, offsetDays = 0): string {
  return gameToday(tz, offsetDays);
}

export type DayCell = "solved" | "bank" | "miss" | "none";

export function cellFor(ds: DailyStatus | undefined): DayCell {
  if (!ds) return "none";
  if (effectiveSolvedToday(ds)) return "solved";
  if (ds.bankUsed) return "bank";
  if (ds.penaltyApplied) return "miss";
  return "none";
}

export const CELL_LABEL: Record<DayCell, string> = {
  solved: "Solved",
  bank: "Bank",
  miss: "Miss",
  none: "—",
};
