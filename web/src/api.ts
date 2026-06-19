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
      atcoderHandle?: string;
      csesUserId?: string;
    },
    { ok: boolean }
  >("updateProfile"),
  createGroup: call<
    { name: string; timezone?: string; scoreLabel: string },
    { groupId: string; inviteCode: string }
  >("createGroup"),
  joinGroup: call<
    { inviteCode: string },
    { groupId: string; groupName: string }
  >("joinGroup"),
  leaveGroup: call<Record<string, never>, { ok: boolean }>("leaveGroup"),
  updateGroupSettings: call<
    { scoreLabel: string },
    { ok: boolean; scoreLabel: string }
  >("updateGroupSettings"),
  adjustBank: call<
    { userId: string; delta: number },
    { ok: boolean; bankedProblems: number }
  >("adjustBank"),
  adjustScore: call<
    { userId: string; delta: number },
    { ok: boolean; score: number }
  >("adjustScore"),
  nullifyTodaySolve: call<
    { userId: string },
    { ok: boolean; date: string; alreadyVoid: boolean; extrasReversed: number }
  >("nullifyTodaySolve"),
  grantTodaySolve: call<
    { userId: string },
    {
      ok: boolean;
      date: string;
      alreadySolved: boolean;
      wasVoided: boolean;
    }
  >("grantTodaySolve"),
  clearDayMiss: call<
    { userId: string; date?: string },
    { ok: boolean; date: string; alreadyClear: boolean; scoreReversed: number }
  >("clearDayMiss"),
  runSubmissionCheck: call<
    { userId?: string },
    {
      ok: boolean;
      ingested: number;
      message: string;
    }
  >("runSubmissionCheck"),
};
