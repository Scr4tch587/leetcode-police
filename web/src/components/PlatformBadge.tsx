import { Badge } from "@/components/ui/badge";
import type { Platform } from "@/types";

export function PlatformBadge({ platform }: { platform: Platform }) {
  return (
    <Badge variant={platform === "leetcode" ? "default" : "outline"}>
      {platform === "leetcode" ? "LC" : "CF"}
    </Badge>
  );
}
