/**
 * Per-user cache of ingested submission keys.
 *
 * The collector re-fetches the same recent submissions from platform APIs every
 * run; before this ledger existed, each one cost a 2-read transaction just to
 * discover it was already stored. Now one ledger read per user filters them all
 * out, and only genuinely new submissions reach ingestSubmission.
 *
 * The ledger is advisory: ingestSubmission's transactional existence check
 * remains the source of truth. A missing or stale ledger self-heals — unknown
 * keys are re-attempted once (dedup'd by doc id) and then recorded here.
 */
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "./admin";
import { Collections, IngestLedger } from "../types";

export async function loadIngestedKeys(userId: string): Promise<Set<string>> {
  const snap = await db
    .collection(Collections.ingestLedgers)
    .doc(userId)
    .get();
  const ledger = snap.data() as IngestLedger | undefined;
  return new Set(ledger?.keys ?? []);
}

export async function recordIngestedKeys(
  userId: string,
  keys: string[]
): Promise<void> {
  if (keys.length === 0) return;
  await db
    .collection(Collections.ingestLedgers)
    .doc(userId)
    .set(
      {
        userId,
        keys: FieldValue.arrayUnion(...keys),
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
}
