import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  doc,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
  type Firestore,
  type FirestoreSettings,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import firebaseConfig from "../../firebase-applet-config.json";

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

function initDb(): Firestore {
  if (typeof window === "undefined") {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
  try {
    return initializeFirestore(
      app,
      {
        experimentalForceLongPolling: true,
        useFetchStreams: false,
      } as FirestoreSettings,
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

export const db = initDb();
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("email");
googleProvider.addScope("profile");
googleProvider.setCustomParameters({ prompt: "select_account" });

export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return;
      }
      // Retry once after brief delay in case initial cold-start handshake timed out
      try {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        await getDocFromServer(doc(db, "test", "connection"));
      } catch (retryError) {
        if (
          retryError instanceof Error &&
          retryError.message.includes("the client is offline")
        ) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
  }
}

void testConnection();
