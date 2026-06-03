/** Shared helpers for callable (onCall) functions. */
import { CallableRequest, HttpsError } from "firebase-functions/v2/https";
import { db } from "./admin";
import { Collections, User } from "../types";

/** Resolve the authenticated caller's user document, or throw. */
export async function requireUser(req: CallableRequest): Promise<User> {
  if (!req.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const snap = await db
    .collection(Collections.users)
    .doc(req.auth.uid)
    .get();
  if (!snap.exists) {
    throw new HttpsError("failed-precondition", "User profile not found.");
  }
  return snap.data() as User;
}

/** Resolve the caller and assert they are an admin of their group. */
export async function requireAdmin(req: CallableRequest): Promise<User> {
  const user = await requireUser(req);
  if (!user.isAdmin || !user.groupId) {
    throw new HttpsError("permission-denied", "Admin access required.");
  }
  return user;
}

/** Normalise a phone number to E.164-ish (digits with leading +). */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  // Assume North American number if 10 digits.
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

/** Generate a short, human-friendly invite code. */
export function generateInviteCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}
