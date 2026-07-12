"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, AlertTriangle, BarChart3, Bell, ChevronDown, ChevronRight, Info, LogOut, Menu, Users2 } from "lucide-react";
import { clearSession, getStoredUser } from "@/lib/auth";
import { markReachable } from "@/lib/connectivity";
import { insightsApi, type AuthUser, type Insight } from "@/lib/api";

const severityMeta: Record<Insight["severity"], { icon: typeof Info; ring: string; text: string; label: string }> = {
  high: { icon: AlertTriangle, ring: "bg-red-50 text-red-600", text: "text-red-600", label: "Critical" },
  medium: { icon: AlertCircle, ring: "bg-amber-50 text-amber-600", text: "text-amber-600", label: "Alert" },
  low: { icon: Info, ring: "bg-blue-50 text-blue-600", text: "text-blue-600", label: "Notice" },
};

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  // Live date, set client-side to avoid a hydration mismatch (was a hardcoded
  // "Tue, 23 Jun 2026" from mock-data.ts).
  const [today, setToday] = useState("");
  const [notifications, setNotifications] = useState<Insight[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    setUser(getStoredUser());
    setToday(
      new Date().toLocaleDateString("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    );
  }, []);

  // Notifications reuse the same rule-based insights the dashboard surfaces —
  // there's no separate notifications endpoint, and these are exactly the
  // "things that need the founder's attention" the bell should show.
  useEffect(() => {
    insightsApi
      .list()
      .then((res) => setNotifications(res.insights))
      .catch(() => setNotifications([]));
  }, []);

  // Close the dropdown on an outside click so it behaves like a normal menu.
  useEffect(() => {
    if (!notifOpen) return;
    function onDown(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [notifOpen]);

  function handleLogout() {
    clearSession();
    // Reachability is a plain module-level flag (see connectivity.ts) that
    // survives navigation, including a full account switch. If it's stuck
    // `false` from something transient right before logout, clear it here so
    // the next account to sign in on this device/tab doesn't inherit a stale
    // "can't reach server" banner.
    markReachable();
    router.push("/login");
  }

  const orgName = user?.org_name ?? "";
  const initials = user
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "RS";

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button
          onClick={onMenuClick}
          aria-label="Open menu"
          className="mr-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 lg:hidden"
        >
          <Menu className="size-5" />
        </button>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-white">
          <BarChart3 className="size-4" />
        </span>
        <span className="truncate text-sm font-bold text-slate-900">LeadPilot</span>
        <span className="hidden shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500 sm:inline">
          Founder
        </span>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <button className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50 sm:px-3">
          <Users2 className="size-4 shrink-0 text-slate-400" />
          <span className="hidden max-w-[10rem] truncate md:inline">{orgName}</span>
          <ChevronDown className="size-3.5 shrink-0 text-slate-400" />
        </button>
        <span className="hidden text-sm text-slate-400 lg:inline">{today}</span>
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((o) => !o)}
            aria-label="Notifications"
            className="relative flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            <Bell className="size-4" />
            {notifications.length > 0 && (
              <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                {notifications.length > 9 ? "9+" : notifications.length}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 z-30 mt-2 w-[22rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">Notifications</span>
                  {notifications.length > 0 && (
                    <span className="rounded-full bg-primary-50 px-1.5 py-0.5 text-[10px] font-bold text-primary-700">
                      {notifications.length}
                    </span>
                  )}
                </div>
              </div>
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                  <span className="flex size-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
                    <Bell className="size-5" />
                  </span>
                  <p className="text-sm font-medium text-slate-500">You&apos;re all caught up</p>
                  <p className="text-xs text-slate-400">New alerts about your pipeline will show up here.</p>
                </div>
              ) : (
                <div className="max-h-[24rem] divide-y divide-slate-50 overflow-auto">
                  {notifications.map((n) => {
                    const meta = severityMeta[n.severity];
                    const Icon = meta.icon;
                    return (
                      <button
                        key={n.id}
                        onClick={() => {
                          setNotifOpen(false);
                          router.push("/dashboard/insights/feed");
                        }}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                      >
                        <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${meta.ring}`}>
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-bold uppercase tracking-wide ${meta.text}`}>{meta.label}</span>
                            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-300">·</span>
                            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{n.category}</span>
                          </span>
                          <span className="mt-0.5 block text-sm font-semibold leading-snug text-slate-900">{n.title}</span>
                          <span className="mt-0.5 line-clamp-2 block text-xs text-slate-500">{n.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              <button
                onClick={() => {
                  setNotifOpen(false);
                  router.push("/dashboard/insights/feed");
                }}
                className="flex w-full items-center justify-center gap-1 border-t border-slate-100 px-4 py-2.5 text-xs font-semibold text-primary-600 transition-colors hover:bg-primary-50"
              >
                View all insights <ChevronRight className="size-3.5" />
              </button>
            </div>
          )}
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">
          {initials}
        </span>
        <button
          onClick={handleLogout}
          title="Log out"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </header>
  );
}
