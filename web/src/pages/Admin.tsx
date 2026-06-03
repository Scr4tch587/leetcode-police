import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../api";
import { useGroupMembers } from "../hooks/useGroupData";
import { Card } from "../components/ui";
import {
  formatCheckResult,
  formatGroupCheckResults,
} from "../lib/checkMessages";

export function Admin() {
  const { profile } = useAuth();
  const members = useGroupMembers(profile?.groupId);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkMsg, setCheckMsg] = useState<string | null>(null);

  if (!profile?.isAdmin) {
    return <main className="container">Admins only.</main>;
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

  return (
    <main className="container">
      <h1>Admin panel</h1>
      {error && <p className="error">{error}</p>}
      {checkMsg && <pre className="success check-debug">{checkMsg}</pre>}

      <Card title="Submission sync">
        <p className="muted small">
          Poll LeetCode and Codeforces now (same logic as the 30-minute cron).
        </p>
        <div className="actions" style={{ marginTop: "0.75rem" }}>
          <button
            className="btn-primary"
            disabled={busyId === "check-all"}
            onClick={() =>
              void wrap("check-all", async () => {
                const res = await api.runSubmissionCheck({});
                setCheckMsg(formatGroupCheckResults(res.ingested, res.results));
              })
            }
          >
            {busyId === "check-all" ? "Checking…" : "Check entire group"}
          </button>
        </div>
      </Card>

      <Card title="Manual adjustments">
        <table className="table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Handles</th>
              <th>Words</th>
              <th>Adjust words</th>
              <th>Banked</th>
              <th>Adjust bank</th>
              <th>Sync</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>{m.displayName}</td>
                <td className="small muted">
                  {m.leetcodeUsername || "—"} / {m.codeforcesHandle || "—"}
                </td>
                <td>{m.wordPenalty}</td>
                <td className="actions">
                  <button
                    className="btn-small"
                    disabled={busyId === `pen-${m.id}`}
                    onClick={() =>
                      void wrap(`pen-${m.id}`, () =>
                        api.adjustPenalty({ userId: m.id, delta: -2 })
                      )
                    }
                  >
                    −2
                  </button>
                  <button
                    className="btn-small"
                    disabled={busyId === `pen-${m.id}`}
                    onClick={() =>
                      void wrap(`pen-${m.id}`, () =>
                        api.adjustPenalty({ userId: m.id, delta: 2 })
                      )
                    }
                  >
                    +2
                  </button>
                </td>
                <td>{m.bankedProblems}</td>
                <td className="actions">
                  <button
                    className="btn-small"
                    disabled={busyId === `bank-${m.id}`}
                    onClick={() =>
                      void wrap(`bank-${m.id}`, () =>
                        api.adjustBank({ userId: m.id, delta: -1 })
                      )
                    }
                  >
                    −1
                  </button>
                  <button
                    className="btn-small"
                    disabled={busyId === `bank-${m.id}`}
                    onClick={() =>
                      void wrap(`bank-${m.id}`, () =>
                        api.adjustBank({ userId: m.id, delta: 1 })
                      )
                    }
                  >
                    +1
                  </button>
                </td>
                <td>
                  <button
                    className="btn-small"
                    disabled={busyId === `check-${m.id}`}
                    onClick={() =>
                      void wrap(`check-${m.id}`, async () => {
                        const res = await api.runSubmissionCheck({
                          userId: m.id,
                        });
                        const r = res.results[0];
                        if (r) {
                          setCheckMsg(formatCheckResult(r, res.ingested));
                        }
                      })
                    }
                  >
                    Check
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </main>
  );
}
