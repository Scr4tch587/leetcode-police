import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function InviteCard({ inviteCode }: { inviteCode: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Invite</CardTitle>
        <CardDescription>Share this code for friends to join</CardDescription>
      </CardHeader>
      <CardContent>
        <code className="rounded-md border border-primary/30 bg-accent px-3 py-2 text-lg font-semibold tracking-widest text-primary">
          {inviteCode}
        </code>
      </CardContent>
    </Card>
  );
}
