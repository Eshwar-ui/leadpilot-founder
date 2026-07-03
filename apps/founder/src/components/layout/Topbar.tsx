"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Bell, ChevronDown, LogOut, Menu, Users2 } from "lucide-react";
import { org } from "@/lib/mock-data";
import { clearSession, getStoredUser } from "@/lib/auth";
import type { AuthUser } from "@/lib/api";

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const router = useRouter();

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  function handleLogout() {
    clearSession();
    router.push("/login");
  }

  const orgName = user?.org_name ?? org.name;
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
        <span className="hidden text-sm text-slate-400 lg:inline">{org.date}</span>
        <button className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
          <Bell className="size-4" />
        </button>
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
