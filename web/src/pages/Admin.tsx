import { useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../api";
import {
  useGroupMembers,
  useGroupSubmissions,
} from "../hooks/useGroupData";
import { Card, PlatformBadge } from "../components/ui";

export function Admin() {
  const { profile, group } = useAuth();
  const members = useGroupMembers(group?.id);
  const submissions = useGroupSubmissions(group?.id, 200);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nameOf = (uid: string) =>
    members.find((m) => m.id === uid)?.displayName ?? uid.slice(0, 6);

  const pending = useMemo(
    () => submissions.filter((s) => s.validationStatus === "pending"),
    [submissions]
  );

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

      <Card title={`Pending review (${pending.length})`}>
        <div className="grid-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Member</th>
                <th>Platform</th>
                <th>Problem</th>
                <th>Note</th>
                <th>Proof</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((s) => (
                <tr key={s.id}>
                  <td>{s.date}</td>
                  <td>{nameOf(s.userId)}</td>
                  <td>
                    <PlatformBadge platform={s.platform} />
                  </td>
                  <td>
                    {s.problemIdentifier ?? "—"}
                    {s.problemTitle ? ` · ${s.problemTitle}` : ""}
                  </td>
                  <td className="small muted">{s.reviewNote ?? ""}</td>
                  <td>
                    {s.screenshotUrl ? (
                      <a href={s.screenshotUrl} target="_blank" rel="noreferrer">
                        view
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="actions">
                    <button
                      className="btn-small btn-green"
                      disabled={busyId === s.id}
                      onClick={() =>
                        void wrap(s.id, () =>
                          api.approveSubmission({ submissionId: s.id })
                        )
                      }
                    >
                      Approve
                    </button>
                    <button
                      className="btn-small btn-red"
                      disabled={busyId === s.id}
                      onClick={() =>
                        void wrap(s.id, () =>
                          api.rejectSubmission({ submissionId: s.id })
                        )
                      }
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
              {pending.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    Nothing to review. 🎉
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Manual adjustments">
        <table className="table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Words</th>
              <th>Adjust words</th>
              <th>Banked</th>
              <th>Adjust bank</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>{m.displayName}</td>
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
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </main>
  );
}
