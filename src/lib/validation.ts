import blueprint from "../../firebase-blueprint.json";
import type { ExperienceLevel, UserProfile } from "../types/skillswap";

const UserProps = blueprint.entities.UserProfile.properties;
const ExchangeProps = blueprint.entities.ExchangeRequest.properties;
const MessageProps = blueprint.entities.ChatMessage.properties;
const ReviewProps = blueprint.entities.Review.properties;
const ReportProps = blueprint.entities.Report.properties;
const SkillProps = blueprint.entities.SkillCategoryItem.properties;

export const SCHEMA_LIMITS = {
  idPattern: new RegExp(UserProps.uid.pattern),
  displayNameMin: UserProps.displayName.minLength,
  displayNameMax: UserProps.displayName.maxLength,
  photoUrlMax: UserProps.photoURL.maxLength,
  countryMin: UserProps.country.minLength,
  countryMax: UserProps.country.maxLength,
  bioMax: UserProps.bio.maxLength,
  availabilityMax: UserProps.availability.maxLength,
  maxSkills: 15,
  maxLanguages: 10,
  skillItemMax: 60,
  experienceLevels: UserProps.experienceLevel.enum as ExperienceLevel[],
  exchangeMessageMax: ExchangeProps.message.maxLength,
  scheduleNoteMax: ExchangeProps.scheduleNote.maxLength,
  chatTextMin: MessageProps.text.minLength,
  chatTextMax: MessageProps.text.maxLength,
  reviewCommentMin: ReviewProps.comment.minLength,
  reviewCommentMax: ReviewProps.comment.maxLength,
  reportDetailsMin: ReportProps.details.minLength,
  reportDetailsMax: ReportProps.details.maxLength,
  skillNameMin: SkillProps.name.minLength,
  skillNameMax: SkillProps.name.maxLength,
  skillCategoryMin: SkillProps.category.minLength,
  skillCategoryMax: SkillProps.category.maxLength,
  skillDescMax: SkillProps.description.maxLength,
  cityMax: 80,
  noteTitleMax: 120,
  noteTextMax: 3000,
  noteTagMax: 50,
};

export function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
}

export function sanitizeStringList(items: string[], maxItems: number, maxLen = 60): string[] {
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const item of items) {
    const trimmed = item.trim().slice(0, maxLen);
    if (trimmed.length >= 1 && !seen.has(trimmed.toLowerCase())) {
      seen.add(trimmed.toLowerCase());
      clean.push(trimmed);
      if (clean.length >= maxItems) break;
    }
  }
  return clean;
}

export function calculateProfileCompletion(
  profile: Pick<
    UserProfile,
    | "displayName"
    | "country"
    | "bio"
    | "teachSkills"
    | "learnSkills"
    | "languages"
    | "availability"
    | "photoURL"
  > & { city?: string } | null
): number {
  if (!profile) return 0;
  let score = 0;
  if (profile.displayName.trim().length >= 2) score += 15;
  if (
    (profile.city && profile.city.trim().length >= 2) ||
    (profile.country.trim().length >= 2 && profile.country !== "Global")
  ) {
    score += 15;
  }
  if (profile.bio.trim().length >= 20) score += 15;
  if (profile.teachSkills.length > 0) score += 20;
  if (profile.learnSkills.length > 0) score += 20;
  if (profile.languages.length > 0) score += 5;
  if (profile.availability.trim().length >= 3) score += 5;
  if (profile.photoURL.trim().length > 0) score += 5;
  return Math.min(100, score);
}

// Spam prevention & safe messaging filter
const recentMessageTimestamps: number[] = [];
let lastMessageNormalized = "";

export function checkMessageSafety(text: string): { ok: boolean; reason?: string } {
  const trimmed = text.trim();
  if (trimmed.length < SCHEMA_LIMITS.chatTextMin) {
    return { ok: false, reason: "Message cannot be empty." };
  }
  if (trimmed.length > SCHEMA_LIMITS.chatTextMax) {
    return {
      ok: false,
      reason: `Message must be ${SCHEMA_LIMITS.chatTextMax} characters or fewer.`,
    };
  }

  const normalized = trimmed.toLowerCase();
  if (normalized === lastMessageNormalized && trimmed.length > 8) {
    return { ok: false, reason: "Duplicate message detected. Please avoid repeating messages." };
  }

  // Block obvious spam/phishing link floods
  const urlMatches = trimmed.match(/https?:\/\/[^\s]+/gi) || [];
  if (urlMatches.length > 2) {
    return { ok: false, reason: "Too many external links in one message (max 2)." };
  }

  const now = Date.now();
  while (recentMessageTimestamps.length && now - recentMessageTimestamps[0] > 30_000) {
    recentMessageTimestamps.shift();
  }
  if (recentMessageTimestamps.length >= 8) {
    return {
      ok: false,
      reason: "You are sending messages too quickly. Please wait a few seconds.",
    };
  }

  recentMessageTimestamps.push(now);
  lastMessageNormalized = normalized;
  return { ok: true };
}

export const DEFAULT_POPULAR_SKILLS: Array<{
  name: string;
  category: string;
  description: string;
}> = [
  {
    name: "Python Programming",
    category: "Programming",
    description: "Scripting, automation, data analysis, and backend fundamentals.",
  },
  {
    name: "HTML & CSS",
    category: "Programming",
    description: "Responsive layouts, semantic markup, and modern Tailwind workflows.",
  },
  {
    name: "TypeScript & React",
    category: "Programming",
    description: "Component architecture, state management, and full-stack web apps.",
  },
  {
    name: "Graphic Design",
    category: "Design",
    description: "Typography, layout hierarchy, brand systems, and Figma prototyping.",
  },
  {
    name: "UI/UX Design",
    category: "Design",
    description: "User research, wireframing, interaction design, and usability testing.",
  },
  {
    name: "Video Editing",
    category: "Media & Audio",
    description: "Story pacing, color grading, audio mixing, and short-form editing.",
  },
  {
    name: "Mathematics",
    category: "Mathematics & Science",
    description: "Calculus, linear algebra, probability, and discrete math tutoring.",
  },
  {
    name: "Data Science & SQL",
    category: "Mathematics & Science",
    description: "Statistical modeling, query optimization, and exploratory analysis.",
  },
  {
    name: "English Fluency",
    category: "Languages",
    description: "Conversational speaking, academic writing, and technical presentations.",
  },
  {
    name: "Spanish Conversation",
    category: "Languages",
    description: "Everyday dialogue, pronunciation, and practical grammar.",
  },
  {
    name: "Acoustic Guitar",
    category: "Media & Audio",
    description: "Chord progressions, fingerstyle technique, and rhythm fundamentals.",
  },
  {
    name: "Product Strategy",
    category: "Business",
    description: "Discovery interviews, roadmapping, and go-to-market positioning.",
  },
];

export const COMMON_COUNTRIES = [
  "United States",
  "United Kingdom",
  "Canada",
  "Germany",
  "India",
  "Pakistan",
  "Brazil",
  "Japan",
  "South Korea",
  "Australia",
  "France",
  "Spain",
  "Nigeria",
  "Singapore",
  "Netherlands",
  "Mexico",
  "Remote / Global",
];

export const COMMON_LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Mandarin",
  "Hindi",
  "Urdu",
  "Arabic",
  "Portuguese",
  "Japanese",
  "Korean",
];
