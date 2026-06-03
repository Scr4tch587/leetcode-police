/** Typed wrappers around the callable Cloud Functions. */
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
    { displayName?: string; phoneNumber?: string },
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
  approveSubmission: call<{ submissionId: string }, { ok: boolean }>(
    "approveSubmission"
  ),
  rejectSubmission: call<
    { submissionId: string; note?: string },
    { ok: boolean }
  >("rejectSubmission"),
  adjustBank: call<
    { userId: string; delta: number },
    { ok: boolean; bankedProblems: number }
  >("adjustBank"),
  adjustPenalty: call<
    { userId: string; delta: number },
    { ok: boolean; wordPenalty: number }
  >("adjustPenalty"),
};
