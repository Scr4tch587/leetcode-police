/**
 * Timezone-aware game-day helpers.
 * A "day" runs from 4:00 AM to 4:00 AM in the group's timezone (not midnight).
 */

/** Hour (0–23) when a new game day starts in local time. */
export const GAME_DAY_CUTOFF_HOUR = 4;

function localParts(
  date: Date,
  timeZone: string
): { hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const hourRaw = get("hour");
  const hour = hourRaw === 24 ? 0 : hourRaw % 24;
  return { hour, minute: get("minute"), second: get("second") };
}

/** True during the 4:00 local hour — when the previous game day should close. */
export function isGameDayCloseHour(timeZone: string, now = new Date()): boolean {
  return localParts(now, timeZone).hour === GAME_DAY_CUTOFF_HOUR;
}

/** Local wall-clock hour and minute in `timeZone`. */
export function localTime(
  timeZone: string,
  now = new Date()
): { hour: number; minute: number } {
  const { hour, minute } = localParts(now, timeZone);
  return { hour, minute };
}

/** Game day that just ended (only valid during the close hour). */
export function gameDayJustClosed(
  timeZone: string,
  now = new Date()
): string | null {
  if (!isGameDayCloseHour(timeZone, now)) return null;
  return addDays(gameDateString(now, timeZone), -1);
}

/** Calendar YYYY-MM-DD in the timezone (ignores 4 AM cutoff). */
export function calendarDateString(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Game-day id (YYYY-MM-DD). Before 4:00 AM local, still the previous game day.
 */
export function gameDateString(date: Date, timeZone: string): string {
  const cal = calendarDateString(date, timeZone);
  const { hour } = localParts(date, timeZone);
  if (hour < GAME_DAY_CUTOFF_HOUR) {
    return addDays(cal, -1);
  }
  return cal;
}

/** @deprecated Use gameDateString — kept as alias for game-day assignment. */
export function localDateString(date: Date, timeZone: string): string {
  return gameDateString(date, timeZone);
}

/** Current game day in the group timezone. */
export function today(timeZone: string): string {
  return gameDateString(new Date(), timeZone);
}

/** The game-day string `n` days before `dateStr`. */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Inclusive list of game-day strings between two dates (chronological). */
export function dateRange(startStr: string, endStr: string): string[] {
  const out: string[] = [];
  let cur = startStr;
  for (let i = 0; i < 366 && cur <= endStr; i++) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

/** Ms until the next 4:00 AM cutoff in `timeZone`. */
export function msUntilNextGameDayCutoff(
  timeZone: string,
  now = Date.now()
): number {
  const { hour, minute, second } = localParts(new Date(now), timeZone);
  const msIntoHour = (minute * 60 + second) * 1000;
  if (hour < GAME_DAY_CUTOFF_HOUR) {
    return (
      (GAME_DAY_CUTOFF_HOUR - hour) * 3600 * 1000 - msIntoHour
    );
  }
  return (
    (24 - hour + GAME_DAY_CUTOFF_HOUR) * 3600 * 1000 - msIntoHour
  );
}
