import React, { useEffect, useState } from "react";
import {
  X,
  Mail,
  Lock,
  User,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: "login" | "signup" | "reset";
  onClose: () => void;
}

const FIREBASE_PROVIDERS_URL =
  "https://console.firebase.google.com/project/gen-lang-client-0960777370/authentication/providers";
const FIREBASE_DOMAINS_URL =
  "https://console.firebase.google.com/project/gen-lang-client-0960777370/authentication/settings";

function mapAuthError(err: unknown): {
  message: string;
  showRedirectFallback?: boolean;
  consoleLink?: { label: string; href: string };
} {
  const code = (err as { code?: string })?.code || "";
  const msg = err instanceof Error ? err.message : String(err);

  if (code === "auth/operation-not-allowed") {
    return {
      message:
        'Email/Password sign-in is currently disabled in Firebase Console. Click "Continue with Google" above to sign in right away, or enable the Email/Password provider in Firebase Console.',
      consoleLink: {
        label: "Open Firebase Sign-in Providers",
        href: FIREBASE_PROVIDERS_URL,
      },
    };
  }
  if (
    code === "auth/popup-blocked" ||
    code === "auth/cancelled-popup-request" ||
    code === "auth/internal-error"
  ) {
    return {
      message:
        "The Google sign-in popup was blocked or interrupted by your browser. Allow popups or use the redirect sign-in option below.",
      showRedirectFallback: true,
    };
  }
  if (code === "auth/unauthorized-domain") {
    const host =
      typeof window !== "undefined" ? window.location.hostname : "this domain";
    return {
      message: `This domain (${host}) is not listed under Firebase Authorized Domains yet. Add "${host}" in Firebase Console → Authentication → Settings → Authorized domains.`,
      consoleLink: {
        label: "Open Firebase Authorized Domains",
        href: FIREBASE_DOMAINS_URL,
      },
    };
  }
  if (code === "auth/network-request-failed") {
    return {
      message:
        "Network error while contacting Google/Firebase Authentication. Please check your internet connection and try again.",
    };
  }
  if (code === "auth/account-exists-with-different-credential") {
    return {
      message:
        "An account already exists with this email address under a different sign-in provider.",
    };
  }
  if (code === "auth/user-disabled") {
    return { message: "This user account has been disabled." };
  }
  if (
    code === "auth/invalid-credential" ||
    code === "auth/wrong-password" ||
    code === "auth/user-not-found"
  ) {
    return {
      message: "Invalid email or password. Please double-check your credentials.",
    };
  }
  if (code === "auth/email-already-in-use") {
    return {
      message: "An account with this email already exists. Try signing in instead.",
    };
  }
  if (code === "auth/weak-password") {
    return { message: "Password must be at least 6 characters long." };
  }
  if (code === "auth/popup-closed-by-user") {
    return {
      message:
        "Google sign-in window was closed before completing. You can retry above or try redirect sign-in below.",
      showRedirectFallback: true,
    };
  }
  if (code === "auth/too-many-requests") {
    return {
      message: "Too many attempts. Please wait a moment before trying again.",
    };
  }
  return { message: msg };
}

export function AuthModal({
  isOpen,
  initialMode = "login",
  onClose,
}: AuthModalProps) {
  const {
    loginWithGoogle,
    loginWithGoogleRedirect,
    loginWithEmail,
    signUpWithEmail,
    resetPassword,
  } = useAuth();
  const [mode, setMode] = useState<"login" | "signup" | "reset">(initialMode);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showRedirectFallback, setShowRedirectFallback] = useState(false);
  const [consoleLink, setConsoleLink] = useState<{
    label: string;
    href: string;
  } | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setShowEmailForm(initialMode === "reset");
      setError("");
      setShowRedirectFallback(false);
      setConsoleLink(null);
      setNotice("");
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleGoogle = async () => {
    setError("");
    setShowRedirectFallback(false);
    setConsoleLink(null);
    setNotice("");
    setSubmitting(true);
    try {
      await loginWithGoogle();
      onClose();
    } catch (err) {
      const mapped = mapAuthError(err);
      setError(mapped.message);
      setShowRedirectFallback(Boolean(mapped.showRedirectFallback));
      setConsoleLink(mapped.consoleLink ?? null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleRedirect = async () => {
    setError("");
    setConsoleLink(null);
    setSubmitting(true);
    try {
      await loginWithGoogleRedirect();
    } catch (err) {
      const mapped = mapAuthError(err);
      setError(mapped.message);
      setConsoleLink(mapped.consoleLink ?? null);
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setShowRedirectFallback(false);
    setConsoleLink(null);
    setNotice("");

    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (mode !== "reset" && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (mode === "signup" && fullName.trim().length < 2) {
      setError("Full name must be at least 2 characters.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "login") {
        await loginWithEmail(cleanEmail, password);
        onClose();
      } else if (mode === "signup") {
        await signUpWithEmail(fullName, cleanEmail, password);
        setNotice(
          "Account created! Check your inbox for a verification link so your profile can go live."
        );
      } else {
        await resetPassword(cleanEmail);
        setNotice(
          "Password reset instructions have been sent to your email address."
        );
      }
    } catch (err) {
      const mapped = mapAuthError(err);
      setError(mapped.message);
      setConsoleLink(mapped.consoleLink ?? null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close authentication dialog"
          className="absolute top-4 right-4 p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
            SkillSwap · Exchange Skills, Not Money
          </p>
          <h2
            id="auth-modal-title"
            className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight"
          >
            {mode === "signup"
              ? "Join SkillSwap with Google"
              : mode === "reset"
              ? "Reset your password"
              : "Sign in to SkillSwap"}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
            Use your Google account for instant, verified peer-to-peer access.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 leading-relaxed space-y-2">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            {(showRedirectFallback || consoleLink) && (
              <div className="pl-6 flex flex-wrap items-center gap-3">
                {showRedirectFallback && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleGoogleRedirect}
                    className="font-semibold underline hover:no-underline"
                  >
                    Try Google Redirect Sign-In instead
                  </button>
                )}
                {consoleLink && (
                  <a
                    href={consoleLink.href}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold underline hover:no-underline"
                  >
                    {consoleLink.label}
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {notice && (
          <div className="mb-4 flex items-start gap-2.5 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{notice}</span>
          </div>
        )}

        <button
          type="button"
          disabled={submitting}
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
        >
          <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
              />
            </svg>
          </span>
          <span>{submitting ? "Connecting to Google..." : "Continue with Google"}</span>
        </button>

        <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              setShowEmailForm((prev) => !prev);
              setError("");
              setShowRedirectFallback(false);
              setConsoleLink(null);
              setNotice("");
            }}
            className="w-full flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <span>Use email &amp; password instead</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${showEmailForm ? "rotate-180" : ""}`}
            />
          </button>

          {showEmailForm && (
            <div className="mt-4 space-y-4">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Requires Email/Password to be enabled in your Firebase Console{" "}
                <a
                  href={FIREBASE_PROVIDERS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 dark:text-blue-400 underline hover:no-underline"
                >
                  Sign-in providers
                </a>
                .
              </p>

              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError("");
                    setNotice("");
                  }}
                  className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    mode === "login"
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError("");
                    setNotice("");
                  }}
                  className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    mode === "signup"
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  Sign Up
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("reset");
                    setError("");
                    setNotice("");
                  }}
                  className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    mode === "reset"
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  Forgot
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                {mode === "signup" && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Ayesha Khan"
                        maxLength={80}
                        className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@university.edu"
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                {mode !== "reset" && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  <span>
                    {submitting
                      ? "Processing..."
                      : mode === "login"
                      ? "Sign In with Email"
                      : mode === "signup"
                      ? "Create Email Account"
                      : "Send Reset Link"}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
