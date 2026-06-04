import type { Timestamp } from "firebase/firestore";
import { gameDateString } from "@/lib/gameDay";

export function firestoreDate(ts: Timestamp | null | undefined): Date | null {
  return ts?.toDate?.() ?? null;
}

export function formatDate(
  ts: Timestamp | null | undefined,
  timeZone?: string
): string {
  const d = firestoreDate(ts);
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export function formatTime(
  ts: Timestamp | null | undefined,
  timeZone?: string
): string {
  const d = firestoreDate(ts);
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function formatDateTime(
  ts: Timestamp | null | undefined,
  timeZone?: string
): string {
  const d = firestoreDate(ts);
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function localDateKey(
  ts: Timestamp | null | undefined,
  timeZone: string
): string {
  const d = firestoreDate(ts);
  if (!d) return "unknown";
  return gameDateString(d, timeZone);
}

export function formatDateKey(dateKey: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dateKey}T12:00:00Z`));
}
