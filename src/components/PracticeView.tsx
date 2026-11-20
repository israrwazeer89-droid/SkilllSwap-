import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Dumbbell,
  RotateCcw,
  Trophy,
  UserPlus,
  XCircle,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { submitPracticeAttempt } from "../lib/firestoreService";
import { getUserRank } from "../lib/gamification";
import { getQuizById, PRACTICE_QUIZZES } from "../lib/practiceQuizzes";
import type {
  PracticeAttempt,
  PracticeQuiz,
  UserProfile,
  WorkspaceTab,
} from "../types/skillswap";

interface PracticeViewProps {
  peers: UserProfile[];
  attempts: PracticeAttempt[];
  initialQuizId?: string | null;
  onClearInitialQuiz?: () => void;
  onNavigate: (tab: WorkspaceTab) => void;
}

const QUESTION_SECONDS = 30;

export function PracticeView({
  peers,
  attempts,
  initialQuizId,
  onClearInitialQuiz,
  onNavigate,
}: PracticeViewProps) {
  const { profile, isVerified, setNeedsOnboarding } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // Active quiz state
  const [activeQuiz, setActiveQuiz] = useState<PracticeQuiz | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_SECONDS);
  const [selectedAnswers, setSelectedAnswers] = useState<Array<number | null>>([]);
  const [currentChoice, setCurrentChoice] = useState<number | null>(null);

  // Completed state
  const [finishedScore, setFinishedScore] = useState<number | null>(null);
  const [earnedXp, setEarnedXp] = useState(0);
  const [savingResult, setSavingResult] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (initialQuizId) {
      const found = getQuizById(initialQuizId);
      if (found) {
        startQuiz(found);
      }
      onClearInitialQuiz?.();
    }
  }, [initialQuizId]);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(PRACTICE_QUIZZES.map((q) => q.category)))],
    []
  );

  const visibleQuizzes = useMemo(
    () =>
      selectedCategory === "All"
        ? PRACTICE_QUIZZES
        : PRACTICE_QUIZZES.filter((q) => q.category === selectedCategory),
    [selectedCategory]
  );

  const startQuiz = (quiz: PracticeQuiz) => {
    setActiveQuiz(quiz);
    setQuestionIndex(0);
    setSecondsLeft(QUESTION_SECONDS);
    setSelectedAnswers([]);
    setCurrentChoice(null);
    setFinishedScore(null);
    setEarnedXp(0);
    setSaveError("");
  };

  const finishQuiz = async (quiz: PracticeQuiz, allAnswers: Array<number | null>) => {
    const score = quiz.questions.reduce((acc, q, idx) => {
      return acc + (allAnswers[idx] === q.correctIndex ? 1 : 0);
    }, 0);

    setFinishedScore(score);
    setEarnedXp(score * 10);

    if (!profile || !isVerified) {
      setSaveError(
        profile
          ? "Verify your email to save quiz XP to Firestore."
          : "Create your profile to save quiz XP and leaderboard rank."
      );
      return;
    }

    setSavingResult(true);
    setSaveError("");
    try {
      const res = await submitPracticeAttempt({
        userProfile: profile,
        quiz,
        score,
      });
      setEarnedXp(res.xpEarned);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Could not save practice score to Firestore."
      );
    } finally {
      setSavingResult(false);
    }
  };

  const advanceQuestion = (chosenIdx: number | null) => {
    if (!activeQuiz) return;
    const nextAnswers = [...selectedAnswers, chosenIdx];
    setSelectedAnswers(nextAnswers);
    setCurrentChoice(null);

    if (questionIndex + 1 >= activeQuiz.questions.length) {
      void finishQuiz(activeQuiz, nextAnswers);
    } else {
      setQuestionIndex((prev) => prev + 1);
      setSecondsLeft(QUESTION_SECONDS);
    }
  };

  // Per-question 30-second countdown timer
  useEffect(() => {
    if (!activeQuiz || finishedScore !== null) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          advanceQuestion(currentChoice);
          return QUESTION_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeQuiz?.id, questionIndex, finishedScore, currentChoice]);

  const currentRank = useMemo(() => {
    if (!profile) return null;
    const map = new Map<string, UserProfile>();
    for (const p of peers) map.set(p.uid, p);
    map.set(profile.uid, profile);
    return getUserRank(profile.uid, Array.from(map.values()));
  }, [peers, profile]);

  // Active Quiz View
  if (activeQuiz) {
    if (finishedScore !== null) {
      return (
        <div className="space-y-6 max-w-3xl mx-auto">
          <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  {activeQuiz.category} · Quiz Complete
                </p>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {activeQuiz.title}
                </h1>
              </div>

              <div className="text-left sm:text-right">
                <p className="font-mono text-3xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {finishedScore} / {activeQuiz.questions.length}
                </p>
                <p className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
                  +{earnedXp} XP Earned
                </p>
              </div>
            </div>

            {savingResult && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Updating your XP and leaderboard rank in Firestore...
              </p>
            )}

            {saveError && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between gap-3">
                <span>{saveError}</span>
                {!profile && (
                  <button
                    type="button"
                    onClick={() => setNeedsOnboarding(true)}
                    className="px-3 py-1.5 rounded-md bg-blue-600 text-white font-semibold whitespace-nowrap"
                  >
                    Create Profile
                  </button>
                )}
              </div>
            )}

            {profile && !savingResult && !saveError && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  Total XP: <strong className="font-mono tabular-nums">{profile.xp} XP</strong>
                  {currentRank ? ` · Current Leaderboard Rank: #${currentRank}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate("leaderboard")}
                  className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  View Leaderboard
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => startQuiz(activeQuiz)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Retake Quiz
              </button>
              <button
                type="button"
                onClick={() => setActiveQuiz(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                All Quizzes
              </button>
              <button
                type="button"
                onClick={() => onNavigate("profile")}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                View Practice History
              </button>
            </div>
          </div>

          {/* Answer Review */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Question Review
            </h2>
            {activeQuiz.questions.map((q, idx) => {
              const chosen = selectedAnswers[idx];
              const isCorrect = chosen === q.correctIndex;
              return (
                <div
                  key={idx}
                  className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {idx + 1}. {q.prompt}
                    </p>
                    {isCorrect ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                        +10 XP
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400 shrink-0">
                        <XCircle className="w-4 h-4" />
                        0 XP
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Correct answer: <strong>{q.options[q.correctIndex]}</strong>
                    {chosen !== null && !isCorrect && (
                      <span> · Your choice: {q.options[chosen]}</span>
                    )}
                    {chosen === null && <span> · Timed out</span>}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {q.explanation}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    const q = activeQuiz.questions[questionIndex];
    const progressPct = Math.round(((questionIndex + 1) / activeQuiz.questions.length) * 100);

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                {activeQuiz.title}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
                Question {questionIndex + 1} of {activeQuiz.questions.length}
              </p>
            </div>

            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono text-sm font-bold tabular-nums shrink-0 ${
                secondsLeft <= 8
                  ? "border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30"
                  : "border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>{secondsLeft}s</span>
            </div>
          </div>

          <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white leading-snug">
            {q.prompt}
          </h2>

          <div className="space-y-3">
            {q.options.map((opt, idx) => {
              const selected = currentChoice === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentChoice(idx)}
                  className={`w-full text-left px-4 py-3.5 rounded-xl border text-sm transition-colors flex items-center gap-3 min-h-[48px] ${
                    selected
                      ? "border-blue-600 bg-blue-50/70 dark:bg-blue-950/50 text-slate-900 dark:text-white font-medium"
                      : "border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-md border text-xs font-mono flex items-center justify-center shrink-0 ${
                      selected
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "border-slate-300 dark:border-slate-700 text-slate-500"
                    }`}
                  >
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setActiveQuiz(null)}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              Exit Quiz
            </button>
            <button
              type="button"
              disabled={currentChoice === null}
              onClick={() => advanceQuestion(currentChoice)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-40 transition-colors"
            >
              <span>
                {questionIndex + 1 === activeQuiz.questions.length ? "Finish Quiz" : "Next Question"}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Quiz Selection & Recent History
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Skill Practice Quizzes
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            5 multiple-choice questions per quiz · 30 seconds per question · +10 XP for every correct answer.
          </p>
        </div>

        {!profile && (
          <button
            type="button"
            onClick={() => setNeedsOnboarding(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold self-start sm:self-auto"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Create Profile to Save XP
          </button>
        )}
      </div>

      {!profile && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            You can preview any quiz right now. Create your profile first so your XP and Practice History save to Firestore.
          </span>
        </div>
      )}

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              selectedCategory === cat
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Quiz Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleQuizzes.map((quiz) => {
          const bestAttempt = attempts
            .filter((a) => a.quizId === quiz.id)
            .sort((a, b) => b.score - a.score)[0];

          return (
            <div
              key={quiz.id}
              className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-5"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    {quiz.category}
                  </span>
                  <span className="font-mono tabular-nums">5 Qs · 30s/q · Up to 50 XP</span>
                </div>

                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {quiz.title}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {quiz.description}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                  {bestAttempt
                    ? `Best: ${bestAttempt.score}/5 (+${bestAttempt.xpEarned} XP)`
                    : "Not attempted yet"}
                </span>
                <button
                  type="button"
                  onClick={() => startQuiz(quiz)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  <Dumbbell className="w-3.5 h-3.5" />
                  Start Quiz
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Practice History Summary */}
      <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Your Recent Practice History
          </h2>
          <button
            type="button"
            onClick={() => onNavigate("profile")}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            View on My Profile
          </button>
        </div>

        {attempts.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {attempts.slice(0, 6).map((att) => (
              <div
                key={att.id}
                className="py-3 flex flex-wrap items-center justify-between gap-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {att.quizTitle}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {att.category} ·{" "}
                    {att.createdAt?.toDate
                      ? att.createdAt.toDate().toLocaleDateString()
                      : "Today"}
                  </p>
                </div>
                <div className="font-mono text-xs font-semibold tabular-nums text-right">
                  <span className="text-slate-900 dark:text-white">
                    {att.score}/{att.totalQuestions}
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 ml-3">
                    +{att.xpEarned} XP
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Complete any 5-question quiz above to record your score, earn XP, and build your learning streak.
          </p>
        )}
      </div>
    </div>
  );
}
