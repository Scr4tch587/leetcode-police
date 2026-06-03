/**
 * Admin callable functions. All require the caller to be an admin of the same
 * group as the targeted user / submission.
 *
 *   - approveSubmission : accept a pending submission and apply daily/bank logic.
 *   - rejectSubmission  : mark a submission rejected.
 *   - adjustBank        : add/subtract banked problems for a member.
 *   - adjustPenalty     : add/subtract penalty words for a member.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../lib/admin";
import { REGION } from "../config";
import { Collections, Submission, User } from "../types";
import { requireAdmin } from "../lib/callable";
import { adminAdjustForApproval } from "../lib/game";

const opts = { region: REGION };

async function getSameGroupSubmission(
  admin: User,
  submissionId: string
): Promise<Submission> {
  const snap = await db
    .collection(Collections.submissions)
    .doc(submissionId)
    .get();
  if (!snap.exists) throw new HttpsError("not-found", "Submission not found.");
  const sub = snap.data() as Submission;
  if (sub.groupId !== admin.groupId) {
    throw new HttpsError("permission-denied", "Submission is not in your group.");
  }
  return sub;
}

async function assertSameGroupUser(admin: User, userId: string): Promise<User> {
  const snap = await db.collection(Collections.users).doc(userId).get();
  if (!snap.exists) throw new HttpsError("not-found", "User not found.");
  const target = snap.data() as User;
  if (target.groupId !== admin.groupId) {
    throw new HttpsError("permission-denied", "User is not in your group.");
  }
  return target;
}

export const approveSubmission = onCall(opts, async (req) => {
  const admin = await requireAdmin(req);
  const submissionId = req.data?.submissionId as string;
  if (!submissionId) {
    throw new HttpsError("invalid-argument", "submissionId required.");
  }
  const sub = await getSameGroupSubmission(admin, submissionId);
  if (sub.validationStatus === "accepted") {
    return { ok: true, alreadyAccepted: true };
  }

  // Apply the daily/banking effect for the submission's date.
  const outcome = await adminAdjustForApproval(sub.userId, sub.groupId, sub.date);

  await db.collection(Collections.submissions).doc(submissionId).update({
    validationStatus: "accepted",
    reviewNote: FieldValue.delete(),
  });

  return { ok: true, outcome };
});

export const rejectSubmission = onCall(opts, async (req) => {
  const admin = await requireAdmin(req);
  const submissionId = req.data?.submissionId as string;
  const note = (req.data?.note as string | undefined) ?? "Rejected by admin.";
  if (!submissionId) {
    throw new HttpsError("invalid-argument", "submissionId required.");
  }
  await getSameGroupSubmission(admin, submissionId);

  await db.collection(Collections.submissions).doc(submissionId).update({
    validationStatus: "rejected",
    reviewNote: note,
  });
  // Note: if this submission had previously been auto-accepted, use adjustBank
  // / adjustPenalty to correct the member's totals.
  return { ok: true };
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
