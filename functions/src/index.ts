/**
 * LeetCode Police — Cloud Functions entry point.
 */
import { setGlobalOptions } from "firebase-functions/v2";
import { REGION } from "./config";

setGlobalOptions({ region: REGION, maxInstances: 10 });

// Event ingestion & daily game loop
export { submissionCollector } from "./submissionCollector";
export { dailyProcessor } from "./dailyProcessor";
export { reminderJob } from "./reminderJob";
export { dailySummaryJob, biweeklySummaryJob } from "./summaryJob";

// Account & group lifecycle (callable)
export {
  bootstrapUser,
  updateProfile,
  createGroup,
  joinGroup,
  leaveGroup,
} from "./handlers/account";

// Admin adjustments (callable)
export {
  adjustBank,
  adjustScore,
  adjustPenalty,
  runSubmissionCheck,
  updateGroupSettings,
  nullifyTodaySolve,
  grantTodaySolve,
} from "./handlers/admin";
