import type { Group } from "@/types";

export function groupScoreLabel(group: Pick<Group, "scoreLabel"> | null | undefined): string {
  const label = group?.scoreLabel?.trim();
  return label || "score";
}
