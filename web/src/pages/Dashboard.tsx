import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../api";
import { Card } from "../components/ui";
import {
  useGroupDailyStatus,
  useGroupMembers,
  useUserSubmissions,
} from "../hooks/useGroupData";
import { manualCheckMessage } from "../lib/checkMessages";
import { getNextPunishmentDayInfo } from "../lib/punishmentCycle";
import type { DailyStatus } from "../types";

function localDate(tz: string, offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

type Cell = "solved" | "bank" | "miss" | "none";

function cellFor(ds: DailyStatus | undefined): Cell {
  if (!ds) return "none";
  if (ds.solvedToday) return "solved";
  if (ds.bankUsed) return "bank";
  if (ds.penaltyApplied) return "miss";
  return "none";
}

const CELL_GLYPH: Record<Cell, string> = {
  solved: "✅",
  bank: "🏦",
  miss: "❌",
  none: "·",
};

export function Dashboard() {
  const { profile, group } = useAuth();
  const members = useGroupMembers(group?.id);
  const statuses = useGroupDailyStatus(group?.id);
  const recentSubs = useUserSubmissions(profile?.id, 8);

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

  const days = useMemo(
    () => Array.from({ length: 14 }, (_, i) => localDate(tz, -(13 - i))),
    [tz]
  );

  const byKey = useMemo(() => {
    const m = new Map<string, DailyStatus>();
    for (const s of statuses) m.set(`${s.userId}_${s.date}`, s);
    return m;
  }, [statuses]);

  const myToday = byKey.get(`${profile?.id}_${todayStr}`);
  const mySolved = myToday?.solvedToday ?? false;
  const hasHandles =
    Boolean(profile?.leetcodeUsername?.trim()) ||
    Boolean(profile?.codeforcesHandle?.trim());

  const punishment = useMemo(
    () =>
      getNextPunishmentDayInfo({
        timeZone: tz,
        lastBiweeklyReset: group?.lastBiweeklyReset,
        groupCreatedAt: group?.createdAt,
        currentWords: profile?.wordPenalty ?? 0,
      }),
    [tz, group?.lastBiweeklyReset, group?.createdAt, profile?.wordPenalty, tick]
  );

  const runSelfCheck = async () => {
    setCheckBusy(true);
    setCheckError(null);
    setCheckMsg(null);
    try {
      const res = await api.runSelfSubmissionCheck({});
      setCheckMsg(manualCheckMessage(res));
    } catch (e) {
      setCheckError((e as Error).message);
    } finally {
      setCheckBusy(false);
    }
  };

  return (
    <main className="container">
      <h1>Dashboard</h1>

      <div className={`today-banner ${mySolved ? "ok" : "todo"}`}>
        <div className="banner-main">
          {mySolved ? (
            <>✅ Today solved — {myToday?.submissionCount ?? 1} accepted problem(s).</>
          ) : (
            <>
              ⏳ Not solved yet today.{" "}
              {hasHandles ? (
                <>Submissions sync automatically from LeetCode / Codeforces.</>
              ) : (
                <>
                  Add your LeetCode username and/or Codeforces handle in{" "}
                  <a href="#/profile">Profile</a>.
                </>
              )}
            </>
          )}
          <p className="punishment-line">
            <strong>{punishment.headline}:</strong> {punishment.detail}
            {punishment.countdown && (
              <span className="punishment-countdown"> · {punishment.countdown}</span>
            )}
          </p>
        </div>
        <div className="banner-aside">
          <span className="banner-stats">
            🏦 {profile?.bankedProblems ?? 0} banked · ✍️ {profile?.wordPenalty ?? 0}{" "}
            words
          </span>
          {hasHandles && (
            <button
              className="btn-secondary btn-small"
              disabled={checkBusy}
              onClick={() => void runSelfCheck()}
            >
              {checkBusy ? "Checking…" : "Check self"}
            </button>
          )}
        </div>
      </div>

      {checkError && <p className="error">{checkError}</p>}
      {checkMsg && <pre className="success check-debug">{checkMsg}</pre>}

      <Card title="Recent submissions">
        {recentSubs.length === 0 ? (
          <p className="muted">No accepted submissions recorded yet.</p>
        ) : (
          <ul className="recent-list">
            {recentSubs.map((s) => (
              <li key={s.id}>
                <span className={`badge badge-platform ${s.platform}`}>
                  {s.platform === "leetcode" ? "LC" : "CF"}
                </span>{" "}
                <strong>{s.problemId}</strong>
                {s.problemName ? ` — ${s.problemName}` : ""}
                <span className="muted small">
                  {" "}
                  · {s.timestamp?.toDate?.().toLocaleString() ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Standings" actions={<span className="muted">fewest words first</span>}>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Member</th>
              <th>Words</th>
              <th>Banked</th>
              <th>Today</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => {
              const t = byKey.get(`${m.id}_${todayStr}`);
              return (
                <tr key={m.id} className={m.id === profile?.id ? "me" : ""}>
                  <td>{i + 1}</td>
                  <td>{m.displayName}</td>
                  <td>{m.wordPenalty}</td>
                  <td>{m.bankedProblems}</td>
                  <td>{CELL_GLYPH[cellFor(t)]}</td>
                </tr>
              );
            })}
            {members.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No members yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card title="Last 14 days">
        <div className="grid-scroll">
          <table className="table grid">
            <thead>
              <tr>
                <th className="sticky-col">Member</th>
                {days.map((d) => (
                  <th key={d} title={d}>
                    {d.slice(5)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className={m.id === profile?.id ? "me" : ""}>
                  <td className="sticky-col">{m.displayName}</td>
                  {days.map((d) => {
                    const c = cellFor(byKey.get(`${m.id}_${d}`));
                    return (
                      <td key={d} className={`cell cell-${c}`}>
                        {CELL_GLYPH[c]}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="legend muted">
          ✅ solved · 🏦 covered by bank · ❌ missed (+2 words) · · no data
        </p>
      </Card>

      {group && (
        <Card title="Invite">
          <p>
            Share this code so friends can join:{" "}
            <code className="invite">{group.inviteCode}</code>
          </p>
        </Card>
      )}
    </main>
  );
}
