/** Twilio SMS — reminders and summaries only. */
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

export async function broadcastSms(
  recipients: string[],
  body: string
): Promise<void> {
  await Promise.all(recipients.map((to) => sendSms(to, body)));
}
