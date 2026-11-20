import { useState } from "react";
import { AuthModal } from "./components/AuthModal";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LandingPage } from "./components/LandingPage";
import { WorkspaceShell } from "./components/WorkspaceShell";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";

function SkillSwapRouter() {
  const { user, loading, authError, logout } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "signup">("signup");

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
    return <WorkspaceShell />;
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
