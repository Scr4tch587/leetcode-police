/**
 * OCR pipeline backed by tesseract.js.
 *
 * Cloud Functions provide a writable /tmp directory; we point tesseract's
 * language-data and core caches there so cold starts download the English
 * traineddata once per instance.
 */
import { createWorker } from "tesseract.js";
import * as os from "os";
import * as logger from "firebase-functions/logger";

export interface OcrResult {
  text: string;
  /** Mean word confidence reported by tesseract, 0..1. */
  confidence: number;
}

let workerPromise: ReturnType<typeof createWorker> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker("eng", undefined, {
      cachePath: os.tmpdir(),
      // Keep tesseract quiet in logs.
      logger: () => undefined,
    });
  }
  return workerPromise;
}

/** Run OCR on an image buffer and return the extracted text + confidence. */
export async function runOcr(image: Buffer): Promise<OcrResult> {
  const worker = await getWorker();
  try {
    const { data } = await worker.recognize(image);
    return {
      text: data.text ?? "",
      confidence: typeof data.confidence === "number" ? data.confidence / 100 : 0,
    };
  } catch (err) {
    logger.error("OCR failed", err);
    return { text: "", confidence: 0 };
  }
}
