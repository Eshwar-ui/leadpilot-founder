"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, BarChart3, BadgeCheck, Inbox, Settings, FileText, Bell, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Intentionally near-one link per group — Attendance, Coaching, Comparison,
// Manage Team, Pipeline Board, Lead Quality, Budget Wastage, Zombie Leads, and
// Insight Feed are all built and live, just not linked from here. They stay
// reachable by URL; this list is the deliberately short version.
//
// Clients is the exception under Leads: it's a primary surface of its own
// (who is actually a customer, as opposed to where a deal sits in the
// pipeline) and there is no other entry point to it.
const NAV = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutGrid }],
  },
  {
    label: "Telecallers",
    items: [{ label: "Performance Matrix", href: "/dashboard/telecallers/performance", icon: BarChart3 }],
  },
  {
    label: "Leads",
    items: [
      { label: "All Leads", href: "/dashboard/leads", icon: Inbox },
      { label: "Clients", href: "/dashboard/clients", icon: BadgeCheck },
    ],
  },
  {
    label: "AI insights",
    items: [{ label: "Report Generator", href: "/dashboard/insights/reports", icon: FileText }],
  },
  {
    label: "System",
    items: [
      { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
      { label: "Settings", href: "/dashboard/settings", icon: Settings },
    ],
  },
];

const ALL_HREFS = NAV.flatMap((g) => g.items.map((i) => i.href));

// Exact match for "/dashboard" (the root — every other route also starts
// with "/dashboard", so a prefix match here would light up Dashboard on
// every single page). Everything else matches its own sub-pages too, so the
// highlight survives drilling into e.g. All Leads -> Lead Detail or
// Settings -> Organisation Profile instead of going dark.
function matches(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

// LONGEST match wins. The nav now lists sibling routes nested under a parent
// that is itself a nav item (/dashboard/leads/kanban under /dashboard/leads,
// and likewise for Lead Quality), and a plain prefix test lights up BOTH the
// parent and the child — two highlighted rows, with no way to tell which page
// you are actually on. Picking the most specific matching href resolves that,
// while still letting a non-nav drill-down like /dashboard/leads/detail fall
// back to highlighting its nearest listed ancestor.
function isActive(pathname: string, href: string) {
  if (!matches(pathname, href)) return false;
  return !ALL_HREFS.some((other) => other !== href && other.length > href.length && matches(pathname, other));
}

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
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 -translate-x-full flex-col overflow-y-auto border-r border-slate-200 bg-white px-3 py-5 transition-transform duration-200 ease-in-out",
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
        <nav className="flex flex-col gap-4">
          {NAV.map((group) => (
            <div key={group.label}>
              <p className="mb-1 px-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{group.label}</p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} onClick={onClose} className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors", active ? "bg-primary-50 text-primary-700" : "text-slate-600 hover:bg-slate-50")}>
                      <Icon className="size-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* /privacy is the public privacy-policy URL the Play Store listing for
            the telecaller app points at, but nothing in the product linked to
            it — it was reachable only by typing the URL. Anchored to the bottom
            of the sidebar, the conventional place for policy links. */}
        <div className="mt-auto pt-4">
          <Link
            href="/privacy"
            onClick={onClose}
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
          >
            <ShieldCheck className="size-3.5" />
            Privacy Policy
          </Link>
        </div>
      </aside>
    </>
  );
}
