import type { Timestamp } from "firebase/firestore";

export type ExperienceLevel = "Beginner" | "Intermediate" | "Advanced" | "Expert";

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  city: string;
  country: string;
  bio: string;
  teachSkills: string[];
  learnSkills: string[];
  experienceLevel: ExperienceLevel;
  languages: string[];
  availability: string;
  xp: number;
  streakDays: number;
  lastActiveDate: string;
  hoursLearned: number;
  hoursTaught: number;
  badges: string[];
  weeklyActivity: number[];
  emailVerified: boolean;
  ratingAvg: number;
  ratingCount: number;
  completedExchanges: number;
  isVerified: boolean;
  isSuspended: boolean;
  isPublic: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface PrivateAccountInfo {
  uid: string;
  email: string;
  blockedUserIds: string[];
  allowMessagesFrom: "anyone" | "matched_only";
  emailNotifications: boolean;
  updatedAt?: Timestamp | null;
}

export interface SkillCategoryItem {
  id: string;
  name: string;
  category: string;
  description: string;
  createdBy: string;
  isActive: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export type ExchangeStatus =
  | "pending"
  | "accepted"
  | "in_progress"
  | "rejected"
  | "completed"
  | "cancelled";

export interface CallHistoryEntry {
  id: string;
  date: string;
  durationMinutes: number;
  topic: string;
  recordedBy: string;
  recordedByName: string;
}

export interface ExchangeRequest {
  id: string;
  fromUid: string;
  toUid: string;
  fromName: string;
  toName: string;
  participants: string[];
  offeredSkill: string;
  requestedSkill: string;
  message: string;
  scheduleNote: string;
  status: ExchangeStatus;
  cancelReason?: string;
  cancelledBy?: string;
  cancelledByName?: string;
  scheduledCallDate?: string;
  scheduledCallTime?: string;
  scheduledCallTopic?: string;
  scheduledBy?: string;
  callHistory?: CallHistoryEntry[];
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface AiMatch {
  id: string;
  userId: string;
  partnerId: string;
  partnerName: string;
  compatibilityScore: number;
  reason: string;
  primarySwap: string;
  isAlternative: boolean;
  createdAt?: Timestamp | null;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  participantNames: Record<string, string>;
  participantPhotos: Record<string, string>;
  exchangeRequestId: string;
  lastMessage: string;
  lastSenderId: string;
  unreadBy: string[];
  lastMessageAt?: Timestamp | null;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  participantIds: string[];
  senderId: string;
  senderName: string;
  text: string;
  createdAt?: Timestamp | null;
}

export interface Review {
  id: string;
  exchangeId: string;
  reviewerId: string;
  reviewerName: string;
  revieweeId: string;
  rating: number;
  comment: string;
  skillLearned: string;
  isVisible: boolean;
  createdAt?: Timestamp | null;
}

export type NotificationType =
  | "new_match"
  | "exchange_request"
  | "exchange_accepted"
  | "exchange_completed"
  | "exchange_cancelled"
  | "call_scheduled"
  | "lesson_uploaded"
  | "new_message"
  | "new_review"
  | "system";

export interface NotificationItem {
  id: string;
  userId: string;
  senderId: string;
  type: NotificationType;
  title: string;
  body: string;
  relatedId: string;
  isRead: boolean;
  createdAt?: Timestamp | null;
}

export type ReportReason =
  | "spam"
  | "harassment"
  | "inappropriate_content"
  | "fake_profile"
  | "other";

export type ReportStatus = "open" | "reviewed" | "actioned" | "dismissed";

export interface ReportItem {
  id: string;
  reporterId: string;
  reportedUid: string;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export type AssistantMode =
  | "explain"
  | "roadmap"
  | "exercises"
  | "coding_help"
  | "resources"
  | "exchange_prep";

export type WorkspaceTab =
  | "dashboard"
  | "profile"
  | "explore"
  | "practice"
  | "leaderboard"
  | "exchanges"
  | "lessons"
  | "messages"
  | "assistant"
  | "admin";

export type LessonType = "upload" | "link";

export interface LessonItem {
  id: string;
  exchangeId: string;
  participants: string[];
  teacherId: string;
  teacherName: string;
  studentId: string;
  studentName: string;
  title: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: string;
  type: LessonType;
  watched: boolean;
  rating: number;
  comment: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export type ExploreCategory =
  | "All"
  | "Learners"
  | "Programmers"
  | "Graphic Designers"
  | "Video Editors"
  | "English Speakers"
  | "Musicians"
  | "More";

export interface NoteItem {
  id: string;
  userId: string;
  title: string;
  text: string;
  skillTag: string;
  noteDate: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface PracticeQuestion {
  prompt: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
}

export interface PracticeQuiz {
  id: string;
  title: string;
  category: string;
  exploreCategory: ExploreCategory;
  description: string;
  questions: PracticeQuestion[];
}

export interface PracticeAttempt {
  id: string;
  userId: string;
  quizId: string;
  quizTitle: string;
  category: string;
  score: number;
  totalQuestions: number;
  xpEarned: number;
  createdAt?: Timestamp | null;
}
