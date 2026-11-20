import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Ban,
  Flag,
  Loader2,
  MessageSquare,
  Send,
  Shield,
  UserPlus,
  X,
} from "lucide-react";
import {
  collection,
  limit,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../lib/firebase";
import { handleFirestoreError, OperationType } from "../lib/firestoreError";
import {
  markConversationRead,
  sendChatMessage,
  submitReport,
  updatePrivateSettings,
} from "../lib/firestoreService";
import { checkMessageSafety, SCHEMA_LIMITS } from "../lib/validation";
import type {
  ChatMessage,
  Conversation,
  ReportReason,
  UserProfile,
} from "../types/skillswap";
import { Avatar } from "./Avatar";

interface MessagesViewProps {
  conversations: Conversation[];
  peers: UserProfile[];
  selectedConversationId: string | null;
  onSelectConversation: (convId: string) => void;
}

export function MessagesView({
  conversations,
  peers,
  selectedConversationId,
  onSelectConversation,
}: MessagesViewProps) {
  const { profile, profileLoading, privateInfo, isVerified, setNeedsOnboarding } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>("spam");
  const [reportDetails, setReportDetails] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  const blockedSet = useMemo(
    () => new Set(privateInfo?.blockedUserIds || []),
    [privateInfo]
  );

  const activeConversation = useMemo(() => {
    if (!conversations.length) return null;
    if (selectedConversationId) {
      const found = conversations.find((c) => c.id === selectedConversationId);
      if (found) return found;
    }
    return conversations[0];
  }, [conversations, selectedConversationId]);

  const peerId = activeConversation?.participantIds.find((id) => id !== profile?.uid) || "";
  const peerProfile = peers.find((p) => p.uid === peerId);
  const peerName =
    peerProfile?.displayName ||
    (activeConversation && peerId ? activeConversation.participantNames?.[peerId] : "") ||
    "Peer";
  const peerPhoto =
    peerProfile?.photoURL ||
    (activeConversation && peerId ? activeConversation.participantPhotos?.[peerId] : "") ||
    "";
  const isPeerBlocked = Boolean(peerId && blockedSet.has(peerId));

  useEffect(() => {
    if (!activeConversation || !profile) {
      setMessages([]);
      return;
    }

    if (activeConversation.unreadBy.includes(profile.uid) && isVerified) {
      void markConversationRead(activeConversation, profile.uid);
    }

    const path = `conversations/${activeConversation.id}/messages`;
    const q = query(
      collection(db, "conversations", activeConversation.id, "messages"),
      where("participantIds", "array-contains", profile.uid),
      limit(150)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as ChatMessage)
          .sort((a, b) => {
            const ta = a.createdAt?.toMillis?.() ?? 0;
            const tb = b.createdAt?.toMillis?.() ?? 0;
            return ta - tb;
          });
        setMessages(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    );

    return () => unsub();
  }, [activeConversation?.id, profile?.uid]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (profileLoading) {
    return (
      <div className="p-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-blue-600 dark:text-blue-400" />
        <p className="text-sm text-slate-600 dark:text-slate-300">Loading messages...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Create your profile to start messaging
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Set up your SkillSwap profile first so peers know who they are chatting with.
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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversation || isPeerBlocked) return;
    setErrorMsg("");

    if (!isVerified) {
      setErrorMsg("Verify your email address before sending messages.");
      return;
    }

    const safety = checkMessageSafety(draft);
    if (!safety.ok) {
      setErrorMsg(safety.reason || "Message blocked by safety filter.");
      return;
    }

    setSending(true);
    try {
      const textToSend = draft;
      setDraft("");
      await sendChatMessage(activeConversation, profile, textToSend);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!privateInfo || !peerId) return;
    const nextBlocked = isPeerBlocked
      ? privateInfo.blockedUserIds.filter((id) => id !== peerId)
      : [...privateInfo.blockedUserIds, peerId];

    await updatePrivateSettings(profile.uid, {
      email: privateInfo.email,
      blockedUserIds: nextBlocked,
      allowMessagesFrom: privateInfo.allowMessagesFrom,
      emailNotifications: privateInfo.emailNotifications,
    });
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!peerId || reportDetails.trim().length < SCHEMA_LIMITS.reportDetailsMin) return;
    await submitReport({
      reporterId: profile.uid,
      reportedUid: peerId,
      reason: reportReason,
      details: reportDetails,
    });
    setReportOpen(false);
    setReportDetails("");
    setErrorMsg("Safety report submitted.");
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Messages
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Real-time peer-to-peer chat with spam protection, unread tracking, and safety controls.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 min-h-[540px]">
        {/* Conversation List */}
        <aside className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto max-h-[540px]">
          {conversations.length > 0 ? (
            conversations.map((conv) => {
              const cidPeer = conv.participantIds.find((id) => id !== profile.uid) || "";
              const cName =
                peers.find((p) => p.uid === cidPeer)?.displayName ||
                conv.participantNames?.[cidPeer] ||
                "Peer";
              const cPhoto =
                peers.find((p) => p.uid === cidPeer)?.photoURL ||
                conv.participantPhotos?.[cidPeer] ||
                "";
              const isSelected = activeConversation?.id === conv.id;
              const unread = conv.unreadBy.includes(profile.uid);

              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => onSelectConversation(conv.id)}
                  className={`w-full text-left p-4 flex items-center gap-3 transition-colors ${
                    isSelected
                      ? "bg-blue-50/80 dark:bg-blue-950/30"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <Avatar src={cPhoto} name={cName} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {cName}
                      </span>
                      {unread && (
                        <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 shrink-0">
                          New
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {conv.lastMessage || "No messages yet"}
                    </p>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="p-8 text-center space-y-2">
              <MessageSquare className="w-6 h-6 text-slate-400 mx-auto" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                No conversations yet
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Start chatting with a peer from Explore or Exchanges.
              </p>
            </div>
          )}
        </aside>

        {/* Thread Viewport */}
        <section className="lg:col-span-8 flex flex-col justify-between h-[540px]">
          {activeConversation ? (
            <>
              <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar src={peerPhoto} name={peerName} size="sm" />
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {peerName}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      <span>Safe messaging active</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReportOpen(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    Report
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleBlock}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${
                      isPeerBlocked
                        ? "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300"
                        : "border-red-200 text-red-600 dark:border-red-900 dark:text-red-400"
                    }`}
                  >
                    <Ban className="w-3.5 h-3.5" />
                    {isPeerBlocked ? "Unblock" : "Block"}
                  </button>
                </div>
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50/50 dark:bg-slate-950/40">
                {messages.length === 0 ? (
                  <p className="text-xs text-center text-slate-500 dark:text-slate-400 py-8">
                    Send the first message to coordinate your skill exchange schedule.
                  </p>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.senderId === profile.uid;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[78%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                            isMine
                              ? "bg-blue-600 text-white"
                              : "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={endRef} />
              </div>

              {/* Composer */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                {errorMsg && (
                  <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}
                {isPeerBlocked ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    You have blocked this peer. Unblock them to resume messaging.
                  </p>
                ) : (
                  <form onSubmit={handleSend} className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={SCHEMA_LIMITS.chatTextMax}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Write a message (no spam or excessive links)..."
                      className="flex-1 px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <button
                      type="submit"
                      disabled={sending || !draft.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      <span className="hidden sm:inline">Send</span>
                    </button>
                  </form>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Select a conversation on the left or message a peer from Explore.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Report Modal */}
      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Report {peerName}
              </h3>
              <button type="button" onClick={() => setReportOpen(false)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleReportSubmit} className="space-y-4">
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value as ReportReason)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                <option value="spam">Spam</option>
                <option value="harassment">Harassment</option>
                <option value="inappropriate_content">Inappropriate content</option>
                <option value="fake_profile">Fake profile</option>
                <option value="other">Other</option>
              </select>
              <textarea
                rows={3}
                required
                minLength={5}
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Describe what happened..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  className="px-4 py-2 text-xs text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold"
                >
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
