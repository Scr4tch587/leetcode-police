import { useState } from "react";
import { api } from "../api";
import { Card } from "../components/ui";

const COMMON_TIMEZONES = [
  "America/Toronto",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Asia/Kolkata",
  "Asia/Shanghai",
];

export function GroupSetup() {
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Toronto"
  );
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.createGroup({ name, timezone });
      // Profile subscription will re-route automatically.
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.joinGroup({ inviteCode });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="container narrow">
      <h1>Get started</h1>
      <p className="muted">Create a new group or join one with an invite code.</p>

      {error && <p className="error">{error}</p>}

      <Card title="Create a group">
        <label>
          Group name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="The Grinders"
          />
        </label>
        <label>
          Timezone (controls the daily midnight cutoff)
          <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {COMMON_TIMEZONES.includes(timezone) ? null : (
              <option value={timezone}>{timezone}</option>
            )}
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </label>
        <button className="btn-primary" disabled={busy || !name} onClick={() => void create()}>
          Create group
        </button>
      </Card>

      <Card title="Join a group">
        <label>
          Invite code
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
          />
        </label>
        <button className="btn-secondary" disabled={busy || !inviteCode} onClick={() => void join()}>
          Join group
        </button>
      </Card>
    </main>
  );
}
