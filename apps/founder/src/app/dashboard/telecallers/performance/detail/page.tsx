"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { SkillRadar } from "@/components/charts/SkillRadar";
import { ApiError, telecallersApi, type TelecallerPerformanceDetail } from "@/lib/api";
import { cn, formatINR, formatSeconds, initials, TELECALLER_STATUS_DOT, TELECALLER_STATUS_PILL, VERDICT_TONE } from "@/lib/utils";

// Same thresholds the backend's status/idle logic runs on (see
// _BREAK_THRESHOLD_MIN / _INACTIVE_THRESHOLD_MIN in app/api/dashboard.py) —
// shown here so the "Idle Time" KPI's note stays true to the actual rule
// instead of a hardcoded number that can drift from it.
const BREAK_THRESHOLD_MIN = 15;

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function fmtChartDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function TelecallerDetailContent() {
  const id = useSearchParams().get("id") ?? "";
  const [detail, setDetail] = useState<TelecallerPerformanceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!id) {
      setError("No telecaller specified.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    telecallersApi
      .performanceDetail(id)
      .then(setDetail)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load telecaller"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  return (
    <div className="pb-10">
      <div className="px-4 pt-6 sm:px-6 lg:px-8">
        <Link href="/dashboard/telecallers/performance" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary-600">
          <ArrowLeft className="size-3.5" /> Performance Matrix
        </Link>
      </div>

      {error && (
        <div className="mt-4 mx-4 sm:mx-6 lg:mx-8 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error} —{" "}
          <button className="font-semibold underline" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="mt-4 px-4 sm:px-6 lg:px-8">
          <Skeleton block className="h-8 w-64" />
          <Skeleton block className="mt-3 h-24 w-full rounded-2xl" />
        </div>
      ) : detail ? (
        <>
          <div className="mt-4 px-4 sm:px-6 lg:px-8">
            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary-700">
                    {initials(detail.name)}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-xl font-bold text-slate-900">{detail.name}</h1>
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", TELECALLER_STATUS_PILL[detail.status])}>
                        <span className={cn("size-1.5 rounded-full", TELECALLER_STATUS_DOT[detail.status])} />
                        {detail.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">
                      Quality {detail.quality}/110
                      {detail.idle_minutes != null && <> · idle {detail.idle_minutes}m</>}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-4">
            <StatCard label="Calls" value={String(detail.calls)} />
            <StatCard label="Connected" value={`${detail.connect_pct}%`} note="Of calls attempted" />
            <StatCard label="Talk Time" value={formatSeconds(detail.talk_time_seconds)} />
            <StatCard
              label="Idle Time"
              value={detail.idle_minutes != null ? `${detail.idle_minutes}m` : "—"}
              note={
                detail.idle_minutes == null
                  ? "Not on shift"
                  : detail.idle_minutes >= BREAK_THRESHOLD_MIN
                  ? `Above the ${BREAK_THRESHOLD_MIN} min limit`
                  : `Within the ${BREAK_THRESHOLD_MIN} min limit`
              }
              noteTone={detail.idle_minutes != null && detail.idle_minutes >= BREAK_THRESHOLD_MIN ? "warning" : "neutral"}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-2">
            <Card className="p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Calls Made — Last 14 Days</h3>
              <div className="mt-3">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={detail.daily_calls} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <XAxis
                      dataKey="date"
                      tickFormatter={fmtChartDate}
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      axisLine={{ stroke: "#eef0f4" }}
                      tickLine={false}
                      interval={2}
                    />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                    <Tooltip
                      formatter={((v: number) => [v, "Calls"]) as never}
                      labelFormatter={((l: string) => fmtChartDate(l)) as never}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                    />
                    <Bar dataKey="count" fill="#4f6ef2" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Skill Breakdown</h3>
              <SkillRadar
                skills={{
                  opening: detail.dimensions.opening,
                  discovery: detail.dimensions.discovery,
                  pitch: detail.dimensions.pitch,
                  objectionHandling: detail.dimensions.objection_handling,
                  closing: detail.dimensions.closing,
                }}
              />
            </Card>
          </div>

          <div className="mt-4 px-4 sm:px-6 lg:px-8">
            <Card>
              <div className="p-5 pb-0">
                <h3 className="text-sm font-semibold text-slate-900">Call Log</h3>
                <p className="mt-0.5 text-xs text-slate-400">Most recent calls · click to open the AI analysis</p>
              </div>
              {detail.timeline.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-400">No calls yet.</p>
              ) : (
                <div className="mt-3 divide-y divide-slate-100">
                  {detail.timeline.map((c) => (
                    <Link
                      key={c.call_id}
                      href={`/dashboard/calls/detail?id=${c.call_id}`}
                      className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-slate-50"
                    >
                      <span className="font-mono text-xs text-slate-400">{fmtDateTime(c.timestamp)}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", VERDICT_TONE[c.lead_verdict] ?? "bg-slate-100 text-slate-500")}>
                        {c.lead_verdict ?? "Unscored"}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-2">
            <Card className="p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Best Calls</h3>
              {detail.best_calls.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">No scored calls yet.</p>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  {detail.best_calls.map((c) => (
                    <Link key={c.call_id} href={`/dashboard/calls/detail?id=${c.call_id}`} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50">
                      <span className="text-slate-600">{fmtDateTime(c.timestamp)}</span>
                      <span className="font-mono font-bold text-emerald-600">{c.total_score}</span>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
            <Card className="p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Needs Review</h3>
              {detail.needs_review.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">No scored calls yet.</p>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  {detail.needs_review.map((c) => (
                    <Link key={c.call_id} href={`/dashboard/calls/detail?id=${c.call_id}`} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50">
                      <span className="text-slate-600">{fmtDateTime(c.timestamp)}</span>
                      <span className="font-mono font-bold text-amber-600">{c.total_score}</span>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="mt-4 px-4 sm:px-6 lg:px-8">
            <Card className="p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Leads Assigned to {detail.name.split(" ")[0]} · {detail.leads_assigned.length}
              </h3>
              {detail.leads_assigned.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">No open leads assigned.</p>
              ) : (
                <div className="mt-3 flex flex-col gap-1.5">
                  {detail.leads_assigned.map((l) => (
                    <Link
                      key={l.id}
                      href={`/dashboard/leads/detail?id=${l.id}`}
                      className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
                    >
                      <span className="font-medium text-slate-800">{l.name}</span>
                      <span className="flex items-center gap-3 text-xs text-slate-400">
                        {l.pipeline_stage}
                        {l.deal_value != null ? <span className="font-mono text-slate-600">{formatINR(l.deal_value)}</span> : null}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      ) : (
        !error && <p className="mt-6 px-4 text-sm text-slate-400 sm:px-6 lg:px-8">Telecaller not found.</p>
      )}
    </div>
  );
}

export default function TelecallerDetailPage() {
  return (
    <Suspense fallback={<div className="px-4 pt-6 sm:px-6 lg:px-8"><Skeleton block className="h-8 w-64" /></div>}>
      <TelecallerDetailContent />
    </Suspense>
  );
}
