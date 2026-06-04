import { useEffect, useState } from "react";
import { formatDeathTimer, msUntilEndOfCalendarDay } from "@/lib/midnight";
import { cn } from "@/lib/utils";

/** Live countdown to the next game-day cutoff (frame-accurate). */
export function useGameDayMsLeft(timeZone: string): number {
  const [msLeft, setMsLeft] = useState(() =>
    msUntilEndOfCalendarDay(timeZone)
  );

  useEffect(() => {
    const tick = () => setMsLeft(msUntilEndOfCalendarDay(timeZone));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timeZone]);

  return msLeft;
}

export function DeathTimer({
  timeZone,
  className,
  variant = "light",
}: {
  timeZone: string;
  className?: string;
  variant?: "light" | "doom";
}) {
  const msLeft = useGameDayMsLeft(timeZone);
  const doom = variant === "doom";

  return (
    <div className={cn("w-full shrink-0 text-right sm:w-auto", className)}>
      <p
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.25em]",
          doom ? "text-background/50" : "text-muted-foreground"
        )}
      >
        Death timer
      </p>
      <p
        className="mt-1 whitespace-nowrap font-mono text-4xl font-bold tabular-nums tracking-tight text-primary sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl"
        aria-live="polite"
      >
        {formatDeathTimer(msLeft)}
      </p>
    </div>
  );
}
