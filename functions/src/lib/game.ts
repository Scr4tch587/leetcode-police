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
import { addDays, today } from "./dates";

export const PENALTY_WORDS_PER_MISS = 2;

export interface MidnightOutcome {
  userId: string;
  date: string;
  status: "solved" | "bankUsed" | "penalty" | "skipped" | "reconciled" | "closed";
  submissionCount?: number;
  extrasBanked?: number;
}

function extrasToBank(count: number, alreadyBanked: number): number {
  return Math.max(0, count - 1 - alreadyBanked);
}

/**
 * Resolve one calendar day for ongoing play (yesterday at midnight, or yesterday catch-up).
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
 * Close older backfilled days: mark resolved for the grid, never add bank.
 */
export async function closeHistoricalDays(
  user: Pick<User, "id" | "groupId">,
  timeZone: string
): Promise<MidnightOutcome[]> {
  if (!user.groupId) return [];

  const yesterday = addDays(today(timeZone), -1);
  const snap = await db
    .collection(Collections.dailyStatus)
    .where("userId", "==", user.id)
    .where("resolved", "==", false)
    .get();

  const outcomes: MidnightOutcome[] = [];

  for (const doc of snap.docs) {
    const ds = doc.data() as DailyStatus;
    if (ds.date >= yesterday) continue;

    const count = await countSubmissionsForDay(user.id, ds.date, timeZone);
    const dsRef = db
      .collection(Collections.dailyStatus)
      .doc(dailyStatusId(user.id, ds.date));

    await dsRef.set(
      {
        id: dsRef.id,
        userId: user.id,
        groupId: user.groupId!,
        date: ds.date,
        solvedToday: count >= 1,
        bankUsed: false,
        penaltyApplied: false,
        submissionCount: count,
        extrasBanked: Math.max(0, count - 1),
        resolved: true,
      },
      { merge: true }
    );

    outcomes.push({
      userId: user.id,
      date: ds.date,
      status: "closed",
      submissionCount: count,
    });
    logger.info("Closed historical day (no banking)", {
      userId: user.id,
      date: ds.date,
      count,
    });
  }

  return outcomes;
}

/**
 * Catch up yesterday only if still unresolved (e.g. ingest after midnight).
 * Skips older historical dates — those are closed without banking.
 */
export async function reconcilePendingDays(
  user: Pick<User, "id" | "groupId">,
  timeZone: string
): Promise<MidnightOutcome[]> {
  await closeHistoricalDays(user, timeZone);

  const yesterday = addDays(today(timeZone), -1);
  const dsRef = db
    .collection(Collections.dailyStatus)
    .doc(dailyStatusId(user.id, yesterday));
  const ds = (await dsRef.get()).data() as DailyStatus | undefined;

  if (!ds || ds.resolved) return [];

  const count = await countSubmissionsForDay(user.id, yesterday, timeZone);
  if (count === 0) return [];

  const outcome = await resolveUserDay(user, yesterday, timeZone);
  logger.info("Reconciled yesterday", {
    userId: user.id,
    date: yesterday,
    count,
    extrasBanked: outcome.extrasBanked,
  });
  return [{ ...outcome, status: "reconciled" }];
}
