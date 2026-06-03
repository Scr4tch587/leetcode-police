/**
 * Biweekly punishment cycle: tally word counts for the admin, then reset to 0.
 */
import { db } from "./admin";
import { Collections, Group, User } from "../types";

const CYCLE_DAYS = 14;

export function lastBiweeklyResetDate(
  group: Group,
  metaLastSent: string | null | undefined
): string | null {
  return group.lastBiweeklyReset ?? metaLastSent ?? null;
}

export function isBiweeklyDue(
  group: Group,
  metaLastSent: string | null | undefined,
  date: string
): boolean {
  const last = lastBiweeklyResetDate(group, metaLastSent);
  if (!last) return true;
  return daysBetween(last, date) >= CYCLE_DAYS;
}

function daysBetween(from: string, to: string): number {
  return Math.floor(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86400000
  );
}

/** SMS body sent to group admin(s) before word counts are zeroed. */
export function buildPunishmentDayAdminSms(group: Group, members: User[]): string {
  const leaderboard = [...members].sort(
    (a, b) => a.wordPenalty - b.wordPenalty
  );
  const board = leaderboard.map(
    (m, i) => `${i + 1}. ${m.displayName} — ${m.wordPenalty} words`
  );
  const total = members.reduce((s, m) => s + m.wordPenalty, 0);

  return [
    `🔔 ${group.name} — Punishment day`,
    "",
    "Word counts this cycle (resetting to 0):",
    ...board,
    "",
    `Total: ${total} words across ${members.length} member${members.length === 1 ? "" : "s"}.`,
  ].join("\n");
}

/** Zero word penalties and stamp the group's last reset date. */
export async function runBiweeklyPunishment(
  group: Group,
  date: string
): Promise<void> {
  const members = await db
    .collection(Collections.users)
    .where("groupId", "==", group.id)
    .get();

  const batch = db.batch();
  for (const doc of members.docs) {
    batch.update(doc.ref, { wordPenalty: 0 });
  }
  batch.update(db.collection(Collections.groups).doc(group.id), {
    lastBiweeklyReset: date,
  });
  await batch.commit();

  await db
    .collection(Collections.meta)
    .doc(`biweekly_${group.id}`)
    .set({ lastSent: date }, { merge: true });
}
