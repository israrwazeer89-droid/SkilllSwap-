import React, { createContext, useContext, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db, googleProvider } from "../lib/firebase";
import { handleFirestoreError, OperationType } from "../lib/firestoreError";
import { normalizeUserProfile } from "../lib/gamification";
import type { PrivateAccountInfo, UserProfile } from "../types/skillswap";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  privateInfo: PrivateAccountInfo | null;
  loading: boolean;
  profileLoading: boolean;
  authError: string | null;
  profileError: string | null;
  isAdmin: boolean;
  isVerified: boolean;
  isGoogleUser: boolean;
  needsOnboarding: boolean;
  setNeedsOnboarding: (val: boolean) => void;
  clearAuthError: () => void;
  retryProfileLoad: () => void;
  loginWithGoogle: () => Promise<void>;
  loginWithGoogleRedirect: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshAuthUser: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const BOOTSTRAPPED_ADMIN_EMAIL = "israrwazeer89@gmail.com";

export function isGoogleAuthUser(user: User | null): boolean {
  if (!user) return false;
  return user.providerData.some((p) => p.providerId === "google.com");
}

export function isVerifiedAccount(user: User | null): boolean {
  if (!user) return false;
  return Boolean(user.emailVerified || isGoogleAuthUser(user));
}

export function getUserEmail(user: User | null): string {
  if (!user) return "";
  if (user.email) return user.email;
  return user.providerData.find((p) => Boolean(p.email))?.email || "";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [privateInfo, setPrivateInfo] = useState<PrivateAccountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isAdminDoc, setIsAdminDoc] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    void getRedirectResult(auth).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg) {
        setAuthError(msg);
      }
    });

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthError(null);
      setProfileError(null);
      if (!firebaseUser) {
        setProfile(null);
        setPrivateInfo(null);
        setIsAdminDoc(false);
        setNeedsOnboarding(false);
        setProfileLoading(false);
        setLoading(false);
      } else {
        setLoading(false);
      }
    });
    return () => unsubAuth();
  }, []);

  const userIsGoogle = isGoogleAuthUser(user);
  const userIsVerified = isVerifiedAccount(user);
  const resolvedEmail = getUserEmail(user);

  useEffect(() => {
    if (!user) return;

    let unsubProfile: (() => void) | undefined;
    let unsubPrivate: (() => void) | undefined;
    let cancelled = false;

    const captureProfileError = (
      err: unknown,
      op: OperationType,
      path: string
    ) => {
      try {
        handleFirestoreError(err, op, path);
      } catch (wrapped) {
        if (!cancelled) {
          setProfileError(
            wrapped instanceof Error ? wrapped.message : String(wrapped)
          );
          setProfileLoading(false);
          setLoading(false);
        }
      }
    };

    const setupUserDocs = async () => {
      setProfileLoading(true);
      setProfileError(null);

      // Ensure auth ID token is ready before Firestore queries/writes
      try {
        await user.getIdToken();
      } catch {
        // Proceed with cached token if offline
      }

      // Check admin record
      try {
        const adminSnap = await getDoc(doc(db, "admins", user.uid));
        if (!cancelled) {
          setIsAdminDoc(adminSnap.exists());
        }
      } catch {
        // Non-admin or offline
      }

      if (cancelled) return;

      // Listen to public profile
      const profilePath = `users/${user.uid}`;
      unsubProfile = onSnapshot(
        doc(db, "users", user.uid),
        (snap) => {
          if (cancelled) return;
          setProfileError(null);
          if (snap.exists()) {
            const raw = snap.data() as Partial<UserProfile> & { uid?: string };
            const normalized = normalizeUserProfile({
              ...raw,
              uid: raw.uid || user.uid,
              emailVerified: Boolean(raw.emailVerified || userIsVerified),
            });
            setProfile(normalized);
          } else {
            setProfile(null);
          }
          setProfileLoading(false);
          setLoading(false);
        },
        (error) => {
          captureProfileError(error, OperationType.GET, profilePath);
        }
      );

      // Listen to private info
      const privatePath = `users/${user.uid}/private/info`;
      unsubPrivate = onSnapshot(
        doc(db, "users", user.uid, "private", "info"),
        (snap) => {
          if (cancelled) return;
          if (snap.exists()) {
            const pData = snap.data() as PrivateAccountInfo;
            setPrivateInfo(pData);
            if (!pData.email && resolvedEmail) {
              void setDoc(
                doc(db, "users", user.uid, "private", "info"),
                {
                  ...pData,
                  email: resolvedEmail.slice(0, 160),
                  updatedAt: serverTimestamp(),
                },
                { merge: true }
              ).catch(() => {});
            }
          } else {
            setPrivateInfo(null);
          }
        },
        (error) => {
          captureProfileError(error, OperationType.GET, privatePath);
        }
      );
    };

    void setupUserDocs();

    return () => {
      cancelled = true;
      unsubProfile?.();
      unsubPrivate?.();
    };
  }, [user?.uid, userIsVerified, resolvedEmail, retryToken]);

  const isAdmin =
    userIsVerified &&
    (isAdminDoc || resolvedEmail.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL);

  const loginWithGoogle = async () => {
    setAuthError(null);
    await signInWithPopup(auth, googleProvider);
  };

  const loginWithGoogleRedirect = async () => {
    setAuthError(null);
    await signInWithRedirect(auth, googleProvider);
  };

  const loginWithEmail = async (email: string, password: string) => {
    setAuthError(null);
    await signInWithEmailAndPassword(auth, email.trim(), password);
  };

  const signUpWithEmail = async (name: string, email: string, password: string) => {
    setAuthError(null);
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(cred.user, { displayName: name.trim() });
    await sendEmailVerification(cred.user);
    setUser(cred.user);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) throw new Error("No authenticated user found.");
    if (isGoogleAuthUser(auth.currentUser)) return;
    await sendEmailVerification(auth.currentUser);
  };

  const refreshAuthUser = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await reload(auth.currentUser);
    const refreshed = auth.currentUser;
    setUser(refreshed);
    return isVerifiedAccount(refreshed);
  };

  const logout = async () => {
    setAuthError(null);
    setProfileError(null);
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        privateInfo,
        loading,
        profileLoading,
        authError,
        profileError,
        isAdmin,
        isVerified: userIsVerified,
        isGoogleUser: userIsGoogle,
        needsOnboarding,
        setNeedsOnboarding,
        clearAuthError: () => setAuthError(null),
        retryProfileLoad: () => setRetryToken((c) => c + 1),
        loginWithGoogle,
        loginWithGoogleRedirect,
        loginWithEmail,
        signUpWithEmail,
        resetPassword,
        resendVerificationEmail,
        refreshAuthUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
