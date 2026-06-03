/**
 * Admin callable functions — manual bank/penalty adjustments only.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../lib/admin";
import { REGION } from "../config";
import { Collections, User } from "../types";
import { requireAdmin } from "../lib/callable";

const opts = { region: REGION };

async function assertSameGroupUser(admin: User, userId: string): Promise<User> {
  const snap = await db.collection(Collections.users).doc(userId).get();
  if (!snap.exists) throw new HttpsError("not-found", "User not found.");
  const target = snap.data() as User;
  if (target.groupId !== admin.groupId) {
    throw new HttpsError("permission-denied", "User is not in your group.");
  }
  return target;
}

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

export const adjustPenalty = onCall(opts, async (req) => {
  const admin = await requireAdmin(req);
  const userId = req.data?.userId as string;
  const delta = Number(req.data?.delta);
  if (!userId || !Number.isFinite(delta)) {
    throw new HttpsError("invalid-argument", "userId and numeric delta required.");
  }
  const target = await assertSameGroupUser(admin, userId);
  const next = Math.max(0, target.wordPenalty + delta);
  await db.collection(Collections.users).doc(userId).update({
    wordPenalty: next,
  });
  return { ok: true, wordPenalty: next };
});
