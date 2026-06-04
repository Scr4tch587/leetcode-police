import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { localDate } from "@/lib/dashboard";
import { effectiveSolvedToday } from "@/lib/dailyStatus";
import { timezoneAbbreviation } from "@/lib/timezone";
import {
  useGroupDailyStatus,
  useGroupMembers,
} from "@/hooks/useGroupData";

type NavItem = { to: string; label: string };

export function SiteHeader() {
  const { profile, group, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const inGroup = Boolean(profile?.groupId);

  const members = useGroupMembers(group?.id);
  const statuses = useGroupDailyStatus(group?.id);
  const todayStr = group ? localDate(group.timezone) : "";

  const solvedTodayCount = todayStr
    ? members.filter((m) =>
        statuses.some(
          (s) =>
            s.userId === m.id && s.date === todayStr && effectiveSolvedToday(s)
        )
      ).length
    : 0;

  const items: NavItem[] = inGroup
    ? [
        { to: "/", label: "Dashboard" },
        { to: "/history", label: "History" },
        { to: "/profile", label: "Profile" },
        ...(profile?.isAdmin ? [{ to: "/admin", label: "Admin" }] : []),
      ]
    : [
        { to: "/setup", label: "Setup" },
        { to: "/profile", label: "Profile" },
      ];

  const current =
    items.find((i) =>
      i.to === "/"
        ? location.pathname === "/" || location.pathname === ""
        : location.pathname.startsWith(i.to)
    )?.label ?? "Menu";

  const tzShort = group ? timezoneAbbreviation(group.timezone) : null;
  const memberLine =
    group &&
    `${members.length} member${members.length === 1 ? "" : "s"} · ${solvedTodayCount} solved today`;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto grid h-auto min-h-14 max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-2 sm:px-6 sm:py-0 sm:h-14">
        <Link
          to={inGroup ? "/" : "/setup"}
          className="flex items-center gap-2 font-semibold tracking-tight justify-self-start"
        >
          <Shield className="h-5 w-5 text-primary" strokeWidth={2} />
          <span className="hidden sm:inline">LeetCode Police</span>
        </Link>

        {group ? (
          <div className="min-w-0 text-center text-sm">
            <p className="truncate font-medium">{group.name}</p>
            {memberLine && (
              <p className="truncate text-xs text-muted-foreground">{memberLine}</p>
            )}
            <p className="truncate text-xs text-muted-foreground">
              <span className="font-mono tracking-wide">{group.inviteCode}</span>
              {tzShort && (
                <>
                  {" "}
                  · <span>{tzShort}</span>
                </>
              )}
            </p>
          </div>
        ) : (
          <div />
        )}

        <div className="justify-self-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Menu className="h-4 w-4" />
                <span className="max-w-[6rem] truncate sm:max-w-[8rem]">
                  {current}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {items.map((item) => (
                <DropdownMenuItem
                  key={item.to}
                  onSelect={() => navigate(item.to)}
                >
                  {item.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => void signOut()}
              >
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
