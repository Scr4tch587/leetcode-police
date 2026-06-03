import { PlatformDetector, PlatformMatch } from "./types";
import { leetcodeDetector } from "./leetcode";
import { codeforcesDetector } from "./codeforces";

export * from "./types";

/**
 * Registry of supported platforms. To add a new judge (e.g. AtCoder), create a
 * detector implementing PlatformDetector and append it here — no other code
 * needs to change.
 */
export const detectors: PlatformDetector[] = [
  leetcodeDetector,
  codeforcesDetector,
];

/** Normalise OCR text for case-insensitive, whitespace-tolerant matching. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Analyse OCR text across all platforms and return the best match.
 * Falls back to an "unknown" result when nothing matches.
 */
export function detectPlatform(rawText: string): PlatformMatch {
  const normalized = normalize(rawText);
  let best: PlatformMatch | null = null;

  for (const d of detectors) {
    const m = d.analyze(normalized, rawText);
    if (!m.matched) continue;
    if (!best || m.confidence > best.confidence) best = m;
  }

  return (
    best ?? {
      platform: "unknown",
      matched: false,
      accepted: false,
      confidence: 0,
      problemIdentifier: null,
      problemTitle: null,
    }
  );
}
