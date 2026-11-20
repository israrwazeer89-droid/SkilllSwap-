import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  MessageSquare,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { calculateProfileCompletion } from "../lib/validation";
import type {
  AiMatch,
  Conversation,
  ExchangeRequest,
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
  onNavigate: (tab: WorkspaceTab) => void;
  onSelectConversation: (convId: string) => void;
}

export function OverviewDashboard({
  peers,
  exchanges,
  conversations,
  matches,
  reviews,
  onNavigate,
  onSelectConversation,
}: OverviewDashboardProps) {
  const { profile } = useAuth();

  if (!profile) return null;

  const completion = calculateProfileCompletion(profile);
  const pendingRequests = exchanges.filter((e) => e.status === "pending");
  const activeExchanges = exchanges.filter((e) => e.status === "accepted");
  const completedExchanges = exchanges.filter((e) => e.status === "completed");
  const unreadMessages = conversations.filter((c) => c.unreadBy.includes(profile.uid)).length;
  const myReviewsReceived = reviews.filter((r) => r.revieweeId === profile.uid);
  const avgRating =
    myReviewsReceived.length > 0
      ? (
          myReviewsReceived.reduce((sum, r) => sum + r.rating, 0) /
          myReviewsReceived.length
        ).toFixed(1)
      : "—";

  const learnedSkills = Array.from(
    new Set(
      completedExchanges.map((e) =>
        e.fromUid === profile.uid ? e.requestedSkill : e.offeredSkill
      )
    )
  );

  const myLearnLower = new Set(profile.learnSkills.map((s) => s.toLowerCase()));
  const myTeachLower = new Set(profile.teachSkills.map((s) => s.toLowerCase()));
  const complementaryPeers = peers
    .filter((p) => p.uid !== profile.uid && !p.isSuspended && p.isPublic)
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
      {/* Welcome & Profile Completion */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-5">
          <div className="space-y-2">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
              Personal Learning Workspace
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Welcome back, {profile.displayName}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
              Track your active skill swaps, review pending peer invitations, or run Gemini AI
              matching to discover new complementary teachers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate("explore")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Find AI Matches
            </button>
            <button
              type="button"
              onClick={() => onNavigate("assistant")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Open AI Study Assistant
            </button>
          </div>
        </div>

        <div className="lg:col-span-4 p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                Profile Completion
              </span>
              <span className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                {completion}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${completion}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {completion < 100
                ? "Add your bio, availability, and both teaching/learning skills for stronger AI match accuracy."
                : "Your profile is complete and visible for high-precision peer matching."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate("profile")}
            className="self-start text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
          >
            <span>{completion < 100 ? "Finish profile setup" : "Manage profile & privacy"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigate("exchanges")}
          className="text-left p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-800 transition-colors"
        >
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Pending Requests
          </p>
          <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
            {pendingRequests.length}
          </p>
        </button>
        <button
          type="button"
          onClick={() => onNavigate("exchanges")}
          className="text-left p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-800 transition-colors"
        >
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Active Exchanges
          </p>
          <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
            {activeExchanges.length}
          </p>
        </button>
        <button
          type="button"
          onClick={() => onNavigate("messages")}
          className="text-left p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-800 transition-colors"
        >
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Unread Conversations
          </p>
          <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
            {unreadMessages}
          </p>
        </button>
        <button
          type="button"
          onClick={() => onNavigate("profile")}
          className="text-left p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-800 transition-colors"
        >
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Completed / Rating
          </p>
          <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
            {completedExchanges.length} · {avgRating}★
          </p>
        </button>
      </div>

      {/* Skills Offered & Wanted + Learning Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Skills Offered
            </h2>
            <button
              type="button"
              onClick={() => onNavigate("profile")}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Edit
            </button>
          </div>
          {profile.teachSkills.length > 0 ? (
            <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
              {profile.teachSkills.map((skill) => (
                <li
                  key={skill}
                  className="py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0"
                >
                  {skill}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No teaching skills added yet.
            </p>
          )}
        </div>

        <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Skills Wanted
            </h2>
            <button
              type="button"
              onClick={() => onNavigate("profile")}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Edit
            </button>
          </div>
          {profile.learnSkills.length > 0 ? (
            <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
              {profile.learnSkills.map((skill) => (
                <li
                  key={skill}
                  className="py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0"
                >
                  {skill}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No learning goals added yet.
            </p>
          )}
        </div>

        <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Learning Progress
            </h2>
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Swaps Completed</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                {completedExchanges.length}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Skills Practiced</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                {learnedSkills.length}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Peer Reviews Received</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                {myReviewsReceived.length}
              </span>
            </div>
          </div>
          {learnedSkills.length > 0 && (
            <p className="text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
              Recently completed: {learnedSkills.slice(0, 3).join(", ")}
            </p>
          )}
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
