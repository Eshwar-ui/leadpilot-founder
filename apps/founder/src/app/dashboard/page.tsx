"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Filter, Layers, Trophy, Activity, Download, CheckCircle2, FileText, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DateRangePicker, type DateRange } from "@/components/ui/DateRangePicker";
import { Skeleton, SkeletonTableRow } from "@/components/ui/Skeleton";
import { RevenueChart } from "@/components/charts/RevenueChart";
import {
  ApiError,
  dashboardApi,
  leadsApi,
  insightsApi,
  telecallersApi,
  type ActivityEvent,
  type BoardLead,
  type DashboardGoal,
  type DashboardRevenue,
  type DashboardSnapshot,
  type Insight,
  type TeamHealthEntry,
} from "@/lib/api";
import { cn, formatLakhs } from "@/lib/utils";

const activityToneDot: Record<string, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  info: "bg-blue-500",
  danger: "bg-red-500",
};

const activityToneBorder: Record<string, string> = {
  success: "border-l-emerald-400",
  warning: "border-l-amber-400",
  info: "border-l-blue-400",
  danger: "border-l-red-400",
};

const teamStatusDot: Record<string, string> = {
  Active: "bg-emerald-500",
  Break: "bg-amber-500",
  Inactive: "bg-red-500",
  Absent: "bg-slate-400",
};

const teamStatusBorder: Record<string, string> = {
  Active: "border-l-emerald-400",
  Break: "border-l-amber-400",
  Inactive: "border-l-red-400",
  Absent: "border-l-slate-300",
};

// The 6 stages a lead sits in while still open — everything short of a
// terminal Closed Won / Closed Lost / Junk outcome. Mirrors the backend's
// own ACTIVE_QUEUE_STAGES (app/api/dashboard.py) so "In progress" here can
// never disagree with what the live-activity idle check considers "active".
const ACTIVE_STAGES = ["New", "Assigned", "Contacted", "Interested", "Proposal Sent", "Negotiation"];

// The stages worth putting in front of a founder who has no revenue yet this
// month: leads that are alive and workable RIGHT NOW. Proposal Sent and
// Negotiation are deliberately excluded — they're already in flight and
// waiting on the other side, so they aren't the ones that need picking up.
const LIVE_STAGES = ["New", "Assigned", "Contacted", "Interested"];

const LIVE_LEAD_LIMIT = 10;

const liveStagePill: Record<string, string> = {
  New: "bg-blue-50 text-blue-700",
  Assigned: "bg-slate-100 text-slate-600",
  Contacted: "bg-slate-100 text-slate-600",
  Interested: "bg-emerald-50 text-emerald-700",
};

const REVENUE_RANGES = [1, 7, 30, 90] as const;
const RANGE_LABEL: Record<number, string> = { 1: "1D", 7: "7D", 30: "30D", 90: "90D" };

// Telecaller call quality is a /110 composite — 5 skill dimensions x 20pts plus
// punctuality x 10pts (DEBRIEF_DIMENSIONS / averaged_debrief_dimensions in the
// backend), the same denominator the Performance Matrix and Comparison pages
// already print. This card used to say "/ 100", which made every telecaller
// look ~10% worse than they are. The founder-facing "80 bar" was written for
// the old /100 scale, so it's re-derived proportionally (80% of 110 = 88)
// rather than left at a literal 80 — on the real scale a bar of 80 would be
// 73%, i.e. a quietly *lower* standard than the copy promises.
const QUALITY_MAX = 110;
const QUALITY_BAR = Math.round(QUALITY_MAX * 0.8);

// A failed fetch must never render as a number. `String(snapshot?.total_leads ?? 0)`
// put a confident "0" next to the red error strip, which reads as a real (and
// catastrophic) figure rather than "we don't know". Em-dash means unknown.
function statValue(loading: boolean, failed: boolean, value: () => string) {
  if (loading) return <Skeleton className="h-6 w-12" />;
  return failed ? "—" : value();
}

function timeAgo(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// Activity event ids are synthetic ("deal-{lead.id}", "hot-{call_id}",
// "idle-{telecaller.id}" — see get_dashboard_activity in the backend) rather
// than a dedicated target field, so the CTA button routes by parsing the
// prefix instead of the API growing a new column just for a link.
function activityHref(id: string): string | null {
  if (id.startsWith("deal-")) return `/dashboard/leads/detail?id=${id.slice("deal-".length)}`;
  if (id.startsWith("hot-")) return `/dashboard/calls/detail?id=${id.slice("hot-".length)}`;
  if (id.startsWith("idle-")) return `/dashboard/telecallers/performance/detail?id=${id.slice("idle-".length)}`;
  return null;
}

function groupByStage(leads: BoardLead[]) {
  const counts: Record<string, number> = {};
  for (const lead of leads) counts[lead.pipeline_stage] = (counts[lead.pipeline_stage] ?? 0) + 1;
  return counts;
}

export default function DashboardPage() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialised client-side (matches attendance/performance pages' own
  // pattern) to avoid an SSR/client Date hydration mismatch.
  const [snapshotRange, setSnapshotRange] = useState<DateRange | null>(null);
  useEffect(() => {
    const now = new Date();
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    setSnapshotRange({ start: iso(start), end: iso(now) });
  }, []);

  const [board, setBoard] = useState<BoardLead[] | null>(null);
  const [boardLoading, setBoardLoading] = useState(true);
  const [boardError, setBoardError] = useState<string | null>(null);

  const [range, setRange] = useState<(typeof REVENUE_RANGES)[number]>(30);
  const [revenue, setRevenue] = useState<DashboardRevenue | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [revenueError, setRevenueError] = useState<string | null>(null);

  const [goal, setGoal] = useState<DashboardGoal | null>(null);
  const [goalLoading, setGoalLoading] = useState(true);
  const [goalError, setGoalError] = useState<string | null>(null);

  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);
  // Set when a *poll* fails after we already have a good list on screen — the
  // feed keeps rendering, we just stop claiming it's live. See loadActivity().
  const [activityStale, setActivityStale] = useState(false);
  const activityLoadedRef = useRef(false);

  const [teamStatus, setTeamStatus] = useState<TeamHealthEntry[]>([]);
  const [teamStatusLoading, setTeamStatusLoading] = useState(true);
  const [teamStatusError, setTeamStatusError] = useState<string | null>(null);

  const [topInsight, setTopInsight] = useState<Insight | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  function load() {
    if (!snapshotRange) return;
    setLoading(true);
    setError(null);
    dashboardApi
      .snapshot(snapshotRange)
      .then(setSnapshot)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load dashboard snapshot"))
      .finally(() => setLoading(false));
  }

  function loadBoard() {
    setBoardLoading(true);
    setBoardError(null);
    leadsApi
      .board()
      .then((res) => setBoard(res.leads))
      .catch((e) => {
        // Swallowing this used to strand the Pipeline card: board stayed null,
        // the render guard was `boardLoading || !stageCounts`, and six skeleton
        // bars shimmered forever with no error text and no way to retry.
        setBoard(null);
        setBoardError(e instanceof ApiError ? e.message : "Failed to load the pipeline");
      })
      .finally(() => setBoardLoading(false));
  }

  function loadRevenue(r: (typeof REVENUE_RANGES)[number]) {
    setRevenueLoading(true);
    setRevenueError(null);
    dashboardApi
      .revenue(r)
      .then(setRevenue)
      .catch((e) => setRevenueError(e instanceof ApiError ? e.message : "Failed to load revenue"))
      .finally(() => setRevenueLoading(false));
  }

  function loadGoal() {
    setGoalLoading(true);
    setGoalError(null);
    dashboardApi
      .goal()
      .then(setGoal)
      .catch((e) => {
        setGoal(null);
        setGoalError(e instanceof ApiError ? e.message : "Failed to load the monthly goal");
      })
      .finally(() => setGoalLoading(false));
  }

  function loadActivity() {
    // Called by the 30s poll as well as on mount. Two things it must NOT do on a
    // refresh: flip the skeleton back on (which wiped the whole feed and
    // reflowed the card every 30 seconds), or throw away a good list because one
    // poll blipped. So the skeleton is reserved for the first load, and a later
    // failure only raises the non-destructive `activityStale` flag.
    if (!activityLoadedRef.current) setActivityLoading(true);
    dashboardApi
      .activity()
      .then((res) => {
        setActivity(res.events);
        setActivityError(null);
        setActivityStale(false);
        activityLoadedRef.current = true;
      })
      .catch((e) => {
        const message = e instanceof ApiError ? e.message : "Failed to load live activity";
        if (activityLoadedRef.current) setActivityStale(true);
        else setActivityError(message);
      })
      .finally(() => setActivityLoading(false));
  }

  function loadTeamStatus() {
    setTeamStatusLoading(true);
    setTeamStatusError(null);
    telecallersApi
      .status()
      .then((res) => setTeamStatus(res.telecallers))
      .catch((e) => setTeamStatusError(e instanceof ApiError ? e.message : "Failed to load team status"))
      .finally(() => setTeamStatusLoading(false));
  }

  function loadTopInsight() {
    setInsightsLoading(true);
    setInsightsError(null);
    const severityRank: Record<Insight["severity"], number> = { high: 0, medium: 1, low: 2 };
    insightsApi
      .list()
      .then((res) => {
        const sorted = [...res.insights].sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
        setTopInsight(sorted[0] ?? null);
      })
      .catch((e) => {
        // Silently nulling this was the worst kind of failure: a missing
        // critical-alert banner is indistinguishable from "nothing is wrong".
        setTopInsight(null);
        setInsightsError(e instanceof ApiError ? e.message : "Failed to check for alerts");
      })
      .finally(() => setInsightsLoading(false));
  }

  useEffect(load, [snapshotRange]);
  useEffect(loadBoard, []);
  useEffect(() => loadRevenue(range), [range]);
  useEffect(loadGoal, []);
  useEffect(loadTopInsight, []);
  useEffect(loadTeamStatus, []);
  useEffect(() => {
    loadActivity();
    const id = setInterval(loadActivity, 30_000);
    return () => clearInterval(id);
  }, []);

  const stageCounts = board ? groupByStage(board) : null;
  const inProgress = stageCounts ? ACTIVE_STAGES.reduce((s, stage) => s + (stageCounts[stage] ?? 0), 0) : null;
  const maxStageCount = stageCounts ? Math.max(1, ...Object.values(stageCounts)) : 1;

  // "No revenue yet this month" is a claim about the org's numbers, so it is
  // only ever made off a revenue fetch that actually SUCCEEDED. On a failed
  // fetch `revenue` is null and mtd_total is unknown — reordering the whole
  // dashboard then would tell the founder they've sold nothing at the one
  // moment the app cannot know that. Same reasoning as `statValue` above.
  const noRevenueThisMonth =
    !revenueLoading && !revenueError && revenue != null && revenue.mtd_total === 0;

  // Freshest workable leads first: everything still in a live stage, New
  // before the rest, then most-recently-touched. Built from the board data
  // the page already fetches — no extra request.
  const liveLeads = board
    ? [...board]
        .filter((l) => LIVE_STAGES.includes(l.pipeline_stage))
        .sort((a, b) => {
          const aNew = a.pipeline_stage === "New" ? 0 : 1;
          const bNew = b.pipeline_stage === "New" ? 0 : 1;
          if (aNew !== bNew) return aNew - bNew;
          return a.days_stuck - b.days_stuck;
        })
    : null;
  const activeTelecallers = teamStatus.filter((t) => t.status === "Active").length;
  const teamCalls = teamStatus.reduce((sum, t) => sum + t.calls, 0);
  const teamConnectRate = teamCalls ? Math.round((teamStatus.reduce((sum, t) => sum + t.connected, 0) / teamCalls) * 100) : 0;
  const teamQuality = teamStatus.length ? Math.round(teamStatus.reduce((sum, t) => sum + t.quality, 0) / teamStatus.length) : 0;

  // Every number above collapses to 0 while the fetch is in flight, after it
  // fails, and for an org with no telecallers — three states that look identical
  // to "your team scored zero". `hasTeam` is the single gate that decides
  // whether the tiles below are allowed to assert anything at all.
  const hasTeam = !teamStatusLoading && !teamStatusError && teamStatus.length > 0;
  const teamNoteFallback = teamStatusError
    ? "Team status unavailable"
    : teamStatusLoading
      ? "Loading team status"
      : "No telecallers on this team yet";
  const teamTiles: { label: string; value: string; note: string }[] = [
    {
      label: "On the phones now",
      value: hasTeam ? `${activeTelecallers} / ${teamStatus.length}` : "—",
      note: hasTeam ? `${teamStatus.length - activeTelecallers} away or inactive` : teamNoteFallback,
    },
    {
      label: "Calls made today",
      value: hasTeam ? String(teamCalls) : "—",
      note: hasTeam ? "Across the whole team" : teamNoteFallback,
    },
    {
      label: "Average connect rate",
      value: hasTeam ? `${teamConnectRate}%` : "—",
      note: hasTeam ? "Across calls attempted" : teamNoteFallback,
    },
    {
      label: "Average call quality",
      value: hasTeam ? `${teamQuality} / ${QUALITY_MAX}` : `— / ${QUALITY_MAX}`,
      note: hasTeam
        ? teamQuality >= QUALITY_BAR
          ? `Meeting your ${QUALITY_BAR} bar`
          : `Below your ${QUALITY_BAR} bar`
        : teamNoteFallback,
    },
  ];

  function exportSnapshotCsv() {
    const header = ["Telecaller", "Status", "Calls", "Connected", "Closed", "Quality", "Revenue Today", "Trend"];
    const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const rows = teamStatus.map((t) =>
      [t.name, t.status, t.calls, t.connected, t.closed_won, t.quality, t.revenue_today, t.trend]
        .map((c) => escape(String(c)))
        .join(",")
    );
    const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "team-health-snapshot.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="pb-10">
      <PageHeader
        title="Dashboard"
        description="A clear view of your lead flow, team output and revenue."
        action={
          <>
            {snapshotRange && <DateRangePicker value={snapshotRange} onChange={setSnapshotRange} />}
            <Button size="sm" onClick={exportSnapshotCsv}><Download className="size-3.5" /> Export</Button>
          </>
        }
      />

      {!insightsLoading && topInsight && (
        <div className="mt-4 px-4 sm:px-6 lg:px-8">
          <AlertBanner
            key={topInsight.id}
            label={topInsight.severity === "high" ? "Critical Alert" : topInsight.severity === "medium" ? "Alert" : "Notice"}
            message={`${topInsight.title} — ${topInsight.description}`}
            cta="View Details"
            href="/dashboard/insights/feed"
          />
        </div>
      )}

      {insightsError && (
        <div
          role="alert"
          className="mt-4 mx-4 sm:mx-6 lg:mx-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          Couldn&apos;t check for alerts — {insightsError}{" "}
          <button className="font-semibold underline" onClick={loadTopInsight}>
            Retry
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-4 mx-4 sm:mx-6 lg:mx-8 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error} —{" "}
          <button className="font-semibold underline" onClick={load}>
            Retry
          </button>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 px-4 sm:px-6 lg:px-8 lg:grid-cols-4">
        <StatCard
          label="Total Leads"
          value={statValue(loading, !!error, () => String(snapshot?.total_leads ?? 0))}
          suffix="all sources"
          icon={Filter}
        />
        <StatCard
          label={snapshot?.ranged ? "New leads" : "New today"}
          value={statValue(loading, !!error, () => String(snapshot?.leads_today ?? 0))}
          icon={CheckCircle2}
        />
        <StatCard
          label="In Progress"
          value={statValue(boardLoading, !!boardError, () => String(inProgress ?? 0))}
          note={
            boardError
              ? "Pipeline unavailable"
              : hasTeam
                ? `${teamStatus.length} telecallers assigned`
                : undefined
          }
          noteTone={boardError ? "warning" : "neutral"}
          icon={Layers}
        />
        <StatCard
          label="Closed Deals"
          value={statValue(goalLoading, !!goalError, () => String(goal?.deals_closed ?? 0))}
          suffix="this month"
          note={
            goalError
              ? "Monthly goal unavailable"
              : goal?.pct_of_target != null
                ? `${goal.pct_of_target}% of monthly target`
                : undefined
          }
          noteTone={goalError ? "warning" : "neutral"}
          icon={Trophy}
        />
      </div>

      {/* No revenue booked this month yet — the useful thing to show a founder
          is not an empty chart, it's the leads they can still act on. The
          revenue card keeps its place below, just demoted for now. */}
      {noRevenueThisMonth && (
        <div className="mt-6 px-4 sm:px-6 lg:px-8">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Sparkles className="size-4 text-primary-600" /> Live &amp; New Leads
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  No revenue booked this month yet — these are the leads still open and worth working.
                </p>
              </div>
              <Link href="/dashboard/leads?stage=New" className="text-xs font-semibold text-primary-600 hover:underline">
                VIEW ALL
              </Link>
            </div>

            {boardLoading ? (
              <div className="flex flex-col gap-2 px-5 pb-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} block className="h-10 w-full" />
                ))}
              </div>
            ) : boardError || !liveLeads ? (
              <p role="alert" className="px-5 pb-6 text-center text-xs text-red-600">
                {boardError ?? "Couldn't load your leads"} —{" "}
                <button className="font-semibold underline" onClick={loadBoard}>
                  Retry
                </button>
              </p>
            ) : liveLeads.length === 0 ? (
              <p className="px-5 pb-6 text-center text-sm text-slate-600">
                No open leads right now.{" "}
                <Link href="/dashboard/leads" className="font-semibold text-primary-600 underline">
                  Add one
                </Link>{" "}
                to get the pipeline moving.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        <th className="px-5 py-2.5">Lead</th>
                        <th className="px-3 py-2.5">Stage</th>
                        <th className="px-3 py-2.5">Source</th>
                        <th className="px-3 py-2.5">Owner</th>
                        <th className="px-5 py-2.5">Last Update</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {liveLeads.slice(0, LIVE_LEAD_LIMIT).map((l) => (
                        <tr
                          key={l.id}
                          onClick={() => router.push(`/dashboard/leads/detail?id=${l.id}`)}
                          className="cursor-pointer hover:bg-slate-50"
                        >
                          <td className="px-5 py-3">
                            <Link
                              href={`/dashboard/leads/detail?id=${l.id}`}
                              className="block font-medium text-slate-900 hover:text-primary-600"
                            >
                              {l.name}
                            </Link>
                            {l.phone && <span className="block text-xs text-slate-600">{l.phone}</span>}
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-xs font-medium",
                                liveStagePill[l.pipeline_stage] ?? "bg-slate-100 text-slate-600"
                              )}
                            >
                              {l.pipeline_stage}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-slate-500">{l.source || "\u2014"}</td>
                          <td className="px-3 py-3 text-slate-500">{l.telecaller_name || "Unassigned"}</td>
                          <td className="px-5 py-3 font-mono text-xs text-slate-600">
                            {l.days_stuck === 0 ? "Today" : `${l.days_stuck}d ago`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {liveLeads.length > LIVE_LEAD_LIMIT && (
                  <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-600">
                    Showing the {LIVE_LEAD_LIMIT} freshest of {liveLeads.length} open leads —{" "}
                    <Link href="/dashboard/leads" className="font-semibold text-primary-600 underline">
                      see them all
                    </Link>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex flex-col gap-4 p-5 pb-0 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Revenue — {range === 1 ? "Today" : `${range} Days`}
              </h3>
              <p className="mt-1 flex items-baseline gap-1 font-mono text-2xl font-bold text-primary-600">
                {/* ₹0 above an error message is a lie the founder can act on —
                    "no revenue this month" and "we couldn't fetch it" are very
                    different facts. Same for Avg/Day and Best Day below. */}
                {statValue(revenueLoading, !!revenueError, () => formatLakhs(revenue?.mtd_total ?? 0))}{" "}
                <span className="text-sm font-medium text-slate-500">MTD</span>
              </p>
              {revenueError ? null : revenue?.pct_change_vs_last_month != null ? (
                <p
                  className={cn(
                    "text-xs font-medium",
                    revenue.pct_change_vs_last_month >= 0 ? "text-emerald-600" : "text-red-600"
                  )}
                >
                  {revenue.pct_change_vs_last_month >= 0 ? "↗" : "↘"} {revenue.pct_change_vs_last_month >= 0 ? "+" : ""}
                  {revenue.pct_change_vs_last_month}% vs last mo
                </p>
              ) : (
                <p className="text-xs text-slate-600">No revenue recorded last month to compare</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 sm:text-right">
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-600">Avg / Day</p>
                <p className="font-mono text-sm font-bold text-slate-900">
                  {statValue(revenueLoading, !!revenueError, () => formatLakhs(revenue?.avg_per_day ?? 0))}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-600">Best Day</p>
                <p className="font-mono text-sm font-bold text-emerald-600">
                  {statValue(revenueLoading, !!revenueError, () => formatLakhs(revenue?.best_day?.revenue ?? 0))}
                </p>
              </div>
              <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs" role="group" aria-label="Revenue range">
                {REVENUE_RANGES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    aria-pressed={r === range}
                    className={cn(
                      "rounded-md px-2 py-1 font-medium",
                      r === range ? "bg-primary-600 text-white" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    {RANGE_LABEL[r]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="px-2 pb-2">
            {revenueError ? (
              <p role="alert" className="px-3 py-10 text-center text-sm text-red-600">
                {revenueError}{" "}
                <button className="font-semibold underline" onClick={() => loadRevenue(range)}>
                  Retry
                </button>
              </p>
            ) : revenueLoading ? (
              <Skeleton className="h-56 w-full rounded-xl" />
            ) : (
              <RevenueChart data={revenue?.series ?? []} targetPerDay={revenue?.target_per_day ?? null} />
            )}
          </div>
          <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-primary-600" /> Actual revenue</span>
              {revenue?.target_per_day != null && (
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 border-t-2 border-dashed border-amber-500" /> Target {formatLakhs(revenue.target_per_day)}/day
                </span>
              )}
            </div>
            {/* Don't advise "set a monthly target" when we simply failed to read
                the revenue response — the founder may already have one set. */}
            {revenueError ? null : revenue?.on_target_days != null ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>Working days <b className="text-slate-900">{revenue.working_days_elapsed}/{revenue.days_in_month}</b></span>
                <span>On-target days <b className="text-slate-900">{revenue.on_target_days}</b></span>
                <span>Off-target days <b className="text-slate-900">{revenue.off_target_days}</b></span>
              </div>
            ) : (
              <span>Set a monthly target in Settings to see on-target tracking</span>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Layers className="size-4 text-primary-600" /> Pipeline
            </h3>
            <Link href="/dashboard/leads/kanban" className="text-xs font-semibold text-primary-600 hover:underline">
              VIEW ALL
            </Link>
          </div>
          <div className="mt-4 flex flex-col gap-2.5">
            {/* The shimmer is for `boardLoading` ONLY. It used to also cover
                `!stageCounts`, which is the exact state a failed fetch leaves
                behind — so a board error shimmered six placeholder bars forever
                with no error text and no retry. */}
            {boardLoading ? (
              Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} block className="h-5 w-full" />)
            ) : boardError || !stageCounts ? (
              <p role="alert" className="py-6 text-center text-xs text-red-600">
                {boardError ?? "Couldn't load the pipeline"} —{" "}
                <button className="font-semibold underline" onClick={loadBoard}>
                  Retry
                </button>
              </p>
            ) : (
              ACTIVE_STAGES.concat(["Closed Won"]).map((stage) => {
                const count = stageCounts[stage] ?? 0;
                const isWon = stage === "Closed Won";
                return (
                  <Link
                    key={stage}
                    href="/dashboard/leads/kanban"
                    className="flex items-center gap-3 text-left"
                  >
                    <span className="w-24 shrink-0 truncate text-xs font-medium text-slate-600">{stage}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <span
                        className={cn("block h-full rounded-full", isWon ? "bg-emerald-500" : "bg-primary-600")}
                        style={{ width: `${Math.round((count / maxStageCount) * 100)}%` }}
                      />
                    </span>
                    <span className="w-6 shrink-0 text-right font-mono text-xs font-bold text-slate-900">{count}</span>
                  </Link>
                );
              })
            )}
          </div>
        </Card>
      </div>

      <div className="mt-5 px-4 sm:px-6 lg:px-8">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2 p-5 pb-0">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Activity className="size-4 text-primary-600" /> Telecaller Health
              </h3>
              <p className="mt-1 text-xs text-slate-600">How the team is holding up against today&apos;s targets</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={exportSnapshotCsv}>
                <Download className="size-3.5" /> Export
              </Button>
              <Link href="/dashboard/telecallers/performance" className="text-xs font-semibold text-primary-600 hover:underline">
                FULL MATRIX
              </Link>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 border-y border-slate-100 lg:grid-cols-4">
            {teamTiles.map((tile) => (
              <div key={tile.label} className="border-b border-slate-100 px-5 py-4 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">{tile.label}</p>
                <p className="mt-1 font-mono text-xl font-bold tracking-tight text-slate-900">{teamStatusLoading ? <Skeleton className="h-5 w-12" /> : tile.value}</p>
                <p className="mt-1 text-[11px] text-slate-600">{tile.note}</p>
              </div>
            ))}
          </div>
          {teamStatusError ? (
            <p role="alert" className="px-5 py-6 text-sm text-red-600">
              {teamStatusError}{" "}
              <button className="font-semibold underline" onClick={loadTeamStatus}>
                Retry
              </button>
            </p>
          ) : !teamStatusLoading && teamStatus.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-600">No telecallers on this team yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <th className="px-5 py-2">Telecaller</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Calls</th>
                    <th className="px-3 py-2">Connected</th>
                    <th className="px-3 py-2">Closed</th>
                    {/* Denominator in the header so the bare number in each row
                        isn't read as a percentage — same /110 scale as the card
                        above and the Performance Matrix. */}
                    <th className="px-3 py-2">Quality / {QUALITY_MAX}</th>
                    <th className="px-3 py-2">Revenue</th>
                    <th className="px-3 py-2">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {teamStatusLoading ? (
                    <>
                      <SkeletonTableRow columns={8} />
                      <SkeletonTableRow columns={8} />
                      <SkeletonTableRow columns={8} />
                    </>
                  ) : (
                    teamStatus.map((t) => (
                      <tr key={t.id} className={cn("border-l-[3px]", teamStatusBorder[t.status])}>
                        <td className="px-5 py-3 font-medium text-slate-900">{t.name}</td>
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={cn("size-2 rounded-full", teamStatusDot[t.status])} />
                            {t.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-mono">{t.calls}</td>
                        <td className="px-3 py-3 font-mono">{t.connected}</td>
                        <td className="px-3 py-3 font-mono">{t.closed_won}</td>
                        <td className="px-3 py-3 font-mono">{t.quality}</td>
                        <td className="px-3 py-3 font-mono">{formatLakhs(t.revenue_today)}</td>
                        <td className="px-3 py-3">
                          {t.trend === "up" ? (
                            <span className="text-emerald-600">↑</span>
                          ) : t.trend === "down" ? (
                            <span className="text-red-600">↓</span>
                          ) : (
                            <span className="text-slate-300">→</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card>
          <div className="flex items-center justify-between gap-3 p-5 pb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Reports</h3>
              <p className="mt-1 text-xs text-slate-600">View a current snapshot or download it when you need it.</p>
            </div>
            <Link href="/dashboard/insights/reports" className="text-xs font-semibold text-primary-600 hover:underline">ALL REPORTS</Link>
          </div>
          <div className="grid gap-3 border-t border-slate-100 p-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Founder weekly", "PDF · weekly", "weekly_summary"],
              ["Telecaller scorecard", "CSV · current team", "telecaller_performance"],
              ["Lead quality audit", "CSV · all sources", "lead_quality"],
              ["Leakage report", "PDF · current risks", "leakage"],
            ].map(([title, meta, report]) => (
              <Link key={report} href={`/dashboard/insights/reports?type=${report}`} className="group rounded-lg border border-slate-200 p-3 transition-colors hover:border-primary-200 hover:bg-primary-50/40">
                <FileText className="size-4 text-primary-500" />
                <p className="mt-4 text-sm font-semibold text-slate-800">{title}</p>
                <p className="mt-1 text-xs text-slate-600">{meta}</p>
                <span className="mt-3 inline-block text-xs font-semibold text-primary-600">View report →</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2 p-5 pb-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Activity className="size-4 text-primary-600" /> Live Activity
            </h3>
            {/* A failed poll must not claim the feed is live, but it also must
                not tear the feed down — the rows below are still the last good
                data, so this degrades the "live" chip instead of replacing them. */}
            {activityStale ? (
              <span role="status" className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                <span className="size-1.5 rounded-full bg-amber-500" /> Couldn&apos;t refresh — showing the last update{" "}
                <button className="font-semibold underline" onClick={loadActivity}>
                  Retry
                </button>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="size-1.5 rounded-full bg-emerald-500" /> Auto-refreshes every 30s
              </span>
            )}
          </div>
          {activityError ? (
            <p role="alert" className="px-5 py-6 text-sm text-red-600">
              {activityError}{" "}
              <button className="font-semibold underline" onClick={loadActivity}>
                Retry
              </button>
            </p>
          ) : activityLoading ? (
            <div className="mt-3 divide-y divide-slate-100">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <Skeleton className="h-3 w-10" />
                  <Skeleton className="size-2 rounded-full" />
                  <Skeleton className="h-4 w-64" />
                </div>
              ))}
            </div>
          ) : activity.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-600">No activity yet today.</p>
          ) : (
            <div className="mt-3 divide-y divide-slate-100">
              {activity.map((a) => (
                <div
                  key={a.id}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-3 border-l-[3px] px-5 py-3",
                    activityToneBorder[a.type]
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="font-mono text-xs text-slate-600">{timeAgo(a.time)}</span>
                    <span className={cn("size-2 shrink-0 rounded-full", activityToneDot[a.type])} />
                    <div>
                      <span className="text-sm font-semibold text-slate-900">{a.title}</span>{" "}
                      <span className="text-sm text-slate-500">{a.detail}</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!activityHref(a.id)}
                    onClick={() => {
                      const href = activityHref(a.id);
                      if (href) router.push(href);
                    }}
                  >
                    {a.cta}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
