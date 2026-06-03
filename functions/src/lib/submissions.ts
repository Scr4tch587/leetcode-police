/**
 * Idempotent submission ingestion and live daily-status updates.
 */
import { Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { db } from "./admin";
import {
  Collections,
  DailyStatus,
  Platform,
  Submission,
  User,
  dailyStatusId,
  submissionDocId,
} from "../types";
import { localDateString } from "./dates";

export interface IncomingSubmission {
  platform: Platform;
  problemId: string;
  problemName?: string;
  timestampSeconds: number;
}

export function uniqueKey(platform: Platform, problemId: string): string {
  return `${platform}_${problemId}`;
}

/**
 * Insert a submission if unseen; bump today's daily status for live dashboard.
 */
export async function ingestSubmission(
  user: Pick<User, "id" | "groupId">,
  event: IncomingSubmission,
  timeZone: string
): Promise<boolean> {
  if (!user.groupId) return false;

  const uk = uniqueKey(event.platform, event.problemId);
  const docId = submissionDocId(user.id, uk);
  const ref = db.collection(Collections.submissions).doc(docId);
  const existing = await ref.get();
  if (existing.exists) return false;

  const ts = Timestamp.fromMillis(event.timestampSeconds * 1000);
  const date = localDateString(new Date(event.timestampSeconds * 1000), timeZone);

  const submission: Submission = {
    id: docId,
    userId: user.id,
    groupId: user.groupId,
    platform: event.platform,
    problemId: event.problemId,
    problemName: event.problemName,
    timestamp: ts,
    uniqueKey: uk,
  };

  const dsRef = db
    .collection(Collections.dailyStatus)
    .doc(dailyStatusId(user.id, date));

  await db.runTransaction(async (tx) => {
    tx.set(ref, submission);
    const dsSnap = await tx.get(dsRef);
    const prev = dsSnap.data() as DailyStatus | undefined;
    const next: DailyStatus = {
      id: dsRef.id,
      userId: user.id,
      groupId: user.groupId!,
      date,
      solvedToday: true,
      bankUsed: prev?.bankUsed ?? false,
      penaltyApplied: prev?.penaltyApplied ?? false,
      submissionCount: (prev?.submissionCount ?? 0) + 1,
      resolved: prev?.resolved ?? false,
    };
    tx.set(dsRef, next, { merge: true });
  });

  logger.info("Ingested submission", {
    userId: user.id,
    platform: event.platform,
    problemId: event.problemId,
    date,
  });
  return true;
}

/** Count submission docs for a user on a local calendar day. */
export async function countSubmissionsForDay(
  userId: string,
  date: string,
  timeZone: string
): Promise<number> {
  const snap = await db
    .collection(Collections.submissions)
    .where("userId", "==", userId)
    .get();

  let count = 0;
  for (const doc of snap.docs) {
    const sub = doc.data() as Submission;
    const ms = sub.timestamp.toMillis();
    const subDate = localDateString(new Date(ms), timeZone);
    if (subDate === date) count++;
  }
  return count;
}

export async function updateLastProcessed(
  userId: string,
  timestampSeconds: number
): Promise<void> {
  await db.collection(Collections.users).doc(userId).update({
    lastProcessedTimestamp: Math.max(0, timestampSeconds),
  });
}
