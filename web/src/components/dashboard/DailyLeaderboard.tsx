import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { cellFor, CELL_LABEL } from "@/lib/dashboard";
import { DailyRaceSolveTooltip } from "@/components/dashboard/DailyRaceSolveTooltip";
import {
  raceSolveTimeLabel,
  sortDailyLeaderboard,
  type MemberRow,
} from "@/lib/leaderboard";

export function DailyLeaderboard({
  rows,
  timeZone,
  currentUserId,
}: {
  rows: MemberRow[];
  timeZone: string;
  currentUserId?: string;
}) {
  const sorted = sortDailyLeaderboard(rows);

  return (
    <Card className="overflow-visible border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="text-base">Today&apos;s race</CardTitle>
      </CardHeader>
      <CardContent className="overflow-visible">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8" />
              <TableHead>Member</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-28 text-right">Solved at</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((m, i) => {
              const cell = cellFor(m.todayStatus);
              const solvedAt = raceSolveTimeLabel(m, timeZone);
              return (
                <TableRow
                  key={m.id}
                  className={cn(
                    "group relative cursor-default",
                    m.id === currentUserId && "bg-accent/40"
                  )}
                >
                  <TableCell className="w-8 text-muted-foreground">
                    {i + 1}
                  </TableCell>
                  <TableCell className="relative font-medium">
                    {m.displayName}
                    <DailyRaceSolveTooltip member={m} timeZone={timeZone} />
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        cell === "solved"
                          ? "default"
                          : cell === "miss"
                            ? "destructive"
                            : "outline"
                      }
                      className="font-normal"
                    >
                      {CELL_LABEL[cell]}
                    </Badge>
                  </TableCell>
                  <TableCell className="w-28 text-right tabular-nums">
                    {solvedAt ? (
                      <span className="font-semibold text-foreground">
                        {solvedAt}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  No members yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
