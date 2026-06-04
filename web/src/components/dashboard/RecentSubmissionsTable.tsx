import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { PlatformLogo, platformHandle } from "@/components/PlatformLogo";
import { formatDate, formatTime } from "@/lib/format";
import type { Submission, User } from "@/types";

export function RecentSubmissionsTable({
  submissions,
  memberName,
  memberById,
  timeZone,
  emptyMessage = "No submissions yet.",
}: {
  submissions: Submission[];
  memberName: (userId: string) => string;
  memberById: (userId: string) => User | undefined;
  timeZone?: string;
  emptyMessage?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent submissions</CardTitle>
      </CardHeader>
      <CardContent>
        {submissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <Table>
            <TableBody>
              {submissions.map((s) => {
                const user = memberById(s.userId);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      {memberName(s.userId)}
                    </TableCell>
                    <TableCell>
                      <PlatformLogo platform={s.platform} />
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {platformHandle(user, s.platform)}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{s.problemId}</span>
                      {s.problemName && (
                        <span className="text-muted-foreground">
                          {" "}
                          · {s.problemName}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(s.timestamp, timeZone)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatTime(s.timestamp, timeZone)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
