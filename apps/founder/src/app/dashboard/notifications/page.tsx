"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { ApiError, notificationsApi, type FounderNotification, type NotificationSeverity } from "@/lib/api";
import { cn } from "@/lib/utils";

type Filter = "all" | "unread" | "leads" | "telecallers";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All activity" },
  { key: "unread", label: "Unread" },
  { key: "leads", label: "Leads" },
  { key: "telecallers", label: "Telecallers" },
];

const severityMeta: Record<NotificationSeverity, { icon: typeof Bell; iconTone: string; edge: string; label: string }> = {
  success: { icon: CheckCircle2, iconTone: "bg-emerald-50 text-emerald-600", edge: "border-l-emerald-500", label: "Update" },
  info: { icon: ClipboardCheck, iconTone: "bg-blue-50 text-blue-600", edge: "border-l-blue-400", label: "Activity" },
  warning: { icon: AlertCircle, iconTone: "bg-amber-50 text-amber-600", edge: "border-l-amber-400", label: "Watch" },
  danger: { icon: AlertTriangle, iconTone: "bg-red-50 text-red-600", edge: "border-l-red-500", label: "Action" },
};

function timeAgo(value: string | null) {
  if (!value) return "Just now";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function notificationGroup(notification: FounderNotification) {
  if (notification.entity_type === "lead") return "leads";
  if (notification.entity_type === "telecaller") return "telecallers";
  return "system";
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<FounderNotification[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    notificationsApi
      .list({ limit: 100 })
      .then((res) => setNotifications(res.notifications))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load notifications"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const unreadCount = notifications.filter((notification) => !notification.read_at).length;
  const filtered = useMemo(() => {
    if (filter === "unread") return notifications.filter((notification) => !notification.read_at);
    if (filter === "leads" || filter === "telecallers") {
      return notifications.filter((notification) => notificationGroup(notification) === filter);
    }
    return notifications;
  }, [filter, notifications]);

  async function markRead(notification: FounderNotification) {
    if (notification.read_at) return;
    try {
      await notificationsApi.markRead(notification.id);
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item));
    } catch {
      // Keep the item visible; the next refresh will retry the read state.
    }
  }

  async function markAllRead() {
    if (!unreadCount) return;
    setMarkingAll(true);
    try {
      await notificationsApi.markAllRead();
      const now = new Date().toISOString();
      setNotifications((current) => current.map((item) => item.read_at ? item : { ...item, read_at: now }));
    } finally {
      setMarkingAll(false);
    }
  }

  function openNotification(notification: FounderNotification) {
    void markRead(notification);
    if (notification.entity_type === "lead" && notification.entity_id) {
      router.push(`/dashboard/leads/detail?id=${notification.entity_id}`);
    } else if (notification.entity_type === "telecaller" && notification.entity_id) {
      router.push(`/dashboard/telecallers/performance/detail?id=${notification.entity_id}`);
    }
  }

  return (
    <div className="pb-10">
      <PageHeader
        title="Notifications"
        description="A live record of pipeline changes and telecaller activity"
        action={
          <>
            <button
              onClick={load}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-white"
            >
              <RefreshCw className="size-3.5" /> Refresh
            </button>
            <button
              onClick={markAllRead}
              disabled={!unreadCount || markingAll}
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check className="size-3.5" /> {markingAll ? "Updating…" : "Mark all read"}
            </button>
          </>
        }
      />

      {error && (
        <div className="mx-4 mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-6 lg:mx-8">
          {error} — <button className="font-semibold underline" onClick={load}>Retry</button>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-4 px-4 sm:px-6 lg:px-8">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
            <div>
              <p className="text-sm font-semibold text-slate-900">Activity stream</p>
              <p className="mt-0.5 text-xs text-slate-400">{unreadCount ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}` : "You’re all caught up"}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setFilter(item.key)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                    filter === item.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-500 hover:bg-slate-50",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="space-y-3 p-5">
              {[1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><Bell className="size-6" /></span>
              <p className="mt-4 text-sm font-semibold text-slate-700">No notifications here</p>
              <p className="mt-1 max-w-sm text-sm text-slate-400">Lead stage moves, attendance, follow-ups, and telecaller activity will appear in this stream as they happen.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((notification) => {
                const meta = severityMeta[notification.severity] ?? severityMeta.info;
                const Icon = meta.icon;
                return (
                  <button
                    key={notification.id}
                    onClick={() => openNotification(notification)}
                    className={cn(
                      "flex w-full items-start gap-4 border-l-4 px-4 py-4 text-left transition-colors hover:bg-slate-50 sm:px-5",
                      meta.edge,
                      notification.read_at ? "bg-white" : "bg-slate-50/70",
                    )}
                  >
                    <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl", meta.iconTone)}><Icon className="size-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{meta.label}</span>
                        <span className="text-[10px] text-slate-300">·</span>
                        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{notification.actor_name ?? "System"}</span>
                        <span className="text-[10px] text-slate-300">·</span>
                        <span className="text-[10px] font-medium text-slate-400">{timeAgo(notification.created_at)}</span>
                      </span>
                      <span className={cn("mt-1 block text-sm leading-snug", notification.read_at ? "font-medium text-slate-700" : "font-bold text-slate-900")}>
                        {notification.title}
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-slate-500">{notification.message}</span>
                    </span>
                    {!notification.read_at && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary-600" aria-label="Unread" />}
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            [CheckCircle2, "Lead outcomes", "Interested, won, lost, and other stage changes"],
            [UserRound, "Team movement", "Check-in, check-out, and assignment activity"],
            [ClipboardCheck, "Work completed", "Follow-ups and logged call activity"],
          ].map(([Icon, title, description]) => {
            const FeatureIcon = Icon as typeof Bell;
            return <Card key={title as string} className="p-4"><FeatureIcon className="size-4 text-slate-400" /><p className="mt-3 text-sm font-semibold text-slate-800">{title as string}</p><p className="mt-1 text-xs leading-relaxed text-slate-500">{description as string}</p></Card>;
          })}
        </div>
      </div>
    </div>
  );
}
