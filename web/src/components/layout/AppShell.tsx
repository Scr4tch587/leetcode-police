import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
