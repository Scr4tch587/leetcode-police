import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { PlatformLogo, platformHandle } from "@/components/PlatformLogo";
import { formatDateTimeLine } from "@/lib/format";
import { cn } from "@/lib/utils";
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
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-base">Recent submissions</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {submissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <Table className="min-w-[52rem] w-full table-fixed">
            <TableBody>
              {submissions.map((s) => {
                const user = memberById(s.userId);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="w-[11%] font-medium">
                      {memberName(s.userId)}
                    </TableCell>
                    <TableCell className="w-[4%]">
                      <PlatformLogo platform={s.platform} />
                    </TableCell>
                    <TableCell className="w-[14%] font-mono text-sm text-muted-foreground">
                      <span className="block truncate">
                        {platformHandle(user, s.platform)}
                      </span>
                    </TableCell>
                    <TableCell className="w-auto min-w-0">
                      <span className="block truncate font-medium">
                        {s.problemId}
                        {s.problemName && (
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            · {s.problemName}
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "w-[11rem] shrink-0 whitespace-nowrap text-right",
                        "tabular-nums text-muted-foreground"
                      )}
                    >
                      {formatDateTimeLine(s.timestamp, timeZone)}
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
