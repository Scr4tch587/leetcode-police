import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../api";
import { TWILIO_NUMBER } from "../firebase";
import { Card } from "../components/ui";

export function Profile() {
  const { profile, group } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setPhoneNumber(profile.phoneNumber);
    }
  }, [profile]);

  const save = async () => {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await api.updateProfile({ displayName, phoneNumber });
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
          Phone number (the number you'll text screenshots from)
          <input
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+15195551234"
          />
        </label>
        <p className="muted small">
          Use the same number you'll text from. Include country code (E.164).
        </p>
        <button className="btn-primary" disabled={busy} onClick={() => void save()}>
          Save
        </button>
      </Card>

      <Card title="How to submit">
        <p>
          Solve a new problem on LeetCode or Codeforces, then text a screenshot
          of the <strong>Accepted</strong> result to{" "}
          {TWILIO_NUMBER ? <strong>{TWILIO_NUMBER}</strong> : "your group's Twilio number"}.
        </p>
        <p className="muted small">
          The first valid problem each day satisfies the requirement; extras are
          banked to cover future misses.
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
