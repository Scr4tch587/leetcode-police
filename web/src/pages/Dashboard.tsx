import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/api";
import { CycleLeaderboard } from "@/components/dashboard/CycleLeaderboard";
import { DailyLeaderboard } from "@/components/dashboard/DailyLeaderboard";
import { RecentSubmissionsTable } from "@/components/dashboard/RecentSubmissionsTable";
import { TodayStatusBanner } from "@/components/dashboard/TodayStatusBanner";
import {
  StatBankBlock,
  StatPunishmentBlock,
  StatScoreBlock,
} from "@/components/dashboard/StatBlocks";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  useGroupDailyStatus,
  useGroupMembers,
  useGroupSubmissions,
} from "@/hooks/useGroupData";
import { callableErrorMessage } from "@/lib/callableError";
import { localDate } from "@/lib/dashboard";
import { groupScoreLabel } from "@/lib/groupScore";
import { buildMemberRows } from "@/lib/leaderboard";
import { getNextPunishmentDayInfo } from "@/lib/punishmentCycle";
import { userScore } from "@/lib/userScore";
import type { DailyStatus, User } from "@/types";

export function Dashboard() {
  const { profile, group } = useAuth();
  const members = useGroupMembers(group?.id);
  const statuses = useGroupDailyStatus(group?.id);
  const recentSubs = useGroupSubmissions(group?.id, 200);

  const scoreLabel = groupScoreLabel(group);

  const [tick, setTick] = useState(0);
  const [checkBusy, setCheckBusy] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checkMsg, setCheckMsg] = useState<string | null>(null);

  const tz = group?.timezone || "America/Toronto";
  const todayStr = localDate(tz);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const byKey = useMemo(() => {
    const m = new Map<string, DailyStatus>();
    for (const s of statuses) m.set(`${s.userId}_${s.date}`, s);
    return m;
  }, [statuses]);

  const memberById = useMemo(() => {
    const m = new Map<string, User>();
    for (const u of members) m.set(u.id, u);
    return m;
  }, [members]);

  const nameOf = (uid: string) =>
    members.find((m) => m.id === uid)?.displayName ?? uid.slice(0, 6);

  const memberRows = useMemo(
    () => buildMemberRows(members, todayStr, tz, byKey, recentSubs),
    [members, todayStr, tz, byKey, recentSubs]
  );

  const hasHandles =
    Boolean(profile?.leetcodeUsername?.trim()) ||
    Boolean(profile?.codeforcesHandle?.trim()) ||
    Boolean(profile?.atcoderHandle?.trim()) ||
    Boolean(profile?.csesUserId?.trim());

  const punishment = useMemo(
    () =>
      getNextPunishmentDayInfo({
        timeZone: tz,
        scoreLabel,
        lastBiweeklyReset: group?.lastBiweeklyReset,
        groupCreatedAt: group?.createdAt,
        currentScore: userScore(profile),
      }),
    [
      tz,
      scoreLabel,
      group?.lastBiweeklyReset,
      group?.createdAt,
      profile,
      tick,
    ]
  );

  const runSelfCheck = async () => {
    setCheckBusy(true);
    setCheckError(null);
    setCheckMsg(null);
    try {
      if (!profile?.id) throw new Error("Profile not loaded.");
      const res = await api.runSubmissionCheck({ userId: profile.id });
      setCheckMsg(res.message);
    } catch (e) {
      setCheckError(callableErrorMessage(e));
    } finally {
      setCheckBusy(false);
    }
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-end gap-2">
        {hasHandles && (
          <Button
            variant="outline"
            size="sm"
            disabled={checkBusy}
            onClick={() => void runSelfCheck()}
            className="gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${checkBusy ? "animate-spin" : ""}`}
            />
            {checkBusy ? "Refreshing…" : "Refresh status"}
          </Button>
        )}
      </div>

      <TodayStatusBanner
        profile={profile}
        todayStr={todayStr}
        timeZone={tz}
        submissions={recentSubs}
        todayStatus={profile?.id ? byKey.get(`${profile.id}_${todayStr}`) : undefined}
      />

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <StatScoreBlock value={userScore(profile)} />
        <StatBankBlock value={profile?.bankedProblems ?? 0} />
        <StatPunishmentBlock punishment={punishment} />
      </div>

      {checkError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{checkError}</AlertDescription>
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
        <div className="grid gap-6 lg:grid-cols-2">
          <CycleLeaderboard
            rows={memberRows}
            currentUserId={profile?.id}
          />
          <DailyLeaderboard
            rows={memberRows}
            timeZone={tz}
            currentUserId={profile?.id}
          />
        </div>

        <RecentSubmissionsTable
          submissions={recentSubs.slice(0, 12)}
          memberName={nameOf}
          memberById={(id) => memberById.get(id)}
          timeZone={tz}
        />
      </div>
    </>
  );
}
