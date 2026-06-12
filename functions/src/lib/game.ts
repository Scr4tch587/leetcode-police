/**
 * Daily resolution: banking, penalties, idempotent per game day (4 AM cutoff).
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

export const PENALTY_SCORE_PER_MISS = 2;

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
 * Resolve one game day for ongoing play (yesterday after 4 AM cutoff, or catch-up).
 */
export async function resolveUserDay(
  user: Pick<User, "id" | "groupId">,
  date: string,
  timeZone: string
): Promise<MidnightOutcome> {
  if (!user.groupId) {
    return { userId: user.id, date, status: "skipped" };
  }

  let count = await countSubmissionsForDay(user.id, date, timeZone);

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

    // Void without submissions still counts as unsolved; void + subs → solved.
    if (ds?.adminVoidToday && count < 1) {
      count = 0;
    }

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
      adminVoidToday: false,
      adminGrantedToday: false,
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
      score: FieldValue.increment(PENALTY_SCORE_PER_MISS),
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
 * Credit today's extra problems from submissions already in Firestore
 * (e.g. both solves ingested earlier — no new writes this run).
 */
export async function reconcileTodayExtras(
  user: Pick<User, "id" | "groupId">,
  timeZone: string
): Promise<MidnightOutcome | null> {
  if (!user.groupId) return null;

  const date = today(timeZone);
  const count = await countSubmissionsForDay(user.id, date, timeZone);

  return db.runTransaction(async (tx) => {
    const userRef = db.collection(Collections.users).doc(user.id);
    const dsRef = db
      .collection(Collections.dailyStatus)
      .doc(dailyStatusId(user.id, date));

    const dsSnap = await tx.get(dsRef);
    const prev = dsSnap.data() as DailyStatus | undefined;

    if (prev?.adminVoidToday) {
      return null;
    }

    const alreadyBanked = prev?.extrasBanked ?? 0;
    const credit = extrasToBank(count, alreadyBanked);

    const next: DailyStatus = {
      id: dsRef.id,
      userId: user.id,
      groupId: user.groupId!,
      date,
      solvedToday: count >= 1,
      bankUsed: prev?.bankUsed ?? false,
      penaltyApplied: prev?.penaltyApplied ?? false,
      submissionCount: count,
      extrasBanked: alreadyBanked + credit,
      resolved: prev?.resolved ?? false,
      adminGrantedToday: false,
    };

    if (credit > 0) {
      tx.update(userRef, { bankedProblems: FieldValue.increment(credit) });
    }
    tx.set(dsRef, next, { merge: true });

    if (credit > 0) {
      logger.info("Reconciled today extras from saved submissions", {
        userId: user.id,
        date,
        count,
        credited: credit,
      });
    }

    return credit > 0 || count >= 1
      ? {
          userId: user.id,
          date,
          status: "reconciled" as const,
          submissionCount: count,
          extrasBanked: next.extrasBanked,
        }
      : null;
  });
}

/**
 * A day already resolved as bankUsed/penalty, but submissions arrived afterward
 * (e.g. AtCoder's data API lagged past the 4 AM cutoff). Reverse the false
 * closure: refund the spent bank credit or the penalty, mark the day solved,
 * and bank any extras. Idempotent — clears the flags so re-runs are no-ops.
 */
export async function reverseFalseClosure(
  user: Pick<User, "id" | "groupId">,
  date: string,
  timeZone: string
): Promise<MidnightOutcome | null> {
  if (!user.groupId) return null;

  const dsRef = db
    .collection(Collections.dailyStatus)
    .doc(dailyStatusId(user.id, date));

  // Cheap pre-check before the (expensive) submission count.
  const pre = (await dsRef.get()).data() as DailyStatus | undefined;
  if (!pre?.resolved) return null;
  if (!pre.bankUsed && !pre.penaltyApplied) return null;

  const count = await countSubmissionsForDay(user.id, date, timeZone);
  if (count < 1) return null;

  return db.runTransaction(async (tx) => {
    const userRef = db.collection(Collections.users).doc(user.id);
    const dsSnap = await tx.get(dsRef);
    const ds = dsSnap.data() as DailyStatus | undefined;

    // Re-check inside the transaction (may have been reversed concurrently).
    if (!ds?.resolved) return null;
    if (!ds.bankUsed && !ds.penaltyApplied) return null;

    const alreadyBanked = ds.extrasBanked ?? 0;
    const extraCredit = extrasToBank(count, alreadyBanked);
    // Refund the wrongly-spent bank credit, plus bank any extra solves.
    const bankDelta = (ds.bankUsed ? 1 : 0) + extraCredit;

    const userUpdates: Record<string, unknown> = {};
    if (ds.penaltyApplied) {
      userUpdates.score = FieldValue.increment(-PENALTY_SCORE_PER_MISS);
    }
    if (bankDelta > 0) {
      userUpdates.bankedProblems = FieldValue.increment(bankDelta);
    }
    if (Object.keys(userUpdates).length > 0) {
      tx.update(userRef, userUpdates);
    }

    const next: DailyStatus = {
      ...ds,
      solvedToday: true,
      bankUsed: false,
      penaltyApplied: false,
      submissionCount: count,
      extrasBanked: alreadyBanked + extraCredit,
      resolved: true,
    };
    tx.set(dsRef, next, { merge: true });

    logger.info("Reversed false day closure after late submission", {
      userId: user.id,
      date,
      count,
      refundedBank: ds.bankUsed,
      reversedPenalty: ds.penaltyApplied,
      bankedExtras: extraCredit,
    });

    return {
      userId: user.id,
      date,
      status: "reconciled" as const,
      submissionCount: count,
      extrasBanked: next.extrasBanked,
    };
  });
}

/**
 * After sync: close history (no bank), bank today's extras from DB count, catch up yesterday.
 */
export async function reconcilePendingDays(
  user: Pick<User, "id" | "groupId">,
  timeZone: string
): Promise<MidnightOutcome[]> {
  const outcomes: MidnightOutcome[] = [];

  outcomes.push(...(await closeHistoricalDays(user, timeZone)));

  const todayOutcome = await reconcileTodayExtras(user, timeZone);
  if (todayOutcome) outcomes.push(todayOutcome);

  const todayStr = today(timeZone);
  const yesterday = addDays(todayStr, -1);
  const dsRef = db
    .collection(Collections.dailyStatus)
    .doc(dailyStatusId(user.id, yesterday));
  const ds = (await dsRef.get()).data() as DailyStatus | undefined;

  if (ds && !ds.resolved) {
    const count = await countSubmissionsForDay(user.id, yesterday, timeZone);
    if (count > 0) {
      const outcome = await resolveUserDay(user, yesterday, timeZone);
      outcomes.push({ ...outcome, status: "reconciled" });
      logger.info("Reconciled yesterday", {
        userId: user.id,
        date: yesterday,
        count,
        extrasBanked: outcome.extrasBanked,
      });
    }
  }

  // Late submissions (e.g. AtCoder API lag) can land after a day was already
  // closed as bankUsed/penalty. Refund those recent days now that subs exist.
  for (const offset of [1, 2, 3]) {
    const reversed = await reverseFalseClosure(
      user,
      addDays(todayStr, -offset),
      timeZone
    );
    if (reversed) outcomes.push(reversed);
  }

  return outcomes;
}
