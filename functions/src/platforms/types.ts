import { Platform } from "../types";

/** Result of analysing OCR text for a single platform. */
export interface PlatformMatch {
  platform: Platform;
  /** True if the screenshot clearly belongs to this platform. */
  matched: boolean;
  /** True if an "accepted"/"OK" verdict was detected. */
  accepted: boolean;
  /** 0..1 confidence that this is an accepted submission on this platform. */
  confidence: number;
  /** Canonical problem id, e.g. "217" (LeetCode) or "1850A" (Codeforces). */
  problemIdentifier: string | null;
  /** Human-readable title if extractable. */
  problemTitle: string | null;
}

/**
 * A PlatformDetector knows how to recognise one platform from OCR text and to
 * extract the problem identifier. Add a new file implementing this interface
 * and register it in `platforms/index.ts` to support another judge.
 */
export interface PlatformDetector {
  readonly platform: Platform;
  analyze(normalizedText: string, rawText: string): PlatformMatch;
}
