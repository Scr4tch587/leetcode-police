/** Small shared UI primitives. */
import type { ReactNode } from "react";
import type { Platform, ValidationStatus } from "../types";

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

export function StatusBadge({ status }: { status: ValidationStatus }) {
  const map: Record<ValidationStatus, string> = {
    accepted: "badge-green",
    pending: "badge-amber",
    rejected: "badge-red",
    failed: "badge-grey",
  };
  return <span className={`badge ${map[status]}`}>{status}</span>;
}

export function PlatformBadge({ platform }: { platform: Platform }) {
  const label =
    platform === "leetcode"
      ? "LeetCode"
      : platform === "codeforces"
        ? "Codeforces"
        : "Unknown";
  return <span className={`badge badge-platform ${platform}`}>{label}</span>;
}
