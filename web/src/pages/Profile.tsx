import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../api";
import { Card } from "../components/ui";

export function Profile() {
  const { profile, group } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [leetcodeUsername, setLeetcodeUsername] = useState("");
  const [codeforcesHandle, setCodeforcesHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setPhoneNumber(profile.phoneNumber);
      setLeetcodeUsername(profile.leetcodeUsername ?? "");
      setCodeforcesHandle(profile.codeforcesHandle ?? "");
    }
  }, [profile]);

  const save = async () => {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await api.updateProfile({
        displayName,
        phoneNumber,
        leetcodeUsername,
        codeforcesHandle,
      });
      setMsg("Saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    if (!confirm("Leave your group? Your stats stay but you'll be removed."))
      return;
    setBusy(true);
    setError(null);
    try {
      await api.leaveGroup({});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="container narrow">
      <h1>Profile</h1>
      {error && <p className="error">{error}</p>}
      {msg && <p className="success">{msg}</p>}

      <Card title="Your details">
        <label>
          Display name
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        <label>
          LeetCode username
          <input
            value={leetcodeUsername}
            onChange={(e) => setLeetcodeUsername(e.target.value)}
            placeholder="e.g. johndoe"
          />
        </label>
        <label>
          Codeforces handle
          <input
            value={codeforcesHandle}
            onChange={(e) => setCodeforcesHandle(e.target.value)}
            placeholder="e.g. tourist"
          />
        </label>
        <p className="muted small">
          At least one handle is required for automatic submission tracking.
          Accepted problems sync every ~30 minutes.
        </p>
        <label>
          Phone number (optional — SMS reminders & summaries)
          <input
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+15195551234"
          />
        </label>
        <p className="muted small">
          E.164 format with country code. Leave blank to skip SMS.
        </p>
        <button className="btn-primary" disabled={busy} onClick={() => void save()}>
          Save
        </button>
      </Card>

      <Card title="How it works">
        <p>
          Solve a <strong>new</strong> problem on LeetCode or Codeforces. The
          backend polls your public profiles and records accepted submissions.
        </p>
        <p className="muted small">
          First new problem each day satisfies the requirement; extras are banked
          at midnight. Missed days consume bank before adding penalty words.
        </p>
      </Card>

      {group && (
        <Card title="Group">
          <p>
            You're in <strong>{group.name}</strong>. Invite code:{" "}
            <code className="invite">{group.inviteCode}</code>
          </p>
          <button className="btn-danger" disabled={busy} onClick={() => void leave()}>
            Leave group
          </button>
        </Card>
      )}
    </main>
  );
}
