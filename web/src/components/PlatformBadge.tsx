import { Badge } from "@/components/ui/badge";
import type { Platform } from "@/types";

const LABEL: Record<Platform, string> = {
  leetcode: "LC",
  codeforces: "CF",
  atcoder: "AC",
};

export function PlatformBadge({ platform }: { platform: Platform }) {
  return (
    <Badge variant={platform === "leetcode" ? "default" : "outline"}>
      {LABEL[platform]}
    </Badge>
  );
}
