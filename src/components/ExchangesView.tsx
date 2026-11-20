import React, { useState } from "react";
import {
  BookOpen,
  Check,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Star,
  UserPlus,
  X,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  getOrCreateConversation,
  submitReview,
  updateExchangeStatus,
} from "../lib/firestoreService";
import { SCHEMA_LIMITS } from "../lib/validation";
import type {
  ExchangeRequest,
  ExchangeStatus,
  Review,
  UserProfile,
  WorkspaceTab,
} from "../types/skillswap";

interface ExchangesViewProps {
  exchanges: ExchangeRequest[];
  peers: UserProfile[];
  reviews: Review[];
  onNavigate: (tab: WorkspaceTab) => void;
  onSelectConversation: (convId: string) => void;
  onPrepExchange: (topic: string) => void;
  onOpenProfile?: (uid: string) => void;
}

export function ExchangesView({
  exchanges,
  peers,
  reviews,
  onNavigate,
  onSelectConversation,
  onPrepExchange,
  onOpenProfile,
}: ExchangesViewProps) {
  const { profile, profileLoading, isVerified, setNeedsOnboarding } = useAuth();
  const [filter, setFilter] = useState<"all" | ExchangeStatus>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  // Review Modal
  const [reviewExchange, setReviewExchange] = useState<ExchangeRequest | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);

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

  const filtered =
    filter === "all" ? exchanges : exchanges.filter((e) => e.status === filter);

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
      }
      setNotice(
        nextStatus === "completed"
          ? "Exchange marked complete! +50 XP earned and leaderboard rank updated."
          : `Exchange status updated to ${nextStatus}.`
      );
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to update exchange.");
    } finally {
      setBusyId(null);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Skill Exchanges
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Accept incoming swap proposals, track active learning sessions, and publish verified reviews.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg self-start">
          {(["all", "pending", "accepted", "completed", "rejected"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors whitespace-nowrap ${
                filter === tab
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {notice && (
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-200 flex items-center justify-between">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")}>
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

            return (
              <div
                key={req.id}
                className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
              >
                <div className="space-y-2 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>{isIncoming ? "Incoming proposal" : "Sent proposal"}</span>
                    <span>·</span>
                    <span className="font-semibold capitalize text-slate-800 dark:text-slate-200">
                      Status: {req.status}
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
                </div>

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
                        onClick={() => handleStatusChange(req, "rejected")}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <X className="w-3.5 h-3.5" />
                        Decline
                      </button>
                    </>
                  )}

                  {req.status === "pending" && !isIncoming && (
                    <button
                      type="button"
                      disabled={busyId === req.id}
                      onClick={() => handleStatusChange(req, "cancelled")}
                      className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Cancel Request
                    </button>
                  )}

                  {req.status === "accepted" && (
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
                              isIncoming ? "teach " + req.requestedSkill : "teach " + req.offeredSkill
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
                        onClick={() => handleStatusChange(req, "completed")}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Complete Swap
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
