import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Dumbbell,
  Flame,
  Loader2,
  Medal,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Trophy,
  UserPlus,
} from "lucide-react";
import { getUserEmail, useAuth } from "../contexts/AuthContext";
import { getLevelInfo, getUserRank, normalizeUserProfile, sortLeaderboard } from "../lib/gamification";
import { getRecommendedQuiz } from "../lib/practiceQuizzes";
import { calculateProfileCompletion } from "../lib/validation";
import type {
  AiMatch,
  Conversation,
  ExchangeRequest,
  PracticeAttempt,
  Review,
  UserProfile,
  WorkspaceTab,
} from "../types/skillswap";
import { Avatar } from "./Avatar";

interface OverviewDashboardProps {
  peers: UserProfile[];
  exchanges: ExchangeRequest[];
  conversations: Conversation[];
  matches: AiMatch[];
  reviews: Review[];
  practiceAttempts?: PracticeAttempt[];
  workspaceError?: string | null;
  onRetryWorkspace?: () => void;
  onNavigate: (tab: WorkspaceTab) => void;
  onSelectConversation: (convId: string) => void;
  onStartPractice?: (quizId?: string) => void;
  onOpenProfile?: (uid: string) => void;
}

function formatFirestoreError(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: string; path?: string | null };
    if (parsed && typeof parsed.error === "string" && parsed.error.trim()) {
      return parsed.path ? `${parsed.error} (${parsed.path})` : parsed.error;
    }
  } catch {
    // Plain error message
  }
  return raw;
}

export function OverviewDashboard({
  peers,
  exchanges,
  conversations,
  matches,
  reviews,
  practiceAttempts = [],
  workspaceError,
  onRetryWorkspace,
  onNavigate,
  onSelectConversation,
  onStartPractice,
  onOpenProfile,
}: OverviewDashboardProps) {
  const {
    user,
    profile,
    profileLoading,
    profileError,
    retryProfileLoad,
    setNeedsOnboarding,
  } = useAuth();

  if (profileLoading) {
    return (
      <div
        className="p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center gap-3 min-h-[280px]"
        aria-busy="true"
        aria-label="Loading dashboard"
      >
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Loading your dashboard...
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
          Fetching your SkillSwap profile, matches, and active exchanges from Firestore.
        </p>
      </div>
    );
  }

  const activeError = profileError || workspaceError;
  if (activeError) {
    return (
      <div
        role="alert"
        className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/70 space-y-4 max-w-2xl"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Could not load your dashboard
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {formatFirestoreError(activeError)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              retryProfileLoad();
              onRetryWorkspace?.();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
          {!profile && (
            <button
              type="button"
              onClick={() => setNeedsOnboarding(true)}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Create Profile
            </button>
          )}
        </div>
      </div>
    );
  }

  const allLeaderboardUsers = (() => {
    const map = new Map<string, UserProfile>();
    for (const p of peers) map.set(p.uid, normalizeUserProfile(p));
    if (profile) map.set(profile.uid, normalizeUserProfile(profile));
    return Array.from(map.values());
  })();
  const topThreeLearners = sortLeaderboard(allLeaderboardUsers).slice(0, 3);
  const recommendedQuiz = getRecommendedQuiz(profile, practiceAttempts);

  if (!profile) {
    const accountLabel =
      user?.displayName || getUserEmail(user).split("@")[0] || "there";
    return (
      <div className="space-y-6">
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Welcome to SkillSwap, {accountLabel}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Welcome! Create Your Profile
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Add your photo, city, skills you can teach, and skills you want to learn so peers can
              connect with you, earn XP together, and appear on the leaderboard.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setNeedsOnboarding(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4" />
              Create Profile
            </button>
            <button
              type="button"
              onClick={() => onNavigate("profile")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              Open My Profile
            </button>
          </div>
        </div>

        {/* Summary KPI Strip even before profile creation */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">My Rank</p>
            <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
              Unranked
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">My XP</p>
            <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
              0 XP
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">My Streak</p>
            <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
              0 days
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                My Next Practice
              </h2>
              <Dumbbell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {recommendedQuiz.title}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {recommendedQuiz.category} · 5 questions · 30s per question · +10 XP per correct answer
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                onStartPractice ? onStartPractice(recommendedQuiz.id) : onNavigate("practice")
              }
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
            >
              Start Practice Quiz
            </button>
          </div>

          <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Top 3 Learners
              </h2>
              <button
                type="button"
                onClick={() => onNavigate("leaderboard")}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Leaderboard
              </button>
            </div>
            {topThreeLearners.length > 0 ? (
              <div className="space-y-2">
                {topThreeLearners.map((learner, idx) => (
                  <button
                    key={learner.uid}
                    type="button"
                    onClick={() =>
                      onOpenProfile ? onOpenProfile(learner.uid) : onNavigate("leaderboard")
                    }
                    className="w-full text-left py-2 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-xs font-bold text-amber-500 w-5">
                        #{idx + 1}
                      </span>
                      <Avatar src={learner.photoURL} name={learner.displayName} size="sm" />
                      <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {learner.displayName}
                      </span>
                    </div>
                    <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400 tabular-nums shrink-0">
                      {learner.xp} XP
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Create your profile and complete a practice quiz to claim #1 on the leaderboard.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const normalizedProfile = normalizeUserProfile(profile);
  const levelInfo = getLevelInfo(normalizedProfile.xp);
  const myRank = getUserRank(normalizedProfile.uid, allLeaderboardUsers);
  const completion = calculateProfileCompletion(normalizedProfile);
  const pendingRequests = exchanges.filter((e) => e.status === "pending");
  const activeExchanges = exchanges.filter((e) => e.status === "accepted");
  const completedExchanges = exchanges.filter((e) => e.status === "completed");
  const unreadMessages = conversations.filter((c) => c.unreadBy.includes(normalizedProfile.uid)).length;
  const myReviewsReceived = reviews.filter((r) => r.revieweeId === normalizedProfile.uid);
  const avgRating =
    myReviewsReceived.length > 0
      ? (
          myReviewsReceived.reduce((sum, r) => sum + r.rating, 0) /
          myReviewsReceived.length
        ).toFixed(1)
      : "—";

  const myLearnLower = new Set(normalizedProfile.learnSkills.map((s) => s.toLowerCase()));
  const myTeachLower = new Set(normalizedProfile.teachSkills.map((s) => s.toLowerCase()));
  const complementaryPeers = peers
    .filter((p) => p.uid !== normalizedProfile.uid && !p.isSuspended && p.isPublic)
    .map((p) => {
      const teachesWhatIWant = p.teachSkills.find((s) => myLearnLower.has(s.toLowerCase()));
      const wantsWhatITeach = p.learnSkills.find((s) => myTeachLower.has(s.toLowerCase()));
      const score = (teachesWhatIWant ? 1 : 0) + (wantsWhatITeach ? 1 : 0);
      return { peer: p, teachesWhatIWant, wantsWhatITeach, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return (
    <div className="space-y-8">
      {/* Welcome & Level Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-5">
          <div className="space-y-2">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
              Personal Learning Workspace · Level {levelInfo.level}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Welcome back, {normalizedProfile.displayName}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
              Track your rank and XP, practice core skills with timed quizzes, and swap skills with
              peers worldwide.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate("explore")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Explore People
            </button>
            <button
              type="button"
              onClick={() =>
                onStartPractice ? onStartPractice(recommendedQuiz.id) : onNavigate("practice")
              }
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <Dumbbell className="w-3.5 h-3.5" />
              Start Practice (+XP)
            </button>
            <button
              type="button"
              onClick={() => onNavigate("assistant")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <BookOpen className="w-3.5 h-3.5" />
              AI Study Assistant
            </button>
          </div>
        </div>

        <div className="lg:col-span-4 p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                XP to Level {levelInfo.level + 1}
              </span>
              <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                {levelInfo.xpInLevel}/{levelInfo.xpPerLevel} XP
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${levelInfo.progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {levelInfo.xpToNextLevel} XP until Level {levelInfo.level + 1} · Profile completion:{" "}
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                {completion}%
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate("profile")}
            className="self-start text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
          >
            <span>Open My Profile &amp; Notes</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Gamification & Workspace KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigate("leaderboard")}
          className="text-left p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-800 transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>My Rank</span>
            <Trophy className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
            {myRank ? `#${myRank}` : "—"}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {allLeaderboardUsers.length} ranked learners
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate("profile")}
          className="text-left p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-800 transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>My XP</span>
            <Sparkles className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
            {normalizedProfile.xp} XP
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Level {levelInfo.level} · {normalizedProfile.badges.length} badges
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate("practice")}
          className="text-left p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-800 transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>My Streak</span>
            <Flame className="w-4 h-4 text-orange-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
            {normalizedProfile.streakDays} {normalizedProfile.streakDays === 1 ? "day" : "days"}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {practiceAttempts.length} quizzes completed
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate("exchanges")}
          className="text-left p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-800 transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Swaps &amp; Rating</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
            {completedExchanges.length} · {avgRating}★
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {pendingRequests.length} pending · {activeExchanges.length} active · {unreadMessages} unread
          </p>
        </button>
      </div>

      {/* My Next Practice + Top 3 Learners + Skills Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Next Practice */}
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                My Next Practice
              </h2>
              <Dumbbell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                Recommended · {recommendedQuiz.category}
              </p>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mt-1">
                {recommendedQuiz.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {recommendedQuiz.description}
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              5 MCQs · +50 max XP
            </span>
            <button
              type="button"
              onClick={() =>
                onStartPractice ? onStartPractice(recommendedQuiz.id) : onNavigate("practice")
              }
              className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              Start Practice
            </button>
          </div>
        </div>

        {/* Top 3 Learners */}
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Top 3 Learners
              </h2>
              <button
                type="button"
                onClick={() => onNavigate("leaderboard")}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Full Leaderboard
              </button>
            </div>

            {topThreeLearners.length > 0 ? (
              <div className="space-y-2.5">
                {topThreeLearners.map((learner, idx) => {
                  const medalColor =
                    idx === 0
                      ? "text-amber-500"
                      : idx === 1
                        ? "text-slate-400"
                        : "text-orange-500";
                  return (
                    <button
                      key={learner.uid}
                      type="button"
                      onClick={() =>
                        onOpenProfile ? onOpenProfile(learner.uid) : onNavigate("leaderboard")
                      }
                      className="w-full text-left py-2 px-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Medal className={`w-4 h-4 shrink-0 ${medalColor}`} />
                        <Avatar src={learner.photoURL} name={learner.displayName} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            #{idx + 1} {learner.displayName}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            Level {getLevelInfo(learner.xp).level} · {learner.badges.length} badges
                          </p>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 tabular-nums shrink-0">
                        {learner.xp} XP
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Complete a quiz or swap to earn XP and top the leaderboard.
              </p>
            )}
          </div>
        </div>

        {/* Skills Offered & Wanted */}
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              My Skill Exchange Goals
            </h2>
            <button
              type="button"
              onClick={() => onNavigate("profile")}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Edit Skills
            </button>
          </div>
          <div className="space-y-3 text-xs">
            <div>
              <p className="font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Can Teach
              </p>
              <p className="text-sm text-slate-800 dark:text-slate-200">
                {normalizedProfile.teachSkills.join(" · ") || "No teaching skills added yet."}
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <p className="font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Wants To Learn
              </p>
              <p className="text-sm text-slate-800 dark:text-slate-200">
                {normalizedProfile.learnSkills.join(" · ") || "No learning goals added yet."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming & Suggested Matches + Active Exchanges + Recent Conversations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Matches */}
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Upcoming Matches
            </h2>
            <button
              type="button"
              onClick={() => onNavigate("explore")}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              View all
            </button>
          </div>
          {matches.length > 0 ? (
            <div className="space-y-3">
              {matches.slice(0, 3).map((m) => {
                const matchedPeer = peers.find((p) => p.uid === m.partnerId);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onNavigate("explore")}
                    className="w-full text-left py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg px-2 transition-colors"
                  >
                    <Avatar src={matchedPeer?.photoURL} name={m.partnerName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {m.partnerName}
                        </span>
                        <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400 tabular-nums shrink-0">
                          {m.compatibilityScore}% fit
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                        {m.primarySwap}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : complementaryPeers.length > 0 ? (
            <div className="space-y-3">
              {complementaryPeers.map(({ peer, teachesWhatIWant, wantsWhatITeach }) => (
                <button
                  key={peer.uid}
                  type="button"
                  onClick={() => onNavigate("explore")}
                  className="w-full text-left py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg px-2 transition-colors"
                >
                  <Avatar src={peer.photoURL} name={peer.displayName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {peer.displayName}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                      {wantsWhatITeach ? `Learns ${wantsWhatITeach}` : peer.country}
                      {teachesWhatIWant ? ` · Teaches ${teachesWhatIWant}` : ""}
                    </p>
                  </div>
                </button>
              ))}
              <button
                type="button"
                onClick={() => onNavigate("explore")}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Run Gemini AI Match scoring →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Run Gemini AI Matching in Explore & Match to get compatibility scores and partner
                recommendations tailored to your skills.
              </p>
              <button
                type="button"
                onClick={() => onNavigate("explore")}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Run AI Matching now →
              </button>
            </div>
          )}
        </div>

        {/* Pending & Active Exchanges */}
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Active & Pending Swaps
            </h2>
            <button
              type="button"
              onClick={() => onNavigate("exchanges")}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Manage
            </button>
          </div>
          {[...pendingRequests, ...activeExchanges].length > 0 ? (
            <div className="space-y-2">
              {[...pendingRequests, ...activeExchanges].slice(0, 4).map((ex) => {
                const peerName = ex.fromUid === profile.uid ? ex.toName : ex.fromName;
                return (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => onNavigate("exchanges")}
                    className="w-full text-left py-2.5 px-2 rounded-lg border-b border-slate-100 dark:border-slate-800 last:border-0 space-y-1 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {peerName}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 capitalize">
                        {ex.status === "accepted" ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                        )}
                        {ex.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {ex.offeredSkill} ↔ {ex.requestedSkill}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              No pending or active exchanges yet. Browse peers to send your first skill swap
              invitation.
            </p>
          )}
        </div>

        {/* Recent Conversations */}
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Recent Conversations
            </h2>
            <button
              type="button"
              onClick={() => onNavigate("messages")}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Open inbox
            </button>
          </div>
          {conversations.length > 0 ? (
            <div className="space-y-2">
              {conversations.slice(0, 4).map((conv) => {
                const peerId = conv.participantIds.find((id) => id !== profile.uid) || "";
                const peerName = conv.participantNames?.[peerId] || "Peer";
                const peerPhoto = conv.participantPhotos?.[peerId] || "";
                const isUnread = conv.unreadBy.includes(profile.uid);
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => {
                      onSelectConversation(conv.id);
                      onNavigate("messages");
                    }}
                    className="w-full text-left p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center gap-3 transition-colors"
                  >
                    <Avatar src={peerPhoto} name={peerName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {peerName}
                        </span>
                        {isUnread && (
                          <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 shrink-0">
                            Unread
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {conv.lastMessage || "Conversation started"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <MessageSquare className="w-4 h-4 shrink-0" />
              <span>Your peer conversations will appear here once you connect.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
