import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useGroupDailyStatus, useGroupMembers } from "@/hooks/useGroupData";
import { manualCheckMessage } from "@/lib/checkMessages";
import { localDate } from "@/lib/dashboard";
import { groupScoreLabel } from "@/lib/groupScore";
import { userScore } from "@/lib/userScore";

export function Admin() {
  const { profile, group } = useAuth();
  const members = useGroupMembers(profile?.groupId);
  const dailyStatuses = useGroupDailyStatus(profile?.groupId);
  const todayStr = group ? localDate(group.timezone) : "";
  const yesterdayStr = group ? localDate(group.timezone, -1) : "";
  const [scoreLabel, setScoreLabel] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkMsg, setCheckMsg] = useState<string | null>(null);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

  useEffect(() => {
    if (group) setScoreLabel(groupScoreLabel(group));
  }, [group]);

  if (!profile?.isAdmin) {
    return <p className="text-sm text-muted-foreground">Admins only.</p>;
  }

  const wrap = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const saveScoreLabel = async () => {
    setBusyId("score-label");
    setError(null);
    setSettingsMsg(null);
    try {
      await api.updateGroupSettings({ scoreLabel });
      setSettingsMsg("Score label updated.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageHeader title="Admin" description="Group settings and manual tools" />

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {settingsMsg && (
        <Alert className="mb-4 border-primary/30 bg-accent/50">
          <AlertDescription>{settingsMsg}</AlertDescription>
        </Alert>
      )}
      {checkMsg && (
        <Alert className="mb-4 border-primary/30 bg-accent/50">
          <AlertDescription>
            <pre className="whitespace-pre-wrap font-mono text-xs">{checkMsg}</pre>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Score label</CardTitle>
            <CardDescription>
              Shown under each member&apos;s score on the dashboard (e.g. push-ups
              owed).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="scoreLabel">Label text</Label>
            <Input
              id="scoreLabel"
              value={scoreLabel}
              onChange={(e) => setScoreLabel(e.target.value)}
            />
          </CardContent>
          <CardFooter>
            <Button
              disabled={busyId === "score-label" || scoreLabel.trim().length < 3}
              onClick={() => void saveScoreLabel()}
            >
              {busyId === "score-label" ? "Saving…" : "Save label"}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submission sync</CardTitle>
            <CardDescription>
              Poll LeetCode, Codeforces, and AtCoder (same as the 30-minute cron).
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              disabled={busyId === "check-all"}
              onClick={() =>
                void wrap("check-all", async () => {
                  const res = await api.runSubmissionCheck({});
                  setCheckMsg(manualCheckMessage(res));
                })
              }
            >
              {busyId === "check-all" ? "Checking…" : "Check entire group"}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Members</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Handles</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead>Adjust</TableHead>
                  <TableHead className="text-right">Bank</TableHead>
                  <TableHead>Adjust</TableHead>
                  <TableHead>Today</TableHead>
                  <TableHead>Sync</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => {
                  const todayStatus = dailyStatuses.find(
                    (s) => s.userId === m.id && s.date === todayStr
                  );
                  const yesterdayStatus = dailyStatuses.find(
                    (s) => s.userId === m.id && s.date === yesterdayStr
                  );
                  const missDate = todayStatus?.penaltyApplied
                    ? todayStr
                    : yesterdayStatus?.penaltyApplied
                      ? yesterdayStr
                      : null;
                  return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.displayName}</TableCell>
                    <TableCell className="max-w-[10rem] truncate text-xs text-muted-foreground">
                      {m.leetcodeUsername || "—"} / {m.codeforcesHandle || "—"}{" "}
                      / {m.atcoderHandle || "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {userScore(m)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busyId === `sc-${m.id}`}
                          onClick={() =>
                            void wrap(`sc-${m.id}`, () =>
                              api.adjustScore({ userId: m.id, delta: -2 })
                            )
                          }
                        >
                          −2
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busyId === `sc-${m.id}`}
                          onClick={() =>
                            void wrap(`sc-${m.id}`, () =>
                              api.adjustScore({ userId: m.id, delta: 2 })
                            )
                          }
                        >
                          +2
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{m.bankedProblems}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busyId === `bank-${m.id}`}
                          onClick={() =>
                            void wrap(`bank-${m.id}`, () =>
                              api.adjustBank({ userId: m.id, delta: -1 })
                            )
                          }
                        >
                          −1
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busyId === `bank-${m.id}`}
                          onClick={() =>
                            void wrap(`bank-${m.id}`, () =>
                              api.adjustBank({ userId: m.id, delta: 1 })
                            )
                          }
                        >
                          +1
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            busyId === `grant-${m.id}` ||
                            busyId === `void-${m.id}` ||
                            busyId === `miss-${m.id}`
                          }
                          onClick={() => {
                            if (
                              !confirm(
                                `Grant ${m.displayName} solved for today without a submission? Expires at 4 AM if they still have not solved. No bank is added.`
                              )
                            ) {
                              return;
                            }
                            void wrap(`grant-${m.id}`, async () => {
                              const res = await api.grantTodaySolve({
                                userId: m.id,
                              });
                              setSettingsMsg(
                                res.alreadySolved
                                  ? `${m.displayName} already counts as solved today.`
                                  : `Granted ${m.displayName} solved for today${res.wasVoided ? " (cleared void)" : ""}.`
                              );
                            });
                          }}
                        >
                          Grant
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            busyId === `grant-${m.id}` ||
                            busyId === `void-${m.id}` ||
                            busyId === `miss-${m.id}`
                          }
                          onClick={() => {
                            if (
                              !confirm(
                                `Nullify ${m.displayName}'s solved-today status until they solve again? (Submissions stay; a new solve or Refresh status restores solved.) Extra bank from today is reversed.`
                              )
                            ) {
                              return;
                            }
                            void wrap(`void-${m.id}`, async () => {
                              const res = await api.nullifyTodaySolve({
                                userId: m.id,
                              });
                              setSettingsMsg(
                                res.alreadyVoid
                                  ? `${m.displayName} was already voided today.`
                                  : `Nullified ${m.displayName} for today${res.extrasReversed > 0 ? ` (reversed ${res.extrasReversed} banked from extras)` : ""}.`
                              );
                            });
                          }}
                        >
                          Void
                        </Button>
                        {missDate && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busyId === `miss-${m.id}`}
                            onClick={() => {
                              if (
                                !confirm(
                                  `Clear ${m.displayName}'s miss for ${missDate}? Their score will go down by 2.`
                                )
                              ) {
                                return;
                              }
                              void wrap(`miss-${m.id}`, async () => {
                                const res = await api.clearDayMiss({
                                  userId: m.id,
                                  date: missDate,
                                });
                                setSettingsMsg(
                                  res.alreadyClear
                                    ? `${m.displayName} has no miss on ${missDate}.`
                                    : `Cleared miss for ${m.displayName} on ${missDate} (−${res.scoreReversed} score).`
                                );
                              });
                            }}
                          >
                            Clear miss
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busyId === `check-${m.id}`}
                        onClick={() =>
                          void wrap(`check-${m.id}`, async () => {
                            const res = await api.runSubmissionCheck({
                              userId: m.id,
                            });
                            setCheckMsg(manualCheckMessage(res));
                          })
                        }
                      >
                        Check
                      </Button>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
