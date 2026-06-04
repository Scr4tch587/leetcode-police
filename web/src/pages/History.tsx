import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/layout/PageHeader";
import { PlatformBadge } from "@/components/PlatformBadge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useGroupMembers,
  useGroupSubmissions,
  useUserSubmissions,
} from "@/hooks/useGroupData";
import { formatDateKey, formatTime, localDateKey } from "@/lib/format";
import type { Submission } from "@/types";

function groupByDate(
  subs: Submission[],
  timeZone: string
): { date: string; label: string; items: Submission[] }[] {
  const map = new Map<string, Submission[]>();
  for (const s of subs) {
    const key = localDateKey(s.timestamp, timeZone);
    const list = map.get(key) ?? [];
    list.push(s);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({
      date,
      label: formatDateKey(date, timeZone),
      items,
    }));
}

function SubmissionTable({
  rows,
  showMember,
  memberName,
  timeZone,
}: {
  rows: Submission[];
  showMember: boolean;
  memberName: (uid: string) => string;
  timeZone: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No submissions yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showMember && <TableHead>Member</TableHead>}
          <TableHead>Platform</TableHead>
          <TableHead>Problem</TableHead>
          <TableHead>Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((s) => (
          <TableRow key={s.id}>
            {showMember && (
              <TableCell className="font-medium">
                {memberName(s.userId)}
              </TableCell>
            )}
            <TableCell>
              <PlatformBadge platform={s.platform} />
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
              {formatTime(s.timestamp, timeZone)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function History() {
  const { profile, group } = useAuth();
  const [scope, setScope] = useState<"mine" | "group">("mine");
  const tz = group?.timezone || "America/Toronto";

  const mine = useUserSubmissions(profile?.id);
  const groupSubs = useGroupSubmissions(group?.id);
  const members = useGroupMembers(group?.id);
  const nameOf = (uid: string) =>
    members.find((m) => m.id === uid)?.displayName ?? uid.slice(0, 6);

  const subs = scope === "mine" ? mine : groupSubs;
  const sections = useMemo(
    () => groupByDate(subs, tz),
    [subs, tz]
  );

  return (
    <>
      <PageHeader
        title="History"
        description="Accepted problems grouped by date"
      />

      <Tabs
        value={scope}
        onValueChange={(v) => setScope(v as "mine" | "group")}
      >
        <TabsList>
          <TabsTrigger value="mine">Mine</TabsTrigger>
          <TabsTrigger value="group">Group</TabsTrigger>
        </TabsList>

        <TabsContent value={scope} className="space-y-4">
          {sections.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No submissions yet.
              </CardContent>
            </Card>
          ) : (
            sections.map((section) => (
              <Card key={section.date}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{section.label}</CardTitle>
                  <CardDescription>
                    {section.items.length} submission
                    {section.items.length === 1 ? "" : "s"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SubmissionTable
                    rows={section.items}
                    showMember={scope === "group"}
                    memberName={nameOf}
                    timeZone={tz}
                  />
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
