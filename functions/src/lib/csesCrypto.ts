/**
 * Symmetric encryption for stored CSES passwords.
 *
 * CSES has no public accepted-submission feed, so to track accurately we log in
 * as the user, which means we must store their password. We never store it in
 * plaintext: each password is sealed with AES-256-GCM under a single 256-bit
 * master key (`CSES_ENC_KEY`) that lives only in Secret Manager and is injected
 * into the function runtime. The ciphertext is kept in a Functions-only
 * Firestore collection that clients can never read (see firestore.rules).
 *
 * Wire format (base64): [12-byte IV][16-byte GCM tag][ciphertext].
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { CSES_ENC_KEY } from "../config";

const IV_LEN = 12; // GCM standard nonce length
const TAG_LEN = 16;

function masterKey(): Buffer {
  const b64 = CSES_ENC_KEY.value();
  if (!b64) {
    throw new Error(
      "CSES_ENC_KEY is not configured. Set it with: " +
        "head -c 32 /dev/urandom | base64 | firebase functions:secrets:set CSES_ENC_KEY"
    );
  }
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) {
    throw new Error(
      `CSES_ENC_KEY must decode to 32 bytes (got ${key.length}).`
    );
  }
  return key;
}

/** Encrypt a UTF-8 string, returning base64 [IV|tag|ciphertext]. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

/** Decrypt a base64 [IV|tag|ciphertext] blob produced by encryptSecret. */
export function decryptSecret(blob: string): string {
  const buf = Buffer.from(blob, "base64");
  if (buf.length < IV_LEN + TAG_LEN) {
    throw new Error("CSES credential ciphertext is malformed.");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", masterKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
    "utf8"
  );
}
