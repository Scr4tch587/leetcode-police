/** Thin wrapper around the Twilio REST client + MMS media download. */
import twilio from "twilio";
import * as logger from "firebase-functions/logger";
import {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER,
} from "../config";

let client: twilio.Twilio | null = null;

function getClient(): twilio.Twilio {
  if (!client) {
    client = twilio(TWILIO_ACCOUNT_SID.value(), TWILIO_AUTH_TOKEN.value());
  }
  return client;
}

/** Send a plain SMS. Errors are logged but never thrown (best-effort). */
export async function sendSms(to: string, body: string): Promise<void> {
  const from = TWILIO_FROM_NUMBER.value();
  if (!from) {
    logger.warn("TWILIO_FROM_NUMBER not configured; skipping SMS", { to });
    return;
  }
  try {
    await getClient().messages.create({ to, from, body });
  } catch (err) {
    logger.error("Failed to send SMS", { to, err });
  }
}

/** Send the same message to many recipients in parallel. */
export async function broadcastSms(
  recipients: string[],
  body: string
): Promise<void> {
  await Promise.all(recipients.map((to) => sendSms(to, body)));
}

/**
 * Download MMS media. Twilio media URLs require HTTP Basic auth using the
 * account SID + auth token.
 */
export async function downloadTwilioMedia(url: string): Promise<Buffer> {
  const auth = Buffer.from(
    `${TWILIO_ACCOUNT_SID.value()}:${TWILIO_AUTH_TOKEN.value()}`
  ).toString("base64");
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok) {
    throw new Error(`Failed to download media (${res.status}) from ${url}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/** Validate an inbound Twilio webhook signature. */
export function validateTwilioRequest(
  signature: string | undefined,
  url: string,
  params: Record<string, string>
): boolean {
  if (!signature) return false;
  return twilio.validateRequest(
    TWILIO_AUTH_TOKEN.value(),
    signature,
    url,
    params
  );
}
