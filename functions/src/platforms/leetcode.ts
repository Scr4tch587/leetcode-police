import { PlatformDetector, PlatformMatch } from "./types";

/**
 * LeetCode detector.
 *
 * Indicators of a LeetCode "Accepted" screenshot:
 *   - "Accepted"
 *   - "Runtime"
 *   - "Memory"
 *   - "All test cases passed" / "N / N testcases passed"
 *
 * Problem identifier extraction:
 *   "217. Contains Duplicate"  -> id "217", title "Contains Duplicate"
 */
export const leetcodeDetector: PlatformDetector = {
  platform: "leetcode",

  analyze(text: string, raw: string): PlatformMatch {
    let score = 0;
    const has = (re: RegExp) => re.test(text);

    // Brand / chrome signals.
    if (has(/leetcode/)) score += 2;
    if (has(/runtime/)) score += 1;
    if (has(/memory/)) score += 1;
    if (has(/all test cases passed/)) score += 2;
    if (has(/\d+\s*\/\s*\d+\s*test ?cases? passed/)) score += 2;
    if (has(/beats\s+\d+(\.\d+)?\s*%/)) score += 1; // "Beats 95.4%"
    if (has(/editorial|submissions|solution/)) score += 0.5;

    const accepted = has(/\baccepted\b/);
    if (accepted) score += 2;

    // Problem identifier: "217. Contains Duplicate" (also tolerate OCR noise).
    let problemIdentifier: string | null = null;
    let problemTitle: string | null = null;
    const idMatch = raw.match(/\b(\d{1,4})\.\s+([A-Za-z][A-Za-z0-9 '()\-/.,&]+)/);
    if (idMatch) {
      problemIdentifier = idMatch[1];
      problemTitle = idMatch[2].trim().replace(/\s{2,}/g, " ");
      score += 1;
    }

    const matched = score >= 3;
    // Confidence reflects how strongly we believe this is an accepted LC subm.
    const confidence = matched
      ? Math.min(1, (score + (accepted ? 2 : 0)) / 9)
      : 0;

    return {
      platform: "leetcode",
      matched,
      accepted,
      confidence,
      problemIdentifier,
      problemTitle,
    };
  },
};
