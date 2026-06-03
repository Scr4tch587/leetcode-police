/**
 * Core game mechanics: daily requirement, banking, penalties, problem history.
 *
 * IMPORTANT: every mutation of game state (bank/penalty/dailyStatus) goes
 * through this module inside a Firestore transaction so concurrent submissions
 * and the midnight job cannot corrupt counts.
 */
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./admin";
import {
  Collections,
  DailyStatus,
  Platform,
  ProblemHistory,
  User,
} from "../types";

export const PENALTY_WORDS_PER_MISS = 2;

export function dailyStatusId(userId: string, date: string): string {
  return `${userId}_${date}`;
}

export function problemHistoryId(
  userId: string,
  platform: Platform,
  identifier: string
): string {
  return `${userId}_${platform}_${identifier}`;
}

export interface AcceptedSubmissionInput {
  userId: string;
  groupId: string;
  date: string;
  platform: Platform;
  problemIdentifier: string | null;
}

export type AcceptOutcome =
  | { kind: "satisfied"; bankedDelta: 0 }
  | { kind: "banked"; bankedDelta: 1 }
  | { kind: "duplicate" }; // already solved before -> needs manual review

/**
 * Apply an OCR-accepted submission to game state, transactionally.
 *
 *  - If the problem was already solved by this user (problemHistory hit), the
 *    submission does NOT count and the caller should mark it `pending`.
 *  - Otherwise the first valid problem of the day satisfies the requirement;
 *    each additional valid problem increments the user's bank by 1.
 */
export async function applyAcceptedSubmission(
  input: AcceptedSubmissionInput
): Promise<AcceptOutcome> {
  const { userId, groupId, date, platform, problemIdentifier } = input;

  return db.runTransaction(async (tx) => {
    // Duplicate detection (only possible when we extracted an identifier).
    let historyRef = null;
    if (problemIdentifier) {
      const histId = problemHistoryId(userId, platform, problemIdentifier);
      historyRef = db.collection(Collections.problemHistory).doc(histId);
      const hist = await tx.get(historyRef);
      if (hist.exists) {
        return { kind: "duplicate" } as const;
      }
    }

    const userRef = db.collection(Collections.users).doc(userId);
    const dsRef = db
      .collection(Collections.dailyStatus)
      .doc(dailyStatusId(userId, date));
    const dsSnap = await tx.get(dsRef);

    const existing = dsSnap.data() as DailyStatus | undefined;
    const wasSatisfied = existing?.satisfied ?? false;

    const baseStatus: DailyStatus = {
      id: dsRef.id,
      userId,
      groupId,
      date,
      submissionCount: (existing?.submissionCount ?? 0) + 1,
      satisfied: true,
      bankUsed: existing?.bankUsed ?? false,
      penaltyApplied: existing?.penaltyApplied ?? false,
    };

    let outcome: AcceptOutcome;
    if (!wasSatisfied) {
      // First valid problem today -> satisfies the requirement.
      outcome = { kind: "satisfied", bankedDelta: 0 };
    } else {
      // Extra valid problem -> bank it.
      outcome = { kind: "banked", bankedDelta: 1 };
      tx.update(userRef, { bankedProblems: FieldValue.increment(1) });
    }

    tx.set(dsRef, baseStatus, { merge: true });

    // Record problem history so future duplicates are caught.
    if (historyRef && problemIdentifier) {
      const history: ProblemHistory = {
        id: historyRef.id,
        userId,
        platform,
        problemIdentifier,
        firstSubmissionDate: date,
      };
      tx.set(historyRef, history);
    }

    return outcome;
  });
}

export interface MidnightOutcome {
  userId: string;
  status: "satisfied" | "bankUsed" | "penalty";
}

/**
 * Resolve a single user's day at the cutoff.
 *  - satisfied  -> nothing
 *  - bank > 0   -> consume one banked problem, mark bankUsed
 *  - otherwise  -> +PENALTY_WORDS_PER_MISS words, mark penaltyApplied
 */
export async function resolveUserDay(
  user: Pick<User, "id" | "groupId">,
  date: string
): Promise<MidnightOutcome> {
  if (!user.groupId) return { userId: user.id, status: "satisfied" };

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

    // Already satisfied today: nothing to do.
    if (ds?.satisfied) {
      return { userId: user.id, status: "satisfied" as const };
    }

    const bank = userData?.bankedProblems ?? 0;
    const base: DailyStatus = {
      id: dsRef.id,
      userId: user.id,
      groupId: user.groupId!,
      date,
      submissionCount: ds?.submissionCount ?? 0,
      satisfied: false,
      bankUsed: ds?.bankUsed ?? false,
      penaltyApplied: ds?.penaltyApplied ?? false,
    };

    if (bank > 0) {
      tx.update(userRef, { bankedProblems: FieldValue.increment(-1) });
      tx.set(dsRef, { ...base, bankUsed: true }, { merge: true });
      return { userId: user.id, status: "bankUsed" as const };
    }

    tx.update(userRef, {
      wordPenalty: FieldValue.increment(PENALTY_WORDS_PER_MISS),
    });
    tx.set(dsRef, { ...base, penaltyApplied: true }, { merge: true });
    return { userId: user.id, status: "penalty" as const };
  });
}

/**
 * Admin override: directly re-apply (or reverse) the effect of a submission's
 * acceptance on a given day. Used when an admin approves a `pending` duplicate
 * or rejects a previously-accepted submission.
 */
export async function adminAdjustForApproval(
  userId: string,
  groupId: string,
  date: string
): Promise<AcceptOutcome> {
  return applyAcceptedSubmission({
    userId,
    groupId,
    date,
    platform: "unknown",
    // No identifier => skip duplicate check (admin already decided).
    problemIdentifier: null,
  });
}
