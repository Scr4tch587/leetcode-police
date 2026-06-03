import type { FunctionsErrorCode } from "firebase/functions";

const MESSAGES: Partial<Record<FunctionsErrorCode, string>> = {
  "functions/not-found":
    "That feature is not deployed yet. Redeploy Cloud Functions (runSubmissionCheck).",
  "functions/unauthenticated": "Sign in again and retry.",
  "functions/permission-denied": "You do not have permission for this action.",
  "functions/failed-precondition": "Complete your profile or join a group first.",
};

/** Human-readable text for Firebase callable failures. */
export function callableErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code: string }).code as FunctionsErrorCode;
    const message = (err as { message?: string }).message;
    if (code === "functions/internal") {
      return (
        message && message !== "internal"
          ? message
          : "Server error during submission check. Try again in a minute."
      );
    }
    return MESSAGES[code] ?? message ?? String(err);
  }
  return err instanceof Error ? err.message : String(err);
}
