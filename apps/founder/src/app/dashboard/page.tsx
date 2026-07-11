"use client";

import { useEffect, useState } from "react";
import { Filter, Target, BarChart3, CheckCircle2, Phone, IndianRupee, Trophy, ShieldAlert, Activity, Calendar, Download } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton, SkeletonTableRow } from "@/components/ui/Skeleton";
import { RevenueChart } from "@/components/charts/RevenueChart";
import { GoalGauge } from "@/components/charts/GoalGauge";
import {
  ApiError,
  dashboardApi,
  insightsApi,
  leadsQualityApi,
  telecallersApi,
  type ActivityEvent,
  type DashboardGoal,
  type DashboardRevenue,
  type DashboardSnapshot,
  type Insight,
  type TeamHealthEntry,
  type TelecallerMetrics,
} from "@/lib/api";
import { cn, formatLakhs } from "@/lib/utils";

const activityToneDot: Record<string, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  info: "bg-blue-500",
  danger: "bg-red-500",
};

// Matches the PRD's own status legend: 🟢 Active / 🟡 Break / 🔴 Inactive / ⛔ Absent.
const teamStatusDot: Record<string, string> = {
  Active: "bg-emerald-500",
  Break: "bg-amber-500",
  Inactive: "bg-red-500",
  Absent: "bg-slate-400",
};

const REVENUE_RANGES = [1, 7, 30, 90] as const;
const RANGE_LABEL: Record<number, string> = { 1: "1D", 7: "7D", 30: "30D", 90: "90D" };

function timeAgo(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default function DailySnapshotPage() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const [teamAverage, setTeamAverage] = useState<TelecallerMetrics | null>(null);
  const [teamAverageLoading, setTeamAverageLoading] = useState(true);
  const [teamAverageError, setTeamAverageError] = useState<string | null>(null);

  // "Money at Risk" isn't a field the backend computes directly — it's derived
  // the same way the PRD's own leakage screens estimate it: wasted-lead count
  // × the average deal value, i.e. "what these leads would be worth if closed
  // at the team's normal rate."
  const [wastedCount, setWastedCount] = useState<number | null>(null);
  const [wastedCountLoading, setWastedCountLoading] = useState(true);

  const [topInsight, setTopInsight] = useState<Insight | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);

  const [teamStatus, setTeamStatus] = useState<TeamHealthEntry[]>([]);
  const [teamStatusLoading, setTeamStatusLoading] = useState(true);
  const [teamStatusError, setTeamStatusError] = useState<string | null>(null);
  // Status filter for the Team Health table — the one dimension on this
  // (month-to-date) page that can actually be filtered client-side.
  const [statusFilter, setStatusFilter] = useState("all");

  // Real month-to-date range for the header. Was a hardcoded "01/01/2026 –
  // 30/01/2026" that filtered nothing and read as stale/wrong on any other
  // date. Computed on the client (empty on first render) so SSR and hydration
  // agree. The snapshot/goal stats are all MTD, so this just labels that.
  const [dateLabel, setDateLabel] = useState("");
  useEffect(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
    setDateLabel(`${fmt(monthStart)} – ${fmt(now)} ${now.getFullYear()}`);
  }, []);

  function load() {
    setLoading(true);
    setError(null);
    dashboardApi
      .snapshot()
      .then(setSnapshot)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load dashboard snapshot"))
      .finally(() => setLoading(false));
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
      .catch((e) => setGoalError(e instanceof ApiError ? e.message : "Failed to load monthly goal"))
      .finally(() => setGoalLoading(false));
  }

  function loadActivity() {
    setActivityLoading(true);
    setActivityError(null);
    dashboardApi
      .activity()
      .then((res) => setActivity(res.events))
      .catch((e) => setActivityError(e instanceof ApiError ? e.message : "Failed to load live activity"))
      .finally(() => setActivityLoading(false));
  }

  function loadTeamAverage() {
    setTeamAverageLoading(true);
    setTeamAverageError(null);
    telecallersApi
      .performance()
      .then((res) => setTeamAverage(res.team_average))
      .catch((e) => setTeamAverageError(e instanceof ApiError ? e.message : "Failed to load team quality"))
      .finally(() => setTeamAverageLoading(false));
  }

  function loadWastedCount() {
    setWastedCountLoading(true);
    leadsQualityApi
      .wastage()
      .then((res) => setWastedCount(res.total_wasted))
      .catch(() => setWastedCount(null))
      .finally(() => setWastedCountLoading(false));
  }

  function loadTopInsight() {
    setInsightsLoading(true);
    const severityRank: Record<Insight["severity"], number> = { high: 0, medium: 1, low: 2 };
    insightsApi
      .list()
      .then((res) => {
        const sorted = [...res.insights].sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
        setTopInsight(sorted[0] ?? null);
      })
      .catch(() => setTopInsight(null))
      .finally(() => setInsightsLoading(false));
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

  useEffect(load, []);
  useEffect(() => loadRevenue(range), [range]);
  useEffect(loadGoal, []);
  useEffect(loadTeamAverage, []);
  useEffect(loadWastedCount, []);
  useEffect(loadTopInsight, []);
  useEffect(loadTeamStatus, []);
  useEffect(() => {
    loadActivity();
    const id = setInterval(loadActivity, 30_000);
    return () => clearInterval(id);
  }, []);

  const moneyAtRisk =
    wastedCount != null && goal?.avg_deal_value != null ? wastedCount * goal.avg_deal_value : null;

  const visibleTeamStatus =
    statusFilter === "all" ? teamStatus : teamStatus.filter((t) => t.status === statusFilter);

  function exportSnapshotCsv() {
    const header = ["Telecaller", "Status", "Calls", "Connected", "Closed", "Quality", "Revenue Today", "Trend"];
    const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const rows = visibleTeamStatus.map((t) =>
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
        title="Daily Snapshot"
        action={
          <div className="flex items-center gap-2">
            <span
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500"
              title="All snapshot figures are month-to-date"
            >
              <Calendar className="size-3.5" /> {dateLabel || "This month"}
            </span>
            <label className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600">
              <Filter className="size-3.5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter team health by status"
                className="bg-transparent text-xs font-medium text-slate-600 focus:outline-none"
              >
                <option value="all">All statuses</option>
                <option value="Active">Active</option>
                <option value="Break">Break</option>
                <option value="Inactive">Inactive</option>
                <option value="Absent">Absent</option>
              </select>
            </label>
            <Button variant="outline" size="sm" onClick={exportSnapshotCsv}>
              <Download className="size-3.5" /> Export
            </Button>
          </div>
        }
      />

      {!insightsLoading && topInsight && (
        <div className="mt-4 px-4 sm:px-6 lg:px-8">
          <AlertBanner
            key={topInsight.id}
            label={topInsight.severity === "high" ? "Critical Alert" : topInsight.severity === "medium" ? "Alert" : "Notice"}
            message={`${topInsight.title} — ${topInsight.description}`}
            cta="View Details"
          />
        </div>
      )}

      {error && (
        <div className="mt-4 mx-4 sm:mx-6 lg:mx-8 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error} —{" "}
          <button className="font-semibold underline" onClick={load}>
            Retry
          </button>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 px-4 sm:px-6 lg:px-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-9">
        <StatCard
          label="Total Leads"
          value={loading ? <Skeleton className="h-6 w-12" /> : String(snapshot?.total_leads ?? 0)}
          suffix="MTD"
          icon={Filter}
        />
        <StatCard label="Hot Leads" value={loading ? <Skeleton className="h-6 w-12" /> : String(snapshot?.hot_leads ?? 0)} icon={Target} />
        <StatCard
          label="Conversion Rate"
          value={loading ? <Skeleton className="h-6 w-12" /> : `${snapshot?.conversion_rate_pct ?? 0}%`}
          icon={BarChart3}
        />
        <StatCard
          label="Revenue Generated"
          value={revenueLoading ? <Skeleton className="h-6 w-16" /> : formatLakhs(revenue?.mtd_total ?? 0)}
          suffix="MTD"
          icon={IndianRupee}
        />
        <StatCard label="Leads Today" value={loading ? <Skeleton className="h-6 w-12" /> : String(snapshot?.leads_today ?? 0)} icon={CheckCircle2} />
        <StatCard label="Calls Today" value={loading ? <Skeleton className="h-6 w-12" /> : String(snapshot?.calls_today ?? 0)} icon={Phone} />
        <StatCard
          label="Closed Deals"
          value={goalLoading ? <Skeleton className="h-6 w-12" /> : String(goal?.deals_closed ?? 0)}
          suffix="MTD"
          icon={Trophy}
        />
        <StatCard
          label="Team Quality"
          value={teamAverageLoading ? <Skeleton className="h-6 w-12" /> : teamAverageError ? "—" : String(teamAverage?.quality ?? 0)}
          suffix="/110"
          icon={Activity}
        />
        <StatCard
          label="Money at Risk"
          value={wastedCountLoading ? <Skeleton className="h-6 w-16" /> : moneyAtRisk != null ? formatLakhs(moneyAtRisk) : "—"}
          icon={ShieldAlert}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex flex-col gap-4 p-5 pb-0 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Revenue — {range === 1 ? "Today" : `${range} Days`}
              </h3>
              <p className="mt-1 flex items-baseline gap-1 font-mono text-2xl font-bold text-primary-600">
                {revenueLoading ? <Skeleton className="h-7 w-20" /> : formatLakhs(revenue?.mtd_total ?? 0)}{" "}
                <span className="text-sm font-medium text-slate-400">MTD</span>
              </p>
              {revenue?.pct_change_vs_last_month != null ? (
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
                <p className="text-xs text-slate-400">No revenue recorded last month to compare</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 sm:text-right">
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-400">Avg / Day</p>
                <p className="font-mono text-sm font-bold text-slate-900">
                  {revenueLoading ? <Skeleton className="h-4 w-14" /> : formatLakhs(revenue?.avg_per_day ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-400">Best Day</p>
                <p className="font-mono text-sm font-bold text-emerald-600">
                  {revenueLoading ? <Skeleton className="h-4 w-14" /> : formatLakhs(revenue?.best_day?.revenue ?? 0)}
                </p>
              </div>
              <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs">
                {REVENUE_RANGES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={cn(
                      "rounded-md px-2 py-1 font-medium",
                      r === range ? "bg-primary-600 text-white" : "text-slate-400 hover:text-slate-600"
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
              <p className="px-3 py-10 text-center text-sm text-red-600">{revenueError}</p>
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
            {revenue?.on_target_days != null ? (
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
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Monthly Goal</h3>
          <div className="relative">
            <GoalGauge pct={goal?.pct_of_target ?? 0} />
            <div className="absolute inset-x-0 top-[52%] flex flex-col items-center">
              <span className="font-mono text-3xl font-bold text-slate-900">
                {goalLoading ? <Skeleton className="h-8 w-16" /> : goal?.pct_of_target != null ? `${goal.pct_of_target}%` : "—"}
              </span>
              <span className="text-xs text-slate-400">of monthly target</span>
            </div>
          </div>
          <div className="-mt-4 flex justify-between text-xs text-slate-400">
            <span>₹0</span>
            <span>{goal?.monthly_target != null ? formatLakhs(goal.monthly_target) : "No target set"}</span>
          </div>
          <p className="text-center font-mono text-sm font-semibold text-slate-700">
            {goalLoading ? (
              <Skeleton className="mx-auto h-4 w-32" />
            ) : (
              `${formatLakhs(goal?.mtd_revenue ?? 0)} / ${goal?.monthly_target != null ? formatLakhs(goal.monthly_target) : "—"}`
            )}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase text-slate-400">Days Left</p>
              <p className="font-mono text-lg font-bold text-amber-600">{goalLoading ? <Skeleton className="h-5 w-8" /> : goal?.days_left ?? 0}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase text-slate-400">Needed/Day</p>
              <p className="font-mono text-lg font-bold text-slate-900">
                {goalLoading ? <Skeleton className="h-5 w-14" /> : goal?.needed_per_day != null ? formatLakhs(goal.needed_per_day) : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase text-slate-400">Deals Closed</p>
              <p className="font-mono text-lg font-bold text-emerald-600">{goalLoading ? <Skeleton className="h-5 w-8" /> : goal?.deals_closed ?? 0}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase text-slate-400">Avg Deal</p>
              <p className="font-mono text-lg font-bold text-slate-900">
                {goalLoading ? <Skeleton className="h-5 w-14" /> : goal?.avg_deal_value != null ? formatLakhs(goal.avg_deal_value) : "—"}
              </p>
            </div>
          </div>
          {goalError && <p className="mt-3 text-xs text-red-600">{goalError}</p>}
        </Card>
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2 p-5 pb-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Activity className="size-4 text-primary-600" /> Team Health
            </h3>
            <span className="text-xs text-slate-400">
              Active = calling now · Break ≤15m idle · Inactive &gt;45m idle or logged out · Absent = not logged in
            </span>
          </div>
          {teamStatusError ? (
            <p className="px-5 py-6 text-sm text-red-600">{teamStatusError}</p>
          ) : !teamStatusLoading && teamStatus.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">No telecallers on this team yet.</p>
          ) : !teamStatusLoading && visibleTeamStatus.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">No telecallers with status “{statusFilter}” right now.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-2">Telecaller</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Calls</th>
                    <th className="px-3 py-2">Connected</th>
                    <th className="px-3 py-2">Closed</th>
                    <th className="px-3 py-2">Quality</th>
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
                    visibleTeamStatus.map((t) => (
                      <tr key={t.id}>
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
          <div className="flex flex-wrap items-center justify-between gap-2 p-5 pb-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Activity className="size-4 text-primary-600" /> Live Activity
            </h3>
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="size-1.5 rounded-full bg-emerald-500" /> Auto-refreshes every 30s
            </span>
          </div>
          {activityError ? (
            <p className="px-5 py-6 text-sm text-red-600">{activityError}</p>
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
            <p className="px-5 py-6 text-sm text-slate-400">No recent activity yet.</p>
          ) : (
            <div className="mt-3 divide-y divide-slate-100">
              {activity.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="font-mono text-xs text-slate-400">{timeAgo(a.time)}</span>
                    <span className={cn("size-2 shrink-0 rounded-full", activityToneDot[a.type])} />
                    <div>
                      <span className="text-sm font-semibold text-slate-900">{a.title}</span>{" "}
                      <span className="text-sm text-slate-500">{a.detail}</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
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
