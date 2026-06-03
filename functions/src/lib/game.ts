/**
 * Midnight daily resolution: banking, penalties, idempotent per day.
 */
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./admin";
import { Collections, DailyStatus, User, dailyStatusId } from "../types";
import { countSubmissionsForDay } from "./submissions";

export const PENALTY_WORDS_PER_MISS = 2;

export interface MidnightOutcome {
  userId: string;
  status: "solved" | "bankUsed" | "penalty" | "skipped";
}

/**
 * Resolve one user's calendar day at the group timezone cutoff.
 *
 *  - submissions >= 1 → day complete; bank += (count - 1)
 *  - submissions == 0 && bank > 0 → consume one bank
 *  - submissions == 0 && bank == 0 → +2 penalty words
 */
export async function resolveUserDay(
  user: Pick<User, "id" | "groupId">,
  date: string,
  timeZone: string
): Promise<MidnightOutcome> {
  if (!user.groupId) return { userId: user.id, status: "skipped" };

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
      return { userId: user.id, status: "skipped" as const };
    }
    const bank = userData?.bankedProblems ?? 0;

    const base: DailyStatus = {
      id: dsRef.id,
      userId: user.id,
      groupId: user.groupId!,
      date,
      solvedToday: count >= 1,
      bankUsed: ds?.bankUsed ?? false,
      penaltyApplied: ds?.penaltyApplied ?? false,
      submissionCount: count,
      resolved: true,
    };

    if (count >= 1) {
      const extras = count - 1;
      if (extras > 0) {
        tx.update(userRef, { bankedProblems: FieldValue.increment(extras) });
      }
      tx.set(dsRef, base, { merge: true });
      return { userId: user.id, status: "solved" as const };
    }

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
