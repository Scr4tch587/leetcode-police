import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { cellFor, CELL_LABEL, type DayCell } from "@/lib/dashboard";
import { userScore } from "@/lib/userScore";
import type { DailyStatus, User } from "@/types";

function todayBadge(cell: DayCell) {
  const variant =
    cell === "solved"
      ? "default"
      : cell === "miss"
        ? "destructive"
        : "outline";
  return (
    <Badge variant={variant} className="font-normal">
      {CELL_LABEL[cell]}
    </Badge>
  );
}

export function StandingsTable({
  members,
  todayStatus,
  todayStr,
  scoreLabel,
  currentUserId,
}: {
  members: User[];
  todayStatus: Map<string, DailyStatus>;
  todayStr: string;
  scoreLabel: string;
  currentUserId?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Standings</CardTitle>
        <CardDescription>Sorted by lowest {scoreLabel}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Member</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead className="text-right">Banked</TableHead>
              <TableHead>Today</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m, i) => {
              const ds = todayStatus.get(`${m.id}_${todayStr}`);
              return (
                <TableRow
                  key={m.id}
                  className={cn(m.id === currentUserId && "bg-accent/40")}
                >
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{m.displayName}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {userScore(m)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.bankedProblems}
                  </TableCell>
                  <TableCell>{todayBadge(cellFor(ds))}</TableCell>
                </TableRow>
              );
            })}
            {members.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
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
