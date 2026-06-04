/**
 * Biweekly punishment cycle: tally scores for the admin, then reset to 0.
 */
import { db } from "./admin";
import { groupScoreLabel } from "./groupScore";
import { scoreOf } from "./userScore";
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

/** SMS body sent to group admin(s) before scores are zeroed. */
export function buildPunishmentDayAdminSms(group: Group, members: User[]): string {
  const unit = groupScoreLabel(group);
  const leaderboard = [...members].sort((a, b) => scoreOf(a) - scoreOf(b));
  const board = leaderboard.map(
    (m, i) => `${i + 1}. ${m.displayName} — ${scoreOf(m)} ${unit}`
  );
  const total = members.reduce((s, m) => s + scoreOf(m), 0);

  return [
    `🔔 ${group.name} — Punishment day`,
    "",
    `Scores this cycle (${unit}, resetting to 0):`,
    ...board,
    "",
    `Total: ${total} across ${members.length} member${members.length === 1 ? "" : "s"}.`,
  ].join("\n");
}

/** Zero scores and stamp the group's last reset date. */
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
    batch.update(doc.ref, { score: 0, wordPenalty: 0 });
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
