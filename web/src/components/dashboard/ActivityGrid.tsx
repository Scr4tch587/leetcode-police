import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { cellFor, CELL_LABEL, type DayCell } from "@/lib/dashboard";
import type { DailyStatus, User } from "@/types";

const CELL_STYLES: Record<DayCell, string> = {
  solved: "bg-primary text-primary-foreground",
  bank: "bg-foreground text-background",
  miss: "bg-muted text-muted-foreground line-through",
  none: "bg-background text-muted-foreground border border-border",
};

export function ActivityGrid({
  members,
  days,
  statusByKey,
  scoreLabel,
  currentUserId,
}: {
  members: User[];
  days: string[];
  statusByKey: Map<string, DailyStatus>;
  scoreLabel: string;
  currentUserId?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">14-day activity</CardTitle>
        <CardDescription>
          {`Solved · Bank · Miss (+2 ${scoreLabel}) · No data`}
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-card py-2 pr-3 text-left font-medium text-muted-foreground">
                Member
              </th>
              {days.map((d) => (
                <th
                  key={d}
                  title={d}
                  className="px-0.5 py-2 text-center font-medium text-muted-foreground"
                >
                  {d.slice(5)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td
                  className={cn(
                    "sticky left-0 z-10 bg-card py-1.5 pr-3 font-medium",
                    m.id === currentUserId && "text-primary"
                  )}
                >
                  {m.displayName}
                </td>
                {days.map((d) => {
                  const cell = cellFor(statusByKey.get(`${m.id}_${d}`));
                  return (
                    <td key={d} className="p-0.5">
                      <div
                        title={`${d}: ${CELL_LABEL[cell]}`}
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-sm text-[10px] font-medium",
                          CELL_STYLES[cell]
                        )}
                      >
                        {cell === "none" ? "·" : cell[0].toUpperCase()}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
