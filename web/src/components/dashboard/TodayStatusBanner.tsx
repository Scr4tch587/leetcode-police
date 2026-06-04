import { CheckCircle2, Landmark, Skull } from "lucide-react";
import { PlatformLogo, platformHandle } from "@/components/PlatformLogo";
import { DeathTimer } from "@/components/dashboard/DeathTimer";
import { formatDate, formatTime } from "@/lib/format";
import { firstSubmissionToday } from "@/lib/leaderboard";
import { cn } from "@/lib/utils";
import { effectiveSolvedToday } from "@/lib/dailyStatus";
import type { ReactNode } from "react";
import type { DailyStatus, Submission, User } from "@/types";

function StatusSubheader({
  children,
  doom = false,
}: {
  children: ReactNode;
  doom?: boolean;
}) {
  return (
    <p
      className={cn(
        "mt-1 text-base italic sm:text-lg",
        doom ? "text-background/75" : "text-muted-foreground"
      )}
    >
      {children}
    </p>
  );
}

function BannerShell({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex w-full rounded-lg border-2 px-6 py-6 sm:py-8",
        className
      )}
    >
      {children}
    </div>
  );
}

function UnsolvedLayout({
  timeZone,
  children,
  doom = false,
}: {
  timeZone: string;
  children: ReactNode;
  doom?: boolean;
}) {
  return (
    <div className="grid w-full grid-cols-1 items-center gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-10">
      <div className="min-w-0">{children}</div>
      <DeathTimer
        timeZone={timeZone}
        variant={doom ? "doom" : "light"}
        className="sm:justify-self-end sm:text-right"
      />
    </div>
  );
}

export function TodayStatusBanner({
  profile,
  todayStr,
  timeZone,
  submissions,
  todayStatus,
}: {
  profile: User | null | undefined;
  todayStr: string;
  timeZone: string;
  submissions: Submission[];
  todayStatus?: DailyStatus;
}) {
  if (!profile) return null;

  const solved = effectiveSolvedToday(todayStatus);
  const bankUsed = todayStatus?.bankUsed ?? false;
  const banked = profile.bankedProblems ?? 0;
  const solve = firstSubmissionToday(
    profile.id,
    todayStr,
    timeZone,
    submissions
  );

  if (solved) {
    if (!solve) {
      return (
        <BannerShell className="border-primary bg-primary/10">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <CheckCircle2 className="h-10 w-10 shrink-0 text-primary" />
            <div>
              <p className="text-2xl font-bold tracking-tight sm:text-3xl">
                Solved
              </p>
              <StatusSubheader>Nice work!</StatusSubheader>
            </div>
          </div>
        </BannerShell>
      );
    }
    return (
      <BannerShell className="border-primary bg-primary/10">
        <div className="flex min-w-0 flex-1 flex-wrap items-start gap-4">
          <CheckCircle2
            className="h-10 w-10 shrink-0 text-primary"
            strokeWidth={2}
          />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-2xl font-bold tracking-tight sm:text-3xl">
                Solved
              </p>
              <StatusSubheader>Nice work!</StatusSubheader>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-base sm:text-lg">
              <span className="flex items-center gap-2">
                <PlatformLogo platform={solve.platform} className="h-6 w-6" />
                <span className="font-mono text-muted-foreground">
                  {platformHandle(profile, solve.platform)}
                </span>
              </span>
              <span className="font-semibold">
                {solve.problemId}
                {solve.problemName && (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {solve.problemName}
                  </span>
                )}
              </span>
              <span className="text-muted-foreground">
                {formatDate(solve.timestamp, timeZone)} at{" "}
                {formatTime(solve.timestamp, timeZone)}
              </span>
            </div>
          </div>
        </div>
      </BannerShell>
    );
  }

  if (bankUsed) {
    return (
      <BannerShell className="border-foreground/20 bg-muted/40">
        <div className="flex items-center gap-4">
          <Landmark className="h-9 w-9 shrink-0 text-foreground" strokeWidth={1.5} />
          <div>
            <p className="text-xl font-semibold tracking-tight sm:text-2xl">
              Bank covered today
            </p>
          </div>
        </div>
      </BannerShell>
    );
  }

  if (banked > 0) {
    return (
      <BannerShell className="border-foreground/15 bg-background">
        <UnsolvedLayout timeZone={timeZone}>
          <div className="flex items-start gap-4">
            <Landmark
              className="h-9 w-9 shrink-0 text-muted-foreground"
              strokeWidth={1.5}
            />
            <div>
              <p className="text-xl font-semibold tracking-tight sm:text-2xl">
                Not solved yet
              </p>
              <StatusSubheader>
                The bank is willing to bail you out {banked} more{" "}
                {banked === 1 ? "time" : "times"}
              </StatusSubheader>
            </div>
          </div>
        </UnsolvedLayout>
      </BannerShell>
    );
  }

  return (
    <BannerShell className="border-foreground bg-foreground text-background">
      <UnsolvedLayout timeZone={timeZone} doom>
        <div className="flex items-center gap-4">
          <Skull
            className="h-10 w-10 shrink-0 text-primary sm:h-11 sm:w-11"
            strokeWidth={1.75}
          />
          <div className="min-w-0">
            <p className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">
              Not solved yet
            </p>
            <StatusSubheader doom>Oh the horror!</StatusSubheader>
          </div>
        </div>
      </UnsolvedLayout>
    </BannerShell>
  );
}
