import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  useGroupMembers,
  useGroupSubmissions,
  useUserSubmissions,
} from "../hooks/useGroupData";
import { Card, PlatformBadge, StatusBadge } from "../components/ui";
import type { Submission } from "../types";

function SubmissionRow({
  sub,
  who,
}: {
  sub: Submission;
  who?: string;
}) {
  const when = sub.timestamp?.toDate?.().toLocaleString() ?? sub.date;
  return (
    <tr>
      <td>{sub.date}</td>
      {who !== undefined && <td>{who}</td>}
      <td>
        <PlatformBadge platform={sub.platform} />
      </td>
      <td>
        {sub.problemIdentifier ? (
          <span>
            <strong>{sub.problemIdentifier}</strong>
            {sub.problemTitle ? ` · ${sub.problemTitle}` : ""}
          </span>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td>
        <StatusBadge status={sub.validationStatus} />
      </td>
      <td>
        {sub.screenshotUrl ? (
          <a href={sub.screenshotUrl} target="_blank" rel="noreferrer">
            view
          </a>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td className="muted small">{when}</td>
    </tr>
  );
}

export function History() {
  const { profile, group } = useAuth();
  const [scope, setScope] = useState<"mine" | "group">("mine");

  const mine = useUserSubmissions(profile?.id);
  const groupSubs = useGroupSubmissions(group?.id);
  const members = useGroupMembers(group?.id);
  const nameOf = (uid: string) =>
    members.find((m) => m.id === uid)?.displayName ?? uid.slice(0, 6);

  const subs = scope === "mine" ? mine : groupSubs;

  return (
    <main className="container">
      <h1>Submission history</h1>

      <div className="tabs">
        <button
          className={scope === "mine" ? "tab active" : "tab"}
          onClick={() => setScope("mine")}
        >
          Mine
        </button>
        <button
          className={scope === "group" ? "tab active" : "tab"}
          onClick={() => setScope("group")}
        >
          Group
        </button>
      </div>

      <Card>
        <div className="grid-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                {scope === "group" && <th>Member</th>}
                <th>Platform</th>
                <th>Problem</th>
                <th>Status</th>
                <th>Proof</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <SubmissionRow
                  key={s.id}
                  sub={s}
                  who={scope === "group" ? nameOf(s.userId) : undefined}
                />
              ))}
              {subs.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    No submissions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}
