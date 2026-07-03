"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Users,
  BarChart3,
  ArrowLeftRight,
  Clock,
  Kanban,
  Target,
  Megaphone,
  Filter,
  UserX,
  Sparkles,
  FileText,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  {
    section: "Overview",
    items: [
      { label: "Daily Snapshot", href: "/dashboard", icon: LayoutGrid },
      { label: "Manage Team", href: "/dashboard/team", icon: Users },
    ],
  },
  {
    section: "Telecallers",
    items: [
      { label: "Performance Matrix", href: "/dashboard/telecallers/performance", icon: BarChart3 },
      { label: "Comparison", href: "/dashboard/telecallers/comparison", icon: ArrowLeftRight },
      { label: "Attendance", href: "/dashboard/telecallers/attendance", icon: Clock },
    ],
  },
  {
    section: "Leads",
    items: [
      { label: "Kanban Board", href: "/dashboard/leads/kanban", icon: Kanban },
      { label: "Lead Quality", href: "/dashboard/leads/quality", icon: Target },
    ],
  },
  {
    section: "Campaigns",
    items: [{ label: "Campaign Overview", href: "/dashboard/campaigns", icon: Megaphone }],
  },
  {
    section: "Leakage",
    dot: true,
    items: [
      { label: "Lead Wastage", href: "/dashboard/leakage/wastage", icon: Filter },
      { label: "Zombie Leads", href: "/dashboard/leakage/zombie", icon: UserX },
    ],
  },
  {
    section: "AI Insights",
    items: [
      { label: "Insight Feed", href: "/dashboard/insights/feed", icon: Sparkles, live: true },
      { label: "Report Generator", href: "/dashboard/insights/reports", icon: FileText },
    ],
  },
  {
    section: "System",
    items: [{ label: "Settings", href: "/dashboard/settings", icon: Settings }],
  },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 -translate-x-full flex-col overflow-y-auto border-r border-slate-200 bg-white px-4 py-5 transition-transform duration-200 ease-in-out",
          "lg:static lg:z-auto lg:translate-x-0",
          open && "translate-x-0"
        )}
      >
        <button
          onClick={onClose}
          aria-label="Close menu"
          className="mb-4 flex items-center justify-end text-slate-400 hover:text-slate-600 lg:hidden"
        >
          <X className="size-5" />
        </button>
        <nav className="flex flex-1 flex-col gap-5">
          {NAV.map((group) => (
            <div key={group.section}>
              <div className="mb-1.5 flex items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {group.section}
                {group.dot && <span className="size-1.5 rounded-full bg-red-400" />}
              </div>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
                        active ? "bg-primary-50 text-primary-700" : "text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon className="size-4" />
                        {item.label}
                      </span>
                      {"live" in item && item.live && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          Live
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
