import { useEffect, useState } from "react";
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

function SkillSwapRouter() {
  const { user, loading, authError, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "signup">("signup");
  const [routeProfileUid, setRouteProfileUid] = useState<string | null>(() =>
    parseProfilePath(window.location.pathname)
  );

  useEffect(() => {
    const onPopState = () => {
      setRouteProfileUid(parseProfilePath(window.location.pathname));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

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

  if (user) {
    return (
      <WorkspaceShell
        initialTab={routeProfileUid ? "profile" : "dashboard"}
        initialProfileUid={routeProfileUid}
      />
    );
  }

  // Public /profile/[userId] route accessible to everyone even when signed out
  if (routeProfileUid) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <header className="sticky top-0 z-20 h-16 px-4 sm:px-6 lg:px-8 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-7xl mx-auto h-full flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => {
                window.history.pushState(null, "", "/");
                setRouteProfileUid(null);
              }}
              className="text-lg font-bold tracking-tight text-slate-900 dark:text-white font-display"
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
            onBackHome={() => {
              window.history.pushState(null, "", "/");
              setRouteProfileUid(null);
            }}
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

  return (
    <>
      <LandingPage
        onOpenAuth={(mode) => {
          setAuthModalMode(mode);
          setAuthModalOpen(true);
        }}
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
