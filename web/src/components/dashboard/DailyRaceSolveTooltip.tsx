import { PlatformLogo, platformHandle } from "@/components/PlatformLogo";
import { CELL_LABEL, cellFor } from "@/lib/dashboard";
import { formatDate, formatTime } from "@/lib/format";
import { formatSolveTime, type MemberRow } from "@/lib/leaderboard";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

function TooltipShell({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute left-0 top-full z-50 mt-1.5 min-w-[12rem] max-w-sm",
        "rounded-lg border border-border bg-card px-3 py-2.5 text-card-foreground shadow-lg",
        "invisible opacity-0 transition-opacity duration-150",
        "group-hover:visible group-hover:opacity-100"
      )}
      role="tooltip"
    >
      {children}
    </div>
  );
}

export function DailyRaceSolveTooltip({
  member,
  timeZone,
}: {
  member: MemberRow;
  timeZone: string;
}) {
  const cell = cellFor(member.todayStatus);
  const solve = member.todaySolve;
  const count = member.todayStatus?.submissionCount;

  if (solve) {
    return (
      <TooltipShell>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Today&apos;s solve
        </p>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <PlatformLogo platform={solve.platform} className="h-5 w-5" />
            <span className="font-mono text-muted-foreground">
              {platformHandle(member, solve.platform)}
            </span>
          </div>
          <p>
            <span className="font-semibold">{solve.problemId}</span>
            {solve.problemName && (
              <span className="text-muted-foreground"> · {solve.problemName}</span>
            )}
          </p>
          <p className="text-muted-foreground">
            {formatDate(solve.timestamp, timeZone)} at{" "}
            {formatTime(solve.timestamp, timeZone)}
          </p>
          <p className="text-muted-foreground">
            Race time:{" "}
            <span className="font-medium text-foreground">
              {formatSolveTime(member.solveTimeMs, timeZone)}
            </span>
          </p>
          {count != null && count > 1 && (
            <p className="text-xs text-muted-foreground">
              +{count - 1} more submission{count - 1 === 1 ? "" : "s"} today
            </p>
          )}
        </div>
      </TooltipShell>
    );
  }

  let body: ReactNode;
  if (cell === "solved") {
    body = (
      <p className="text-sm text-muted-foreground">
        Counted as solved — no submission recorded for today.
      </p>
    );
  } else if (cell === "bank") {
    body = (
      <p className="text-sm text-muted-foreground">
        Bank covered today — no new solve required.
      </p>
    );
  } else if (cell === "miss") {
    body = (
      <p className="text-sm text-muted-foreground">
        Missed today — penalty applied at the day cutoff.
      </p>
    );
  } else if (member.todayStatus?.adminVoidToday) {
    body = (
      <p className="text-sm text-muted-foreground">
        Today&apos;s solve was voided by an admin.
      </p>
    );
  } else {
    body = (
      <p className="text-sm text-muted-foreground">No solve yet today.</p>
    );
  }

  return (
    <TooltipShell>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {CELL_LABEL[cell] === "—" ? "Status" : CELL_LABEL[cell]}
      </p>
      {body}
    </TooltipShell>
  );
}
