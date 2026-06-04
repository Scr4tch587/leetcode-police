import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { groupScoreLabel } from "@/lib/groupScore";

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
    if (!leetcodeUsername.trim() && !codeforcesHandle.trim()) {
      setError(
        "At least one LeetCode username or Codeforces handle is required."
      );
      setBusy(false);
      return;
    }
    try {
      await api.updateProfile({
        displayName,
        phoneNumber,
        leetcodeUsername,
        codeforcesHandle,
      });
      setMsg("Saved. Handles were verified on LeetCode / Codeforces.");
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
    <>
      <PageHeader title="Profile" description="Handles are verified on save" />

      {error && (
        <Alert variant="destructive" className="mb-4 max-w-lg">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {msg && (
        <Alert className="mb-4 max-w-lg border-primary/30 bg-accent/50">
          <AlertDescription>{msg}</AlertDescription>
        </Alert>
      )}

      <div className="mx-auto max-w-lg space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your details</CardTitle>
            <CardDescription>
              At least one platform handle is required. We check that it exists
              publicly before saving.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="leetcode">LeetCode username</Label>
              <Input
                id="leetcode"
                value={leetcodeUsername}
                onChange={(e) => setLeetcodeUsername(e.target.value)}
                placeholder="johndoe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="codeforces">Codeforces handle</Label>
              <Input
                id="codeforces"
                value={codeforcesHandle}
                onChange={(e) => setCodeforcesHandle(e.target.value)}
                placeholder="tourist"
              />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+15195551234"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              E.164 format for SMS reminders and summaries.
            </p>
          </CardContent>
          <CardFooter>
            <Button disabled={busy} onClick={() => void save()}>
              Save & verify handles
            </Button>
          </CardFooter>
        </Card>

        {group && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Group</CardTitle>
              <CardDescription>
                {group.name} · invite{" "}
                <code className="rounded border border-primary/30 bg-accent px-1.5 py-0.5 font-mono text-primary">
                  {group.inviteCode}
                </code>
                <br />
                Score label: {groupScoreLabel(group)}
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => void leave()}
              >
                Leave group
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </>
  );
}
