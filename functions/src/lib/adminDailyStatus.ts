/**
 * Temporary admin void/grant overlays — not permanent.
 */
import { db } from "./admin";
import { today } from "./dates";
import { countSubmissionsForDay } from "./submissions";
import { Collections, DailyStatus, User, dailyStatusId } from "../types";

/** Void is lifted when the user has any submission on today's game day. */
export async function liftVoidIfSubmissionsToday(
  user: Pick<User, "id" | "groupId">,
  timeZone: string
): Promise<boolean> {
  if (!user.groupId) return false;

  const date = today(timeZone);
  const dsRef = db
    .collection(Collections.dailyStatus)
    .doc(dailyStatusId(user.id, date));
  const snap = await dsRef.get();
  const prev = snap.data() as DailyStatus | undefined;
  if (!prev?.adminVoidToday) return false;

  const count = await countSubmissionsForDay(user.id, date);
  if (count < 1) return false;

  await dsRef.set(
    {
      adminVoidToday: false,
      adminGrantedToday: false,
      solvedToday: count >= 1,
      submissionCount: count,
    },
    { merge: true }
  );
  return true;
}
