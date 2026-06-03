/**
 * Frontend mirror of the Firestore data model. Kept in sync with
 * `functions/src/types.ts`. Timestamps arrive as Firestore Timestamp objects
 * on the client.
 */
import type { Timestamp } from "firebase/firestore";

export type Platform = "leetcode" | "codeforces" | "unknown";

export type ValidationStatus = "accepted" | "pending" | "rejected" | "failed";

export interface User {
  id: string;
  displayName: string;
  phoneNumber: string;
  groupId: string | null;
  wordPenalty: number;
  bankedProblems: number;
  isAdmin: boolean;
  createdAt: Timestamp | null;
}

export interface Group {
  id: string;
  name: string;
  inviteCode: string;
  createdBy: string;
  timezone: string;
  createdAt: Timestamp | null;
}

export interface Submission {
  id: string;
  userId: string;
  groupId: string;
  timestamp: Timestamp | null;
  platform: Platform;
  problemIdentifier: string | null;
  problemTitle: string | null;
  screenshotUrl: string;
  validationStatus: ValidationStatus;
  date: string;
  ocrText?: string;
  ocrConfidence?: number;
  reviewNote?: string;
}

export interface DailyStatus {
  id: string;
  userId: string;
  groupId: string;
  date: string;
  submissionCount: number;
  satisfied: boolean;
  bankUsed: boolean;
  penaltyApplied: boolean;
}
