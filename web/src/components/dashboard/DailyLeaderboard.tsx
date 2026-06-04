import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { cellFor, CELL_LABEL } from "@/lib/dashboard";
import { DailyRaceSolveTooltip } from "@/components/dashboard/DailyRaceSolveTooltip";
import {
  formatSolveTime,
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
          <TableBody>
            {sorted.map((m, i) => {
              const cell = cellFor(m.todayStatus);
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
                  <TableCell className="text-right text-muted-foreground">
                    {m.solvedToday ? (
                      <span className="font-medium text-foreground">
                        {formatSolveTime(m.solveTimeMs, timeZone)}
                      </span>
                    ) : (
                      "—"
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
