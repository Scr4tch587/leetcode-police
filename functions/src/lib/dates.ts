/**
 * Timezone-aware date helpers. All "days" in Problem Club are computed in a
 * group's local timezone so the midnight cutoff is meaningful for the members.
 */

/** Return YYYY-MM-DD for `date` in the given IANA timezone. */
export function localDateString(date: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Today's local date string. */
export function today(timeZone: string): string {
  return localDateString(new Date(), timeZone);
}

/** The local date string `n` days before `date`. */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Inclusive list of date strings between two dates (chronological). */
export function dateRange(startStr: string, endStr: string): string[] {
  const out: string[] = [];
  let cur = startStr;
  // Guard against accidental infinite loops.
  for (let i = 0; i < 366 && cur <= endStr; i++) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}
