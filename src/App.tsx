import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Moon, Sun } from "lucide-react";
import { AuthModal } from "./components/AuthModal";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LandingPage } from "./components/LandingPage";
import { ProfilePageView } from "./components/ProfilePageView";
import { WorkspaceShell } from "./components/WorkspaceShell";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";

function parseProfilePath(pathname: string): string | null {
  const match = pathname.match(/^\/profile\/([a-zA-Z0-9_-]+)$/);
  return match ? match[1] : null;
}

function normalizePathname(raw: string): string {
  if (!raw || raw === "/") return "/";
  return raw.replace(/\/+$/, "") || "/";
}

function SkillSwapRouter() {
  const { user, loading, authError, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "signup">("signup");
  const [pathname, setPathname] = useState<string>(() =>
    normalizePathname(window.location.pathname)
  );

  const authInitializedRef = useRef(false);
  const prevUserUidRef = useRef<string | null>(null);

  const navigateTo = useCallback((targetPath: string) => {
    const normalized = normalizePathname(targetPath);
    if (normalizePathname(window.location.pathname) !== normalized) {
      window.history.pushState(null, "", normalized);
    }
    setPathname(normalized);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setPathname(normalizePathname(window.location.pathname));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Only redirect "/" -> "/dashboard" on active sign-in transitions (null -> signed-in),
  // NEVER auto-redirect an already signed-in user visiting or refreshing "/".
  useEffect(() => {
    if (loading) return;

    const currentUid = user?.uid ?? null;
    if (!authInitializedRef.current) {
      authInitializedRef.current = true;
      prevUserUidRef.current = currentUid;
      return;
    }

    const prevUid = prevUserUidRef.current;
    prevUserUidRef.current = currentUid;

    if (!prevUid && currentUid) {
      setAuthModalOpen(false);
      if (pathname === "/") {
        navigateTo("/dashboard");
      }
    } else if (prevUid && !currentUid) {
      if (pathname !== "/" && !parseProfilePath(pathname)) {
        navigateTo("/");
      }
    }
  }, [loading, user?.uid, pathname, navigateTo]);

  const routeProfileUid = parseProfilePath(pathname);

  if (authError) {
    let readable = authError;
    try {
      const parsed = JSON.parse(authError) as {
        error?: string;
        operationType?: string;
        path?: string;
      };
      if (parsed.error) {
        readable = `${parsed.error}${parsed.path ? ` (${parsed.operationType} on ${parsed.path})` : ""}`;
      }
    } catch {
      // Plain error string
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Unable to complete sign-in
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 break-words leading-relaxed">
            {readable}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="space-y-3 text-center">
          <Loader2 className="w-7 h-7 animate-spin text-blue-600 dark:text-blue-400 mx-auto" />
          <p className="text-lg font-bold font-display text-slate-900 dark:text-white">
            SkillSwap
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Loading your workspace...
          </p>
        </div>
      </div>
    );
  }

  // Keep Landing Page route "/" accessible even when logged in
  if (pathname === "/") {
    return (
      <>
        <LandingPage
          onOpenAuth={(mode) => {
            setAuthModalMode(mode);
            setAuthModalOpen(true);
          }}
          onGoDashboard={() => navigateTo("/dashboard")}
          onGoProfile={(uid) => navigateTo(`/profile/${uid}`)}
          onLogout={() => void logout()}
        />
        <AuthModal
          isOpen={authModalOpen}
          initialMode={authModalMode}
          onClose={() => setAuthModalOpen(false)}
        />
      </>
    );
  }

  if (routeProfileUid) {
    if (user) {
      return (
        <WorkspaceShell
          initialTab="profile"
          initialProfileUid={routeProfileUid}
          onGoHome={() => navigateTo("/")}
        />
      );
    }

    // Public /profile/[userId] route accessible to everyone even when signed out
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <header className="sticky top-0 z-20 h-16 px-4 sm:px-6 lg:px-8 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-7xl mx-auto h-full flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => navigateTo("/")}
              className="text-lg font-bold tracking-tight text-slate-900 dark:text-white font-display hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              SkillSwap
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Toggle theme"
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
              >
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthModalMode("login");
                  setAuthModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthModalMode("signup");
                  setAuthModalOpen(true);
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
              >
                Join SkillSwap
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ProfilePageView
            viewedUserId={routeProfileUid}
            onOpenAuth={(mode) => {
              setAuthModalMode(mode);
              setAuthModalOpen(true);
            }}
            onBackHome={() => navigateTo("/")}
          />
        </main>

        <AuthModal
          isOpen={authModalOpen}
          initialMode={authModalMode}
          onClose={() => setAuthModalOpen(false)}
        />
      </div>
    );
  }

  if (user) {
    return (
      <WorkspaceShell
        initialTab="dashboard"
        onGoHome={() => navigateTo("/")}
      />
    );
  }

  return (
    <>
      <LandingPage
        onOpenAuth={(mode) => {
          setAuthModalMode(mode);
          setAuthModalOpen(true);
        }}
        onGoDashboard={() => navigateTo("/dashboard")}
        onGoProfile={(uid) => navigateTo(`/profile/${uid}`)}
        onLogout={() => void logout()}
      />
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authModalMode}
        onClose={() => setAuthModalOpen(false)}
      />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <SkillSwapRouter />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
