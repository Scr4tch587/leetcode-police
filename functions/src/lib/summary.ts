/** Helpers for composing the SMS summaries sent to a group. */
import { db } from "./admin";
import { userFromSnap } from "./callable";
import { groupScoreLabel } from "./groupScore";
import { scoreOf } from "./userScore";
import { Collections, DailyStatus, Group, User } from "../types";
import { dailyStatusId } from "../types";
import { effectiveSolvedToday } from "./dailyStatus";
import { PENALTY_SCORE_PER_MISS } from "./game";

export async function getGroupMembers(groupId: string): Promise<User[]> {
  const snap = await db
    .collection(Collections.users)
    .where("groupId", "==", groupId)
    .get();
  return snap.docs.map((d) => userFromSnap(d));
}

export async function getAllGroups(): Promise<Group[]> {
  const snap = await db.collection(Collections.groups).get();
  return snap.docs.map((d) => {
    const data = d.data() as Group;
    return {
      ...data,
      scoreLabel: data.scoreLabel?.trim() || "score",
    };
  });
}

/** Format a YYYY-MM-DD date as e.g. "June 2" in the group timezone. */
export function humanDate(dateStr: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "long",
    day: "numeric",
  }).format(new Date(`${dateStr}T12:00:00Z`));
}

export async function buildDailySummary(
  group: Group,
  date: string
): Promise<string> {
  const unit = groupScoreLabel(group);
  const members = await getGroupMembers(group.id);
  members.sort((a, b) => a.displayName.localeCompare(b.displayName));

  const statusLines = await Promise.all(
    members.map(async (m) => {
      const dsSnap = await db
        .collection(Collections.dailyStatus)
        .doc(dailyStatusId(m.id, date))
        .get();
      const ds = dsSnap.data() as DailyStatus | undefined;
      if (effectiveSolvedToday(ds)) return `${m.displayName} ✅`;
      if (ds?.bankUsed) return `${m.displayName} 🏦 (banked)`;
      return `${m.displayName} ❌ (+${PENALTY_SCORE_PER_MISS} ${unit})`;
    })
  );

  const totals = members.map(
    (m) => `${m.displayName}: ${scoreOf(m)} ${unit}`
  );
  const banks = members.map((m) => `${m.displayName}: ${m.bankedProblems}`);

  return [
    `${humanDate(date, group.timezone)} Results`,
    "",
    ...statusLines,
    "",
    "Current totals",
    ...totals,
    "",
    "Banked problems",
    ...banks,
  ].join("\n");
}
