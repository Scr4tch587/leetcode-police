import { useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Card } from "../components/ui";
import {
  useGroupDailyStatus,
  useGroupMembers,
  useUserSubmissions,
} from "../hooks/useGroupData";
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

  const tz = group?.timezone || "America/Toronto";
  const todayStr = localDate(tz);

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

  return (
    <main className="container">
      <h1>Dashboard</h1>

      <div className={`today-banner ${mySolved ? "ok" : "todo"}`}>
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
        <span className="banner-stats">
          🏦 {profile?.bankedProblems ?? 0} banked · ✍️ {profile?.wordPenalty ?? 0}{" "}
          words
        </span>
      </div>

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
