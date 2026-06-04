/**
 * Admin callable functions — manual checks, bank/score adjustments, group settings.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { db } from "../lib/admin";
import { REGION } from "../config";
import {
  Collections,
  DailyStatus,
  User,
  dailyStatusId,
} from "../types";
import { requireAdmin, requireUser, userFromSnap } from "../lib/callable";
import { collectForUsers, formatGroupCheckDebug } from "../lib/collector";
import { effectiveSolvedToday } from "../lib/dailyStatus";
import { today } from "../lib/dates";
import { PENALTY_SCORE_PER_MISS } from "../lib/game";
import { scoreOf } from "../lib/userScore";
import { FieldValue } from "firebase-admin/firestore";

const opts = { region: REGION };
const collectOpts = { ...opts, memory: "512MiB" as const, timeoutSeconds: 120 };

function normalizeScoreLabel(raw: string): string {
  const label = raw.trim().slice(0, 120);
  if (label.length < 3) {
    throw new HttpsError(
      "invalid-argument",
      "Score label must be at least 3 characters."
    );
  }
  return label;
}

async function getGroupMembers(groupId: string): Promise<User[]> {
  const snap = await db
    .collection(Collections.users)
    .where("groupId", "==", groupId)
    .get();
  return snap.docs.map((d) => userFromSnap(d));
}

export const runSubmissionCheck = onCall(collectOpts, async (req) => {
  const caller = await requireUser(req);
  if (!caller.groupId) {
    throw new HttpsError("failed-precondition", "Join a group first.");
  }

  const targetUserId = req.data?.userId as string | undefined;
  let targets: User[];

  if (targetUserId) {
    if (targetUserId === caller.id) {
      targets = [caller];
    } else {
      const admin = await requireAdmin(req);
      targets = [await assertSameGroupUser(admin, targetUserId)];
    }
  } else {
    const admin = await requireAdmin(req);
    targets = await getGroupMembers(admin.groupId!);
  }

  const results = await collectForUsers(targets, { includeLatestSeen: true });
  const ingested = results.reduce((s, r) => s + r.ingested, 0);

  logger.info("Manual submission check", {
    callerId: caller.id,
    groupId: caller.groupId,
    targetUserId: targetUserId ?? null,
    ingested,
    members: results.length,
  });

  return {
    ok: true,
    ingested,
    message: formatGroupCheckDebug(results, ingested),
  };
});

async function assertSameGroupUser(admin: User, userId: string): Promise<User> {
  const snap = await db.collection(Collections.users).doc(userId).get();
  const target = userFromSnap(snap);
  if (target.groupId !== admin.groupId) {
    throw new HttpsError("permission-denied", "User is not in your group.");
  }
  return target;
}

async function todayStatusContext(
  admin: User,
  userId: string,
  dateOverride?: string
) {
  await assertSameGroupUser(admin, userId);
  const groupSnap = await db
    .collection(Collections.groups)
    .doc(admin.groupId!)
    .get();
  const timeZone =
    (groupSnap.data()?.timezone as string | undefined) || "America/Toronto";
  const date = dateOverride?.trim() || today(timeZone);
  const dsRef = db
    .collection(Collections.dailyStatus)
    .doc(dailyStatusId(userId, date));
  const userRef = db.collection(Collections.users).doc(userId);
  return { groupId: admin.groupId!, date, dsRef, userRef };
}

/** Extra bank credits to reverse when voiding today (handles reconcile desync). */
function extrasToReverseOnVoid(prev: DailyStatus | undefined): number {
  const recorded = prev?.extrasBanked ?? 0;
  const fromCount = Math.max(0, (prev?.submissionCount ?? 0) - 1);
  return Math.max(recorded, fromCount);
}

export const updateGroupSettings = onCall(opts, async (req) => {
  const admin = await requireAdmin(req);
  const scoreLabelRaw = req.data?.scoreLabel as string | undefined;
  if (!scoreLabelRaw?.trim()) {
    throw new HttpsError("invalid-argument", "scoreLabel is required.");
  }
  const scoreLabel = normalizeScoreLabel(scoreLabelRaw);
  await db.collection(Collections.groups).doc(admin.groupId!).update({ scoreLabel });
  return { ok: true, scoreLabel };
});

export const adjustBank = onCall(opts, async (req) => {
  const admin = await requireAdmin(req);
  const userId = req.data?.userId as string;
  const delta = Number(req.data?.delta);
  if (!userId || !Number.isFinite(delta)) {
    throw new HttpsError("invalid-argument", "userId and numeric delta required.");
  }
  const target = await assertSameGroupUser(admin, userId);
  const next = Math.max(0, target.bankedProblems + delta);
  await db.collection(Collections.users).doc(userId).update({
    bankedProblems: next,
  });
  return { ok: true, bankedProblems: next };
});

export const adjustScore = onCall(opts, async (req) => {
  const admin = await requireAdmin(req);
  const userId = req.data?.userId as string;
  const delta = Number(req.data?.delta);
  if (!userId || !Number.isFinite(delta)) {
    throw new HttpsError("invalid-argument", "userId and numeric delta required.");
  }
  const target = await assertSameGroupUser(admin, userId);
  const next = Math.max(0, scoreOf(target) + delta);
  await db.collection(Collections.users).doc(userId).update({
    score: next,
    wordPenalty: next,
  });
  return { ok: true, score: next };
});

/** @deprecated Use adjustScore */
export const adjustPenalty = adjustScore;

/** Admin: mark today as not solved (void); reverses today's extra banking. */
export const nullifyTodaySolve = onCall(opts, async (req) => {
  const admin = await requireAdmin(req);
  const userId = req.data?.userId as string;
  if (!userId) {
    throw new HttpsError("invalid-argument", "userId is required.");
  }

  const { groupId, date, dsRef, userRef } = await todayStatusContext(
    admin,
    userId
  );

  const result = await db.runTransaction(async (tx) => {
    const [dsSnap, userSnap] = await Promise.all([tx.get(dsRef), tx.get(userRef)]);
    const prev = dsSnap.data() as DailyStatus | undefined;
    const userData = userSnap.data() as User | undefined;
    const toReverse = extrasToReverseOnVoid(prev);

    if (prev?.adminVoidToday) {
      return { alreadyVoid: true, extrasReversed: 0 };
    }

    if (toReverse > 0 && userData) {
      tx.update(userRef, {
        bankedProblems: FieldValue.increment(-toReverse),
      });
    }

    const next: DailyStatus = {
      id: dsRef.id,
      userId,
      groupId,
      date,
      solvedToday: false,
      adminVoidToday: true,
      adminGrantedToday: false,
      bankUsed: prev?.bankUsed ?? false,
      penaltyApplied: prev?.penaltyApplied ?? false,
      submissionCount: prev?.submissionCount ?? 0,
      extrasBanked: 0,
      resolved: prev?.resolved ?? false,
    };

    tx.set(dsRef, next, { merge: true });
    return { alreadyVoid: false, extrasReversed: toReverse };
  });

  logger.info("Admin nullified today solve", {
    adminId: admin.id,
    targetUserId: userId,
    date,
    ...result,
  });

  return { ok: true, date, ...result };
});

/** Admin: mark today as solved (pair of nullify); does not add bank. */
export const grantTodaySolve = onCall(opts, async (req) => {
  const admin = await requireAdmin(req);
  const userId = req.data?.userId as string;
  if (!userId) {
    throw new HttpsError("invalid-argument", "userId is required.");
  }

  const { groupId, date, dsRef } = await todayStatusContext(admin, userId);

  const result = await db.runTransaction(async (tx) => {
    const dsSnap = await tx.get(dsRef);
    const prev = dsSnap.data() as DailyStatus | undefined;

    if (effectiveSolvedToday(prev)) {
      return { alreadySolved: true, wasVoided: false };
    }

    const submissionCount = prev?.submissionCount ?? 0;
    // After a void, mark extras as already credited so sync won't re-bank from saved subs.
    const extrasBanked = prev?.adminVoidToday
      ? Math.max(0, submissionCount - 1)
      : (prev?.extrasBanked ?? 0);

    const next: DailyStatus = {
      id: dsRef.id,
      userId,
      groupId,
      date,
      solvedToday: submissionCount >= 1,
      adminVoidToday: false,
      adminGrantedToday: true,
      bankUsed: prev?.bankUsed ?? false,
      penaltyApplied: prev?.penaltyApplied ?? false,
      submissionCount,
      extrasBanked,
      resolved: prev?.resolved ?? false,
    };

    tx.set(dsRef, next, { merge: true });
    return {
      alreadySolved: false,
      wasVoided: prev?.adminVoidToday ?? false,
      grantOnly: submissionCount === 0,
    };
  });

  logger.info("Admin granted today solve", {
    adminId: admin.id,
    targetUserId: userId,
    date,
    ...result,
  });

  return { ok: true, date, ...result };
});

/** Admin: remove a miss (penalty) for a game day; reverses +2 score if applied. */
export const clearDayMiss = onCall(opts, async (req) => {
  const admin = await requireAdmin(req);
  const userId = req.data?.userId as string;
  const dateArg = req.data?.date as string | undefined;
  if (!userId) {
    throw new HttpsError("invalid-argument", "userId is required.");
  }

  const { date, dsRef, userRef } = await todayStatusContext(
    admin,
    userId,
    dateArg
  );

  const result = await db.runTransaction(async (tx) => {
    const [dsSnap, userSnap] = await Promise.all([tx.get(dsRef), tx.get(userRef)]);
    const prev = dsSnap.data() as DailyStatus | undefined;
    const userData = userSnap.data() as User | undefined;

    if (!prev?.penaltyApplied) {
      return { alreadyClear: true, scoreReversed: 0 };
    }

    if (userData) {
      const nextScore = Math.max(0, scoreOf(userData) - PENALTY_SCORE_PER_MISS);
      tx.update(userRef, { score: nextScore, wordPenalty: nextScore });
    }

    tx.set(dsRef, { penaltyApplied: false }, { merge: true });
    return { alreadyClear: false, scoreReversed: PENALTY_SCORE_PER_MISS };
  });

  logger.info("Admin cleared day miss", {
    adminId: admin.id,
    targetUserId: userId,
    date,
    ...result,
  });

  return { ok: true, date, ...result };
});
