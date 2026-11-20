import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight,
  Bell,
  BookOpen,
  Compass,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  RefreshCw,
  Shield,
  Sun,
  User as UserIcon,
  X,
} from "lucide-react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { db } from "../lib/firebase";
import { handleFirestoreError, OperationType } from "../lib/firestoreError";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "../lib/firestoreService";
import type {
  AiMatch,
  Conversation,
  ExchangeRequest,
  NotificationItem,
  Review,
  UserProfile,
  WorkspaceTab,
} from "../types/skillswap";
import { AdminPanelView } from "./AdminPanelView";
import { AiLearningAssistantView } from "./AiLearningAssistantView";
import { Avatar } from "./Avatar";
import { ExchangesView } from "./ExchangesView";
import { ExploreAndMatchView } from "./ExploreAndMatchView";
import { MessagesView } from "./MessagesView";
import {
  getNotificationMeta,
  NotificationAlerts,
  NotificationIcon,
} from "./NotificationAlerts";
import { OnboardingModal } from "./OnboardingModal";
import { OverviewDashboard } from "./OverviewDashboard";
import { ProfileView } from "./ProfileView";

interface WorkspaceShellProps {
  initialTab?: WorkspaceTab;
  children?: React.ReactNode;
}

export function WorkspaceShell({
  initialTab = "dashboard",
  children,
}: WorkspaceShellProps = {}) {
  const {
    user,
    profile,
    isAdmin,
    resendVerificationEmail,
    refreshAuthUser,
    logout,
  } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [assistantInitialPrompt, setAssistantInitialPrompt] = useState<string | undefined>(
    undefined
  );

  const [verifyMsg, setVerifyMsg] = useState("");
  const [peers, setPeers] = useState<UserProfile[]>([]);
  const [exchanges, setExchanges] = useState<ExchangeRequest[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [matches, setMatches] = useState<AiMatch[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<NotificationItem[]>([]);
  const [listenerError, setListenerError] = useState<Error | null>(null);
  const seenNotifIdsRef = useRef<Set<string>>(new Set());
  const initializedNotifsRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    seenNotifIdsRef.current = new Set();
    initializedNotifsRef.current = false;
    setActiveAlerts([]);
    setListenerError(null);

    const reportListenerError = (err: unknown, op: OperationType, path: string) => {
      try {
        handleFirestoreError(err, op, path);
      } catch (wrapped) {
        setListenerError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    };

    const qPeers = query(
      collection(db, "users"),
      where("isPublic", "==", true),
      where("isSuspended", "==", false)
    );
    const unsubPeers = onSnapshot(
      qPeers,
      (snap) => setPeers(snap.docs.map((d) => d.data() as UserProfile)),
      (err) => reportListenerError(err, OperationType.LIST, "users")
    );

    const qExchanges = query(
      collection(db, "exchangeRequests"),
      where("participants", "array-contains", user.uid)
    );
    const unsubExchanges = onSnapshot(
      qExchanges,
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as ExchangeRequest)
          .sort(
            (a, b) =>
              (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0)
          );
        setExchanges(list);
      },
      (err) => reportListenerError(err, OperationType.LIST, "exchangeRequests")
    );

    const qConvs = query(
      collection(db, "conversations"),
      where("participantIds", "array-contains", user.uid)
    );
    const unsubConvs = onSnapshot(
      qConvs,
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as Conversation)
          .sort(
            (a, b) =>
              (b.lastMessageAt?.toMillis?.() ?? 0) -
              (a.lastMessageAt?.toMillis?.() ?? 0)
          );
        setConversations(list);
      },
      (err) => reportListenerError(err, OperationType.LIST, "conversations")
    );

    const qMatches = query(collection(db, "matches"), where("userId", "==", user.uid));
    const unsubMatches = onSnapshot(
      qMatches,
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as AiMatch)
          .sort((a, b) => b.compatibilityScore - a.compatibilityScore);
        setMatches(list);
      },
      (err) => reportListenerError(err, OperationType.LIST, "matches")
    );

    const qReviews = query(collection(db, "reviews"), where("isVisible", "==", true));
    const unsubReviews = onSnapshot(
      qReviews,
      (snap) => setReviews(snap.docs.map((d) => d.data() as Review)),
      (err) => reportListenerError(err, OperationType.LIST, "reviews")
    );

    const qNotifs = query(collection(db, "notifications"), where("userId", "==", user.uid));
    const unsubNotifs = onSnapshot(
      qNotifs,
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as NotificationItem)
          .sort(
            (a, b) =>
              (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
          );

        if (!initializedNotifsRef.current) {
          list.forEach((n) => seenNotifIdsRef.current.add(n.id));
          initializedNotifsRef.current = true;
        } else {
          const freshUnread = list.filter(
            (n) => !n.isRead && !seenNotifIdsRef.current.has(n.id)
          );
          list.forEach((n) => seenNotifIdsRef.current.add(n.id));
          if (freshUnread.length > 0) {
            setActiveAlerts((prev) => {
              const existingIds = new Set(prev.map((p) => p.id));
              const merged = [
                ...freshUnread.filter((n) => !existingIds.has(n.id)),
                ...prev,
              ];
              return merged.slice(0, 3);
            });
          }
        }

        setNotifications(list);
      },
      (err) => reportListenerError(err, OperationType.LIST, "notifications")
    );

    return () => {
      unsubPeers();
      unsubExchanges();
      unsubConvs();
      unsubMatches();
      unsubReviews();
      unsubNotifs();
    };
  }, [user?.uid]);

  if (listenerError) {
    throw listenerError;
  }

  useEffect(() => {
    if (activeAlerts.length === 0) return;
    const timer = window.setTimeout(() => {
      setActiveAlerts((prev) => prev.slice(0, -1));
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [activeAlerts]);

  if (!user) return null;

  const pendingIncoming = exchanges.filter(
    (e) => e.status === "pending" && e.toUid === user.uid
  ).length;
  const unreadChats = conversations.filter((c) => c.unreadBy.includes(user.uid)).length;
  const unreadNotifs = notifications.filter((n) => !n.isRead).length;

  const navItems: Array<{
    id: WorkspaceTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "explore", label: "Explore & Match", icon: Compass },
    {
      id: "exchanges",
      label: "Exchanges",
      icon: ArrowLeftRight,
      badge: pendingIncoming || undefined,
    },
    {
      id: "messages",
      label: "Messages",
      icon: MessageSquare,
      badge: unreadChats || undefined,
    },
    { id: "assistant", label: "AI Assistant", icon: BookOpen },
    { id: "profile", label: "Profile & Safety", icon: UserIcon },
  ];

  if (isAdmin) {
    navItems.push({ id: "admin", label: "Admin Console", icon: Shield });
  }

  const activeLabel = navItems.find((n) => n.id === activeTab)?.label || "Dashboard";

  const handleNotificationClick = async (n: NotificationItem) => {
    setActiveAlerts((prev) => prev.filter((a) => a.id !== n.id));
    if (!n.isRead && user.emailVerified) {
      await markNotificationRead(n.id);
    }
    setNotifOpen(false);
    if (n.type === "new_match") {
      setActiveTab("explore");
    } else if (n.type === "new_message" && n.relatedId) {
      setSelectedConversationId(n.relatedId);
      setActiveTab("messages");
    } else if (
      n.type === "exchange_request" ||
      n.type === "exchange_accepted" ||
      n.type === "exchange_completed"
    ) {
      setActiveTab("exchanges");
    } else if (n.type === "new_review") {
      setActiveTab("profile");
    }
  };

  const handleMarkAllRead = async () => {
    if (!user.emailVerified) return;
    const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id);
    setActiveAlerts([]);
    await markAllNotificationsRead(unreadIds);
  };

  if (profile?.isSuspended) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-md w-full p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 text-center">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Account Suspended
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Your account is currently suspended following a Trust & Safety review.
          </p>
          <button
            type="button"
            onClick={logout}
            className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      <OnboardingModal />

      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar (260px) */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-[260px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white font-display">
              SkillSwap
            </span>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  <span className="flex items-center gap-3 whitespace-nowrap">
                    <Icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </span>
                  {item.badge !== undefined && (
                    <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          {profile && (
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar src={profile.photoURL} name={profile.displayName} size="sm" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {profile.displayName}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {profile.country}
                </p>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 h-16 px-4 sm:px-6 lg:px-8 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
              SkillSwap <span aria-hidden="true">/</span>{" "}
              <span className="text-slate-900 dark:text-white font-semibold">
                {activeLabel}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 relative">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setNotifOpen((v) => !v)}
              aria-label="Notifications"
              className="relative p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifs > 0 && (
                <span className="absolute -top-1 -right-1 px-1 min-w-[16px] h-4 rounded-full bg-blue-600 text-white text-[10px] font-mono font-bold flex items-center justify-center tabular-nums">
                  {unreadNotifs}
                </span>
              )}
            </button>

            {profile && (
              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                aria-label="Open profile settings"
                className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
              >
                <Avatar src={profile.photoURL} name={profile.displayName} size="sm" />
                <span className="hidden sm:inline text-xs font-medium text-slate-800 dark:text-slate-200 max-w-[120px] truncate">
                  {profile.displayName}
                </span>
              </button>
            )}

            {notifOpen && (
              <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg p-3 z-50 space-y-2 max-h-96 overflow-y-auto">
                <div className="flex items-center justify-between px-1 pb-2 border-b border-slate-100 dark:border-slate-800 gap-2">
                  <span className="text-xs font-semibold text-slate-900 dark:text-white">
                    Notifications ({unreadNotifs} unread)
                  </span>
                  <div className="flex items-center gap-3">
                    {unreadNotifs > 0 && user.emailVerified && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setNotifOpen(false)}
                      className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      Close
                    </button>
                  </div>
                </div>
                {notifications.length > 0 ? (
                  notifications.slice(0, 12).map((n) => {
                    const meta = getNotificationMeta(n.type);
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => handleNotificationClick(n)}
                        className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors flex items-start gap-2.5 ${
                          n.isRead
                            ? "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400"
                            : "bg-blue-50/70 dark:bg-blue-950/40 text-slate-900 dark:text-white"
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          <NotificationIcon type={n.type} className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="font-medium">{meta.label}</span>
                            {!n.isRead && (
                              <span className="font-semibold text-blue-600 dark:text-blue-400">
                                Unread
                              </span>
                            )}
                          </div>
                          <p className="font-semibold mt-0.5">{n.title}</p>
                          <p className="text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                            {n.body}
                          </p>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
                    No notifications yet. New matches and skill swap requests will alert you here.
                  </p>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {/* Email Verification Gate Banner for Email/Password signups */}
          {!user.emailVerified && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  Verify your email address to activate profile & exchanges
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  We sent a verification link to {user.email}. Click the link in your inbox,
                  then click Refresh Status.
                </p>
                {verifyMsg && (
                  <p className="text-xs font-medium text-amber-950 dark:text-amber-100">
                    {verifyMsg}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={async () => {
                    await resendVerificationEmail();
                    setVerifyMsg("Verification email resent.");
                  }}
                  className="px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-xs font-semibold text-amber-900 dark:text-amber-100"
                >
                  Resend Email
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const verified = await refreshAuthUser();
                    setVerifyMsg(
                      verified
                        ? "Email verified! Setting up your workspace..."
                        : "Still unverified—please check your inbox."
                    );
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh Status
                </button>
              </div>
            </div>
          )}

          <div className="w-full" data-testid="workspace-outlet">
            {children ? (
              children
            ) : (
              <>
                {activeTab === "dashboard" && (
                  <OverviewDashboard
                    peers={peers}
                    exchanges={exchanges}
                    conversations={conversations}
                    matches={matches}
                    reviews={reviews}
                    onNavigate={setActiveTab}
                    onSelectConversation={(id) => setSelectedConversationId(id)}
                  />
                )}

                {activeTab === "explore" && (
                  <ExploreAndMatchView
                    peers={peers}
                    matches={matches}
                    reviews={reviews}
                    onNavigate={setActiveTab}
                    onSelectConversation={(id) => setSelectedConversationId(id)}
                  />
                )}

                {activeTab === "exchanges" && (
                  <ExchangesView
                    exchanges={exchanges}
                    peers={peers}
                    reviews={reviews}
                    onNavigate={setActiveTab}
                    onSelectConversation={(id) => setSelectedConversationId(id)}
                    onPrepExchange={(promptText) => {
                      setAssistantInitialPrompt(promptText);
                      setActiveTab("assistant");
                    }}
                  />
                )}

                {activeTab === "messages" && (
                  <MessagesView
                    conversations={conversations}
                    peers={peers}
                    selectedConversationId={selectedConversationId}
                    onSelectConversation={(id) => setSelectedConversationId(id)}
                  />
                )}

                {activeTab === "assistant" && (
                  <AiLearningAssistantView
                    initialPrompt={assistantInitialPrompt}
                    onClearInitialPrompt={() => setAssistantInitialPrompt(undefined)}
                  />
                )}

                {activeTab === "profile" && (
                  <ProfileView peers={peers} reviews={reviews} />
                )}

                {activeTab === "admin" && <AdminPanelView />}
              </>
            )}
          </div>
        </main>
      </div>

      <NotificationAlerts
        alerts={activeAlerts}
        onDismiss={(id) => setActiveAlerts((prev) => prev.filter((a) => a.id !== id))}
        onOpen={handleNotificationClick}
      />
    </div>
  );
}
