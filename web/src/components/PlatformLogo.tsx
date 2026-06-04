import { cn } from "@/lib/utils";
import type { Platform, User } from "@/types";

const LOGO: Record<Platform, { src: string; alt: string }> = {
  leetcode: {
    src: "https://leetcode.com/favicon.ico",
    alt: "LeetCode",
  },
  codeforces: {
    src: "https://codeforces.org/favicon.ico",
    alt: "Codeforces",
  },
};

export function PlatformLogo({
  platform,
  className,
}: {
  platform: Platform;
  className?: string;
}) {
  const { src, alt } = LOGO[platform];
  return (
    <img
      src={src}
      alt={alt}
      width={20}
      height={20}
      className={cn("h-5 w-5 shrink-0 rounded-sm object-contain", className)}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}

export function platformHandle(
  user: Pick<User, "leetcodeUsername" | "codeforcesHandle"> | undefined,
  platform: Platform
): string {
  if (!user) return "—";
  if (platform === "leetcode") {
    return user.leetcodeUsername?.trim() || "—";
  }
  return user.codeforcesHandle?.trim() || "—";
}
