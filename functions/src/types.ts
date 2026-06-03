/**
 * Shared domain types for the Problem Club backend.
 *
 * These mirror the Firestore data model. The same shapes are duplicated in
 * `web/src/types.ts` for the frontend. Keep the two in sync when changing the
 * schema.
 */

import { Timestamp } from "firebase-admin/firestore";

/** Supported competitive-programming platforms. */
export type Platform = "leetcode" | "codeforces" | "unknown";

/**
 * Lifecycle of a submission.
 *  - `accepted`        : auto-validated (OCR proved an accepted, new problem).
 *  - `pending`         : needs manual admin review (duplicate / low-confidence).
 *  - `rejected`        : an admin rejected it.
 *  - `failed`          : OCR could not find an "accepted" verdict.
 */
export type ValidationStatus = "accepted" | "pending" | "rejected" | "failed";

export interface User {
  id: string;
  displayName: string;
  phoneNumber: string; // E.164, e.g. +15195551234
  groupId: string | null;
  wordPenalty: number;
  bankedProblems: number;
  isAdmin: boolean;
  createdAt: Timestamp;
}

export interface Group {
  id: string;
  name: string;
  inviteCode: string;
  createdBy: string;
  /** IANA timezone used for the daily cutoff & reminders, e.g. America/Toronto */
  timezone: string;
  createdAt: Timestamp;
}

export interface Submission {
  id: string;
  userId: string;
  groupId: string;
  timestamp: Timestamp;
  platform: Platform;
  problemIdentifier: string | null;
  problemTitle: string | null;
  screenshotUrl: string;
  validationStatus: ValidationStatus;
  /** Local date string (YYYY-MM-DD) in the group's timezone. */
  date: string;
  /** Raw OCR text, kept for auditing / admin review. */
  ocrText?: string;
  /** Confidence 0..1 that the verdict was "accepted". */
  ocrConfidence?: number;
  /** Reason a submission is pending/failed (shown to admins). */
  reviewNote?: string;
}

export interface ProblemHistory {
  id: string; // `${userId}_${platform}_${problemIdentifier}`
  userId: string;
  platform: Platform;
  problemIdentifier: string;
  firstSubmissionDate: string;
}

export interface DailyStatus {
  id: string; // `${userId}_${date}`
  userId: string;
  groupId: string;
  date: string; // YYYY-MM-DD
  submissionCount: number;
  satisfied: boolean;
  bankUsed: boolean;
  penaltyApplied: boolean;
}

/** Firestore collection names, centralised to avoid typos. */
export const Collections = {
  users: "users",
  groups: "groups",
  submissions: "submissions",
  problemHistory: "problemHistory",
  dailyStatus: "dailyStatus",
  meta: "meta",
} as const;
