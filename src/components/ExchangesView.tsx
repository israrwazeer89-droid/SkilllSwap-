import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  History,
  Link as LinkIcon,
  Loader2,
  MessageSquare,
  Play,
  RotateCcw,
  Star,
  Upload,
  UserPlus,
  Video,
  X,
  XCircle,
} from "lucide-react";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { useAuth } from "../contexts/AuthContext";
import { storage } from "../lib/firebase";
import {
  createLessonVideo,
  getOrCreateConversation,
  markExchangeSessionDone,
  scheduleExchangeCall,
  startExchangeVideoCall,
  submitReview,
  updateExchangeStatus,
} from "../lib/firestoreService";
import { SCHEMA_LIMITS } from "../lib/validation";
import { getJitsiRoomUrl, parseLessonVideoUrl } from "../lib/videoHelpers";
import type {
  ExchangeRequest,
  ExchangeStatus,
  LessonItem,
  LessonType,
  Review,
  UserProfile,
  WorkspaceTab,
} from "../types/skillswap";

interface ExchangesViewProps {
  exchanges: ExchangeRequest[];
  peers: UserProfile[];
  reviews: Review[];
  lessons?: LessonItem[];
  onNavigate: (tab: WorkspaceTab) => void;
  onSelectConversation: (convId: string) => void;
  onPrepExchange: (topic: string) => void;
  onOpenProfile?: (uid: string) => void;
  onWatchLesson?: (lessonId: string) => void;
}

const CANCEL_REASONS = [
  "Mistakenly Accepted",
  "Not Available",
  "Changed Mind",
  "Other",
] as const;

type FilterTab = "all" | "pending" | "accepted" | "in_progress" | "completed" | "cancelled";

function formatStatusLabel(status: ExchangeStatus): string {
  switch (status) {
    case "in_progress":
      return "In Progress";
    case "pending":
      return "Pending";
    case "accepted":
      return "Accepted";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "rejected":
      return "Rejected";
    default:
      return status;
  }
}

function getStatusBadgeClasses(status: ExchangeStatus): string {
  switch (status) {
    case "pending":
      return "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
    case "accepted":
      return "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
    case "in_progress":
      return "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
    case "completed":
      return "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800";
    case "cancelled":
    case "rejected":
      return "bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900";
    default:
      return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";
  }
}

export function ExchangesView({
  exchanges,
  peers,
  reviews,
  lessons = [],
  onNavigate,
  onSelectConversation,
  onPrepExchange,
  onOpenProfile,
  onWatchLesson,
}: ExchangesViewProps) {
  const { profile, profileLoading, isVerified, setNeedsOnboarding } = useAuth();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  // 10-second Undo Accept toast
  const [undoBanner, setUndoBanner] = useState<{
    req: ExchangeRequest;
    secondsLeft: number;
  } | null>(null);

  // Cancel Confirmation Modal
  const [cancelTarget, setCancelTarget] = useState<ExchangeRequest | null>(null);
  const [cancelReason, setCancelReason] = useState<string>("Mistakenly Accepted");
  const [cancelOtherDetail, setCancelOtherDetail] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);

  // Schedule Live Call Modal
  const [scheduleTarget, setScheduleTarget] = useState<ExchangeRequest | null>(null);
  const [callDate, setCallDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [callTime, setCallTime] = useState("18:00");
  const [callTopic, setCallTopic] = useState("");
  const [scheduleBusy, setScheduleBusy] = useState(false);

  // Embedded Jitsi Call Modal (optional in-app view in addition to New Tab)
  const [embeddedCallExchange, setEmbeddedCallExchange] = useState<ExchangeRequest | null>(null);

  // Mark Session Done Modal
  const [sessionDoneTarget, setSessionDoneTarget] = useState<ExchangeRequest | null>(null);
  const [sessionTopic, setSessionTopic] = useState("");
  const [sessionDuration, setSessionDuration] = useState(45);
  const [completeAfterSession, setCompleteAfterSession] = useState(true);
  const [sessionDoneBusy, setSessionDoneBusy] = useState(false);

  // Upload Recorded Video Lesson Modal
  const [lessonTarget, setLessonTarget] = useState<ExchangeRequest | null>(null);
  const [lessonType, setLessonType] = useState<LessonType>("link");
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonDuration, setLessonDuration] = useState("15 min");
  const [lessonLinkUrl, setLessonLinkUrl] = useState("");
  const [lessonFile, setLessonFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [lessonBusy, setLessonBusy] = useState(false);

  // Review Modal
  const [reviewExchange, setReviewExchange] = useState<ExchangeRequest | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);

  // Countdown timer for Undo Accept toast (10 seconds)
  useEffect(() => {
    if (!undoBanner) return;
    if (undoBanner.secondsLeft <= 0) {
      setUndoBanner(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setUndoBanner((prev) =>
        prev ? { ...prev, secondsLeft: prev.secondsLeft - 1 } : null
      );
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [undoBanner]);

  if (profileLoading) {
    return (
      <div className="p-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-blue-600 dark:text-blue-400" />
        <p className="text-sm text-slate-600 dark:text-slate-300">Loading exchanges...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Create your profile to start exchanges
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Set up your teaching and learning skills before sending or accepting skill swaps.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setNeedsOnboarding(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shrink-0 self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          Create Profile
        </button>
      </div>
    );
  }

  const filterTabs: Array<{ id: FilterTab; label: string; count: number }> = [
    { id: "all", label: "All", count: exchanges.length },
    { id: "pending", label: "Pending", count: exchanges.filter((e) => e.status === "pending").length },
    { id: "accepted", label: "Accepted", count: exchanges.filter((e) => e.status === "accepted").length },
    {
      id: "in_progress",
      label: "In Progress",
      count: exchanges.filter((e) => e.status === "in_progress").length,
    },
    {
      id: "completed",
      label: "Completed",
      count: exchanges.filter((e) => e.status === "completed").length,
    },
    {
      id: "cancelled",
      label: "Cancelled",
      count: exchanges.filter((e) => e.status === "cancelled" || e.status === "rejected").length,
    },
  ];

  const filtered = exchanges.filter((e) => {
    if (filter === "all") return true;
    if (filter === "cancelled") return e.status === "cancelled" || e.status === "rejected";
    return e.status === filter;
  });

  const handleStatusChange = async (req: ExchangeRequest, nextStatus: ExchangeStatus) => {
    if (!isVerified) {
      setNotice("Please verify your email address before updating exchanges.");
      return;
    }
    setBusyId(req.id);
    setNotice("");
    try {
      await updateExchangeStatus(
        req,
        nextStatus,
        profile.uid,
        profile.displayName,
        profile
      );
      if (nextStatus === "accepted") {
        const peerUid = req.fromUid === profile.uid ? req.toUid : req.fromUid;
        const peer = peers.find((p) => p.uid === peerUid);
        if (peer) {
          await getOrCreateConversation(profile, peer, req.id);
        }
        setUndoBanner({ req, secondsLeft: 10 });
      }
      setNotice(
        nextStatus === "completed"
          ? "Exchange marked complete! +50 XP earned and leaderboard rank updated."
          : nextStatus === "accepted"
            ? "Exchange accepted! You can start a live call, upload lessons, or undo within 10 seconds."
            : `Exchange status updated to ${formatStatusLabel(nextStatus)}.`
      );
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to update exchange.");
    } finally {
      setBusyId(null);
    }
  };

  const handleUndoAccept = async () => {
    if (!undoBanner) return;
    const targetReq = undoBanner.req;
    setBusyId(targetReq.id);
    try {
      await updateExchangeStatus(
        targetReq,
        "pending",
        profile.uid,
        profile.displayName,
        profile
      );
      setUndoBanner(null);
      setNotice("Accept undone — exchange moved back to Pending.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Unable to undo accept.");
    } finally {
      setBusyId(null);
    }
  };

  const openCancelModal = (req: ExchangeRequest) => {
    setCancelTarget(req);
    setCancelReason(req.status === "pending" ? "Not Available" : "Mistakenly Accepted");
    setCancelOtherDetail("");
  };

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTarget) return;
    if (!isVerified) {
      setNotice("Please verify your email address before updating exchanges.");
      return;
    }
    const finalReason =
      cancelReason === "Other" && cancelOtherDetail.trim()
        ? `Other: ${cancelOtherDetail.trim()}`
        : cancelReason;

    setCancelBusy(true);
    try {
      await updateExchangeStatus(
        cancelTarget,
        "cancelled",
        profile.uid,
        profile.displayName,
        profile,
        { cancelReason: finalReason }
      );
      if (undoBanner?.req.id === cancelTarget.id) {
        setUndoBanner(null);
      }
      setCancelTarget(null);
      setNotice("Exchange cancelled and partner notified. No XP was awarded.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to cancel exchange.");
    } finally {
      setCancelBusy(false);
    }
  };

  const handleOpenChat = async (req: ExchangeRequest) => {
    const peerUid = req.fromUid === profile.uid ? req.toUid : req.fromUid;
    const peer = peers.find((p) => p.uid === peerUid) || {
      ...profile,
      uid: peerUid,
      displayName: req.fromUid === profile.uid ? req.toName : req.fromName,
      photoURL: "",
    };
    const convId = await getOrCreateConversation(profile, peer, req.id);
    onSelectConversation(convId);
    onNavigate("messages");
  };

  const openScheduleModal = (req: ExchangeRequest) => {
    setScheduleTarget(req);
    setCallDate(req.scheduledCallDate || new Date().toISOString().slice(0, 10));
    setCallTime(req.scheduledCallTime || "18:00");
    setCallTopic(req.scheduledCallTopic || `${req.offeredSkill} ↔ ${req.requestedSkill}`);
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleTarget) return;
    setScheduleBusy(true);
    try {
      await scheduleExchangeCall(scheduleTarget, {
        date: callDate,
        time: callTime,
        topic: callTopic,
        actorUid: profile.uid,
        actorName: profile.displayName,
      });
      setScheduleTarget(null);
      setNotice(`Live video call scheduled for ${callDate} at ${callTime}.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to schedule call.");
    } finally {
      setScheduleBusy(false);
    }
  };

  const handleStartLiveCall = async (req: ExchangeRequest) => {
    try {
      await startExchangeVideoCall(req);
    } catch {
      // Non-blocking transition to in_progress
    }
  };

  const openSessionDoneModal = (req: ExchangeRequest) => {
    setSessionDoneTarget(req);
    setSessionTopic(req.scheduledCallTopic || `${req.offeredSkill} ↔ ${req.requestedSkill}`);
    setSessionDuration(45);
    setCompleteAfterSession(true);
  };

  const handleSessionDoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionDoneTarget) return;
    setSessionDoneBusy(true);
    try {
      await markExchangeSessionDone(sessionDoneTarget, {
        topic: sessionTopic,
        durationMinutes: sessionDuration,
        completeExchange: completeAfterSession,
        actorUid: profile.uid,
        actorName: profile.displayName,
        actorProfile: profile,
      });
      setSessionDoneTarget(null);
      setNotice(
        completeAfterSession
          ? "Session logged & exchange completed! +50 XP awarded to both partners."
          : "Call session saved to Call History."
      );
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to save session.");
    } finally {
      setSessionDoneBusy(false);
    }
  };

  const openLessonModal = (req: ExchangeRequest) => {
    const isIncoming = req.toUid === profile.uid;
    const skillTeaching = isIncoming ? req.requestedSkill : req.offeredSkill;
    setLessonTarget(req);
    setLessonType("link");
    setLessonTitle(`${skillTeaching} Lesson`);
    setLessonDuration("15 min");
    setLessonLinkUrl("");
    setLessonFile(null);
    setUploadProgress(null);
  };

  const handleLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonTarget) return;
    if (!isVerified) {
      setNotice("Please verify your email before uploading lesson videos.");
      return;
    }

    const isIncoming = lessonTarget.toUid === profile.uid;
    const studentId = isIncoming ? lessonTarget.fromUid : lessonTarget.toUid;
    const studentName = isIncoming ? lessonTarget.fromName : lessonTarget.toName;

    setLessonBusy(true);
    try {
      let finalUrl = lessonLinkUrl.trim();
      let thumbnailUrl = "";

      if (lessonType === "upload") {
        if (!lessonFile) {
          throw new Error("Please select an MP4 or WebM video file to upload.");
        }
        if (lessonFile.size > 100 * 1024 * 1024) {
          throw new Error("Video file must be 100 MB or smaller.");
        }
        const safeName = lessonFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storageRef = ref(
          storage,
          `lessons/${lessonTarget.id}/${Date.now()}_${safeName}`
        );

        finalUrl = await new Promise<string>((resolve, reject) => {
          const uploadTask = uploadBytesResumable(storageRef, lessonFile);
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const pct = Math.round(
                (snapshot.bytesTransferred / Math.max(1, snapshot.totalBytes)) * 100
              );
              setUploadProgress(pct);
            },
            (err) => reject(err),
            async () => {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(url);
            }
          );
        });
      } else {
        if (!finalUrl) {
          throw new Error("Please paste a YouTube, Loom, or direct video URL.");
        }
        const parsed = parseLessonVideoUrl(finalUrl, "link");
        thumbnailUrl = parsed.thumbnailUrl;
      }

      await createLessonVideo({
        exchangeId: lessonTarget.id,
        teacherId: profile.uid,
        teacherName: profile.displayName,
        studentId,
        studentName,
        title: lessonTitle,
        videoUrl: finalUrl,
        thumbnailUrl,
        duration: lessonDuration,
        type: lessonType,
      });

      setLessonTarget(null);
      setUploadProgress(null);
      setNotice(`Lesson "${lessonTitle}" uploaded and shared with ${studentName}!`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to save lesson video.");
    } finally {
      setLessonBusy(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewExchange) return;
    if (comment.trim().length < SCHEMA_LIMITS.reviewCommentMin) {
      setNotice("Review comment must be at least 3 characters.");
      return;
    }
    const isSender = reviewExchange.fromUid === profile.uid;
    const revieweeId = isSender ? reviewExchange.toUid : reviewExchange.fromUid;
    const skillLearned = isSender
      ? reviewExchange.requestedSkill
      : reviewExchange.offeredSkill;

    setReviewBusy(true);
    try {
      await submitReview({
        exchangeId: reviewExchange.id,
        reviewer: profile,
        revieweeId,
        rating,
        comment,
        skillLearned,
      });
      setReviewExchange(null);
      setComment("");
      setRating(5);
      setNotice("Your peer review has been published.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to publish review.");
    } finally {
      setReviewBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 10-Second Undo Accept Toast */}
      {undoBanner && (
        <div
          role="status"
          className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 flex flex-wrap items-center justify-between gap-3 shadow-md"
        >
          <div className="flex items-center gap-2.5 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              Accepted! Undo? ({undoBanner.secondsLeft}s)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busyId === undoBanner.req.id}
              onClick={handleUndoAccept}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:opacity-90"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Undo
            </button>
            <button
              type="button"
              onClick={() => setUndoBanner(null)}
              aria-label="Dismiss undo prompt"
              className="p-1 text-emerald-700 dark:text-emerald-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              My Exchanges
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Manage requests, teach via live Jitsi video calls or recorded lessons, and track progress.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate("lessons")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 self-start sm:self-auto"
          >
            <Video className="w-4 h-4 text-blue-500" />
            My Lessons ({lessons.length})
          </button>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg self-start">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                filter === tab.id
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <span>{tab.label}</span>
              <span className="font-mono text-[11px] opacity-75 tabular-nums">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {notice && (
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-200 flex items-center justify-between gap-2">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")} className="shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {filtered.length > 0 ? (
        <div className="space-y-4">
          {filtered.map((req) => {
            const isIncoming = req.toUid === profile.uid;
            const peerUid = isIncoming ? req.fromUid : req.toUid;
            const peerName = isIncoming ? req.fromName : req.toName;
            const alreadyReviewed = reviews.some(
              (r) => r.exchangeId === req.id && r.reviewerId === profile.uid
            );
            const isActiveTeach = req.status === "accepted" || req.status === "in_progress";
            const exchangeLessons = lessons.filter((l) => l.exchangeId === req.id);
            const jitsiUrl = getJitsiRoomUrl(req.id);
            const callHistory = Array.isArray(req.callHistory) ? req.callHistory : [];

            return (
              <div
                key={req.id}
                className="p-5 sm:p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5"
              >
                {/* Header + Primary Actions */}
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="space-y-2 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>{isIncoming ? "Incoming proposal" : "Sent proposal"}</span>
                      <span>·</span>
                      <span
                        className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${getStatusBadgeClasses(
                          req.status
                        )}`}
                      >
                        {formatStatusLabel(req.status)}
                      </span>
                      {req.scheduleNote && (
                        <>
                          <span>·</span>
                          <span>{req.scheduleNote}</span>
                        </>
                      )}
                    </div>

                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      Swap with{" "}
                      {onOpenProfile ? (
                        <button
                          type="button"
                          onClick={() => onOpenProfile(peerUid)}
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {peerName}
                        </button>
                      ) : (
                        peerName
                      )}
                      : {req.offeredSkill} ↔ {req.requestedSkill}
                    </h3>

                    {req.message && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                        {req.message}
                      </p>
                    )}

                    {/* Cancelled Reason Banner */}
                    {req.status === "cancelled" && (
                      <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-xs text-red-800 dark:text-red-200 space-y-0.5">
                        <p className="font-semibold">
                          Cancelled by {req.cancelledByName || "participant"} · No XP awarded
                        </p>
                        {req.cancelReason && <p>Reason: {req.cancelReason}</p>}
                      </div>
                    )}
                  </div>

                  {/* Primary Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {req.status === "pending" && isIncoming && (
                      <>
                        <button
                          type="button"
                          disabled={busyId === req.id}
                          onClick={() => handleStatusChange(req, "accepted")}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Accept
                        </button>
                        <button
                          type="button"
                          disabled={busyId === req.id}
                          onClick={() => openCancelModal(req)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-red-300 dark:border-red-800 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject / Cancel
                        </button>
                      </>
                    )}

                    {req.status === "pending" && !isIncoming && (
                      <button
                        type="button"
                        disabled={busyId === req.id}
                        onClick={() => openCancelModal(req)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-red-300 dark:border-red-800 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Cancel Request
                      </button>
                    )}

                    {isActiveTeach && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenChat(req)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          Chat
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onPrepExchange(
                              `Help me prepare a 45-minute SkillSwap session where I ${
                                isIncoming
                                  ? "teach " + req.requestedSkill
                                  : "teach " + req.offeredSkill
                              } and learn ${
                                isIncoming ? req.offeredSkill : req.requestedSkill
                              }.`
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-blue-200 dark:border-blue-800 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          AI Prep
                        </button>
                        <button
                          type="button"
                          disabled={busyId === req.id}
                          onClick={() => openCancelModal(req)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-red-300 dark:border-red-800 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Cancel / Reject
                        </button>
                      </>
                    )}

                    {req.status === "completed" && !alreadyReviewed && (
                      <button
                        type="button"
                        onClick={() => setReviewExchange(req)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
                      >
                        <Star className="w-3.5 h-3.5" />
                        Leave Review
                      </button>
                    )}

                    {req.status === "completed" && alreadyReviewed && (
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        Reviewed ✓
                      </span>
                    )}
                  </div>
                </div>

                {/* Live Video Call + Recorded Lessons Workspace inside Accepted / In Progress Exchanges */}
                {isActiveTeach && (
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* A) Live Video Call Panel */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                          <Video className="w-4 h-4 text-blue-500" />
                          Live Video Call (Jitsi Meet)
                        </h4>
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          Room: SkillSwap-{req.id.slice(0, 6)}
                        </span>
                      </div>

                      {req.scheduledCallDate && req.scheduledCallTime ? (
                        <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-200 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5">
                            <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              Call Scheduled:{" "}
                              <strong>
                                {req.scheduledCallDate} at {req.scheduledCallTime}
                              </strong>
                              {req.scheduledCallTopic ? ` · ${req.scheduledCallTopic}` : ""}
                            </span>
                          </span>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          No call scheduled yet. Start an instant Jitsi room or schedule a date &amp; time.
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={jitsiUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => handleStartLiveCall(req)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                        >
                          <Video className="w-3.5 h-3.5" />
                          Start Video Call
                          <ExternalLink className="w-3 h-3" />
                        </a>

                        <button
                          type="button"
                          onClick={() => {
                            void handleStartLiveCall(req);
                            setEmbeddedCallExchange(req);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          Embed Here
                        </button>

                        <button
                          type="button"
                          onClick={() => openScheduleModal(req)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <CalendarClock className="w-3.5 h-3.5" />
                          {req.scheduledCallDate ? "Reschedule" : "Schedule Call"}
                        </button>

                        <button
                          type="button"
                          onClick={() => openSessionDoneModal(req)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Mark Session Done (+50 XP)
                        </button>
                      </div>

                      {callHistory.length > 0 && (
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <History className="w-3 h-3" />
                            Call History ({callHistory.length})
                          </p>
                          <div className="space-y-1">
                            {callHistory.slice(0, 3).map((ch) => (
                              <div
                                key={ch.id}
                                className="flex items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-800"
                              >
                                <span className="truncate font-medium">{ch.topic}</span>
                                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                                  {ch.date} · {ch.durationMinutes}m
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* B) Recorded Video Lessons Panel */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                          <Play className="w-4 h-4 text-violet-500" />
                          Recorded Lessons ({exchangeLessons.length})
                        </h4>

                        <button
                          type="button"
                          onClick={() => openLessonModal(req)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Upload Lesson Video
                        </button>
                      </div>

                      {exchangeLessons.length > 0 ? (
                        <div className="space-y-2">
                          {exchangeLessons.map((lesson) => {
                            const info = parseLessonVideoUrl(lesson.videoUrl, lesson.type);
                            const thumb = lesson.thumbnailUrl || info.thumbnailUrl;
                            return (
                              <div
                                key={lesson.id}
                                className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-16 h-10 rounded-md bg-slate-950 overflow-hidden shrink-0 flex items-center justify-center">
                                    {thumb ? (
                                      <img
                                        src={thumb}
                                        alt={lesson.title}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <Play className="w-4 h-4 text-blue-400" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                      {lesson.title}
                                    </p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                      {lesson.teacherName} · {lesson.duration}{" "}
                                      {lesson.watched ? "· Watched ✓" : "· Unwatched"}
                                      {lesson.rating > 0 ? ` · ${lesson.rating}★` : ""}
                                    </p>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    onWatchLesson
                                      ? onWatchLesson(lesson.id)
                                      : onNavigate("lessons")
                                  }
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shrink-0"
                                >
                                  <Play className="w-3 h-3" />
                                  Watch
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          Upload an MP4 recording or paste a YouTube / Loom link so your partner can watch lessons anytime and rate them.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Call History + Lessons summary on Completed Exchanges */}
                {req.status === "completed" &&
                  (callHistory.length > 0 || exchangeLessons.length > 0) && (
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
                      {callHistory.length > 0 && (
                        <span className="flex items-center gap-1.5">
                          <History className="w-3.5 h-3.5 text-emerald-500" />
                          Last session: {callHistory[0].topic} ({callHistory[0].date} ·{" "}
                          {callHistory[0].durationMinutes} min)
                        </span>
                      )}
                      {exchangeLessons.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            onWatchLesson
                              ? onWatchLesson(exchangeLessons[0].id)
                              : onNavigate("lessons")
                          }
                          className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                        >
                          View {exchangeLessons.length} recorded{" "}
                          {exchangeLessons.length === 1 ? "lesson" : "lessons"} →
                        </button>
                      )}
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            No exchanges in this view
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Explore peers or run AI matching to send your next skill exchange request.
          </p>
          <button
            type="button"
            onClick={() => onNavigate("explore")}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold"
          >
            Browse Peers
          </button>
        </div>
      )}

      {/* Cancel Confirmation Modal with Reason Box */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Cancel Exchange?
                </h3>
              </div>
              <button type="button" onClick={() => setCancelTarget(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure? This will cancel this exchange and notify the other person. Cancelled
              exchanges do not give XP and free both users for other requests.
            </p>

            <form onSubmit={handleConfirmCancel} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Reason for cancelling
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {CANCEL_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setCancelReason(reason)}
                      className={`px-3 py-2 rounded-lg border text-xs font-medium text-left transition-colors ${
                        cancelReason === reason
                          ? "border-red-500 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                          : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              {cancelReason === "Other" && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Details (optional)
                  </label>
                  <input
                    type="text"
                    maxLength={180}
                    value={cancelOtherDetail}
                    onChange={(e) => setCancelOtherDetail(e.target.value)}
                    placeholder="Briefly explain why you are cancelling..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCancelTarget(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  Keep Exchange
                </button>
                <button
                  type="submit"
                  disabled={cancelBusy}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
                >
                  {cancelBusy ? "Cancelling..." : "Yes, Cancel Exchange"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Call Modal */}
      {scheduleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Schedule Live Video Call
              </h3>
              <button type="button" onClick={() => setScheduleTarget(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={callDate}
                    onChange={(e) => setCallDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    required
                    value={callTime}
                    onChange={(e) => setCallTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Session Topic
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={callTopic}
                  onChange={(e) => setCallTopic(e.target.value)}
                  placeholder="e.g., Python Functions & Practice Exercises"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setScheduleTarget(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={scheduleBusy}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  {scheduleBusy ? "Saving..." : "Save Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Embedded Jitsi Video Call Modal */}
      {embeddedCallExchange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 sm:p-6">
          <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-white">
                  Live SkillSwap Call: {embeddedCallExchange.offeredSkill} ↔{" "}
                  {embeddedCallExchange.requestedSkill}
                </p>
                <p className="text-[11px] text-slate-400">
                  Powered by Jitsi Meet · {getJitsiRoomUrl(embeddedCallExchange.id)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={getJitsiRoomUrl(embeddedCallExchange.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open Full Tab
                </a>
                <button
                  type="button"
                  onClick={() => {
                    const target = embeddedCallExchange;
                    setEmbeddedCallExchange(null);
                    openSessionDoneModal(target);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark Session Done
                </button>
                <button
                  type="button"
                  onClick={() => setEmbeddedCallExchange(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <iframe
              src={getJitsiRoomUrl(embeddedCallExchange.id)}
              title="SkillSwap Live Video Call"
              allow="camera; microphone; fullscreen; display-capture; autoplay"
              className="w-full h-[70vh] border-0 bg-black"
            />
          </div>
        </div>
      )}

      {/* Mark Session Done Modal (+50 XP + Call History) */}
      {sessionDoneTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Mark Session Done
              </h3>
              <button type="button" onClick={() => setSessionDoneTarget(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSessionDoneSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Topic Covered
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={sessionTopic}
                  onChange={(e) => setSessionTopic(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Call Duration (minutes)
                </label>
                <input
                  type="number"
                  min={5}
                  max={300}
                  required
                  value={sessionDuration}
                  onChange={(e) => setSessionDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <label className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={completeAfterSession}
                  onChange={(e) => setCompleteAfterSession(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Complete this exchange now and give <strong>+50 XP</strong> to both teacher and student
                </span>
              </label>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSessionDoneTarget(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sessionDoneBusy}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                >
                  {sessionDoneBusy
                    ? "Saving..."
                    : completeAfterSession
                      ? "Mark Done (+50 XP)"
                      : "Save Call Log"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Lesson Video Modal (MP4 Upload or YouTube/Loom Link) */}
      {lessonTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Upload Lesson Video
              </h3>
              <button type="button" onClick={() => setLessonTarget(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setLessonType("link")}
                className={`py-2 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 ${
                  lessonType === "link"
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                <LinkIcon className="w-3.5 h-3.5" />
                YouTube / Loom Link
              </button>
              <button
                type="button"
                onClick={() => setLessonType("upload")}
                className={`py-2 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 ${
                  lessonType === "upload"
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                Upload MP4 File
              </button>
            </div>

            <form onSubmit={handleLessonSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Lesson Title
                </label>
                <input
                  type="text"
                  required
                  maxLength={140}
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  placeholder="e.g., Lesson 1: Python Loops & Dictionaries"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Duration
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    maxLength={30}
                    value={lessonDuration}
                    onChange={(e) => setLessonDuration(e.target.value)}
                    placeholder="e.g., 15 min or 12:30"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {lessonType === "link" ? (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    YouTube / Loom / Vimeo Video URL
                  </label>
                  <input
                    type="url"
                    required
                    maxLength={2000}
                    value={lessonLinkUrl}
                    onChange={(e) => setLessonLinkUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... or https://www.loom.com/share/..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Select Video File (MP4 / WebM, max 100 MB)
                  </label>
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    onChange={(e) => setLessonFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:text-xs file:font-semibold hover:file:bg-blue-700"
                  />
                  {uploadProgress !== null && (
                    <div className="space-y-1">
                      <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-blue-600 transition-all"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        Uploading to Firebase Storage: {uploadProgress}%
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setLessonTarget(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={lessonBusy}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold"
                >
                  {lessonBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {lessonBusy ? "Saving..." : "Share Lesson Video"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leave Review Modal */}
      {reviewExchange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Rate Your SkillSwap
              </h3>
              <button type="button" onClick={() => setReviewExchange(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Rating
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className={`p-2 rounded-lg border ${
                        rating >= star
                          ? "border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-600"
                          : "border-slate-200 dark:border-slate-700 text-slate-400"
                      }`}
                    >
                      <Star className={`w-4 h-4 ${rating >= star ? "fill-current" : ""}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Feedback
                </label>
                <textarea
                  rows={3}
                  required
                  minLength={3}
                  maxLength={800}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="How was the teaching clarity, reliability, and session flow?"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReviewExchange(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reviewBusy}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  {reviewBusy ? "Publishing..." : "Publish Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
