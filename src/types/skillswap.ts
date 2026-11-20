import type { Timestamp } from "firebase/firestore";

export type ExperienceLevel = "Beginner" | "Intermediate" | "Advanced" | "Expert";

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  country: string;
  bio: string;
  teachSkills: string[];
  learnSkills: string[];
  experienceLevel: ExperienceLevel;
  languages: string[];
  availability: string;
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
  | "rejected"
  | "completed"
  | "cancelled";

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
  | "explore"
  | "exchanges"
  | "messages"
  | "assistant"
  | "profile"
  | "admin";
