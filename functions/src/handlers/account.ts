/**
 * Account & group lifecycle callable functions.
 *
 *   - bootstrapUser : idempotently create the caller's user document.
 *   - updateProfile : set displayName / phoneNumber (validated, unique phone).
 *   - createGroup   : create a group; caller becomes admin + member.
 *   - joinGroup     : join an existing group by invite code.
 *   - leaveGroup    : leave the current group.
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

const opts = { region: REGION };

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
    groupId: null,
    wordPenalty: 0,
    bankedProblems: 0,
    isAdmin: false,
    createdAt: FieldValue.serverTimestamp() as unknown as User["createdAt"],
  };
  await ref.set(user);
  return { created: true, user };
});

export const updateProfile = onCall(opts, async (req) => {
  const user = await requireUser(req);
  const updates: Partial<User> = {};

  const displayName = req.data?.displayName as string | undefined;
  if (typeof displayName === "string" && displayName.trim()) {
    updates.displayName = displayName.trim().slice(0, 60);
  }

  const phoneRaw = req.data?.phoneNumber as string | undefined;
  if (typeof phoneRaw === "string" && phoneRaw.trim()) {
    const phone = normalizePhone(phoneRaw);
    if (!/^\+\d{8,15}$/.test(phone)) {
      throw new HttpsError("invalid-argument", "Invalid phone number.");
    }
    // Enforce uniqueness across all users.
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
  }

  if (Object.keys(updates).length > 0) {
    await db.collection(Collections.users).doc(user.id).update(updates);
  }
  return { ok: true, updates };
});

export const createGroup = onCall(opts, async (req) => {
  const user = await requireUser(req);
  if (user.groupId) {
    throw new HttpsError("failed-precondition", "You're already in a group.");
  }
  const name = (req.data?.name as string | undefined)?.trim();
  if (!name) throw new HttpsError("invalid-argument", "Group name required.");

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
