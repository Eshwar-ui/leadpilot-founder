import { Filter, Target, BarChart3, CheckCircle2, Phone, Megaphone, Activity, Calendar, Download } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RevenueChart } from "@/components/charts/RevenueChart";
import { GoalGauge } from "@/components/charts/GoalGauge";
import { liveActivity } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const activityToneDot: Record<string, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  info: "bg-blue-500",
  danger: "bg-red-500",
};

export default function DailySnapshotPage() {
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

      <div className="mt-6 grid grid-cols-2 gap-4 px-4 sm:px-6 lg:px-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Total Leads" value="2,840" suffix="MTD" delta="+12 vs last mo" icon={Filter} />
        <StatCard label="Positive Leads" value="1,190" delta="+8 vs last mo" icon={Target} />
        <StatCard label="Conversion Rate" value="41.9%" delta="+2.1 vs last mo" icon={BarChart3} />
        <StatCard label="Closed Deals" value="284" delta="+34 vs last mo" icon={CheckCircle2} />
        <StatCard label="Calls Today" value="1,240" icon={Phone} />
        <StatCard label="Active Campaigns" value="7" icon={Megaphone} />
        <StatCard label="Team Quality" value="89" suffix="/100" delta="+4 vs last mo" icon={Activity} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex flex-col gap-4 p-5 pb-0 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Revenue — 30 Days</h3>
              <p className="mt-1 font-mono text-2xl font-bold text-primary-600">
                ₹24.6L <span className="text-sm font-medium text-slate-400">MTD</span>
              </p>
              <p className="text-xs font-medium text-emerald-600">↗ +27% vs last mo</p>
            </div>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 sm:text-right">
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-400">Avg / Day</p>
                <p className="font-mono text-sm font-bold text-slate-900">₹82K</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-400">Best Day</p>
                <p className="font-mono text-sm font-bold text-emerald-600">₹1.28L</p>
              </div>
              <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs">
                {["1D", "7D", "30D", "90D"].map((r) => (
                  <span
                    key={r}
                    className={cn(
                      "rounded-md px-2 py-1 font-medium",
                      r === "30D" ? "bg-primary-600 text-white" : "text-slate-400"
                    )}
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="px-2 pb-2">
            <RevenueChart />
          </div>
          <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-primary-600" /> Actual revenue</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed border-amber-500" /> Target ₹1L/day</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>Working days <b className="text-slate-900">18/30</b></span>
              <span>On-target days <b className="text-slate-900">11</b></span>
              <span>Off-target days <b className="text-slate-900">7</b></span>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Monthly Goal</h3>
          <div className="relative">
            <GoalGauge pct={68} />
            <div className="absolute inset-x-0 top-[52%] flex flex-col items-center">
              <span className="font-mono text-3xl font-bold text-slate-900">68%</span>
              <span className="text-xs text-slate-400">of monthly target</span>
            </div>
          </div>
          <div className="-mt-4 flex justify-between text-xs text-slate-400">
            <span>₹0</span>
            <span>₹36L</span>
          </div>
          <p className="text-center font-mono text-sm font-semibold text-slate-700">₹24.6L / ₹36L</p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase text-slate-400">Days Left</p>
              <p className="font-mono text-lg font-bold text-amber-600">12</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase text-slate-400">Needed/Day</p>
              <p className="font-mono text-lg font-bold text-slate-900">₹94K</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase text-slate-400">Deals Closed</p>
              <p className="font-mono text-lg font-bold text-emerald-600">284</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase text-slate-400">Avg Deal</p>
              <p className="font-mono text-lg font-bold text-slate-900">₹8.7K</p>
            </div>
          </div>
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
          <div className="mt-3 divide-y divide-slate-100">
            {liveActivity.map((a) => (
              <div key={a.title + a.time} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="font-mono text-xs text-slate-400">{a.time}</span>
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
        </Card>
      </div>
    </div>
  );
}
