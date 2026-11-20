import {
  ArrowLeftRight,
  Bell,
  MessageSquare,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import type { NotificationItem, NotificationType } from "../types/skillswap";

interface NotificationAlertsProps {
  alerts: NotificationItem[];
  onDismiss: (id: string) => void;
  onOpen: (notification: NotificationItem) => void;
}

export function getNotificationMeta(type: NotificationType): {
  label: string;
  actionLabel: string;
} {
  switch (type) {
    case "new_match":
      return { label: "New AI Match", actionLabel: "View matches" };
    case "exchange_request":
      return { label: "Swap Request", actionLabel: "Review request" };
    case "exchange_accepted":
      return { label: "Swap Accepted", actionLabel: "Open exchanges" };
    case "exchange_completed":
      return { label: "Swap Completed", actionLabel: "Leave review" };
    case "new_message":
      return { label: "New Message", actionLabel: "Open chat" };
    case "new_review":
      return { label: "New Review", actionLabel: "View profile" };
    default:
      return { label: "Update", actionLabel: "View" };
  }
}

export function NotificationIcon({
  type,
  className = "w-4 h-4",
}: {
  type: NotificationType;
  className?: string;
}) {
  switch (type) {
    case "new_match":
      return <Sparkles className={`${className} text-blue-600 dark:text-blue-400`} />;
    case "exchange_request":
    case "exchange_accepted":
    case "exchange_completed":
      return <ArrowLeftRight className={`${className} text-emerald-600 dark:text-emerald-400`} />;
    case "new_message":
      return <MessageSquare className={`${className} text-blue-600 dark:text-blue-400`} />;
    case "new_review":
      return <Star className={`${className} text-amber-600 dark:text-amber-400`} />;
    default:
      return <Bell className={`${className} text-slate-600 dark:text-slate-400`} />;
  }
}

export function NotificationAlerts({
  alerts,
  onDismiss,
  onOpen,
}: NotificationAlertsProps) {
  if (alerts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="In-app notifications"
      className="fixed bottom-4 right-4 z-50 w-full max-w-sm space-y-2.5 px-4 sm:px-0 pointer-events-none"
    >
      {alerts.map((alert) => {
        const meta = getNotificationMeta(alert.type);
        return (
          <div
            key={alert.id}
            role="status"
            className="pointer-events-auto p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg flex items-start gap-3"
          >
            <div className="mt-0.5 shrink-0">
              <NotificationIcon type={alert.type} className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                {meta.label}
              </p>
              <p className="text-xs font-semibold text-slate-900 dark:text-white leading-snug">
                {alert.title}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                {alert.body}
              </p>
              <button
                type="button"
                onClick={() => onOpen(alert)}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline pt-0.5"
              >
                {meta.actionLabel} →
              </button>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(alert.id)}
              aria-label="Dismiss notification"
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
