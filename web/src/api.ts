import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

function call<TReq, TRes>(name: string) {
  const fn = httpsCallable<TReq, TRes>(functions, name);
  return async (data: TReq): Promise<TRes> => (await fn(data)).data;
}

export const api = {
  bootstrapUser: call<{ displayName?: string }, { created: boolean }>(
    "bootstrapUser"
  ),
  updateProfile: call<
    {
      displayName?: string;
      phoneNumber?: string;
      leetcodeUsername?: string;
      codeforcesHandle?: string;
    },
    { ok: boolean }
  >("updateProfile"),
  createGroup: call<
    { name: string; timezone?: string },
    { groupId: string; inviteCode: string }
  >("createGroup"),
  joinGroup: call<
    { inviteCode: string },
    { groupId: string; groupName: string }
  >("joinGroup"),
  leaveGroup: call<Record<string, never>, { ok: boolean }>("leaveGroup"),
  adjustBank: call<
    { userId: string; delta: number },
    { ok: boolean; bankedProblems: number }
  >("adjustBank"),
  adjustPenalty: call<
    { userId: string; delta: number },
    { ok: boolean; wordPenalty: number }
  >("adjustPenalty"),
  runSubmissionCheck: call<
    { userId?: string },
    {
      ok: boolean;
      ingested: number;
      message: string;
      results: Array<{
        userId: string;
        displayName: string;
        ingested: number;
        skipped: boolean;
        skipReason?: string;
        debugMessage?: string;
        latestSeenByPlatform?: Array<{
          platform: string;
          problemId: string;
          problemName?: string;
          timestampSeconds: number;
          localDate: string;
          alreadyInDb: boolean;
        }>;
      }>;
    }
  >("runSubmissionCheck"),
};
