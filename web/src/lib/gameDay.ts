/** Game day helpers — day rolls at 4:00 AM in the group timezone. */

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

function calendarDateString(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function gameDateString(date: Date, timeZone: string): string {
  const cal = calendarDateString(date, timeZone);
  const { hour } = localParts(date, timeZone);
  if (hour < GAME_DAY_CUTOFF_HOUR) {
    return addDays(cal, -1);
  }
  return cal;
}

export function gameToday(timeZone: string, offsetDays = 0): string {
  const base = gameDateString(new Date(), timeZone);
  if (offsetDays === 0) return base;
  return addDays(base, offsetDays);
}

export function msUntilNextGameDayCutoff(
  timeZone: string,
  now = Date.now()
): number {
  const { hour, minute, second } = localParts(new Date(now), timeZone);
  const msIntoHour = (minute * 60 + second) * 1000;
  if (hour < GAME_DAY_CUTOFF_HOUR) {
    return (GAME_DAY_CUTOFF_HOUR - hour) * 3600 * 1000 - msIntoHour;
  }
  return (24 - hour + GAME_DAY_CUTOFF_HOUR) * 3600 * 1000 - msIntoHour;
}

export function cutoffLabel(timeZone: string): string {
  const abbr = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "short",
  })
    .formatToParts(new Date())
    .find((p) => p.type === "timeZoneName")?.value;
  return `4:00 AM${abbr ? ` ${abbr}` : ""}`;
}
