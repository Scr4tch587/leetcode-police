import { useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { TWILIO_NUMBER } from "../firebase";
import { Card } from "../components/ui";
import { useGroupDailyStatus, useGroupMembers } from "../hooks/useGroupData";
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

type Cell = "satisfied" | "bank" | "miss" | "none";

function cellFor(ds: DailyStatus | undefined): Cell {
  if (!ds) return "none";
  if (ds.satisfied) return "satisfied";
  if (ds.bankUsed) return "bank";
  if (ds.penaltyApplied) return "miss";
  return "none";
}

const CELL_GLYPH: Record<Cell, string> = {
  satisfied: "✅",
  bank: "🏦",
  miss: "❌",
  none: "·",
};

export function Dashboard() {
  const { profile, group } = useAuth();
  const members = useGroupMembers(group?.id);
  const statuses = useGroupDailyStatus(group?.id);

  const tz = group?.timezone || "America/Toronto";
  const today = localDate(tz);

  // Last 14 days (most recent last) for the history grid.
  const days = useMemo(
    () => Array.from({ length: 14 }, (_, i) => localDate(tz, -(13 - i))),
    [tz]
  );

  // Index statuses by `${userId}_${date}`.
  const byKey = useMemo(() => {
    const m = new Map<string, DailyStatus>();
    for (const s of statuses) m.set(`${s.userId}_${s.date}`, s);
    return m;
  }, [statuses]);

  const myToday = byKey.get(`${profile?.id}_${today}`);
  const mySatisfied = myToday?.satisfied ?? false;

  return (
    <main className="container">
      <h1>Dashboard</h1>

      {/* Personal status banner */}
      <div className={`today-banner ${mySatisfied ? "ok" : "todo"}`}>
        {mySatisfied ? (
          <>✅ You've completed today's problem.</>
        ) : (
          <>
            ⏳ You haven't submitted today.{" "}
            {TWILIO_NUMBER ? (
              <>
                Text a screenshot to <strong>{TWILIO_NUMBER}</strong>.
              </>
            ) : (
              <>Text a screenshot to your group's Twilio number.</>
            )}
          </>
        )}
        <span className="banner-stats">
          🏦 {profile?.bankedProblems ?? 0} banked · ✍️ {profile?.wordPenalty ?? 0} words
        </span>
      </div>

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
              const t = byKey.get(`${m.id}_${today}`);
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
            Share this code so friends can join: <code className="invite">{group.inviteCode}</code>
          </p>
        </Card>
      )}
    </main>
  );
}
