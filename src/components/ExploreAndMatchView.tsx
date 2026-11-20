import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  Ban,
  Flag,
  MessageSquare,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  X,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  createExchangeRequest,
  getOrCreateConversation,
  submitReport,
  updatePrivateSettings,
} from "../lib/firestoreService";
import {
  matchesExploreCategory,
  normalizeUserProfile,
  sortLeaderboard,
} from "../lib/gamification";
import { computeAndStoreSkillMatches } from "../lib/matchingService";
import { SCHEMA_LIMITS } from "../lib/validation";
import type {
  AiMatch,
  ExploreCategory,
  ReportReason,
  Review,
  UserProfile,
  WorkspaceTab,
} from "../types/skillswap";
import { Avatar } from "./Avatar";

const EXPLORE_CATEGORIES: ExploreCategory[] = [
  "All",
  "Learners",
  "Programmers",
  "Graphic Designers",
  "Video Editors",
  "English Speakers",
  "Musicians",
  "More",
];

interface ExploreAndMatchViewProps {
  peers: UserProfile[];
  matches: AiMatch[];
  reviews: Review[];
  onNavigate: (tab: WorkspaceTab) => void;
  onSelectConversation: (convId: string) => void;
  onOpenProfile?: (uid: string) => void;
}

export function ExploreAndMatchView({
  peers,
  matches,
  reviews,
  onNavigate,
  onSelectConversation,
  onOpenProfile,
}: ExploreAndMatchViewProps) {
  const { user, profile, privateInfo, isVerified, setNeedsOnboarding } = useAuth();
  const [subTab, setSubTab] = useState<"browse" | "ai">("browse");
  const [activeCategory, setActiveCategory] = useState<ExploreCategory>("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [countryFilter, setCountryFilter] = useState("All");
  const [languageFilter, setLanguageFilter] = useState("All");

  // AI matching state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  // Proposal Modal state
  const [proposalPeer, setProposalPeer] = useState<UserProfile | null>(null);
  const [offeredSkill, setOfferedSkill] = useState("");
  const [requestedSkill, setRequestedSkill] = useState("");
  const [scheduleNote, setScheduleNote] = useState("Flexible 45-min video session");
  const [proposalMessage, setProposalMessage] = useState("");
  const [proposalBusy, setProposalBusy] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState("");

  // Report Modal state
  const [reportPeer, setReportPeer] = useState<UserProfile | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason>("spam");
  const [reportDetails, setReportDetails] = useState("");
  const [reportBusy, setReportBusy] = useState(false);

  const blockedSet = useMemo(
    () => new Set(privateInfo?.blockedUserIds || []),
    [privateInfo]
  );

  const rankMap = useMemo(() => {
    const map = new Map<string, UserProfile>();
    for (const p of peers) map.set(p.uid, normalizeUserProfile(p));
    if (profile) map.set(profile.uid, normalizeUserProfile(profile));
    const sorted = sortLeaderboard(Array.from(map.values()));
    const ranks = new Map<string, number>();
    sorted.forEach((u, idx) => ranks.set(u.uid, idx + 1));
    return ranks;
  }, [peers, profile]);

  const eligiblePeers = useMemo(
    () =>
      peers
        .map((p) => normalizeUserProfile(p))
        .filter(
          (p) =>
            p.uid !== profile?.uid &&
            !p.isSuspended &&
            p.isPublic &&
            !blockedSet.has(p.uid)
        ),
    [peers, profile?.uid, blockedSet]
  );

  const countries = useMemo(
    () => ["All", ...Array.from(new Set(eligiblePeers.map((p) => p.country))).sort()],
    [eligiblePeers]
  );

  const languages = useMemo(
    () => [
      "All",
      ...Array.from(new Set(eligiblePeers.flatMap((p) => p.languages))).sort(),
    ],
    [eligiblePeers]
  );

  const filteredPeers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return eligiblePeers.filter((p) => {
      if (!matchesExploreCategory(p, activeCategory)) return false;
      if (countryFilter !== "All" && p.country !== countryFilter) return false;
      if (languageFilter !== "All" && !p.languages.includes(languageFilter)) return false;
      if (!q) return true;
      return (
        p.displayName.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.bio.toLowerCase().includes(q) ||
        p.teachSkills.some((s) => s.toLowerCase().includes(q)) ||
        p.learnSkills.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [eligiblePeers, activeCategory, countryFilter, languageFilter, searchTerm]);

  const getPeerRating = (uid: string) => {
    const list = reviews.filter((r) => r.revieweeId === uid);
    if (!list.length) return null;
    const avg = list.reduce((sum, r) => sum + r.rating, 0) / list.length;
    return { avg: avg.toFixed(1), count: list.length };
  };

  const openProposal = (peer: UserProfile) => {
    if (!profile) {
      setFeedbackBanner("Create your profile first to send a skill swap proposal.");
      setNeedsOnboarding(true);
      return;
    }
    setProposalPeer(peer);
    setOfferedSkill(profile.teachSkills[0] || "Programming / Mentoring");
    setRequestedSkill(peer.teachSkills[0] || profile.learnSkills[0] || "Skill Coaching");
    setProposalMessage(
      `Hi ${peer.displayName}, I'd love to swap skills with you! I can teach ${
        profile.teachSkills[0] || "my core skill"
      } and would appreciate learning ${peer.teachSkills[0] || "from you"}.`
    );
  };

  const handleSendProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !proposalPeer) return;
    if (!isVerified) {
      setFeedbackBanner("Verify your email address first to send exchange requests.");
      return;
    }
    setProposalBusy(true);
    try {
      await createExchangeRequest({
        fromUser: profile,
        toUser: proposalPeer,
        offeredSkill,
        requestedSkill,
        message: proposalMessage,
        scheduleNote,
      });
      setProposalPeer(null);
      setFeedbackBanner(`Exchange proposal sent to ${proposalPeer.displayName}.`);
    } catch (err) {
      setFeedbackBanner(err instanceof Error ? err.message : "Could not send proposal.");
    } finally {
      setProposalBusy(false);
    }
  };

  const handleStartChat = async (peer: UserProfile) => {
    if (!profile) {
      setFeedbackBanner("Create your profile first to start peer conversations.");
      setNeedsOnboarding(true);
      return;
    }
    if (!isVerified) {
      setFeedbackBanner("Verify your email address first to start peer conversations.");
      return;
    }
    try {
      const convId = await getOrCreateConversation(profile, peer);
      onSelectConversation(convId);
      onNavigate("messages");
    } catch (err) {
      setFeedbackBanner(err instanceof Error ? err.message : "Could not open chat.");
    }
  };

  const handleBlockPeer = async (peer: UserProfile) => {
    if (!profile || !privateInfo) return;
    try {
      await updatePrivateSettings(profile.uid, {
        email: privateInfo.email,
        blockedUserIds: [...privateInfo.blockedUserIds, peer.uid],
        allowMessagesFrom: privateInfo.allowMessagesFrom,
        emailNotifications: privateInfo.emailNotifications,
      });
      setFeedbackBanner(`${peer.displayName} has been blocked.`);
    } catch (err) {
      setFeedbackBanner(err instanceof Error ? err.message : "Could not block user.");
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !reportPeer) return;
    if (reportDetails.trim().length < SCHEMA_LIMITS.reportDetailsMin) {
      setFeedbackBanner("Please describe the issue in at least 5 characters.");
      return;
    }
    setReportBusy(true);
    try {
      await submitReport({
        reporterId: profile.uid,
        reportedUid: reportPeer.uid,
        reason: reportReason,
        details: reportDetails,
      });
      setReportPeer(null);
      setReportDetails("");
      setFeedbackBanner("Report submitted to the Trust & Safety moderation queue.");
    } catch (err) {
      setFeedbackBanner(err instanceof Error ? err.message : "Failed to submit report.");
    } finally {
      setReportBusy(false);
    }
  };

  const handleRunAiMatch = async () => {
    if (!user) return;
    if (!profile) {
      setAiError("Create your profile with teaching and learning skills before running AI matching.");
      setNeedsOnboarding(true);
      return;
    }
    setAiError("");
    setFeedbackBanner("");
    setAiLoading(true);
    try {
      const result = await computeAndStoreSkillMatches({
        uid: profile.uid,
        emailVerified: isVerified,
        blockedUserIds: privateInfo?.blockedUserIds ?? [],
      });

      if (result.matches.length === 0) {
        setAiError(
          `Analyzed ${result.analyzedPeers} peers and ${result.analyzedSkills} skills, but found no strong skill overlaps yet. Add more taught and wanted skills in your profile.`
        );
      } else if (!result.persisted) {
        setAiError(
          "Compatibility scores were computed, but verify your email address to save matches to Firestore."
        );
      } else {
        setFeedbackBanner(
          `Saved ${result.matches.length} Gemini compatibility matches after analyzing ${result.analyzedPeers} peers and ${result.analyzedSkills} catalog skills.`
        );
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Unable to compute AI matches.");
    } finally {
      setAiLoading(false);
    }
  };

  const directMatches = matches.filter((m) => !m.isAlternative);
  const altMatches = matches.filter((m) => m.isAlternative);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Explore People &amp; Communities
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Browse skill communities, view public profiles, and connect for 1:1 skill exchanges.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setSubTab("browse")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              subTab === "browse"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            Browse People ({filteredPeers.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab("ai")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap inline-flex items-center gap-1.5 ${
              subTab === "ai"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            AI Matching
          </button>
        </div>
      </div>

      {feedbackBanner && (
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-200 flex items-center justify-between gap-4">
          <span>{feedbackBanner}</span>
          <button type="button" onClick={() => setFeedbackBanner("")}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {subTab === "browse" ? (
        <>
          {/* Category Tabs */}
          <div
            role="tablist"
            aria-label="Explore People Categories"
            className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto"
          >
            {EXPLORE_CATEGORIES.map((category) => {
              const active = activeCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveCategory(category)}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>

          {/* Filter Toolbar */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by skill (e.g., Python, Photoshop, English), city, or name..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              aria-label="Filter by country"
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            >
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c === "All" ? "All Countries" : c}
                </option>
              ))}
            </select>
            <select
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value)}
              aria-label="Filter by language"
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            >
              {languages.map((l) => (
                <option key={l} value={l}>
                  {l === "All" ? "All Languages" : l}
                </option>
              ))}
            </select>
          </div>

          {filteredPeers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPeers.map((peer) => {
                const rating = getPeerRating(peer.uid);
                const rank = rankMap.get(peer.uid);
                return (
                  <div
                    key={peer.uid}
                    className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                  >
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => onOpenProfile?.(peer.uid)}
                          className="flex items-center gap-3 min-w-0 text-left group"
                        >
                          <Avatar src={peer.photoURL} name={peer.displayName} size="md" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-base font-semibold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {peer.displayName}
                              </h3>
                              {(peer.emailVerified || peer.isVerified) && (
                                <ShieldCheck
                                  className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0"
                                  aria-label="Verified profile"
                                />
                              )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {peer.city ? `${peer.city}, ` : ""}
                              {peer.country} · {peer.experienceLevel}
                            </p>
                          </div>
                        </button>

                        <div className="text-right shrink-0 space-y-0.5">
                          <div className="inline-flex items-center gap-1 font-mono text-xs font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                            <Trophy className="w-3.5 h-3.5" />
                            <span>{rank ? `#${rank}` : "—"}</span>
                            <span className="text-slate-400">·</span>
                            <span>{peer.xp} XP</span>
                          </div>
                          {rating && (
                            <p className="inline-flex items-center justify-end gap-1 text-[11px] font-mono font-semibold text-amber-600 dark:text-amber-400 tabular-nums block">
                              <Star className="w-3 h-3 fill-current" />
                              {rating.avg} ({rating.count})
                            </p>
                          )}
                        </div>
                      </div>

                      <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                        {peer.bio || "Available for peer-to-peer skill exchanges."}
                      </p>

                      <div className="space-y-1.5 text-xs">
                        <p className="text-slate-700 dark:text-slate-300">
                          <span className="font-semibold">Can Teach:</span>{" "}
                          {peer.teachSkills.join(", ") || "Not listed"}
                        </p>
                        <p className="text-slate-700 dark:text-slate-300">
                          <span className="font-semibold">Wants to Learn:</span>{" "}
                          {peer.learnSkills.join(", ") || "Open"}
                        </p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openProposal(peer)}
                          className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                        >
                          Connect
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenProfile?.(peer.uid)}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                        >
                          Profile
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartChat(peer)}
                          title="Send message"
                          className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setReportPeer(peer)}
                          title="Report user"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Flag className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBlockPeer(peer)}
                          title="Block user"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                No people in {activeCategory} match these filters
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Try switching back to All or clearing your search. New profiles appear automatically as members join.
              </p>
              {activeCategory !== "All" && (
                <button
                  type="button"
                  onClick={() => setActiveCategory("All")}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  Show All People
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        /* AI Matching View */
        <div className="space-y-6">
          <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Gemini Compatibility Matching
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Analyzes your teaching skills ({profile?.teachSkills.join(", ") || "none"}) and
                learning goals ({profile?.learnSkills.join(", ") || "none"}) against{" "}
                {eligiblePeers.length} available peers.
              </p>
            </div>
            <button
              type="button"
              disabled={aiLoading}
              onClick={handleRunAiMatch}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              <span>{aiLoading ? "Analyzing Peers..." : "Compute AI Matches"}</span>
            </button>
          </div>

          {aiError && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{aiError}</span>
            </div>
          )}

          {aiLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-44 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse p-6"
                />
              ))}
            </div>
          )}

          {!aiLoading && matches.length === 0 && (
            <div className="p-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                No AI matches saved yet
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Click "Compute AI Matches" to generate ranked partner compatibility scores and
                explanations.
              </p>
            </div>
          )}

          {directMatches.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Recommended Direct Swap Partners
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {directMatches.map((m) => {
                  const peer = peers.find((p) => p.uid === m.partnerId);
                  return (
                    <div
                      key={m.id}
                      className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar src={peer?.photoURL} name={m.partnerName} size="md" />
                          <div className="min-w-0">
                            <h4 className="text-base font-semibold text-slate-900 dark:text-white truncate">
                              {m.partnerName}
                            </h4>
                            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                              {m.primarySwap}
                            </p>
                          </div>
                        </div>
                        <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0">
                          {m.compatibilityScore}% match
                        </span>
                      </div>

                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {m.reason}
                      </p>

                      {peer && (
                        <div className="flex items-center gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => openProposal(peer)}
                            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                          >
                            Propose Exchange
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartChat(peer)}
                            className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
                          >
                            Message
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {altMatches.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Alternative Learning Partners
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {altMatches.map((m) => {
                  const peer = peers.find((p) => p.uid === m.partnerId);
                  return (
                    <div
                      key={m.id}
                      className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-base font-semibold text-slate-900 dark:text-white">
                            {m.partnerName}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Alternative · {m.primarySwap}
                          </p>
                        </div>
                        <span className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                          {m.compatibilityScore}% match
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {m.reason}
                      </p>
                      {peer && (
                        <button
                          type="button"
                          onClick={() => openProposal(peer)}
                          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Propose custom exchange →
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Propose Exchange Modal */}
      {proposalPeer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Propose SkillSwap with {proposalPeer.displayName}
              </h3>
              <button type="button" onClick={() => setProposalPeer(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSendProposal} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Skill You Offer
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={60}
                    value={offeredSkill}
                    onChange={(e) => setOfferedSkill(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Skill You Want to Learn
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={60}
                    value={requestedSkill}
                    onChange={(e) => setRequestedSkill(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Proposed Cadence / Schedule
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={scheduleNote}
                  onChange={(e) => setScheduleNote(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Introduction Message
                </label>
                <textarea
                  rows={3}
                  maxLength={800}
                  value={proposalMessage}
                  onChange={(e) => setProposalMessage(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setProposalPeer(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={proposalBusy}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-60"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{proposalBusy ? "Sending..." : "Send Request"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportPeer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Report {reportPeer.displayName}
              </h3>
              <button type="button" onClick={() => setReportPeer(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSubmitReport} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Reason
                </label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value as ReportReason)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  <option value="spam">Spam or unsolicited promotion</option>
                  <option value="harassment">Harassment or abusive conduct</option>
                  <option value="inappropriate_content">Inappropriate content</option>
                  <option value="fake_profile">Impersonation or fake profile</option>
                  <option value="other">Other safety concern</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Details
                </label>
                <textarea
                  rows={3}
                  required
                  minLength={5}
                  maxLength={1000}
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Provide specific context for our moderation team..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReportPeer(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reportBusy}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
                >
                  {reportBusy ? "Submitting..." : "Submit Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
