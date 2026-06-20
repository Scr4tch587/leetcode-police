/**
 * Read/write helpers for the Functions-only `csesCredentials` collection.
 */
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "./admin";
import { Collections, CsesCredential } from "../types";
import { encryptSecret } from "./csesCrypto";
import { fetchSolvedTasks } from "../csesClient";

function ref(userId: string) {
  return db.collection(Collections.csesCredentials).doc(userId);
}

export async function getCsesCredential(
  userId: string
): Promise<CsesCredential | null> {
  const snap = await ref(userId).get();
  return snap.exists ? (snap.data() as CsesCredential) : null;
}

/**
 * Verify credentials by logging in, then store them encrypted. On first link we
 * capture the already-solved tasks as a baseline so they are never counted as
 * solves; re-saving (e.g. password change) preserves the existing baseline.
 */
export async function setCsesCredential(
  userId: string,
  username: string,
  password: string
): Promise<{ solvedCount: number; isNew: boolean }> {
  const solved = await fetchSolvedTasks(username, password); // throws if invalid
  const existing = await getCsesCredential(userId);
  const isNew = existing === null;

  const baselineTaskIds = isNew
    ? solved.map((t) => t.id)
    : existing!.baselineTaskIds;

  const doc: CsesCredential = {
    userId,
    username,
    encPassword: encryptSecret(password),
    baselineTaskIds,
    baselineAt: isNew
      ? (FieldValue.serverTimestamp() as unknown as Timestamp)
      : existing!.baselineAt,
    updatedAt: FieldValue.serverTimestamp() as unknown as Timestamp,
  };
  await ref(userId).set(doc);
  return { solvedCount: solved.length, isNew };
}

export async function clearCsesCredential(userId: string): Promise<void> {
  await ref(userId).delete();
}

export async function recordCsesError(
  userId: string,
  message: string
): Promise<void> {
  await ref(userId).set(
    { lastError: message, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
}
