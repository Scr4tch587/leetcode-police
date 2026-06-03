/**
 * Idempotent submission ingestion and live daily-status updates.
 */
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { db } from "./admin";
import { PENALTY_WORDS_PER_MISS } from "./game";
import {
  Collections,
  DailyStatus,
  Platform,
  Submission,
  User,
  dailyStatusId,
  submissionDocId,
} from "../types";
import { localDateString, today } from "./dates";

/** Only today counts for live banking / penalty fixes (not historical backfill). */
export function isActiveGameDay(date: string, timeZone: string): boolean {
  return date === today(timeZone);
}

export interface IncomingSubmission {
  platform: Platform;
  problemId: string;
  problemName?: string;
  timestampSeconds: number;
}

export function uniqueKey(platform: Platform, problemId: string): string {
  return `${platform}_${problemId}`;
}

export async function submissionExists(
  userId: string,
  platform: Platform,
  problemId: string
): Promise<boolean> {
  const docId = submissionDocId(userId, uniqueKey(platform, problemId));
  const snap = await db.collection(Collections.submissions).doc(docId).get();
  return snap.exists;
}

/**
 * Insert a submission if unseen; update daily status.
 * Banks extras only when the submission falls on **today** (group timezone).
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
  const ts = Timestamp.fromMillis(event.timestampSeconds * 1000);
  const date = localDateString(new Date(event.timestampSeconds * 1000), timeZone);

  const submission: Submission = {
    id: docId,
    userId: user.id,
    groupId: user.groupId,
    platform: event.platform,
    problemId: event.problemId,
    timestamp: ts,
    uniqueKey: uk,
    ...(event.problemName ? { problemName: event.problemName } : {}),
  };

  const dsRef = db
    .collection(Collections.dailyStatus)
    .doc(dailyStatusId(user.id, date));
  const userRef = db.collection(Collections.users).doc(user.id);

  const ingested = await db.runTransaction(async (tx) => {
    const [subSnap, dsSnap] = await Promise.all([tx.get(ref), tx.get(dsRef)]);
    if (subSnap.exists) return false;

    const prev = dsSnap.data() as DailyStatus | undefined;
    const prevCount = prev?.submissionCount ?? 0;
    const newCount = prevCount + 1;
    let extrasBanked = prev?.extrasBanked ?? 0;

    const userUpdates: Record<string, unknown> = {};
    const activeDay = isActiveGameDay(date, timeZone);

    // 2nd+ problem today only → bank one (never for historical backfill dates).
    if (activeDay && newCount >= 2) {
      extrasBanked += 1;
      userUpdates.bankedProblems = FieldValue.increment(1);
    }

    // Late submission today undoing a false penalty on the same day.
    if (
      activeDay &&
      newCount === 1 &&
      prev?.resolved &&
      prev.penaltyApplied &&
      !prev.solvedToday
    ) {
      userUpdates.wordPenalty = FieldValue.increment(-PENALTY_WORDS_PER_MISS);
    }

    if (Object.keys(userUpdates).length > 0) {
      tx.update(userRef, userUpdates);
    }

    const next: DailyStatus = {
      id: dsRef.id,
      userId: user.id,
      groupId: user.groupId!,
      date,
      solvedToday: true,
      bankUsed: prev?.bankUsed ?? false,
      penaltyApplied:
        newCount === 1 && prev?.penaltyApplied && prev?.resolved
          ? false
          : (prev?.penaltyApplied ?? false),
      submissionCount: newCount,
      extrasBanked,
      resolved: prev?.resolved ?? false,
    };

    tx.set(ref, submission);
    tx.set(dsRef, next, { merge: true });
    return true;
  });

  if (!ingested) return false;

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
