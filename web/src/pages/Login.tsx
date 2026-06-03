import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

export function Login() {
  const { signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="centered">
      <div className="login-card">
        <div className="login-emoji">🏆</div>
        <h1>Problem Club</h1>
        <p className="muted">
          One new problem a day. Miss a day, owe some words. Bank ahead, stay
          safe.
        </p>
        <button className="btn-primary" onClick={() => void handle()} disabled={busy}>
          {busy ? "Signing in…" : "Sign in with Google"}
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
