/**
 * Runtime configuration & secrets.
 *
 * We use the firebase-functions v2 params API so that configuration is declared
 * in code (IAC-friendly) and validated at deploy time. Secrets are stored in
 * Google Secret Manager and injected into the runtime — never committed.
 */
import { defineString, defineSecret } from "firebase-functions/params";

/**
 * Default region for all functions. Must match Firestore's region
 * (northamerica-northeast2) — cross-region reads bill as network egress.
 * Keep in sync with the web app's VITE_FUNCTIONS_REGION.
 */
export const REGION = "northamerica-northeast2";

/**
 * Region for scheduled functions only. Cloud Scheduler does not exist in
 * northamerica-northeast2, so cron-triggered functions run from Montreal;
 * their post-optimization Firestore traffic is small enough not to matter.
 */
export const SCHEDULE_REGION = "northamerica-northeast1";

/**
 * Default group timezone, used for scheduled jobs and for computing the local
 * "day" of a submission. Individual groups may override via their `timezone`
 * field, but scheduled triggers fire on this single timezone (Cloud Scheduler
 * cron is per-function, not per-group).
 */
export const DEFAULT_TIMEZONE = defineString("TIMEZONE", {
  default: "America/Toronto",
  description: "IANA timezone for daily cutoff, reminders and summaries.",
});

// ---- Twilio ----------------------------------------------------------------
export const TWILIO_ACCOUNT_SID = defineString("TWILIO_ACCOUNT_SID", {
  default: "",
  description: "Twilio Account SID (starts with AC...).",
});

export const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");

export const TWILIO_FROM_NUMBER = defineString("TWILIO_FROM_NUMBER", {
  default: "",
  description: "Twilio phone number that sends SMS, in E.164 format.",
});

// ---- CSES credential encryption --------------------------------------------
/**
 * 256-bit master key (base64-encoded 32 bytes) used to AES-256-GCM encrypt the
 * CSES passwords we store. Held only in Secret Manager and injected into the
 * runtime of the functions that read/write credentials — never in Firestore,
 * code, or the client. Generate + set with:
 *   head -c 32 /dev/urandom | base64 | \
 *     firebase functions:secrets:set CSES_ENC_KEY
 */
export const CSES_ENC_KEY = defineSecret("CSES_ENC_KEY");

