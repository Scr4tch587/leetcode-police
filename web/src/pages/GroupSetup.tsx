import { useState } from "react";
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
  const [scoreLabel, setScoreLabel] = useState("");
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
      await api.createGroup({ name, timezone, scoreLabel });
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
    <>
      <PageHeader
        title="Get started"
        description="Create a group or join with an invite code"
      />

      {error && (
        <Alert variant="destructive" className="mb-4 max-w-lg">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="mx-auto grid max-w-lg gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create a group</CardTitle>
            <CardDescription>
              You become the admin. Define what a penalty score means for everyone.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="groupName">Group name</Label>
              <Input
                id="groupName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="The Grinders"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scoreLabel">Score label (required)</Label>
              <Input
                id="scoreLabel"
                value={scoreLabel}
                onChange={(e) => setScoreLabel(e.target.value)}
                placeholder="e.g. push-ups owed, dollars, miles"
              />
              <p className="text-xs text-muted-foreground">
                Shown under each member&apos;s score on the dashboard. Missed days
                add +2 to this tally until punishment day resets it.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tz">Timezone</Label>
              <select
                id="tz"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                {!COMMON_TIMEZONES.includes(timezone) && (
                  <option value={timezone}>{timezone}</option>
                )}
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              disabled={busy || !name.trim() || scoreLabel.trim().length < 3}
              onClick={() => void create()}
            >
              Create group
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Join a group</CardTitle>
            <CardDescription>
              Save at least one verified platform handle in Profile first.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="invite">Invite code</Label>
            <Input
              id="invite"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
            />
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              disabled={busy || !inviteCode}
              onClick={() => void join()}
            >
              Join group
            </Button>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
