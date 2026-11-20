import { Award, Medal, Trophy, UserPlus } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { getLevelInfo, getUserRank, sortLeaderboard } from "../lib/gamification";
import type { UserProfile, WorkspaceTab } from "../types/skillswap";
import { Avatar } from "./Avatar";

interface LeaderboardViewProps {
  peers: UserProfile[];
  onOpenProfile: (uid: string) => void;
  onNavigate: (tab: WorkspaceTab) => void;
}

export function LeaderboardView({
  peers,
  onOpenProfile,
  onNavigate,
}: LeaderboardViewProps) {
  const { user, profile, setNeedsOnboarding } = useAuth();

  const allProfiles = (() => {
    const map = new Map<string, UserProfile>();
    for (const p of peers) map.set(p.uid, p);
    if (profile) map.set(profile.uid, profile);
    return Array.from(map.values());
  })();

  const ranked = sortLeaderboard(allProfiles);
  const myRank = profile ? getUserRank(profile.uid, allProfiles) : null;
  const myXp = profile?.xp || 0;
  const myLevel = getLevelInfo(myXp);
  const topThree = ranked.slice(0, 3);

  const podiumStyles = [
    {
      label: "1st · Gold",
      border: "border-amber-400/70 dark:border-amber-500/50",
      accent: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "2nd · Silver",
      border: "border-slate-300 dark:border-slate-600",
      accent: "text-slate-600 dark:text-slate-300",
    },
    {
      label: "3rd · Bronze",
      border: "border-orange-400/60 dark:border-orange-500/40",
      accent: "text-orange-600 dark:text-orange-400",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Leaderboard &amp; Top Learners
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Earn +50 XP for completed skill swaps and +10 XP per correct practice quiz answer to climb the ranks.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate("practice")}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors self-start sm:self-auto whitespace-nowrap"
        >
          Earn XP in Practice
        </button>
      </div>

      {/* My Rank Banner */}
      {profile ? (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0">
            <Avatar src={profile.photoURL} name={profile.displayName} size="lg" />
            <div className="space-y-1 min-w-0">
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                My Rank · Level {myLevel.level}
              </p>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                {myRank
                  ? `You are Rank #${myRank} with ${myXp} XP`
                  : `You have ${myXp} XP (Profile hidden from public directory)`}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {myLevel.xpToNextLevel} XP to Level {myLevel.level + 1} · {profile.streakDays} day streak ·{" "}
                {profile.badges.length} badges earned
              </p>
            </div>
          </div>

          <div className="w-full lg:w-72 space-y-2">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-slate-500 dark:text-slate-400">
                Level {myLevel.level} Progress
              </span>
              <span className="font-mono text-slate-900 dark:text-white tabular-nums">
                {myLevel.xpInLevel} / {myLevel.xpPerLevel} XP
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${myLevel.progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Join the SkillSwap Leaderboard
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Create your profile to start earning XP from skill exchanges and practice quizzes.
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
      )}

      {/* Top 3 Gold, Silver, Bronze Podium */}
      {topThree.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {topThree.map((learner, idx) => {
            const style = podiumStyles[idx];
            const lvl = getLevelInfo(learner.xp || 0);
            const isMe = learner.uid === user?.uid;
            return (
              <button
                key={learner.uid}
                type="button"
                onClick={() => onOpenProfile(learner.uid)}
                className={`text-left p-6 rounded-xl bg-white dark:bg-slate-900 border ${style.border} hover:border-blue-500 transition-colors space-y-4`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${style.accent}`}>
                    {idx === 0 ? (
                      <Trophy className="w-4 h-4" />
                    ) : (
                      <Medal className="w-4 h-4" />
                    )}
                    {style.label}
                  </span>
                  <span className="font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                    {learner.xp || 0} XP
                  </span>
                </div>

                <div className="flex items-center gap-3 min-w-0">
                  <Avatar src={learner.photoURL} name={learner.displayName} size="md" />
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-slate-900 dark:text-white truncate">
                      {learner.displayName} {isMe ? "(You)" : ""}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      Level {lvl.level} · {learner.city ? `${learner.city}, ` : ""}
                      {learner.country}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>{learner.completedExchanges || 0} swaps</span>
                  <span>{(learner.badges || []).length} badges</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Full Rankings Table */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            All Ranked Members ({ranked.length})
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Click any learner to open their profile
          </span>
        </div>

        {ranked.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-6">Rank</th>
                  <th className="py-3 px-4">Learner</th>
                  <th className="py-3 px-4">Level</th>
                  <th className="py-3 px-4">Badges</th>
                  <th className="py-3 px-6 text-right">XP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {ranked.map((learner, index) => {
                  const rank = index + 1;
                  const lvl = getLevelInfo(learner.xp || 0);
                  const isMe = learner.uid === user?.uid;
                  const rankColor =
                    rank === 1
                      ? "text-amber-500 font-bold"
                      : rank === 2
                        ? "text-slate-400 font-bold"
                        : rank === 3
                          ? "text-orange-500 font-bold"
                          : "text-slate-500 dark:text-slate-400 font-medium";

                  return (
                    <tr
                      key={learner.uid}
                      onClick={() => onOpenProfile(learner.uid)}
                      className={`cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                        isMe ? "bg-blue-50/50 dark:bg-blue-950/25" : ""
                      }`}
                    >
                      <td className={`py-3.5 px-6 font-mono tabular-nums ${rankColor}`}>
                        #{rank}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar src={learner.photoURL} name={learner.displayName} size="sm" />
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-white truncate">
                              {learner.displayName} {isMe ? "(You)" : ""}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {learner.teachSkills.slice(0, 2).join(", ") || learner.experienceLevel}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                        Lv. {lvl.level} · {learner.experienceLevel}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400">
                        {learner.badges.length > 0 ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Award className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span>
                              {learner.badges.slice(0, 2).join(", ")}
                              {learner.badges.length > 2 ? ` +${learner.badges.length - 2}` : ""}
                            </span>
                          </span>
                        ) : (
                          <span>—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                        {learner.xp || 0} XP
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No public learners yet. Create your profile to appear first on the leaderboard.
          </div>
        )}
      </div>
    </div>
  );
}
