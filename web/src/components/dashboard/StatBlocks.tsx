import { Card, CardContent } from "@/components/ui/card";
import type { PunishmentCycleInfo } from "@/lib/punishmentCycle";

export function StatScoreBlock({ value }: { value: number }) {
  return (
    <Card className="border-2 border-primary/25 bg-gradient-to-br from-accent/50 to-background shadow-sm">
      <CardContent className="flex flex-col justify-center px-6 py-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Your score
        </p>
        <p className="mt-2 text-6xl font-bold tabular-nums tracking-tight text-primary sm:text-7xl">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

export function StatBankBlock({ value }: { value: number }) {
  return (
    <Card className="border-2 border-foreground/15 bg-muted/30 shadow-sm">
      <CardContent className="flex flex-col justify-center px-6 py-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Banked
        </p>
        <p className="mt-2 text-6xl font-bold tabular-nums tracking-tight sm:text-7xl">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

export function StatPunishmentBlock({
  punishment,
}: {
  punishment: PunishmentCycleInfo;
}) {
  return (
    <Card className="border border-muted-foreground/15 bg-muted/20 shadow-sm">
      <CardContent className="flex flex-col justify-center px-6 py-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Next reset
        </p>
        <p className="mt-2 text-4xl font-semibold tabular-nums tracking-tight text-foreground sm:text-5xl">
          {punishment.countdown ?? "—"}
        </p>
      </CardContent>
    </Card>
  );
}
