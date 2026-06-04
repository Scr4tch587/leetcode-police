import { msUntilNextGameDayCutoff } from "@/lib/gameDay";

/** Ms until the next 4:00 AM game-day cutoff (not calendar midnight). */
export function msUntilNextGameDayCutoffMs(
  timeZone: string,
  now = Date.now()
): number {
  return msUntilNextGameDayCutoff(timeZone, now);
}

/** @deprecated Alias — counts down to 4 AM, not midnight. */
export function msUntilEndOfCalendarDay(
  timeZone: string,
  now = Date.now()
): number {
  return msUntilNextGameDayCutoffMs(timeZone, now);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** HH:MM:SS */
export function formatDeathTimer(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

export function formatSoftCountdown(ms: number): string {
  if (ms <= 0) return "0s";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
