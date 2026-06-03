/**
 * Inbound Twilio webhook: a user texts a screenshot of an accepted solution.
 *
 * Pipeline:
 *   1. Validate the request actually came from Twilio.
 *   2. Resolve the sender to a Problem Club user (by phone number).
 *   3. Download the MMS image and run OCR.
 *   4. Detect the platform + problem identifier.
 *   5. Check for duplicates (ProblemHistory) and apply the daily/banking logic.
 *   6. Persist the submission + screenshot, and reply over SMS (TwiML).
 */
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../lib/admin";
import {
  REGION,
  TWILIO_AUTH_TOKEN,
  VALIDATE_TWILIO_SIGNATURE,
} from "../config";
import {
  Collections,
  Group,
  Submission,
  User,
  ValidationStatus,
} from "../types";
import { downloadTwilioMedia, validateTwilioRequest } from "../lib/twilio";
import { runOcr } from "../lib/ocr";
import { detectPlatform } from "../platforms";
import { uploadScreenshot } from "../lib/storage";
import { applyAcceptedSubmission } from "../lib/game";
import { today } from "../lib/dates";

function twiml(message: string): string {
  const escaped = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
}

async function findUserByPhone(phone: string): Promise<User | null> {
  const snap = await db
    .collection(Collections.users)
    .where("phoneNumber", "==", phone)
    .limit(1)
    .get();
  return snap.empty ? null : (snap.docs[0].data() as User);
}

export const twilioWebhook = onRequest(
  {
    region: REGION,
    memory: "1GiB",
    timeoutSeconds: 120,
    secrets: [TWILIO_AUTH_TOKEN],
    // Twilio posts from the public internet; this endpoint is intentionally
    // unauthenticated but is protected by signature validation.
    invoker: "public",
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const params = (req.body ?? {}) as Record<string, string>;

    // 1. Verify the request came from Twilio.
    if (VALIDATE_TWILIO_SIGNATURE.value() === "true") {
      const signature = req.header("X-Twilio-Signature");
      const url = `https://${req.hostname}${req.originalUrl}`;
      if (!validateTwilioRequest(signature, url, params)) {
        logger.warn("Rejected request with invalid Twilio signature", { url });
        res.status(403).send("Invalid signature");
        return;
      }
    }

    const from = params.From;
    const numMedia = parseInt(params.NumMedia ?? "0", 10);

    res.set("Content-Type", "text/xml");

    // 2. Resolve sender.
    const user = from ? await findUserByPhone(from) : null;
    if (!user) {
      res.send(
        twiml(
          "We couldn't find a Problem Club account for this number. " +
            "Sign in at the dashboard and add this phone number to your profile."
        )
      );
      return;
    }
    if (!user.groupId) {
      res.send(twiml("You're not in a group yet. Create or join one first."));
      return;
    }

    if (numMedia === 0) {
      res.send(
        twiml("Please attach a screenshot of your accepted solution.")
      );
      return;
    }

    const groupSnap = await db
      .collection(Collections.groups)
      .doc(user.groupId)
      .get();
    const group = groupSnap.data() as Group | undefined;
    const tz = group?.timezone || "America/Toronto";
    const date = today(tz);

    const mediaUrl = params.MediaUrl0;
    const contentType = params.MediaContentType0 || "image/jpeg";

    // Pre-create the submission id so the screenshot path is deterministic.
    const subRef = db.collection(Collections.submissions).doc();

    try {
      // 3. Download + OCR.
      const image = await downloadTwilioMedia(mediaUrl);
      const ocr = await runOcr(image);

      // 4. Detect platform / identifier.
      const detection = detectPlatform(ocr.text);

      // 5. Persist screenshot.
      const screenshotUrl = await uploadScreenshot(
        image,
        contentType,
        subRef.id
      );

      let validationStatus: ValidationStatus;
      let reviewNote: string | undefined;
      let reply: string;

      if (!detection.accepted) {
        // OCR could not find an accepted verdict.
        validationStatus = "failed";
        reviewNote =
          "No 'Accepted' verdict detected in the screenshot via OCR.";
        reply =
          "We couldn't detect an 'Accepted' verdict in that screenshot. " +
          "An admin can review it manually if you think this is a mistake.";
        // Still flag for review rather than discard.
        validationStatus = "pending";
      } else {
        // 6. Apply game logic.
        const outcome = await applyAcceptedSubmission({
          userId: user.id,
          groupId: user.groupId,
          date,
          platform: detection.platform,
          problemIdentifier: detection.problemIdentifier,
        });

        if (outcome.kind === "duplicate") {
          validationStatus = "pending";
          reviewNote = `Problem ${detection.platform}/${detection.problemIdentifier} already submitted by this user.`;
          reply =
            "Looks like you've already submitted this problem before. " +
            "It's been sent for manual review.";
        } else if (outcome.kind === "satisfied") {
          validationStatus = "accepted";
          reply = `✅ Accepted! Today's problem is done${
            detection.problemTitle ? ` (${detection.problemTitle})` : ""
          }.`;
        } else {
          validationStatus = "accepted";
          reply =
            "✅ Accepted and banked! You're ahead — this counts toward a " +
            "future missed day.";
        }
      }

      const submission: Submission = {
        id: subRef.id,
        userId: user.id,
        groupId: user.groupId,
        timestamp: FieldValue.serverTimestamp() as unknown as Submission["timestamp"],
        platform: detection.platform,
        problemIdentifier: detection.problemIdentifier,
        problemTitle: detection.problemTitle,
        screenshotUrl,
        validationStatus,
        date,
        ocrText: ocr.text.slice(0, 4000),
        ocrConfidence: Number(detection.confidence.toFixed(3)),
        reviewNote,
      };
      await subRef.set(submission);

      res.send(twiml(reply));
    } catch (err) {
      logger.error("Error processing submission", { err, userId: user.id });
      // Record a failed submission for visibility.
      await subRef
        .set({
          id: subRef.id,
          userId: user.id,
          groupId: user.groupId,
          timestamp: FieldValue.serverTimestamp(),
          platform: "unknown",
          problemIdentifier: null,
          problemTitle: null,
          screenshotUrl: "",
          validationStatus: "failed",
          date,
          reviewNote: "Internal error while processing the submission.",
        })
        .catch(() => undefined);
      res.send(
        twiml(
          "Something went wrong processing your screenshot. Please try again."
        )
      );
    }
  }
);
