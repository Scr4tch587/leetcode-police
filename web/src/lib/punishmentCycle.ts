import type { Timestamp } from "firebase/firestore";

const CYCLE_DAYS = 14;

function addDaysISO(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function localDateString(timeZone: string, date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function timestampToLocalDate(
  ts: Timestamp | null | undefined,
  timeZone: string
): string | null {
  const d = ts?.toDate?.();
  if (!d) return null;
  return localDateString(timeZone, d);
}

function daysBetween(from: string, to: string): number {
  return Math.floor(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86400000
  );
}

function formatDisplayDate(dateStr: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${dateStr}T12:00:00Z`));
}

export type PunishmentCycleInfo = {
  headline: string;
  detail: string;
  countdown?: string;
};

/** Next biweekly punishment: score reset + admin SMS tally. */
export function getNextPunishmentDayInfo(params: {
  timeZone: string;
  scoreLabel: string;
  lastBiweeklyReset?: string | null;
  groupCreatedAt?: Timestamp | null;
  currentScore: number;
}): PunishmentCycleInfo {
  const {
    timeZone,
    scoreLabel,
    lastBiweeklyReset,
    groupCreatedAt,
    currentScore,
  } = params;
  const today = localDateString(timeZone);
  const anchor =
    lastBiweeklyReset ??
    timestampToLocalDate(groupCreatedAt, timeZone) ??
    today;

  let next = addDaysISO(anchor, CYCLE_DAYS);
  while (next < today) {
    next = addDaysISO(next, CYCLE_DAYS);
  }

  const daysLeft = daysBetween(today, next);
  const when = formatDisplayDate(next, timeZone);
  let countdown: string | undefined;
  if (daysLeft === 0) countdown = "today";
  else if (daysLeft === 1) countdown = "1 day left";
  else countdown = `${daysLeft} days left`;

  return {
    headline: "Next punishment day",
    detail: `${when} at 9 AM: scores reset to 0 and the admin gets a tally (${scoreLabel}). You have ${currentScore} this cycle.`,
    countdown,
  };
}
