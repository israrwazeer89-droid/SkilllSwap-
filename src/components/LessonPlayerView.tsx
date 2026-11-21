import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  Film,
  Loader2,
  Play,
  Star,
  Trash2,
  User,
  Video,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { deleteLessonVideo, submitLessonFeedback } from "../lib/firestoreService";
import { parseLessonVideoUrl } from "../lib/videoHelpers";
import type { ExchangeRequest, LessonItem, WorkspaceTab } from "../types/skillswap";

interface LessonPlayerViewProps {
  lessons: LessonItem[];
  exchanges: ExchangeRequest[];
  selectedLessonId: string | null;
  onSelectLesson: (lessonId: string | null) => void;
  onNavigate: (tab: WorkspaceTab) => void;
}

export function LessonPlayerView({
  lessons,
  exchanges,
  selectedLessonId,
  onSelectLesson,
  onNavigate,
}: LessonPlayerViewProps) {
  const { profile, isVerified } = useAuth();
  const [filterMode, setFilterMode] = useState<"all" | "to_watch" | "shared_by_me">("all");

  const activeLesson = useMemo(
    () => lessons.find((l) => l.id === selectedLessonId) || null,
    [lessons, selectedLessonId]
  );

  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState("");

  useEffect(() => {
    if (activeLesson) {
      setRating(activeLesson.rating || 5);
      setComment(activeLesson.comment || "");
      setFeedbackMsg("");
    }
  }, [activeLesson?.id]);

  if (!profile) {
    return (
      <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          My Lessons
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Create your SkillSwap profile to upload or watch recorded exchange lessons.
        </p>
        <button
          type="button"
          onClick={() => onNavigate("exchanges")}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
        >
          Go to My Exchanges
        </button>
      </div>
    );
  }

  const filteredLessons = lessons.filter((lesson) => {
    if (filterMode === "to_watch") return lesson.studentId === profile.uid;
    if (filterMode === "shared_by_me") return lesson.teacherId === profile.uid;
    return true;
  });

  const handleMarkWatched = async (lesson: LessonItem) => {
    if (!isVerified) {
      setFeedbackMsg("Please verify your email before updating lesson status.");
      return;
    }
    setSaving(true);
    setFeedbackMsg("");
    try {
      await submitLessonFeedback({
        lessonId: lesson.id,
        watched: true,
        rating: lesson.rating,
        comment: lesson.comment,
        studentUid: profile.uid,
        studentName: profile.displayName,
        teacherId: lesson.teacherId,
        lessonTitle: lesson.title,
      });
      setFeedbackMsg("Lesson marked as Watched!");
    } catch (err) {
      setFeedbackMsg(err instanceof Error ? err.message : "Failed to update lesson.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLesson) return;
    if (!isVerified) {
      setFeedbackMsg("Please verify your email before submitting a rating.");
      return;
    }
    setSaving(true);
    setFeedbackMsg("");
    try {
      await submitLessonFeedback({
        lessonId: activeLesson.id,
        watched: true,
        rating: Math.max(1, Math.min(5, rating || 5)),
        comment,
        studentUid: profile.uid,
        studentName: profile.displayName,
        teacherId: activeLesson.teacherId,
        lessonTitle: activeLesson.title,
      });
      setFeedbackMsg("Saved! Lesson marked as Watched and your rating was sent to the teacher.");
    } catch (err) {
      setFeedbackMsg(err instanceof Error ? err.message : "Failed to save feedback.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    setDeleting(true);
    try {
      await deleteLessonVideo(lessonId);
      onSelectLesson(null);
    } catch (err) {
      setFeedbackMsg(err instanceof Error ? err.message : "Failed to delete lesson.");
    } finally {
      setDeleting(false);
    }
  };

  // Video Player Page View when a lesson is selected
  if (activeLesson) {
    const videoInfo = parseLessonVideoUrl(activeLesson.videoUrl, activeLesson.type);
    const isStudent = activeLesson.studentId === profile.uid;
    const isTeacher = activeLesson.teacherId === profile.uid;
    const parentExchange = exchanges.find((ex) => ex.id === activeLesson.exchangeId);

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onSelectLesson(null)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              All Lessons
            </button>
            <button
              type="button"
              onClick={() => onNavigate("exchanges")}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Back to My Exchanges
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                activeLesson.watched
                  ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  : "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
              }`}
            >
              {activeLesson.watched ? "Watched ✓" : "Unwatched"}
            </span>
            {isTeacher && (
              <button
                type="button"
                disabled={deleting}
                onClick={() => handleDeleteLesson(activeLesson.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleting ? "Removing..." : "Delete"}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Video Player Column */}
          <div className="lg:col-span-8 space-y-5">
            <div className="rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-lg">
              {videoInfo.isDirectVideo ? (
                <video
                  controls
                  playsInline
                  preload="metadata"
                  src={activeLesson.videoUrl}
                  poster={activeLesson.thumbnailUrl || undefined}
                  className="w-full aspect-video bg-black"
                />
              ) : videoInfo.embedUrl ? (
                <iframe
                  src={videoInfo.embedUrl}
                  title={activeLesson.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full aspect-video border-0"
                />
              ) : (
                <div className="aspect-video flex flex-col items-center justify-center p-8 text-center space-y-4 bg-slate-900">
                  <Film className="w-12 h-12 text-blue-400" />
                  <div className="space-y-1 max-w-md">
                    <p className="text-base font-semibold text-white">{activeLesson.title}</p>
                    <p className="text-xs text-slate-400">
                      This external link cannot be embedded directly. Open it in a new tab to watch,
                      then mark it watched below.
                    </p>
                  </div>
                  <a
                    href={activeLesson.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Video Link
                  </a>
                </div>
              )}
            </div>

            <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {videoInfo.providerLabel}
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {activeLesson.duration}
                    </span>
                    {parentExchange && (
                      <>
                        <span>·</span>
                        <span>
                          {parentExchange.offeredSkill} ↔ {parentExchange.requestedSkill}
                        </span>
                      </>
                    )}
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                    {activeLesson.title}
                  </h1>
                  <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    Taught by <span className="font-semibold text-slate-800 dark:text-slate-200">{activeLesson.teacherName}</span> · For{" "}
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{activeLesson.studentName}</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {isStudent && !activeLesson.watched && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleMarkWatched(activeLesson)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                    >
                      {saving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      Mark as Watched
                    </button>
                  )}
                  <a
                    href={activeLesson.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Source
                  </a>
                </div>
              </div>

              {feedbackMsg && (
                <p className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-200">
                  {feedbackMsg}
                </p>
              )}

              {/* Student Rating & Comment Form */}
              {isStudent ? (
                <form
                  onSubmit={handleSubmitFeedback}
                  className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4"
                >
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Rate Lesson &amp; Leave Feedback
                  </h2>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                      Star Rating (1–5)
                    </label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          className={`p-2 rounded-lg border transition-colors ${
                            rating >= star
                              ? "border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-500"
                              : "border-slate-200 dark:border-slate-700 text-slate-400"
                          }`}
                        >
                          <Star className={`w-4 h-4 ${rating >= star ? "fill-current" : ""}`} />
                        </button>
                      ))}
                      <span className="ml-2 text-xs font-mono text-slate-600 dark:text-slate-300">
                        {rating || 0}/5
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                      Comment for {activeLesson.teacherName}
                    </label>
                    <textarea
                      rows={3}
                      maxLength={600}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="What did you learn or find most helpful in this lesson?"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    {activeLesson.rating > 0 ? "Update Rating & Mark Watched" : "Save Rating & Mark Watched"}
                  </button>
                </form>
              ) : (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Student Progress &amp; Review
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {activeLesson.rating > 0
                      ? `Rated ${activeLesson.rating}/5 ★${activeLesson.comment ? ` — "${activeLesson.comment}"` : ""}`
                      : activeLesson.watched
                        ? `${activeLesson.studentName} has watched this lesson.`
                        : `Waiting for ${activeLesson.studentName} to watch this lesson.`}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Playlist Column */}
          <div className="lg:col-span-4 p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Exchange Lessons ({lessons.length})
            </h2>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {lessons.map((item) => {
                const isSelected = item.id === activeLesson.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectLesson(item.id)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-colors flex items-start gap-3 ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/70 dark:bg-blue-950/40"
                        : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="w-16 h-11 rounded-md bg-slate-900 overflow-hidden shrink-0 flex items-center justify-center relative">
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Play className="w-4 h-4 text-blue-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-2">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {item.teacherName} · {item.duration}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // My Lessons Library Grid View
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            My Lessons
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Watch recorded skill lessons from your exchanges, track completion, and rate teachers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg self-start">
          {[
            { id: "all" as const, label: `All (${lessons.length})` },
            {
              id: "to_watch" as const,
              label: `For Me (${lessons.filter((l) => l.studentId === profile.uid).length})`,
            },
            {
              id: "shared_by_me" as const,
              label: `Shared by Me (${lessons.filter((l) => l.teacherId === profile.uid).length})`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterMode(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                filterMode === tab.id
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filteredLessons.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredLessons.map((lesson) => {
            const info = parseLessonVideoUrl(lesson.videoUrl, lesson.type);
            const thumb = lesson.thumbnailUrl || info.thumbnailUrl;
            return (
              <div
                key={lesson.id}
                className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <button
                    type="button"
                    onClick={() => onSelectLesson(lesson.id)}
                    className="relative w-full aspect-video bg-slate-950 flex items-center justify-center group overflow-hidden"
                  >
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={lesson.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <Video className="w-9 h-9 text-blue-400" />
                        <span className="text-[11px] font-medium">{info.providerLabel}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-slate-950/35 group-hover:bg-slate-950/20 transition-colors flex items-center justify-center">
                      <span className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg">
                        <Play className="w-5 h-5 ml-0.5 fill-current" />
                      </span>
                    </div>
                    <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-slate-950/85 text-white text-[11px] font-mono">
                      {lesson.duration}
                    </span>
                  </button>

                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {lesson.teacherName}
                      </span>
                      <span
                        className={`font-semibold ${
                          lesson.watched
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {lesson.watched ? "Watched ✓" : "New"}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2">
                      {lesson.title}
                    </h3>
                    {lesson.rating > 0 && (
                      <p className="text-xs text-amber-500 flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span>{lesson.rating}/5</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="px-4 pb-4 pt-1 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectLesson(lesson.id)}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Watch Lesson
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <Video className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            No recorded lessons yet
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            In any accepted or in-progress exchange, teachers can upload MP4 lessons or share YouTube / Loom videos for their partner to watch here.
          </p>
          <button
            type="button"
            onClick={() => onNavigate("exchanges")}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
          >
            Open My Exchanges
          </button>
        </div>
      )}
    </div>
  );
}
