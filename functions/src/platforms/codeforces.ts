import { PlatformDetector, PlatformMatch } from "./types";

/**
 * Codeforces detector.
 *
 * Indicators of a Codeforces "Accepted" screenshot:
 *   - "Accepted"
 *   - "OK"  (the verdict column shows a green "OK")
 *   - "Verdict"
 *   - "Codeforces" / "Pretests passed"
 *
 * Problem identifier extraction:
 *   Codeforces problems are addressed as <contestId><index>, e.g. "1850A".
 *   We look for that pattern, or an explicit "Problem A" near a contest number.
 */
export const codeforcesDetector: PlatformDetector = {
  platform: "codeforces",

  analyze(text: string, raw: string): PlatformMatch {
    let score = 0;
    const has = (re: RegExp) => re.test(text);

    if (has(/codeforces/)) score += 2;
    if (has(/\bverdict\b/)) score += 1.5;
    if (has(/pretests? passed/)) score += 1.5;
    if (has(/\bok\b/)) score += 1; // verdict "OK"
    if (has(/time:?\s*\d+\s*ms/)) score += 0.5;
    if (has(/memory:?\s*\d+\s*kb/)) score += 0.5;
    if (has(/problemset|contest|gym/)) score += 0.5;

    const accepted = has(/\baccepted\b/) || has(/\bok\b/) || has(/pretests? passed/);
    if (accepted) score += 2;

    // Problem identifier: contestId + index, e.g. "1850A", "1850 A", "A. Title".
    let problemIdentifier: string | null = null;
    let problemTitle: string | null = null;

    const combined = raw.match(/\b(\d{2,4})\s*([A-H][0-9]?)\b/);
    if (combined) {
      problemIdentifier = `${combined[1]}${combined[2].toUpperCase()}`;
      score += 1;
    } else {
      // "A. Theatre Square" style — index + title without contest number.
      const titled = raw.match(/\b([A-H][0-9]?)\.\s+([A-Za-z][A-Za-z0-9 '()\-/.,&]+)/);
      if (titled) {
        problemIdentifier = titled[1].toUpperCase();
        problemTitle = titled[2].trim().replace(/\s{2,}/g, " ");
        score += 0.5;
      }
    }

    const matched = score >= 3;
    const confidence = matched
      ? Math.min(1, (score + (accepted ? 1 : 0)) / 9)
      : 0;

    return {
      platform: "codeforces",
      matched,
      accepted,
      confidence,
      problemIdentifier,
      problemTitle,
    };
  },
};
