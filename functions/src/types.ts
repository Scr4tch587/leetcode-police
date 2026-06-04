/**
 * Shared domain types for the LeetCode Police backend.
 *
 * These mirror the Firestore data model. Keep in sync with `web/src/types.ts`.
 */
import { Timestamp } from "firebase-admin/firestore";

export type Platform = "leetcode" | "codeforces";

export interface User {
  id: string;
  displayName: string;
  /** E.164 — used only for SMS reminders/summaries. */
  phoneNumber: string;
  leetcodeUsername: string;
  codeforcesHandle: string;
  groupId: string | null;
  /** Penalty tally for the current cycle (legacy field: wordPenalty). */
  score: number;
  bankedProblems: number;
  /** Latest platform submission timestamp we have ingested (seconds). */
  lastProcessedTimestamp: number;
  isAdmin: boolean;
  createdAt: Timestamp;
}

export interface Group {
  id: string;
  name: string;
  inviteCode: string;
  createdBy: string;
  timezone: string;
  /** YYYY-MM-DD (group timezone) when scores were last reset on punishment day. */
  lastBiweeklyReset?: string | null;
  /** Admin-defined label for what +score means, e.g. "push-ups owed". */
  scoreLabel?: string;
  createdAt: Timestamp;
}

/** Accepted submission event — source of truth for daily/banking logic. */
export interface Submission {
  id: string;
  userId: string;
  groupId: string;
  platform: Platform;
  problemId: string;
  problemName?: string;
  timestamp: Timestamp;
  uniqueKey: string;
}

export interface DailyStatus {
  id: string;
  userId: string;
  groupId: string;
  date: string;
  solvedToday: boolean;
  bankUsed: boolean;
  penaltyApplied: boolean;
  submissionCount: number;
  /** Extra problems already converted to bank for this day (0..count-1). */
  extrasBanked?: number;
  /** Set by the daily processor so re-runs are idempotent. */
  resolved: boolean;
  /** Admin nullified today's solve; submissions may still exist in history. */
  adminVoidToday?: boolean;
}

export const Collections = {
  users: "users",
  groups: "groups",
  submissions: "submissions",
  dailyStatus: "dailyStatus",
  meta: "meta",
} as const;

export function submissionDocId(userId: string, uniqueKey: string): string {
  return `${userId}_${uniqueKey}`;
}

export function dailyStatusId(userId: string, date: string): string {
  return `${userId}_${date}`;
}
