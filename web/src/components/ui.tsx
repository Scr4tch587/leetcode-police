import type { ReactNode } from "react";
import type { Platform } from "../types";

export function Card({
  title,
  children,
  actions,
}: {
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="card">
      {(title || actions) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function PlatformBadge({ platform }: { platform: Platform }) {
  const label = platform === "leetcode" ? "LeetCode" : "Codeforces";
  return <span className={`badge badge-platform ${platform}`}>{label}</span>;
}
