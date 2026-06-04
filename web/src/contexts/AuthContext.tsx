/**
 * Authentication + profile context.
 *
 * Responsibilities:
 *  - Track Firebase Auth state (Google sign-in).
 *  - Ensure a user profile document exists (via the bootstrapUser function).
 *  - Subscribe in real time to the user's profile and their group document.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db, googleProvider } from "../firebase";
import { api } from "../api";
import { groupScoreLabel } from "@/lib/groupScore";
import { userScore } from "@/lib/userScore";
import type { Group, User } from "../types";

interface AuthState {
  firebaseUser: FirebaseUser | null;
  profile: User | null;
  group: Group | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);

  // Track auth state and bootstrap the profile doc.
  useEffect(() => {
    return onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          await api.bootstrapUser({
            displayName: fbUser.displayName ?? undefined,
          });
        } catch (err) {
          console.error("bootstrapUser failed", err);
        }
      } else {
        setProfile(null);
        setGroup(null);
        setLoading(false);
      }
    });
  }, []);

  // Subscribe to the profile document.
  useEffect(() => {
    if (!firebaseUser) return;
    const ref = doc(db, "users", firebaseUser.uid);
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setProfile(null);
        } else {
          const raw = { id: snap.id, ...snap.data() } as User;
          setProfile({ ...raw, score: userScore(raw) });
        }
        setLoading(false);
      },
      (err) => {
        console.error("profile subscription error", err);
        setLoading(false);
      }
    );
  }, [firebaseUser]);

  // Subscribe to the group document when the user belongs to one.
  useEffect(() => {
    if (!profile?.groupId) {
      setGroup(null);
      return;
    }
    const ref = doc(db, "groups", profile.groupId);
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setGroup(null);
      } else {
        const raw = { id: snap.id, ...snap.data() } as Group;
        setGroup({ ...raw, scoreLabel: groupScoreLabel(raw) });
      }
    });
  }, [profile?.groupId]);

  const value = useMemo<AuthState>(
    () => ({
      firebaseUser,
      profile,
      group,
      loading,
      signIn: async () => {
        await signInWithPopup(auth, googleProvider);
      },
      signOut: async () => {
        await fbSignOut(auth);
      },
    }),
    [firebaseUser, profile, group, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
