/** Singleton firebase-admin initialisation shared by all functions. */
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

if (getApps().length === 0) {
  initializeApp();
}

export const db = getFirestore();
export const storage = getStorage();

// Use serverTimestamps for consistency and ignore undefined props.
db.settings({ ignoreUndefinedProperties: true });
