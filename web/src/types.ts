import type { Timestamp } from "firebase/firestore";

export type Platform = "leetcode" | "codeforces";

export interface User {
  id: string;
  displayName: string;
  phoneNumber: string;
  leetcodeUsername: string;
  codeforcesHandle: string;
  groupId: string | null;
  wordPenalty: number;
  bankedProblems: number;
  lastProcessedTimestamp?: number;
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
  platform: Platform;
  problemId: string;
  problemName?: string;
  timestamp: Timestamp | null;
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
  extrasBanked?: number;
  resolved?: boolean;
}
