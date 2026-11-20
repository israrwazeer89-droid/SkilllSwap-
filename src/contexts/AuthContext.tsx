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
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "../lib/firebase";
import { handleFirestoreError, OperationType } from "../lib/firestoreError";
import { SCHEMA_LIMITS } from "../lib/validation";
import type { PrivateAccountInfo, UserProfile } from "../types/skillswap";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  privateInfo: PrivateAccountInfo | null;
  loading: boolean;
  authError: string | null;
  isAdmin: boolean;
  needsOnboarding: boolean;
  setNeedsOnboarding: (val: boolean) => void;
  clearAuthError: () => void;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [privateInfo, setPrivateInfo] = useState<PrivateAccountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAdminDoc, setIsAdminDoc] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

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
      if (!firebaseUser) {
        setProfile(null);
        setPrivateInfo(null);
        setIsAdminDoc(false);
        setNeedsOnboarding(false);
        setLoading(false);
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    let unsubProfile: (() => void) | undefined;
    let unsubPrivate: (() => void) | undefined;
    let cancelled = false;
    let provisioningStarted = false;

    const captureFirestoreError = (
      err: unknown,
      op: OperationType,
      path: string
    ) => {
      try {
        handleFirestoreError(err, op, path);
      } catch (wrapped) {
        if (!cancelled) {
          setAuthError(
            wrapped instanceof Error ? wrapped.message : String(wrapped)
          );
          setLoading(false);
        }
      }
    };

    const setupUserDocs = async () => {
      setLoading(true);
      setAuthError(null);

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
        async (snap) => {
          if (cancelled) return;
          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            setProfile(data);
            setNeedsOnboarding(
              data.teachSkills.length === 0 &&
                data.learnSkills.length === 0 &&
                data.bio === ""
            );
            setLoading(false);
          } else if (user.emailVerified && !provisioningStarted) {
            provisioningStarted = true;
            // Auto-provision initial profile & private info for newly verified users
            try {
              const displayName = (
                user.displayName ||
                user.email?.split("@")[0] ||
                "Learner"
              )
                .trim()
                .slice(0, SCHEMA_LIMITS.displayNameMax);
              const safeName =
                displayName.length >= 2 ? displayName : "SkillSwap Peer";

              const initialProfile: Omit<
                UserProfile,
                "createdAt" | "updatedAt"
              > & {
                createdAt: ReturnType<typeof serverTimestamp>;
                updatedAt: ReturnType<typeof serverTimestamp>;
              } = {
                uid: user.uid,
                displayName: safeName,
                photoURL: (user.photoURL || "").slice(
                  0,
                  SCHEMA_LIMITS.photoUrlMax
                ),
                country: "Remote / Global",
                bio: "",
                teachSkills: [],
                learnSkills: [],
                experienceLevel: "Intermediate",
                languages: ["English"],
                availability: "Weekdays & Weekends (Flexible)",
                ratingAvg: 0,
                ratingCount: 0,
                completedExchanges: 0,
                isVerified: false,
                isSuspended: false,
                isPublic: true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              };

              await setDoc(doc(db, "users", user.uid), initialProfile);

              await setDoc(doc(db, "users", user.uid, "private", "info"), {
                uid: user.uid,
                email: (user.email || "").slice(0, 160),
                blockedUserIds: [],
                allowMessagesFrom: "anyone",
                emailNotifications: true,
                updatedAt: serverTimestamp(),
              });

              if (!cancelled) {
                setNeedsOnboarding(true);
                setLoading(false);
              }
            } catch (err) {
              provisioningStarted = false;
              captureFirestoreError(err, OperationType.WRITE, profilePath);
            }
          } else if (!user.emailVerified) {
            setProfile(null);
            setLoading(false);
          }
        },
        (error) => {
          captureFirestoreError(error, OperationType.GET, profilePath);
        }
      );

      // Listen to private info
      const privatePath = `users/${user.uid}/private/info`;
      unsubPrivate = onSnapshot(
        doc(db, "users", user.uid, "private", "info"),
        (snap) => {
          if (cancelled) return;
          if (snap.exists()) {
            setPrivateInfo(snap.data() as PrivateAccountInfo);
          }
        },
        (error) => {
          captureFirestoreError(error, OperationType.GET, privatePath);
        }
      );
    };

    void setupUserDocs();

    return () => {
      cancelled = true;
      unsubProfile?.();
      unsubPrivate?.();
    };
  }, [user?.uid, user?.emailVerified]);

  const isAdmin =
    Boolean(user?.emailVerified) &&
    (isAdminDoc || user?.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL);

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
    await sendEmailVerification(auth.currentUser);
  };

  const refreshAuthUser = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await reload(auth.currentUser);
    const refreshed = auth.currentUser;
    setUser(refreshed);
    return refreshed.emailVerified;
  };

  const logout = async () => {
    setAuthError(null);
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        privateInfo,
        loading,
        authError,
        isAdmin,
        needsOnboarding,
        setNeedsOnboarding,
        clearAuthError: () => setAuthError(null),
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
