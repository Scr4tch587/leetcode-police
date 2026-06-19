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
  atcoder: {
    src: "https://atcoder.jp/favicon.ico",
    alt: "AtCoder",
  },
  cses: {
    src: "https://cses.fi/logo.png",
    alt: "CSES",
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
  user:
    | Pick<
        User,
        | "leetcodeUsername"
        | "codeforcesHandle"
        | "atcoderHandle"
        | "csesUserId"
      >
    | undefined,
  platform: Platform
): string {
  if (!user) return "—";
  if (platform === "leetcode") {
    return user.leetcodeUsername?.trim() || "—";
  }
  if (platform === "atcoder") {
    return user.atcoderHandle?.trim() || "—";
  }
  if (platform === "cses") {
    return user.csesUserId?.trim() || "—";
  }
  return user.codeforcesHandle?.trim() || "—";
}
