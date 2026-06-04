import type { Group } from "../types";

export function groupScoreLabel(group: Pick<Group, "scoreLabel">): string {
  const label = group.scoreLabel?.trim();
  return label || "score";
}
