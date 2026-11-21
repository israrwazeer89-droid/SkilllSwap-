import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { handleFirestoreError, OperationType } from "./firestoreError";
import { computeNextActivityStats, normalizeUserProfile } from "./gamification";
import {
  DEFAULT_POPULAR_SKILLS,
  sanitizeId,
  sanitizeStringList,
  SCHEMA_LIMITS,
} from "./validation";
import type {
  AiMatch,
  CallHistoryEntry,
  Conversation,
  ExchangeRequest,
  ExchangeStatus,
  LessonType,
  NoteItem,
  PracticeQuiz,
  PrivateAccountInfo,
  ReportReason,
  ReportStatus,
  UserProfile,
} from "../types/skillswap";

export async function createUserProfile(
  uid: string,
  email: string,
  profileData: Pick<
    UserProfile,
    | "displayName"
    | "photoURL"
    | "city"
    | "country"
    | "bio"
    | "teachSkills"
    | "learnSkills"
    | "experienceLevel"
    | "languages"
    | "availability"
    | "isPublic"
  > & { emailVerified?: boolean },
  privateSettings?: Partial<
    Pick<PrivateAccountInfo, "allowMessagesFrom" | "emailNotifications">
  >
) {
  const path = `users/${uid}`;
  try {
    const cleanName = profileData.displayName
      .trim()
      .slice(0, SCHEMA_LIMITS.displayNameMax);
    if (cleanName.length < SCHEMA_LIMITS.displayNameMin) {
      throw new Error("Display name must be at least 2 characters.");
    }
    const cleanCountry = profileData.country
      .trim()
      .slice(0, SCHEMA_LIMITS.countryMax);
    if (cleanCountry.length < SCHEMA_LIMITS.countryMin) {
      throw new Error("Country must be at least 2 characters.");
    }

    const batch = writeBatch(db);
    batch.set(doc(db, "users", uid), {
      uid,
      displayName: cleanName,
      photoURL: profileData.photoURL.trim().slice(0, SCHEMA_LIMITS.photoUrlMax),
      city: (profileData.city || "").trim().slice(0, SCHEMA_LIMITS.cityMax),
      country: cleanCountry,
      bio: profileData.bio.trim().slice(0, SCHEMA_LIMITS.bioMax),
      teachSkills: sanitizeStringList(
        profileData.teachSkills,
        SCHEMA_LIMITS.maxSkills,
        SCHEMA_LIMITS.skillItemMax
      ),
      learnSkills: sanitizeStringList(
        profileData.learnSkills,
        SCHEMA_LIMITS.maxSkills,
        SCHEMA_LIMITS.skillItemMax
      ),
      experienceLevel: profileData.experienceLevel,
      languages: sanitizeStringList(
        profileData.languages.length > 0 ? profileData.languages : ["English"],
        SCHEMA_LIMITS.maxLanguages,
        40
      ),
      availability: profileData.availability
        .trim()
        .slice(0, SCHEMA_LIMITS.availabilityMax),
      xp: 0,
      streakDays: 0,
      lastActiveDate: "",
      hoursLearned: 0,
      hoursTaught: 0,
      badges: [],
      weeklyActivity: [0, 0, 0, 0, 0, 0, 0],
      emailVerified: Boolean(profileData.emailVerified),
      ratingAvg: 0,
      ratingCount: 0,
      completedExchanges: 0,
      isVerified: false,
      isSuspended: false,
      isPublic: Boolean(profileData.isPublic),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, "users", uid, "private", "info"), {
      uid,
      email: email.trim().slice(0, 160),
      blockedUserIds: [],
      allowMessagesFrom: privateSettings?.allowMessagesFrom ?? "anyone",
      emailNotifications: privateSettings?.emailNotifications ?? true,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateUserProfile(
  uid: string,
  updates: Pick<
    UserProfile,
    | "displayName"
    | "photoURL"
    | "city"
    | "country"
    | "bio"
    | "teachSkills"
    | "learnSkills"
    | "experienceLevel"
    | "languages"
    | "availability"
    | "isPublic"
  > & { emailVerified?: boolean; existingProfile?: UserProfile | null }
) {
  const path = `users/${uid}`;
  try {
    const cleanName = updates.displayName.trim().slice(0, SCHEMA_LIMITS.displayNameMax);
    if (cleanName.length < SCHEMA_LIMITS.displayNameMin) {
      throw new Error("Display name must be at least 2 characters.");
    }
    const cleanCountry = updates.country.trim().slice(0, SCHEMA_LIMITS.countryMax);
    if (cleanCountry.length < SCHEMA_LIMITS.countryMin) {
      throw new Error("Country must be at least 2 characters.");
    }

    const base = updates.existingProfile
      ? normalizeUserProfile(updates.existingProfile)
      : normalizeUserProfile({ uid });

    await updateDoc(doc(db, "users", uid), {
      displayName: cleanName,
      photoURL: updates.photoURL.trim().slice(0, SCHEMA_LIMITS.photoUrlMax),
      city: (updates.city || "").trim().slice(0, SCHEMA_LIMITS.cityMax),
      country: cleanCountry,
      bio: updates.bio.trim().slice(0, SCHEMA_LIMITS.bioMax),
      teachSkills: sanitizeStringList(
        updates.teachSkills,
        SCHEMA_LIMITS.maxSkills,
        SCHEMA_LIMITS.skillItemMax
      ),
      learnSkills: sanitizeStringList(
        updates.learnSkills,
        SCHEMA_LIMITS.maxSkills,
        SCHEMA_LIMITS.skillItemMax
      ),
      experienceLevel: updates.experienceLevel,
      languages: sanitizeStringList(
        updates.languages.length > 0 ? updates.languages : ["English"],
        SCHEMA_LIMITS.maxLanguages,
        40
      ),
      availability: updates.availability.trim().slice(0, SCHEMA_LIMITS.availabilityMax),
      isPublic: Boolean(updates.isPublic),
      emailVerified: Boolean(updates.emailVerified ?? base.emailVerified),
      xp: base.xp,
      streakDays: base.streakDays,
      lastActiveDate: base.lastActiveDate,
      hoursLearned: base.hoursLearned,
      hoursTaught: base.hoursTaught,
      badges: base.badges,
      weeklyActivity: base.weeklyActivity,
      completedExchanges: base.completedExchanges,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updatePrivateSettings(
  uid: string,
  updates: Pick<
    PrivateAccountInfo,
    "email" | "blockedUserIds" | "allowMessagesFrom" | "emailNotifications"
  >
) {
  const path = `users/${uid}/private/info`;
  try {
    await updateDoc(doc(db, "users", uid, "private", "info"), {
      email: updates.email.trim().slice(0, 160),
      blockedUserIds: sanitizeStringList(updates.blockedUserIds, 100, 128),
      allowMessagesFrom: updates.allowMessagesFrom,
      emailNotifications: Boolean(updates.emailNotifications),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function createExchangeRequest(params: {
  fromUser: UserProfile;
  toUser: UserProfile;
  offeredSkill: string;
  requestedSkill: string;
  message: string;
  scheduleNote: string;
}): Promise<string> {
  const reqRef = doc(collection(db, "exchangeRequests"));
  const path = `exchangeRequests/${reqRef.id}`;
  try {
    const offered = params.offeredSkill.trim().slice(0, 60);
    const requested = params.requestedSkill.trim().slice(0, 60);
    if (!offered || !requested) {
      throw new Error("Please select both an offered skill and a requested skill.");
    }

    const batch = writeBatch(db);
    batch.set(reqRef, {
      id: reqRef.id,
      fromUid: params.fromUser.uid,
      toUid: params.toUser.uid,
      fromName: params.fromUser.displayName.slice(0, 80),
      toName: params.toUser.displayName.slice(0, 80),
      participants: [params.fromUser.uid, params.toUser.uid],
      offeredSkill: offered,
      requestedSkill: requested,
      message: params.message.trim().slice(0, SCHEMA_LIMITS.exchangeMessageMax),
      scheduleNote: params.scheduleNote.trim().slice(0, SCHEMA_LIMITS.scheduleNoteMax),
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const notifRef = doc(collection(db, "notifications"));
    batch.set(notifRef, {
      id: notifRef.id,
      userId: params.toUser.uid,
      senderId: params.fromUser.uid,
      type: "exchange_request",
      title: `New SkillSwap request from ${params.fromUser.displayName.slice(0, 50)}`,
      body: `Offers ${offered} in exchange for ${requested}.`.slice(0, 300),
      relatedId: reqRef.id,
      isRead: false,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
    return reqRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateExchangeStatus(
  req: ExchangeRequest,
  nextStatus: ExchangeStatus,
  actorUid: string,
  actorName: string,
  actorProfile?: UserProfile | null,
  options?: { cancelReason?: string }
) {
  const path = `exchangeRequests/${req.id}`;
  try {
    const batch = writeBatch(db);
    const updatePayload: Record<string, unknown> = {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    };

    const cleanReason = (options?.cancelReason || "").trim().slice(0, 200);
    if (nextStatus === "cancelled") {
      updatePayload.cancelReason = cleanReason || "Not specified";
      updatePayload.cancelledBy = actorUid;
      updatePayload.cancelledByName = actorName.trim().slice(0, 80) || "Peer";
    }

    batch.update(doc(db, "exchangeRequests", req.id), updatePayload);

    if (nextStatus === "completed" && actorProfile) {
      const normalized = normalizeUserProfile(actorProfile);
      const stats = computeNextActivityStats(normalized, {
        xpGain: 50,
        completedExchangeDelta: 1,
        hoursLearnedDelta: 1,
        hoursTaughtDelta: 1,
      });
      batch.update(doc(db, "users", actorUid), {
        city: normalized.city,
        xp: stats.xp,
        streakDays: stats.streakDays,
        lastActiveDate: stats.lastActiveDate,
        hoursLearned: stats.hoursLearned,
        hoursTaught: stats.hoursTaught,
        badges: stats.badges,
        weeklyActivity: stats.weeklyActivity,
        completedExchanges: stats.completedExchanges,
        emailVerified: normalized.emailVerified,
        updatedAt: serverTimestamp(),
      });
    }

    const recipientUid = req.fromUid === actorUid ? req.toUid : req.fromUid;
    if (nextStatus === "accepted" || nextStatus === "completed") {
      const notifRef = doc(collection(db, "notifications"));
      batch.set(notifRef, {
        id: notifRef.id,
        userId: recipientUid,
        senderId: actorUid,
        type: nextStatus === "accepted" ? "exchange_accepted" : "exchange_completed",
        title:
          nextStatus === "accepted"
            ? `${actorName.slice(0, 50)} accepted your SkillSwap`
            : `Exchange completed with ${actorName.slice(0, 45)} (+50 XP)`,
        body: `${req.offeredSkill} ↔ ${req.requestedSkill}`.slice(0, 300),
        relatedId: req.id,
        isRead: false,
        createdAt: serverTimestamp(),
      });
    } else if (nextStatus === "cancelled") {
      const notifRef = doc(collection(db, "notifications"));
      batch.set(notifRef, {
        id: notifRef.id,
        userId: recipientUid,
        senderId: actorUid,
        type: "exchange_cancelled",
        title: `${actorName.slice(0, 50)} cancelled the exchange`.slice(0, 120),
        body: `${cleanReason ? `Reason: ${cleanReason} · ` : ""}${req.offeredSkill} ↔ ${req.requestedSkill}`.slice(
          0,
          300
        ),
        relatedId: req.id,
        isRead: false,
        createdAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function scheduleExchangeCall(
  req: ExchangeRequest,
  params: {
    date: string;
    time: string;
    topic: string;
    actorUid: string;
    actorName: string;
  }
) {
  const path = `exchangeRequests/${req.id}`;
  try {
    const cleanDate = params.date.trim().slice(0, 20);
    const cleanTime = params.time.trim().slice(0, 20);
    const cleanTopic = params.topic.trim().slice(0, 120);
    if (!cleanDate || !cleanTime) {
      throw new Error("Please select both a date and time for the call.");
    }

    const batch = writeBatch(db);
    batch.update(doc(db, "exchangeRequests", req.id), {
      scheduledCallDate: cleanDate,
      scheduledCallTime: cleanTime,
      scheduledCallTopic: cleanTopic || `${req.offeredSkill} ↔ ${req.requestedSkill}`.slice(0, 120),
      scheduledBy: params.actorUid,
      updatedAt: serverTimestamp(),
    });

    const recipientUid = req.fromUid === params.actorUid ? req.toUid : req.fromUid;
    const notifRef = doc(collection(db, "notifications"));
    batch.set(notifRef, {
      id: notifRef.id,
      userId: recipientUid,
      senderId: params.actorUid,
      type: "call_scheduled",
      title: `${params.actorName.slice(0, 45)} scheduled a live video call`,
      body: `${cleanDate} at ${cleanTime}${cleanTopic ? ` · ${cleanTopic}` : ""}`.slice(0, 300),
      relatedId: req.id,
      isRead: false,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function startExchangeVideoCall(req: ExchangeRequest) {
  if (req.status !== "accepted") return;
  const path = `exchangeRequests/${req.id}`;
  try {
    await updateDoc(doc(db, "exchangeRequests", req.id), {
      status: "in_progress",
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function markExchangeSessionDone(
  req: ExchangeRequest,
  params: {
    topic: string;
    durationMinutes: number;
    completeExchange: boolean;
    actorUid: string;
    actorName: string;
    actorProfile: UserProfile;
  }
) {
  const path = `exchangeRequests/${req.id}`;
  try {
    const cleanTopic =
      params.topic.trim().slice(0, 120) ||
      `${req.offeredSkill} ↔ ${req.requestedSkill}`.slice(0, 120);
    const cleanDuration = Math.max(5, Math.min(300, Math.round(params.durationMinutes || 30)));
    const entry: CallHistoryEntry = {
      id: `call_${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      durationMinutes: cleanDuration,
      topic: cleanTopic,
      recordedBy: params.actorUid,
      recordedByName: params.actorName.trim().slice(0, 80) || "Peer",
    };

    const existingHistory = Array.isArray(req.callHistory) ? req.callHistory : [];
    const nextHistory = [entry, ...existingHistory].slice(0, 30);
    const nextStatus: ExchangeStatus = params.completeExchange ? "completed" : "in_progress";

    const batch = writeBatch(db);
    batch.update(doc(db, "exchangeRequests", req.id), {
      status: nextStatus,
      callHistory: nextHistory,
      updatedAt: serverTimestamp(),
    });

    if (params.completeExchange) {
      const normalized = normalizeUserProfile(params.actorProfile);
      const hoursDelta = Math.max(0.5, Number((cleanDuration / 60).toFixed(2)));
      const stats = computeNextActivityStats(normalized, {
        xpGain: 50,
        completedExchangeDelta: 1,
        hoursLearnedDelta: hoursDelta,
        hoursTaughtDelta: hoursDelta,
      });
      batch.update(doc(db, "users", params.actorUid), {
        city: normalized.city,
        xp: stats.xp,
        streakDays: stats.streakDays,
        lastActiveDate: stats.lastActiveDate,
        hoursLearned: stats.hoursLearned,
        hoursTaught: stats.hoursTaught,
        badges: stats.badges,
        weeklyActivity: stats.weeklyActivity,
        completedExchanges: stats.completedExchanges,
        emailVerified: normalized.emailVerified,
        updatedAt: serverTimestamp(),
      });

      const recipientUid = req.fromUid === params.actorUid ? req.toUid : req.fromUid;
      const notifRef = doc(collection(db, "notifications"));
      batch.set(notifRef, {
        id: notifRef.id,
        userId: recipientUid,
        senderId: params.actorUid,
        type: "exchange_completed",
        title: `${params.actorName.slice(0, 45)} marked the session done (+50 XP)`,
        body: `${cleanTopic} (${cleanDuration} min) — Exchange completed!`.slice(0, 300),
        relatedId: req.id,
        isRead: false,
        createdAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function createLessonVideo(params: {
  exchangeId: string;
  teacherId: string;
  teacherName: string;
  studentId: string;
  studentName: string;
  title: string;
  videoUrl: string;
  thumbnailUrl?: string;
  duration: string;
  type: LessonType;
}): Promise<string> {
  const lessonRef = doc(collection(db, "lessons"));
  const path = `lessons/${lessonRef.id}`;
  try {
    const cleanTitle = params.title.trim().slice(0, 140);
    const cleanUrl = params.videoUrl.trim().slice(0, 2000);
    const cleanDuration = (params.duration.trim() || "10 min").slice(0, 30);
    if (!cleanTitle || cleanUrl.length < 5) {
      throw new Error("Please provide a lesson title and valid video link or file.");
    }

    const batch = writeBatch(db);
    batch.set(lessonRef, {
      id: lessonRef.id,
      exchangeId: params.exchangeId,
      participants: [params.teacherId, params.studentId],
      teacherId: params.teacherId,
      teacherName: params.teacherName.trim().slice(0, 80) || "Teacher",
      studentId: params.studentId,
      studentName: params.studentName.trim().slice(0, 80) || "Student",
      title: cleanTitle,
      videoUrl: cleanUrl,
      thumbnailUrl: (params.thumbnailUrl || "").trim().slice(0, 1000),
      duration: cleanDuration,
      type: params.type,
      watched: false,
      rating: 0,
      comment: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const notifRef = doc(collection(db, "notifications"));
    batch.set(notifRef, {
      id: notifRef.id,
      userId: params.studentId,
      senderId: params.teacherId,
      type: "lesson_uploaded",
      title: `${params.teacherName.slice(0, 45)} shared a lesson video`,
      body: `${cleanTitle} (${cleanDuration})`.slice(0, 300),
      relatedId: lessonRef.id,
      isRead: false,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
    return lessonRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function submitLessonFeedback(params: {
  lessonId: string;
  watched: boolean;
  rating: number;
  comment: string;
  studentUid: string;
  studentName: string;
  teacherId: string;
  lessonTitle: string;
}) {
  const path = `lessons/${params.lessonId}`;
  try {
    const cleanRating = Math.max(0, Math.min(5, Math.round(params.rating)));
    const cleanComment = params.comment.trim().slice(0, 600);

    const batch = writeBatch(db);
    batch.update(doc(db, "lessons", params.lessonId), {
      watched: Boolean(params.watched),
      rating: cleanRating,
      comment: cleanComment,
      updatedAt: serverTimestamp(),
    });

    if (cleanRating >= 1) {
      const notifRef = doc(collection(db, "notifications"));
      batch.set(notifRef, {
        id: notifRef.id,
        userId: params.teacherId,
        senderId: params.studentUid,
        type: "lesson_uploaded",
        title: `${params.studentName.slice(0, 45)} rated your lesson ${cleanRating}★`,
        body: `${params.lessonTitle.slice(0, 80)}${cleanComment ? ` — "${cleanComment}"` : ""}`.slice(
          0,
          300
        ),
        relatedId: params.lessonId,
        isRead: false,
        createdAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteLessonVideo(lessonId: string) {
  const path = `lessons/${lessonId}`;
  try {
    await deleteDoc(doc(db, "lessons", lessonId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function syncPendingExchangeXp(profile: UserProfile) {
  const path = `users/${profile.uid}`;
  try {
    const normalized = normalizeUserProfile(profile);
    const stats = computeNextActivityStats(normalized, {
      xpGain: 50,
      completedExchangeDelta: 1,
      hoursLearnedDelta: 1,
      hoursTaughtDelta: 1,
    });
    await updateDoc(doc(db, "users", profile.uid), {
      city: normalized.city,
      xp: stats.xp,
      streakDays: stats.streakDays,
      lastActiveDate: stats.lastActiveDate,
      hoursLearned: stats.hoursLearned,
      hoursTaught: stats.hoursTaught,
      badges: stats.badges,
      weeklyActivity: stats.weeklyActivity,
      completedExchanges: stats.completedExchanges,
      emailVerified: normalized.emailVerified,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function getOrCreateConversation(
  currentUser: UserProfile,
  peer: UserProfile,
  exchangeRequestId = ""
): Promise<string> {
  const sortedIds = [currentUser.uid, peer.uid].sort();
  const convId = sanitizeId(`${sortedIds[0]}_${sortedIds[1]}`);
  const path = `conversations/${convId}`;
  try {
    const convRef = doc(db, "conversations", convId);
    const snap = await getDoc(convRef);
    if (!snap.exists()) {
      await setDoc(convRef, {
        id: convId,
        participantIds: sortedIds,
        participantNames: {
          [currentUser.uid]: currentUser.displayName.slice(0, 80),
          [peer.uid]: peer.displayName.slice(0, 80),
        },
        participantPhotos: {
          [currentUser.uid]: currentUser.photoURL.slice(0, 1000),
          [peer.uid]: peer.photoURL.slice(0, 1000),
        },
        exchangeRequestId: exchangeRequestId.slice(0, 128),
        lastMessage: "",
        lastSenderId: "",
        unreadBy: [],
        lastMessageAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return convId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function sendChatMessage(
  conversation: Conversation,
  sender: UserProfile,
  text: string
) {
  const cleanText = text.trim().slice(0, SCHEMA_LIMITS.chatTextMax);
  if (!cleanText) return;

  const msgRef = doc(collection(db, "conversations", conversation.id, "messages"));
  const path = `conversations/${conversation.id}/messages/${msgRef.id}`;
  const recipientUid = conversation.participantIds.find((id) => id !== sender.uid) || "";

  try {
    const batch = writeBatch(db);
    batch.set(msgRef, {
      id: msgRef.id,
      conversationId: conversation.id,
      participantIds: conversation.participantIds,
      senderId: sender.uid,
      senderName: sender.displayName.slice(0, 80),
      text: cleanText,
      createdAt: serverTimestamp(),
    });

    batch.update(doc(db, "conversations", conversation.id), {
      lastMessage: cleanText.slice(0, 500),
      lastSenderId: sender.uid,
      unreadBy: recipientUid ? [recipientUid] : [],
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (recipientUid) {
      const notifRef = doc(collection(db, "notifications"));
      batch.set(notifRef, {
        id: notifRef.id,
        userId: recipientUid,
        senderId: sender.uid,
        type: "new_message",
        title: `New message from ${sender.displayName.slice(0, 50)}`,
        body: cleanText.slice(0, 140),
        relatedId: conversation.id,
        isRead: false,
        createdAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function markConversationRead(
  conversation: Conversation,
  currentUid: string
) {
  if (!conversation.unreadBy.includes(currentUid)) return;
  const path = `conversations/${conversation.id}`;
  try {
    await updateDoc(doc(db, "conversations", conversation.id), {
      unreadBy: conversation.unreadBy.filter((id) => id !== currentUid),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function saveAiMatches(
  userId: string,
  matches: Array<Omit<AiMatch, "id" | "userId" | "createdAt">>,
  staleMatchIds: string[] = []
) {
  const batch = writeBatch(db);
  try {
    const nextIds = new Set<string>();
    for (const m of matches) {
      const matchId = sanitizeId(`${userId}_${m.partnerId}`);
      nextIds.add(matchId);
      const ref = doc(db, "matches", matchId);
      const safeName = (m.partnerName.trim() || "Peer").slice(0, 80);
      const rawReason = m.reason.trim();
      const safeReason = (
        rawReason.length >= 5
          ? rawReason
          : `Compatible peer for ${m.primarySwap || "skill exchange"}.`
      ).slice(0, 600);
      const safeSwap = (m.primarySwap.trim() || "Skill Exchange").slice(0, 140);

      batch.set(ref, {
        id: matchId,
        userId,
        partnerId: m.partnerId,
        partnerName: safeName,
        compatibilityScore: Math.max(0, Math.min(100, Math.round(m.compatibilityScore))),
        reason: safeReason,
        primarySwap: safeSwap,
        isAlternative: Boolean(m.isAlternative),
        createdAt: serverTimestamp(),
      });
    }

    for (const oldId of staleMatchIds) {
      if (!nextIds.has(oldId)) {
        batch.delete(doc(db, "matches", oldId));
      }
    }

    if (matches.length > 0) {
      const top = [...matches].sort(
        (a, b) => b.compatibilityScore - a.compatibilityScore
      )[0];
      const topScore = Math.max(0, Math.min(100, Math.round(top.compatibilityScore)));
      const notifRef = doc(collection(db, "notifications"));
      batch.set(notifRef, {
        id: notifRef.id,
        userId,
        senderId: userId,
        type: "new_match",
        title: `${matches.length} new AI ${
          matches.length === 1 ? "match" : "matches"
        } generated`.slice(0, 120),
        body: `Top fit: ${top.partnerName.slice(0, 50)} (${topScore}% match) — ${top.primarySwap}`.slice(
          0,
          300
        ),
        relatedId: sanitizeId(`${userId}_${top.partnerId}`),
        isRead: false,
        createdAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, "matches");
  }
}

export async function submitReview(params: {
  exchangeId: string;
  reviewer: UserProfile;
  revieweeId: string;
  rating: number;
  comment: string;
  skillLearned: string;
}) {
  const reviewId = sanitizeId(`${params.exchangeId}_${params.reviewer.uid}`);
  const path = `reviews/${reviewId}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, "reviews", reviewId), {
      id: reviewId,
      exchangeId: params.exchangeId,
      reviewerId: params.reviewer.uid,
      reviewerName: params.reviewer.displayName.slice(0, 80),
      revieweeId: params.revieweeId,
      rating: Math.max(1, Math.min(5, Math.round(params.rating))),
      comment: params.comment.trim().slice(0, SCHEMA_LIMITS.reviewCommentMax),
      skillLearned: params.skillLearned.trim().slice(0, 60),
      isVisible: true,
      createdAt: serverTimestamp(),
    });

    const notifRef = doc(collection(db, "notifications"));
    batch.set(notifRef, {
      id: notifRef.id,
      userId: params.revieweeId,
      senderId: params.reviewer.uid,
      type: "new_review",
      title: `${params.reviewer.displayName.slice(0, 45)} left you a ${params.rating}-star review`,
      body: params.comment.trim().slice(0, 160),
      relatedId: reviewId,
      isRead: false,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function markNotificationRead(notificationId: string) {
  const path = `notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, "notifications", notificationId), {
      isRead: true,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function markAllNotificationsRead(notificationIds: string[]) {
  if (notificationIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const id of notificationIds.slice(0, 50)) {
      batch.update(doc(db, "notifications", id), { isRead: true });
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, "notifications");
  }
}

export async function submitReport(params: {
  reporterId: string;
  reportedUid: string;
  reason: ReportReason;
  details: string;
}) {
  const reportRef = doc(collection(db, "reports"));
  const path = `reports/${reportRef.id}`;
  try {
    await setDoc(reportRef, {
      id: reportRef.id,
      reporterId: params.reporterId,
      reportedUid: params.reportedUid,
      reason: params.reason,
      details: params.details.trim().slice(0, SCHEMA_LIMITS.reportDetailsMax),
      status: "open",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

// Admin operations
export async function adminToggleUserVerify(uid: string, nextVerified: boolean) {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    const current = snap.exists()
      ? normalizeUserProfile(snap.data() as Partial<UserProfile> & { uid: string })
      : normalizeUserProfile({ uid });
    await updateDoc(doc(db, "users", uid), {
      city: current.city,
      xp: current.xp,
      streakDays: current.streakDays,
      lastActiveDate: current.lastActiveDate,
      hoursLearned: current.hoursLearned,
      hoursTaught: current.hoursTaught,
      badges: current.badges,
      weeklyActivity: current.weeklyActivity,
      emailVerified: current.emailVerified,
      isVerified: nextVerified,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function adminToggleUserSuspend(uid: string, nextSuspended: boolean) {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    const current = snap.exists()
      ? normalizeUserProfile(snap.data() as Partial<UserProfile> & { uid: string })
      : normalizeUserProfile({ uid });
    await updateDoc(doc(db, "users", uid), {
      city: current.city,
      xp: current.xp,
      streakDays: current.streakDays,
      lastActiveDate: current.lastActiveDate,
      hoursLearned: current.hoursLearned,
      hoursTaught: current.hoursTaught,
      badges: current.badges,
      weeklyActivity: current.weeklyActivity,
      emailVerified: current.emailVerified,
      isSuspended: nextSuspended,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// Personal Notes (Private to owner)
export async function createUserNote(
  userId: string,
  input: Pick<NoteItem, "title" | "text" | "skillTag" | "noteDate">
): Promise<string> {
  const noteRef = doc(collection(db, "notes"));
  const path = `notes/${noteRef.id}`;
  try {
    await setDoc(noteRef, {
      id: noteRef.id,
      userId,
      title: input.title.trim().slice(0, SCHEMA_LIMITS.noteTitleMax),
      text: input.text.trim().slice(0, SCHEMA_LIMITS.noteTextMax),
      skillTag: (input.skillTag.trim() || "General").slice(0, SCHEMA_LIMITS.noteTagMax),
      noteDate: input.noteDate.trim().slice(0, 20),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return noteRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateUserNote(
  noteId: string,
  input: Pick<NoteItem, "title" | "text" | "skillTag" | "noteDate">
) {
  const path = `notes/${noteId}`;
  try {
    await updateDoc(doc(db, "notes", noteId), {
      title: input.title.trim().slice(0, SCHEMA_LIMITS.noteTitleMax),
      text: input.text.trim().slice(0, SCHEMA_LIMITS.noteTextMax),
      skillTag: (input.skillTag.trim() || "General").slice(0, SCHEMA_LIMITS.noteTagMax),
      noteDate: input.noteDate.trim().slice(0, 20),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteUserNote(noteId: string) {
  const path = `notes/${noteId}`;
  try {
    await deleteDoc(doc(db, "notes", noteId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// Practice Quiz Submission (+10 XP per correct answer)
export async function submitPracticeAttempt(params: {
  userProfile: UserProfile;
  quiz: PracticeQuiz;
  score: number;
}): Promise<{ xpEarned: number; attemptId: string }> {
  const attemptRef = doc(collection(db, "practiceAttempts"));
  const path = `practiceAttempts/${attemptRef.id}`;
  const cleanScore = Math.max(0, Math.min(5, Math.round(params.score)));
  const xpEarned = cleanScore * 10;

  try {
    const normalized = normalizeUserProfile(params.userProfile);
    const stats = computeNextActivityStats(normalized, {
      xpGain: xpEarned,
      hoursLearnedDelta: 0.25,
      hasPractice: true,
      perfectPractice: cleanScore === 5,
    });

    const batch = writeBatch(db);
    batch.set(attemptRef, {
      id: attemptRef.id,
      userId: normalized.uid,
      quizId: params.quiz.id.slice(0, 80),
      quizTitle: params.quiz.title.slice(0, 120),
      category: params.quiz.category.slice(0, 60),
      score: cleanScore,
      totalQuestions: 5,
      xpEarned,
      createdAt: serverTimestamp(),
    });

    batch.update(doc(db, "users", normalized.uid), {
      city: normalized.city,
      xp: stats.xp,
      streakDays: stats.streakDays,
      lastActiveDate: stats.lastActiveDate,
      hoursLearned: stats.hoursLearned,
      hoursTaught: stats.hoursTaught,
      badges: stats.badges,
      weeklyActivity: stats.weeklyActivity,
      completedExchanges: stats.completedExchanges,
      emailVerified: normalized.emailVerified,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    return { xpEarned, attemptId: attemptRef.id };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function adminCreateSkill(
  adminUid: string,
  skill: { name: string; category: string; description: string }
) {
  const skillRef = doc(collection(db, "skills"));
  const path = `skills/${skillRef.id}`;
  try {
    await setDoc(skillRef, {
      id: skillRef.id,
      name: skill.name.trim().slice(0, SCHEMA_LIMITS.skillNameMax),
      category: skill.category.trim().slice(0, SCHEMA_LIMITS.skillCategoryMax),
      description: skill.description.trim().slice(0, SCHEMA_LIMITS.skillDescMax),
      createdBy: adminUid,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function adminToggleSkillActive(skillId: string, isActive: boolean) {
  const path = `skills/${skillId}`;
  try {
    await updateDoc(doc(db, "skills", skillId), {
      isActive,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function adminDeleteSkill(skillId: string) {
  const path = `skills/${skillId}`;
  try {
    await deleteDoc(doc(db, "skills", skillId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function adminSeedDefaultSkills(adminUid: string) {
  const batch = writeBatch(db);
  try {
    for (const item of DEFAULT_POPULAR_SKILLS) {
      const id = sanitizeId(item.name.toLowerCase().replace(/[^a-z0-9]+/g, "_"));
      batch.set(doc(db, "skills", id), {
        id,
        name: item.name,
        category: item.category,
        description: item.description,
        createdBy: adminUid,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, "skills");
  }
}

export async function adminUpdateReportStatus(reportId: string, status: ReportStatus) {
  const path = `reports/${reportId}`;
  try {
    await updateDoc(doc(db, "reports", reportId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}
