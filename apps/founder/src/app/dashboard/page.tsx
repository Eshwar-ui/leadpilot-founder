"use client";

import { useEffect, useState } from "react";
import { Filter, Target, BarChart3, CheckCircle2, Phone, Megaphone, Activity, Calendar, Download } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RevenueChart } from "@/components/charts/RevenueChart";
import { GoalGauge } from "@/components/charts/GoalGauge";
import {
  ApiError,
  dashboardApi,
  telecallersApi,
  type ActivityEvent,
  type DashboardGoal,
  type DashboardRevenue,
  type DashboardSnapshot,
  type TelecallerMetrics,
} from "@/lib/api";
import { cn, formatLakhs } from "@/lib/utils";

const activityToneDot: Record<string, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  info: "bg-blue-500",
  danger: "bg-red-500",
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

  useEffect(load, []);
  useEffect(() => loadRevenue(range), [range]);
  useEffect(loadGoal, []);
  useEffect(loadTeamAverage, []);
  useEffect(() => {
    loadActivity();
    const id = setInterval(loadActivity, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="pb-10">
      <PageHeader
        title="Daily Snapshot"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Calendar className="size-3.5" /> 01/01/2026 – 30/01/2026
            </Button>
            <Button variant="outline" size="sm">Filter</Button>
            <Button variant="outline" size="sm">
              <Download className="size-3.5" /> Export
            </Button>
          </div>
        }
      />

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <AlertBanner
          label="Critical Alert"
          message="Budget overspend ₹3,200 · Meta Lead Gen campaign +22% over daily cap"
          cta="Act Now"
        />
      </div>

      {error && (
        <div className="mt-4 mx-4 sm:mx-6 lg:mx-8 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error} —{" "}
          <button className="font-semibold underline" onClick={load}>
            Retry
          </button>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 px-4 sm:px-6 lg:px-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <StatCard
          label="Total Leads"
          value={loading ? "…" : String(snapshot?.total_leads ?? 0)}
          suffix="MTD"
          icon={Filter}
        />
        <StatCard label="Hot Leads" value={loading ? "…" : String(snapshot?.hot_leads ?? 0)} icon={Target} />
        <StatCard
          label="Conversion Rate"
          value={loading ? "…" : `${snapshot?.conversion_rate_pct ?? 0}%`}
          icon={BarChart3}
        />
        <StatCard label="Leads Today" value={loading ? "…" : String(snapshot?.leads_today ?? 0)} icon={CheckCircle2} />
        <StatCard label="Calls Today" value={loading ? "…" : String(snapshot?.calls_today ?? 0)} icon={Phone} />
        <StatCard label="Active Campaigns" value="7" icon={Megaphone} />
        <StatCard
          label="Team Quality"
          value={teamAverageLoading ? "…" : teamAverageError ? "—" : String(teamAverage?.quality ?? 0)}
          suffix="/100"
          icon={Activity}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex flex-col gap-4 p-5 pb-0 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Revenue — {range === 1 ? "Today" : `${range} Days`}
              </h3>
              <p className="mt-1 font-mono text-2xl font-bold text-primary-600">
                {revenueLoading ? "…" : formatLakhs(revenue?.mtd_total ?? 0)}{" "}
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
                  {revenueLoading ? "…" : formatLakhs(revenue?.avg_per_day ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-400">Best Day</p>
                <p className="font-mono text-sm font-bold text-emerald-600">
                  {revenueLoading ? "…" : formatLakhs(revenue?.best_day?.revenue ?? 0)}
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
                {goalLoading ? "…" : goal?.pct_of_target != null ? `${goal.pct_of_target}%` : "—"}
              </span>
              <span className="text-xs text-slate-400">of monthly target</span>
            </div>
          </div>
          <div className="-mt-4 flex justify-between text-xs text-slate-400">
            <span>₹0</span>
            <span>{goal?.monthly_target != null ? formatLakhs(goal.monthly_target) : "No target set"}</span>
          </div>
          <p className="text-center font-mono text-sm font-semibold text-slate-700">
            {goalLoading
              ? "…"
              : `${formatLakhs(goal?.mtd_revenue ?? 0)} / ${goal?.monthly_target != null ? formatLakhs(goal.monthly_target) : "—"}`}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase text-slate-400">Days Left</p>
              <p className="font-mono text-lg font-bold text-amber-600">{goalLoading ? "…" : goal?.days_left ?? 0}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase text-slate-400">Needed/Day</p>
              <p className="font-mono text-lg font-bold text-slate-900">
                {goalLoading ? "…" : goal?.needed_per_day != null ? formatLakhs(goal.needed_per_day) : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase text-slate-400">Deals Closed</p>
              <p className="font-mono text-lg font-bold text-emerald-600">{goalLoading ? "…" : goal?.deals_closed ?? 0}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase text-slate-400">Avg Deal</p>
              <p className="font-mono text-lg font-bold text-slate-900">
                {goalLoading ? "…" : goal?.avg_deal_value != null ? formatLakhs(goal.avg_deal_value) : "—"}
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
              <Activity className="size-4 text-primary-600" /> Live Activity
            </h3>
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="size-1.5 rounded-full bg-emerald-500" /> Auto-refreshes every 30s
            </span>
          </div>
          {activityError ? (
            <p className="px-5 py-6 text-sm text-red-600">{activityError}</p>
          ) : activityLoading ? (
            <p className="px-5 py-6 text-sm text-slate-400">Loading activity…</p>
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
