"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, BarChart3, Inbox, Settings, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Mirrors the redesign mockup's nav: one item per group. Old-design routes
// (Manage Team, Comparison/Coaching/Attendance, Kanban Board, Campaigns,
// Insight Feed) still exist on disk and still work if visited directly —
// they're just not part of the navigable product surface. Report Generator
// (Sprint 3) is back with a reduced, honest scope: 4 real report types,
// on-demand preview only — no Campaign ROI (no ad-spend data exists
// anywhere in the schema) and no scheduled email (no email infra exists).
// Budget Guardrails and Integrations are NOT here: both need a real
// Meta/Google Ads API integration this codebase has never built (see the
// campaigns page's own "not yet live" empty state) — a separate, large
// project, not something a redesign pass can honestly fake.
const NAV = [
  {
    section: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutGrid }],
  },
  {
    section: "Telecallers",
    items: [{ label: "Performance Matrix", href: "/dashboard/telecallers/performance", icon: BarChart3 }],
  },
  {
    section: "Leads",
    items: [{ label: "All Leads", href: "/dashboard/leads", icon: Inbox }],
  },
  {
    section: "AI Insights",
    items: [{ label: "Report Generator", href: "/dashboard/insights/reports", icon: FileText }],
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
              <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {group.section}
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
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
                        active ? "bg-primary-50 text-primary-700" : "text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <Icon className="size-4" />
                      {item.label}
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
