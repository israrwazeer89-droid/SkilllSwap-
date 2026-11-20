import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  Code2,
  Compass,
  Dumbbell,
  Library,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import type { AssistantMode } from "../types/skillswap";

interface AiLearningAssistantViewProps {
  initialPrompt?: string;
  onClearInitialPrompt?: () => void;
}

interface Turn {
  role: "user" | "model";
  text: string;
  mode?: AssistantMode;
}

const MODES: Array<{
  id: AssistantMode;
  label: string;
  description: string;
  samplePrompt: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "explain",
    label: "Explain Concept",
    description: "Break down complex ideas clearly with concrete analogies.",
    samplePrompt: "Explain recursion and call stacks simply with a real-world analogy.",
    icon: Sparkles,
  },
  {
    id: "roadmap",
    label: "Learning Roadmap",
    description: "Generate a structured week-by-week study curriculum.",
    samplePrompt: "Create a 4-week beginner roadmap to learn UI/UX Design with Figma.",
    icon: Compass,
  },
  {
    id: "exercises",
    label: "Practice Exercises",
    description: "Build progressive drills with hints and verification checks.",
    samplePrompt: "Give me 3 progressive Python dictionary & data-cleaning exercises.",
    icon: Dumbbell,
  },
  {
    id: "coding_help",
    label: "Programming Q&A",
    description: "Debug algorithms, TypeScript types, SQL queries, or architecture.",
    samplePrompt: "How do I avoid race conditions in React useEffect async fetches?",
    icon: Code2,
  },
  {
    id: "resources",
    label: "Study Resources",
    description: "Curated free docs, open textbooks, and hands-on projects.",
    samplePrompt: "Recommend the best free resources to practice spoken English fluency.",
    icon: Library,
  },
  {
    id: "exchange_prep",
    label: "Exchange Prep",
    description: "Plan a 45-minute 1:1 skill swap agenda and icebreakers.",
    samplePrompt:
      "Prepare a 45-minute peer exchange lesson plan where I teach Python and learn Graphic Design.",
    icon: Users,
  },
];

export function AiLearningAssistantView({
  initialPrompt,
  onClearInitialPrompt,
}: AiLearningAssistantViewProps) {
  const { profile } = useAuth();
  const [mode, setMode] = useState<AssistantMode>("explain");
  const [prompt, setPrompt] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialPrompt) {
      setMode("exchange_prep");
      setPrompt(initialPrompt);
      onClearInitialPrompt?.();
    }
  }, [initialPrompt, onClearInitialPrompt]);

  const sendPrompt = async (customText?: string) => {
    const text = (customText ?? prompt).trim();
    if (!text || loading) return;

    setError("");
    const nextTurns: Turn[] = [...turns, { role: "user", text, mode }];
    setTurns(nextTurns);
    if (!customText) setPrompt("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          prompt: text,
          skillContext: {
            teachSkills: profile?.teachSkills ?? [],
            learnSkills: profile?.learnSkills ?? [],
            experienceLevel: profile?.experienceLevel ?? "Intermediate",
          },
          history: nextTurns.slice(-6).map((t) => ({ role: t.role, text: t.text })),
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Assistant request failed.");
      }
      setTurns((prev) => [
        ...prev,
        { role: "model", text: data.reply || "No response generated.", mode },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reach AI Assistant.");
    } finally {
      setLoading(false);
    }
  };

  const activeMode = MODES.find((m) => m.id === mode) || MODES[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            AI Learning Assistant
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Powered by Gemini to explain concepts, build roadmaps, craft exercises, and prepare
            for peer exchanges.
          </p>
        </div>

        {turns.length > 0 && (
          <button
            type="button"
            onClick={() => setTurns([])}
            className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:underline self-start"
          >
            Clear session
          </button>
        )}
      </div>

      {/* Mode Selector */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = m.id === mode;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`p-3 rounded-xl border text-left transition-colors ${
                active
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className={`w-4 h-4 mb-2 ${active ? "text-white" : "text-blue-600 dark:text-blue-400"}`} />
              <p className="text-xs font-semibold whitespace-nowrap truncate">{m.label}</p>
            </button>
          );
        })}
      </div>

      {/* Chat Workspace */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col min-h-[480px]">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>
              <strong className="text-slate-900 dark:text-white">{activeMode.label}:</strong>{" "}
              {activeMode.description}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setPrompt(activeMode.samplePrompt)}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0"
          >
            Use example prompt
          </button>
        </div>

        <div className="flex-1 p-5 space-y-4 overflow-y-auto max-h-[500px]">
          {turns.length === 0 ? (
            <div className="py-10 text-center space-y-3 max-w-lg mx-auto">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Ask anything about what you are learning or teaching
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Try clicking "Use example prompt" above, or enter your own question below.
              </p>
            </div>
          ) : (
            turns.map((turn, idx) => (
              <div
                key={idx}
                className={`flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                    turn.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words font-sans">{turn.text}</div>
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-xl px-4 py-3 bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400 animate-pulse">
                Generating study guidance...
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendPrompt();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={`Ask in ${activeMode.label} mode...`}
              className="flex-1 px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>Ask</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
