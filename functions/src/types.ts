/**
 * Shared domain types for the LeetCode Police backend.
 *
 * These mirror the Firestore data model. Keep in sync with `web/src/types.ts`.
 */
import { Timestamp } from "firebase-admin/firestore";

export type Platform = "leetcode" | "codeforces" | "atcoder" | "cses";

export interface User {
  id: string;
  displayName: string;
  /** E.164 — used only for SMS reminders/summaries. */
  phoneNumber: string;
  leetcodeUsername: string;
  codeforcesHandle: string;
  atcoderHandle: string;
  /** @deprecated Legacy public CSES account id; superseded by login linking. */
  csesUserId?: string;
  /** CSES login username (public-ish handle; the password is stored encrypted). */
  csesUsername?: string;
  /** True once CSES credentials are linked (password lives in csesCredentials). */
  csesLinked?: boolean;
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
  /** Admin nullified today until a new solve or sync finds today's submissions. */
  adminVoidToday?: boolean;
  /** Admin granted solve without a submission; expires at 4 AM if still no solve. */
  adminGrantedToday?: boolean;
}

/**
 * Encrypted CSES credentials + sync state. Stored in its own collection that is
 * locked down to Functions only (clients can never read it). One doc per user,
 * keyed by uid.
 */
export interface CsesCredential {
  userId: string;
  /** CSES login username. */
  username: string;
  /** AES-256-GCM ciphertext of the password (see lib/csesCrypto). */
  encPassword: string;
  /**
   * Task ids already solved when CSES was first linked. These are NOT counted
   * as solves — only tasks solved *after* linking are ingested.
   */
  baselineTaskIds: string[];
  baselineAt: Timestamp;
  updatedAt: Timestamp;
  /** Last poll-time login/scrape error, for admin debugging. */
  lastError?: string;
}

export const Collections = {
  users: "users",
  groups: "groups",
  submissions: "submissions",
  dailyStatus: "dailyStatus",
  csesCredentials: "csesCredentials",
  meta: "meta",
} as const;

export function submissionDocId(userId: string, uniqueKey: string): string {
  return `${userId}_${uniqueKey}`;
}

export function dailyStatusId(userId: string, date: string): string {
  return `${userId}_${date}`;
}
