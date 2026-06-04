import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { sortCycleLeaderboard, type MemberRow } from "@/lib/leaderboard";
import { userScore } from "@/lib/userScore";

export function CycleLeaderboard({
  rows,
  currentUserId,
}: {
  rows: MemberRow[];
  currentUserId?: string;
}) {
  const sorted = sortCycleLeaderboard(rows);

  return (
    <Card className="border border-border">
      <CardHeader>
        <CardTitle className="text-base">Two-week standings</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10" />
              <TableHead />
              <TableHead className="text-right">Score</TableHead>
              <TableHead className="text-right">Banked</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((m, i) => (
              <TableRow
                key={m.id}
                className={cn(m.id === currentUserId && "bg-accent/40")}
              >
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="font-medium">{m.displayName}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {userScore(m)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {m.bankedProblems}
                </TableCell>
              </TableRow>
            ))}
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
