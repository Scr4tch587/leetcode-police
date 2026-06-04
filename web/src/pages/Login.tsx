import { useState } from "react";
import { Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-2 border-foreground/10">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">LeetCode Police</CardTitle>
          <CardDescription>
            One new problem a day. Miss a day, add to your score. Bank ahead.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            className="w-full"
            size="lg"
            disabled={busy}
            onClick={() => void handle()}
          >
            {busy ? "Signing in…" : "Sign in with Google"}
          </Button>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
