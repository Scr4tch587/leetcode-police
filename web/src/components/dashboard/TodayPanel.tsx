import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PunishmentCycleInfo } from "@/lib/punishmentCycle";

export function TodayPanel({
  solved,
  submissionCount,
  hasHandles,
  punishment,
  checkBusy,
  onCheckSelf,
}: {
  solved: boolean;
  submissionCount: number;
  hasHandles: boolean;
  punishment: PunishmentCycleInfo;
  checkBusy: boolean;
  onCheckSelf: () => void;
}) {
  return (
    <Card className="border-2 border-foreground/10">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg">Today</CardTitle>
          <Badge variant={solved ? "default" : "outline"}>
            {solved ? "Solved" : "Pending"}
          </Badge>
        </div>
        <CardDescription>
          {solved
            ? `${submissionCount} accepted problem(s) recorded today.`
            : hasHandles
              ? "Submissions sync from LeetCode / Codeforces / AtCoder / CSES every ~30 min."
              : "Add platform handles in Profile to start tracking."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!solved && !hasHandles && (
          <p className="text-sm">
            <Link
              to="/profile"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Profile → handles
            </Link>
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {punishment.headline}:
          </span>{" "}
          {punishment.detail}
          {punishment.countdown && (
            <span className="font-medium text-primary">
              {" "}
              · {punishment.countdown}
            </span>
          )}
        </p>
      </CardContent>
      {hasHandles && (
        <CardFooter>
          <Button
            variant="outline"
            size="sm"
            disabled={checkBusy}
            onClick={onCheckSelf}
            className="gap-2"
          >
            <RefreshCw
              className={cn("h-4 w-4", checkBusy && "animate-spin")}
            />
            {checkBusy ? "Refreshing…" : "Refresh status"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
