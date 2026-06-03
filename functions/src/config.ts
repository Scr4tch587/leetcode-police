/**
 * Runtime configuration & secrets.
 *
 * We use the firebase-functions v2 params API so that configuration is declared
 * in code (IAC-friendly) and validated at deploy time. Secrets are stored in
 * Google Secret Manager and injected into the runtime — never committed.
 */
import { defineString, defineSecret } from "firebase-functions/params";

/** Default region for all functions. */
export const REGION = "us-central1";

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

