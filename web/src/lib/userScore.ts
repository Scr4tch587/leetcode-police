import type { User } from "@/types";

export function userScore(user: User | null | undefined): number {
  if (!user) return 0;
  if (typeof user.score === "number") return user.score;
  return user.wordPenalty ?? 0;
}
