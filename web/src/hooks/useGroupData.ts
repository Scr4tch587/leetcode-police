/** Real-time subscriptions for a group's members, submissions and statuses. */
import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import type { DailyStatus, Submission, User } from "../types";

export function useGroupMembers(groupId: string | null | undefined): User[] {
  const [members, setMembers] = useState<User[]>([]);
  useEffect(() => {
    if (!groupId) {
      setMembers([]);
      return;
    }
    const q = query(collection(db, "users"), where("groupId", "==", groupId));
    return onSnapshot(q, (snap) => {
      setMembers(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as User)
          .sort((a, b) => a.wordPenalty - b.wordPenalty)
      );
    });
  }, [groupId]);
  return members;
}

export function useGroupSubmissions(
  groupId: string | null | undefined,
  max = 100
): Submission[] {
  const [subs, setSubs] = useState<Submission[]>([]);
  useEffect(() => {
    if (!groupId) {
      setSubs([]);
      return;
    }
    const q = query(
      collection(db, "submissions"),
      where("groupId", "==", groupId),
      orderBy("timestamp", "desc")
    );
    return onSnapshot(q, (snap) => {
      setSubs(
        snap.docs.slice(0, max).map((d) => ({ id: d.id, ...d.data() }) as Submission)
      );
    });
  }, [groupId, max]);
  return subs;
}

export function useUserSubmissions(
  userId: string | null | undefined
): Submission[] {
  const [subs, setSubs] = useState<Submission[]>([]);
  useEffect(() => {
    if (!userId) {
      setSubs([]);
      return;
    }
    const q = query(
      collection(db, "submissions"),
      where("userId", "==", userId),
      orderBy("timestamp", "desc")
    );
    return onSnapshot(q, (snap) => {
      setSubs(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Submission));
    });
  }, [userId]);
  return subs;
}

export function useGroupDailyStatus(
  groupId: string | null | undefined,
  max = 200
): DailyStatus[] {
  const [statuses, setStatuses] = useState<DailyStatus[]>([]);
  useEffect(() => {
    if (!groupId) {
      setStatuses([]);
      return;
    }
    const q = query(
      collection(db, "dailyStatus"),
      where("groupId", "==", groupId),
      orderBy("date", "desc")
    );
    return onSnapshot(q, (snap) => {
      setStatuses(
        snap.docs.slice(0, max).map((d) => ({ id: d.id, ...d.data() }) as DailyStatus)
      );
    });
  }, [groupId, max]);
  return statuses;
}
