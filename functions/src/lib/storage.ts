/** Helpers for persisting submission screenshots to Cloud Storage. */
import { storage } from "./admin";
import { STORAGE_BUCKET } from "../config";

/** The configured screenshots bucket, or the project default when unset. */
function bucketRef() {
  const name = STORAGE_BUCKET.value();
  return name ? storage.bucket(name) : storage.bucket();
}

/**
 * Upload a screenshot and return a long-lived signed URL. We use a signed URL
 * (rather than making the object public) so screenshots are not world-readable;
 * the URL is stored on the submission doc which is itself protected by
 * group-scoped Firestore rules.
 */
export async function uploadScreenshot(
  buffer: Buffer,
  contentType: string,
  submissionId: string
): Promise<string> {
  const bucket = bucketRef();
  const ext = contentType.includes("png") ? "png" : "jpg";
  const file = bucket.file(`screenshots/${submissionId}.${ext}`);
  await file.save(buffer, {
    contentType,
    resumable: false,
    metadata: { cacheControl: "private, max-age=0" },
  });
  // Signed URL valid for 10 years (effectively permanent for this use case).
  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
  });
  return url;
}
