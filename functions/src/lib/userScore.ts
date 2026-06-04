import type { User } from "../types";

/** Read penalty score; supports legacy `wordPenalty` field. */
export function readScore(data: {
  score?: number;
  wordPenalty?: number;
}): number {
  if (typeof data.score === "number") return data.score;
  if (typeof data.wordPenalty === "number") return data.wordPenalty;
  return 0;
}

export function scoreOf(user: User): number {
  return readScore(user);
}
