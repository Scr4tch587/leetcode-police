/** Helpers for composing the SMS summaries sent to a group. */
import { db } from "./admin";
import { Collections, DailyStatus, Group, User } from "../types";
import { dailyStatusId } from "../types";

export async function getGroupMembers(groupId: string): Promise<User[]> {
  const snap = await db
    .collection(Collections.users)
    .where("groupId", "==", groupId)
    .get();
  return snap.docs.map((d) => d.data() as User);
}

export async function getAllGroups(): Promise<Group[]> {
  const snap = await db.collection(Collections.groups).get();
  return snap.docs.map((d) => d.data() as Group);
}

/** Format a YYYY-MM-DD date as e.g. "June 2" in the group timezone. */
export function humanDate(dateStr: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "long",
    day: "numeric",
  }).format(new Date(`${dateStr}T12:00:00Z`));
}

/** Build the daily results SMS, e.g.:
 *
 *   June 2 Results
 *
 *   Kai ✅
 *   John ❌ (+2 words)
 *
 *   Current Totals
 *   Kai: 4 words
 *
 *   Banked Problems
 *   Kai: 1
 */
export async function buildDailySummary(
  group: Group,
  date: string
): Promise<string> {
  const members = await getGroupMembers(group.id);
  members.sort((a, b) => a.displayName.localeCompare(b.displayName));

  const statusLines = await Promise.all(
    members.map(async (m) => {
      const dsSnap = await db
        .collection(Collections.dailyStatus)
        .doc(dailyStatusId(m.id, date))
        .get();
      const ds = dsSnap.data() as DailyStatus | undefined;
      if (ds?.solvedToday) return `${m.displayName} ✅`;
      if (ds?.bankUsed) return `${m.displayName} 🏦 (banked)`;
      return `${m.displayName} ❌ (+2 words)`;
    })
  );

  const totals = members.map((m) => `${m.displayName}: ${m.wordPenalty} words`);
  const banks = members.map((m) => `${m.displayName}: ${m.bankedProblems}`);

  return [
    `${humanDate(date, group.timezone)} Results`,
    "",
    ...statusLines,
    "",
    "Current Totals",
    ...totals,
    "",
    "Banked Problems",
    ...banks,
  ].join("\n");
}

