/**
 * 11 PM reminder — SMS users who have not solved today.
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { db } from "./lib/admin";
import { SCHEDULE_REGION, DEFAULT_TIMEZONE, TWILIO_AUTH_TOKEN } from "./config";
import { effectiveSolvedToday } from "./lib/dailyStatus";
import { Collections, DailyStatus, User, dailyStatusId } from "./types";
import { today } from "./lib/dates";
import { sendSms } from "./lib/twilio";

const scheduleOpts = {
  region: SCHEDULE_REGION,
  timeZone: DEFAULT_TIMEZONE,
  secrets: [TWILIO_AUTH_TOKEN],
  memory: "256MiB" as const,
};

async function getActiveUsers(): Promise<User[]> {
  const snap = await db
    .collection(Collections.users)
    .where("groupId", "!=", null)
    .get();
  return snap.docs.map((d) => d.data() as User);
}

export const reminderJob = onSchedule(
  { ...scheduleOpts, schedule: "0 23 * * *" },
  async () => {
    const tz = DEFAULT_TIMEZONE.value();
    const date = today(tz);
    const users = await getActiveUsers();
    let sent = 0;

    await Promise.all(
      users.map(async (u) => {
        if (!u.phoneNumber) return;
        const dsSnap = await db
          .collection(Collections.dailyStatus)
          .doc(dailyStatusId(u.id, date))
          .get();
        const ds = dsSnap.data() as DailyStatus | undefined;
        if (effectiveSolvedToday(ds)) return;

        await sendSms(
          u.phoneNumber,
          "⏰ LeetCode Police: solve one new problem before 4 AM (LeetCode, Codeforces, AtCoder, or CSES)."
        );
        sent++;
      })
    );

    logger.info("Reminder job finished", { date, sent, users: users.length });
  }
);
