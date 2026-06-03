/**
 * Problem Club — Cloud Functions entry point.
 *
 * Re-exports every deployable function. The Firebase CLI provisions the
 * underlying infrastructure (HTTPS endpoints, Cloud Scheduler jobs, Pub/Sub
 * topics, Secret Manager bindings) automatically from these declarations.
 */
import { setGlobalOptions } from "firebase-functions/v2";
import { REGION } from "./config";

setGlobalOptions({ region: REGION, maxInstances: 10 });

// Inbound messaging
export { twilioWebhook } from "./handlers/twilioWebhook";

// Scheduled jobs
export {
  reminders,
  midnightRollover,
  biweeklySummary,
} from "./handlers/scheduled";

// Account & group lifecycle (callable)
export {
  bootstrapUser,
  updateProfile,
  createGroup,
  joinGroup,
  leaveGroup,
} from "./handlers/account";

// Admin actions (callable)
export {
  approveSubmission,
  rejectSubmission,
  adjustBank,
  adjustPenalty,
} from "./handlers/admin";
