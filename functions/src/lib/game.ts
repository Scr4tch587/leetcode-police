/**
 * Daily resolution: banking, penalties, idempotent per calendar day.
 */
import { FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { db } from "./admin";
import {
  Collections,
  DailyStatus,
  User,
  dailyStatusId,
} from "../types";
import { countSubmissionsForDay } from "./submissions";

export const PENALTY_WORDS_PER_MISS = 2;

export interface MidnightOutcome {
  userId: string;
  date: string;
  status: "solved" | "bankUsed" | "penalty" | "skipped" | "reconciled";
  submissionCount?: number;
  extrasBanked?: number;
}

/** Credit un-banked extras for a day (count - 1 minus already banked at ingest). */
function extrasToBank(count: number, alreadyBanked: number): number {
  return Math.max(0, count - 1 - alreadyBanked);
}

/**
 * Resolve one user's calendar day (midnight or backfill).
 *
 *  - N >= 1 → solved; bank += extras not yet credited
 *  - N = 0 && bank > 0 → consume one bank
 *  - N = 0 && no bank → +2 penalty
 */
export async function resolveUserDay(
  user: Pick<User, "id" | "groupId">,
  date: string,
  timeZone: string
): Promise<MidnightOutcome> {
  if (!user.groupId) {
    return { userId: user.id, date, status: "skipped" };
  }

  const count = await countSubmissionsForDay(user.id, date, timeZone);

  return db.runTransaction(async (tx) => {
    const userRef = db.collection(Collections.users).doc(user.id);
    const dsRef = db
      .collection(Collections.dailyStatus)
      .doc(dailyStatusId(user.id, date));

    const [userSnap, dsSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(dsRef),
    ]);

    const userData = userSnap.data() as User | undefined;
    const ds = dsSnap.data() as DailyStatus | undefined;

    if (ds?.resolved) {
      return {
        userId: user.id,
        date,
        status: "skipped" as const,
        submissionCount: count,
      };
    }

    const bank = userData?.bankedProblems ?? 0;
    const alreadyBanked = ds?.extrasBanked ?? 0;

    const base: DailyStatus = {
      id: dsRef.id,
      userId: user.id,
      groupId: user.groupId!,
      date,
      solvedToday: count >= 1,
      bankUsed: ds?.bankUsed ?? false,
      penaltyApplied: ds?.penaltyApplied ?? false,
      submissionCount: count,
      extrasBanked: alreadyBanked,
      resolved: true,
    };

    if (count >= 1) {
      const credit = extrasToBank(count, alreadyBanked);
      if (credit > 0) {
        tx.update(userRef, { bankedProblems: FieldValue.increment(credit) });
        base.extrasBanked = alreadyBanked + credit;
      }
      tx.set(dsRef, base, { merge: true });
      return {
        userId: user.id,
        date,
        status: "solved" as const,
        submissionCount: count,
        extrasBanked: base.extrasBanked,
      };
    }

    if (bank > 0) {
      tx.update(userRef, { bankedProblems: FieldValue.increment(-1) });
      tx.set(dsRef, { ...base, bankUsed: true }, { merge: true });
      return { userId: user.id, date, status: "bankUsed" as const };
    }

    tx.update(userRef, {
      wordPenalty: FieldValue.increment(PENALTY_WORDS_PER_MISS),
    });
    tx.set(dsRef, { ...base, penaltyApplied: true }, { merge: true });
    return { userId: user.id, date, status: "penalty" as const };
  });
}

/**
 * Backfill banking for days that have submissions but were never resolved
 * (e.g. historical ingest after midnight, or ingest landed after penalty).
 */
export async function reconcilePendingDays(
  user: Pick<User, "id" | "groupId">,
  timeZone: string
): Promise<MidnightOutcome[]> {
  if (!user.groupId) return [];

  const snap = await db
    .collection(Collections.dailyStatus)
    .where("userId", "==", user.id)
    .where("resolved", "==", false)
    .get();

  const outcomes: MidnightOutcome[] = [];
  for (const doc of snap.docs) {
    const ds = doc.data() as DailyStatus;
    const count = await countSubmissionsForDay(user.id, ds.date, timeZone);
    if (count === 0) continue;

    const outcome = await resolveUserDay(user, ds.date, timeZone);
    outcomes.push({ ...outcome, status: "reconciled" });
    logger.info("Reconciled pending day", {
      userId: user.id,
      date: ds.date,
      count,
      extrasBanked: outcome.extrasBanked,
    });
  }
  return outcomes;
}
