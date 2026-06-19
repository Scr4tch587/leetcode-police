/**
 * Account & group lifecycle callable functions.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../lib/admin";
import { REGION, DEFAULT_TIMEZONE } from "../config";
import { Collections, Group, User } from "../types";
import {
  generateInviteCode,
  normalizePhone,
  requireUser,
} from "../lib/callable";
import { verifyAtLeastOneHandle } from "../lib/handleVerify";

const opts = { region: REGION };

function normalizeScoreLabel(raw: string): string {
  const label = raw.trim().slice(0, 120);
  if (label.length < 3) {
    throw new HttpsError(
      "invalid-argument",
      "Score label must be at least 3 characters (e.g. push-ups owed)."
    );
  }
  return label;
}

export const bootstrapUser = onCall(opts, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const uid = req.auth.uid;
  const ref = db.collection(Collections.users).doc(uid);
  const snap = await ref.get();
  if (snap.exists) return { created: false, user: snap.data() };

  const displayName =
    (req.data?.displayName as string | undefined) ||
    (req.auth.token.name as string | undefined) ||
    "Anonymous";

  const user: User = {
    id: uid,
    displayName,
    phoneNumber: "",
    leetcodeUsername: "",
    codeforcesHandle: "",
    atcoderHandle: "",
    csesUserId: "",
    groupId: null,
    score: 0,
    bankedProblems: 0,
    lastProcessedTimestamp: 0,
    isAdmin: false,
    createdAt: FieldValue.serverTimestamp() as unknown as User["createdAt"],
  };
  await ref.set({ ...user, wordPenalty: 0 });
  return { created: true, user };
});

export const updateProfile = onCall(opts, async (req) => {
  const user = await requireUser(req);
  const updates: Partial<User> & { wordPenalty?: number } = {};

  const displayName = req.data?.displayName as string | undefined;
  if (typeof displayName === "string" && displayName.trim()) {
    updates.displayName = displayName.trim().slice(0, 60);
  }

  const phoneRaw = req.data?.phoneNumber as string | undefined;
  if (typeof phoneRaw === "string") {
    if (phoneRaw.trim()) {
      const phone = normalizePhone(phoneRaw);
      if (!/^\+\d{8,15}$/.test(phone)) {
        throw new HttpsError("invalid-argument", "Invalid phone number.");
      }
      const dup = await db
        .collection(Collections.users)
        .where("phoneNumber", "==", phone)
        .limit(1)
        .get();
      if (!dup.empty && dup.docs[0].id !== user.id) {
        throw new HttpsError(
          "already-exists",
          "That phone number is already registered to another account."
        );
      }
      updates.phoneNumber = phone;
    } else {
      updates.phoneNumber = "";
    }
  }

  const nextLc =
    typeof req.data?.leetcodeUsername === "string"
      ? req.data.leetcodeUsername.trim().slice(0, 40)
      : user.leetcodeUsername;
  const nextCf =
    typeof req.data?.codeforcesHandle === "string"
      ? req.data.codeforcesHandle.trim().slice(0, 40)
      : user.codeforcesHandle;
  const nextAc =
    typeof req.data?.atcoderHandle === "string"
      ? req.data.atcoderHandle.trim().slice(0, 40)
      : user.atcoderHandle;
  const nextCs =
    typeof req.data?.csesUserId === "string"
      ? req.data.csesUserId.trim().slice(0, 40)
      : user.csesUserId;

  const handlesTouched =
    typeof req.data?.leetcodeUsername === "string" ||
    typeof req.data?.codeforcesHandle === "string" ||
    typeof req.data?.atcoderHandle === "string" ||
    typeof req.data?.csesUserId === "string";

  if (handlesTouched) {
    await verifyAtLeastOneHandle(nextLc, nextCf, nextAc, nextCs);
    updates.leetcodeUsername = nextLc;
    updates.codeforcesHandle = nextCf;
    updates.atcoderHandle = nextAc;
    updates.csesUserId = nextCs;
  }

  if (Object.keys(updates).length > 0) {
    await db.collection(Collections.users).doc(user.id).update(updates);
  }
  return { ok: true };
});

export const createGroup = onCall(opts, async (req) => {
  const user = await requireUser(req);
  if (user.groupId) {
    throw new HttpsError("failed-precondition", "You're already in a group.");
  }
  const name = (req.data?.name as string | undefined)?.trim();
  if (!name) throw new HttpsError("invalid-argument", "Group name required.");

  const scoreLabelRaw = req.data?.scoreLabel as string | undefined;
  if (!scoreLabelRaw?.trim()) {
    throw new HttpsError(
      "invalid-argument",
      "Score label is required — describe what a penalty means for your group."
    );
  }
  const scoreLabel = normalizeScoreLabel(scoreLabelRaw);

  const timezone =
    (req.data?.timezone as string | undefined) || DEFAULT_TIMEZONE.value();

  const groupRef = db.collection(Collections.groups).doc();
  const inviteCode = generateInviteCode();

  const group: Group = {
    id: groupRef.id,
    name: name.slice(0, 80),
    inviteCode,
    createdBy: user.id,
    timezone,
    scoreLabel,
    createdAt: FieldValue.serverTimestamp() as unknown as Group["createdAt"],
  };

  const batch = db.batch();
  batch.set(groupRef, group);
  batch.update(db.collection(Collections.users).doc(user.id), {
    groupId: groupRef.id,
    isAdmin: true,
  });
  await batch.commit();

  return { groupId: groupRef.id, inviteCode };
});

export const joinGroup = onCall(opts, async (req) => {
  const user = await requireUser(req);
  if (user.groupId) {
    throw new HttpsError("failed-precondition", "You're already in a group.");
  }

  const lc = user.leetcodeUsername?.trim() ?? "";
  const cf = user.codeforcesHandle?.trim() ?? "";
  const ac = user.atcoderHandle?.trim() ?? "";
  const cs = user.csesUserId?.trim() ?? "";
  if (!lc && !cf && !ac && !cs) {
    throw new HttpsError(
      "failed-precondition",
      "Add and save at least one verified LeetCode, Codeforces, AtCoder, or CSES handle in Profile before joining a group."
    );
  }

  const code = (req.data?.inviteCode as string | undefined)
    ?.trim()
    .toUpperCase();
  if (!code) throw new HttpsError("invalid-argument", "Invite code required.");

  const snap = await db
    .collection(Collections.groups)
    .where("inviteCode", "==", code)
    .limit(1)
    .get();
  if (snap.empty) {
    throw new HttpsError("not-found", "No group found for that invite code.");
  }
  const group = snap.docs[0].data() as Group;

  await db.collection(Collections.users).doc(user.id).update({
    groupId: group.id,
    isAdmin: false,
  });
  return { groupId: group.id, groupName: group.name };
});

export const leaveGroup = onCall(opts, async (req) => {
  const user = await requireUser(req);
  if (!user.groupId) {
    throw new HttpsError("failed-precondition", "You're not in a group.");
  }
  await db.collection(Collections.users).doc(user.id).update({
    groupId: null,
    isAdmin: false,
  });
  return { ok: true };
});
