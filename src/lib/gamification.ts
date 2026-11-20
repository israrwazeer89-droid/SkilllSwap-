import type { ExploreCategory, UserProfile } from "../types/skillswap";

export const XP_PER_LEVEL = 100;
export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function normalizeWeeklyActivity(raw?: number[]): number[] {
  if (!Array.isArray(raw) || raw.length !== 7) {
    return [0, 0, 0, 0, 0, 0, 0];
  }
  return raw.map((val) =>
    typeof val === "number" && Number.isFinite(val) && val >= 0
      ? Math.min(1000, Math.round(val))
      : 0
  );
}

export function normalizeUserProfile(raw: Partial<UserProfile> & { uid: string }): UserProfile {
  return {
    uid: raw.uid,
    displayName: raw.displayName || "SkillSwap Learner",
    photoURL: raw.photoURL || "",
    city: raw.city || "",
    country: raw.country || "United States",
    bio: raw.bio || "",
    teachSkills: Array.isArray(raw.teachSkills) ? raw.teachSkills : [],
    learnSkills: Array.isArray(raw.learnSkills) ? raw.learnSkills : [],
    experienceLevel: raw.experienceLevel || "Intermediate",
    languages: Array.isArray(raw.languages) && raw.languages.length > 0 ? raw.languages : ["English"],
    availability: raw.availability || "Flexible",
    xp: typeof raw.xp === "number" && Number.isFinite(raw.xp) ? Math.max(0, Math.round(raw.xp)) : 0,
    streakDays:
      typeof raw.streakDays === "number" && Number.isFinite(raw.streakDays)
        ? Math.max(0, Math.round(raw.streakDays))
        : 0,
    lastActiveDate: typeof raw.lastActiveDate === "string" ? raw.lastActiveDate : "",
    hoursLearned:
      typeof raw.hoursLearned === "number" && Number.isFinite(raw.hoursLearned)
        ? Math.max(0, Number(raw.hoursLearned.toFixed(2)))
        : 0,
    hoursTaught:
      typeof raw.hoursTaught === "number" && Number.isFinite(raw.hoursTaught)
        ? Math.max(0, Number(raw.hoursTaught.toFixed(2)))
        : 0,
    badges: Array.isArray(raw.badges) ? raw.badges.slice(0, 20) : [],
    weeklyActivity: normalizeWeeklyActivity(raw.weeklyActivity),
    emailVerified: Boolean(raw.emailVerified),
    ratingAvg: typeof raw.ratingAvg === "number" ? raw.ratingAvg : 0,
    ratingCount: typeof raw.ratingCount === "number" ? raw.ratingCount : 0,
    completedExchanges:
      typeof raw.completedExchanges === "number" ? Math.max(0, Math.round(raw.completedExchanges)) : 0,
    isVerified: Boolean(raw.isVerified),
    isSuspended: Boolean(raw.isSuspended),
    isPublic: raw.isPublic ?? true,
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
  };
}

export function getLevelInfo(xpInput: number) {
  const xp = Math.max(0, Math.round(xpInput || 0));
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpInLevel = xp % XP_PER_LEVEL;
  const xpToNextLevel = XP_PER_LEVEL - xpInLevel;
  const progressPercent = Math.min(100, Math.round((xpInLevel / XP_PER_LEVEL) * 100));
  return {
    xp,
    level,
    xpInLevel,
    xpPerLevel: XP_PER_LEVEL,
    xpToNextLevel,
    progressPercent,
  };
}

export function getTodayDateString(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getYesterdayDateString(now = new Date()): string {
  const copy = new Date(now);
  copy.setDate(copy.getDate() - 1);
  return getTodayDateString(copy);
}

export function getMonToSunIndex(now = new Date()): number {
  const day = now.getDay(); // 0=Sun..6=Sat
  return day === 0 ? 6 : day - 1;
}

export function computeUpdatedBadges(params: {
  existingBadges: string[];
  xp: number;
  streakDays: number;
  completedExchanges: number;
  hasPractice?: boolean;
  perfectPractice?: boolean;
  emailVerified?: boolean;
}): string[] {
  const set = new Set(params.existingBadges);
  if (params.completedExchanges >= 1) set.add("First Swap");
  if (params.completedExchanges >= 5) set.add("Swap Mentor");
  if (params.hasPractice) set.add("Practice Starter");
  if (params.perfectPractice) set.add("Quiz Ace");
  if (params.streakDays >= 3) set.add("3-Day Streak");
  if (params.streakDays >= 7) set.add("7-Day Streak");
  if (params.xp >= 100) set.add("100 XP Club");
  if (params.xp >= 500) set.add("500 XP Club");
  if (params.emailVerified) set.add("Verified Peer");
  return Array.from(set).slice(0, 20);
}

export function computeNextActivityStats(
  profile: UserProfile,
  opts: {
    xpGain: number;
    completedExchangeDelta?: number;
    hoursLearnedDelta?: number;
    hoursTaughtDelta?: number;
    hasPractice?: boolean;
    perfectPractice?: boolean;
  }
) {
  const now = new Date();
  const today = getTodayDateString(now);
  const yesterday = getYesterdayDateString(now);

  let nextStreak = profile.streakDays || 0;
  if (profile.lastActiveDate === today) {
    nextStreak = Math.max(1, nextStreak);
  } else if (profile.lastActiveDate === yesterday) {
    nextStreak = nextStreak + 1;
  } else {
    nextStreak = 1;
  }

  const weekly = normalizeWeeklyActivity(profile.weeklyActivity);
  const dayIdx = getMonToSunIndex(now);
  weekly[dayIdx] = Math.min(1000, weekly[dayIdx] + Math.max(1, Math.round(opts.xpGain || 10)));

  const nextXp = Math.min(1000000, (profile.xp || 0) + Math.max(0, Math.round(opts.xpGain)));
  const nextCompleted = Math.min(
    100000,
    (profile.completedExchanges || 0) + (opts.completedExchangeDelta || 0)
  );
  const nextHoursLearned = Number(
    ((profile.hoursLearned || 0) + (opts.hoursLearnedDelta || 0)).toFixed(2)
  );
  const nextHoursTaught = Number(
    ((profile.hoursTaught || 0) + (opts.hoursTaughtDelta || 0)).toFixed(2)
  );

  const nextBadges = computeUpdatedBadges({
    existingBadges: profile.badges || [],
    xp: nextXp,
    streakDays: nextStreak,
    completedExchanges: nextCompleted,
    hasPractice: opts.hasPractice,
    perfectPractice: opts.perfectPractice,
    emailVerified: profile.emailVerified || profile.isVerified,
  });

  return {
    xp: nextXp,
    streakDays: nextStreak,
    lastActiveDate: today,
    weeklyActivity: weekly,
    completedExchanges: nextCompleted,
    hoursLearned: nextHoursLearned,
    hoursTaught: nextHoursTaught,
    badges: nextBadges,
  };
}

export function sortLeaderboard(users: UserProfile[]): UserProfile[] {
  return [...users]
    .filter((u) => !u.isSuspended && u.isPublic)
    .sort((a, b) => {
      const xpDiff = (b.xp || 0) - (a.xp || 0);
      if (xpDiff !== 0) return xpDiff;
      const exDiff = (b.completedExchanges || 0) - (a.completedExchanges || 0);
      if (exDiff !== 0) return exDiff;
      return a.displayName.localeCompare(b.displayName);
    });
}

export function getUserRank(uid: string, users: UserProfile[]): number | null {
  const sorted = sortLeaderboard(users);
  const idx = sorted.findIndex((u) => u.uid === uid);
  return idx >= 0 ? idx + 1 : null;
}

export function matchesExploreCategory(
  user: UserProfile,
  category: ExploreCategory
): boolean {
  if (category === "All") return true;

  const teachLower = user.teachSkills.map((s) => s.toLowerCase());
  const learnLower = user.learnSkills.map((s) => s.toLowerCase());
  const allLower = [...teachLower, ...learnLower];

  if (category === "Learners") {
    return learnLower.length > 0;
  }

  const hasAny = (keywords: string[]) =>
    allLower.some((skill) => keywords.some((kw) => skill.includes(kw)));

  const progKw = [
    "python",
    "javascript",
    "typescript",
    "react",
    "html",
    "css",
    "code",
    "coding",
    "program",
    "software",
    "sql",
    "java",
    "c++",
    "node",
    "web",
    "data",
  ];
  const designKw = [
    "graphic",
    "design",
    "ui",
    "ux",
    "figma",
    "photoshop",
    "illustrator",
    "branding",
    "typography",
    "sketch",
  ];
  const videoKw = [
    "video",
    "editing",
    "premiere",
    "after effects",
    "davinci",
    "film",
    "cinema",
    "youtube",
    "animation",
    "motion",
  ];
  const englishKw = ["english", "ielts", "toefl", "writing", "speaking", "grammar", "fluency"];
  const musicKw = ["music", "guitar", "piano", "violin", "sing", "vocal", "audio", "drum", "beat"];

  if (category === "Programmers") return hasAny(progKw);
  if (category === "Graphic Designers") return hasAny(designKw);
  if (category === "Video Editors") return hasAny(videoKw);
  if (category === "English Speakers") {
    return (
      hasAny(englishKw) ||
      user.languages.some((l) => l.toLowerCase() === "english")
    );
  }
  if (category === "Musicians") return hasAny(musicKw);

  if (category === "More") {
    const known = [...progKw, ...designKw, ...videoKw, ...englishKw, ...musicKw];
    return (
      allLower.some((skill) => !known.some((kw) => skill.includes(kw))) ||
      allLower.length === 0
    );
  }

  return true;
}
