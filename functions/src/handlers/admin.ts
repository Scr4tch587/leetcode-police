/**
 * Admin callable functions — manual checks, bank/penalty adjustments.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { db } from "../lib/admin";
import { REGION } from "../config";
import { Collections, User } from "../types";
import { requireAdmin } from "../lib/callable";
import { collectForUsers } from "../lib/collector";

const opts = { region: REGION };
const collectOpts = { ...opts, memory: "512MiB" as const, timeoutSeconds: 120 };

async function getGroupMembers(groupId: string): Promise<User[]> {
  const snap = await db
    .collection(Collections.users)
    .where("groupId", "==", groupId)
    .get();
  return snap.docs.map((d) => d.data() as User);
}

/** Manually poll LeetCode/Codeforces for new submissions (admin only). */
export const runSubmissionCheck = onCall(collectOpts, async (req) => {
  const admin = await requireAdmin(req);
  const targetUserId = req.data?.userId as string | undefined;

  let targets: User[];
  if (targetUserId) {
    const target = await assertSameGroupUser(admin, targetUserId);
    targets = [target];
  } else {
    targets = await getGroupMembers(admin.groupId!);
  }

  const results = await collectForUsers(targets);
  const ingested = results.reduce((s, r) => s + r.ingested, 0);

  logger.info("Manual submission check", {
    adminId: admin.id,
    groupId: admin.groupId,
    ingested,
    members: results.length,
  });

  return { ok: true, ingested, results };
});

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
