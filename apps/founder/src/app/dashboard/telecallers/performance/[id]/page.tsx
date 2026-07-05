"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Sparkles, Download, Calendar } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { SkillRadar } from "@/components/charts/SkillRadar";
import {
  ApiError,
  telecallersApi,
  type TelecallerPerformanceDetail,
} from "@/lib/api";
import { formatSeconds, cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

const verdictTone: Record<string, string> = {
  Hot: "bg-emerald-50 text-emerald-600",
  Warm: "bg-blue-50 text-blue-600",
  Cold: "bg-amber-50 text-amber-600",
  Junk: "bg-red-50 text-red-600",
};

export default function TelecallerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [detail, setDetail] = useState<TelecallerPerformanceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    telecallersApi
      .performanceDetail(id)
      .then(setDetail)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load telecaller profile"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  return (
    <div className="pb-10">
      <div className="px-4 sm:px-6 lg:px-8 pt-6">
        <Link href="/dashboard/telecallers/performance" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ChevronLeft className="size-4" /> Back to Matrix
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
        <p className="mt-10 text-center text-sm text-slate-400">Loading telecaller profile…</p>
      ) : !detail ? (
        !error && <p className="mt-10 text-center text-sm text-slate-400">Telecaller not found.</p>
      ) : (
        <>
          <div className="mt-4 flex items-center justify-end gap-2 px-4 sm:px-6 lg:px-8">
            <Button variant="outline" size="sm">Compare</Button>
            <Button size="sm">
              <Sparkles className="size-3.5" /> Coach
            </Button>
          </div>

          <div className="mt-4 flex items-center gap-4 px-4 sm:px-6 lg:px-8">
            <span className="flex size-14 items-center justify-center rounded-full bg-primary-600 text-lg font-bold text-white">
              {initials(detail.name)}
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{detail.name}</h1>
              <p className="text-sm text-slate-500">
                Quality trend: {detail.trend === "up" ? "↗ improving" : detail.trend === "down" ? "↘ declining" : "— steady"}
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-4">
            <StatCard label="Total Calls" value={detail.calls} suffix="MTD" />
            <StatCard label="Connect Rate" value={`${detail.connect_pct}%`} />
            <StatCard label="Positive Rate" value={`${detail.positive_pct}%`} />
            <StatCard label="Close Rate" value={`${detail.close_pct}%`} />
            <StatCard label="Avg Handle Time" value={formatSeconds(detail.talk_time_seconds)} />
            <StatCard label="Quality Score" value={detail.quality} suffix="/100" />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-2">
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900">AI Skill Radar</h3>
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

            <Card className="p-5">
              <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-600">Best Calls (AI-selected)</h3>
              <div className="mt-3 divide-y divide-slate-100">
                {detail.best_calls.length === 0 ? (
                  <p className="py-4 text-sm text-slate-400">No standout calls yet.</p>
                ) : (
                  detail.best_calls.map((c) => (
                    <div key={c.call_id} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="text-slate-600">
                        <span className="mr-2 text-slate-400">{formatTime(c.timestamp)}</span>
                        <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-medium", verdictTone[c.lead_verdict] ?? "bg-slate-100 text-slate-500")}>
                          {c.lead_verdict}
                        </span>
                      </span>
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-700">
                        {c.total_score}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          <div className="mt-4 px-4 sm:px-6 lg:px-8">
            <Card className="p-5">
              <h3 className="text-xs font-bold uppercase tracking-wide text-red-600">Needs Review (AI-selected)</h3>
              <div className="mt-3 divide-y divide-slate-100">
                {detail.needs_review.length === 0 ? (
                  <p className="py-4 text-sm text-slate-400">Nothing flagged for review.</p>
                ) : (
                  detail.needs_review.map((c) => (
                    <div key={c.call_id} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="text-slate-600">
                        <span className="mr-2 text-slate-400">{formatTime(c.timestamp)}</span>
                        <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-medium", verdictTone[c.lead_verdict] ?? "bg-slate-100 text-slate-500")}>
                          {c.lead_verdict}
                        </span>
                      </span>
                      <span className="rounded-md bg-red-50 px-2 py-0.5 font-mono text-xs font-semibold text-red-700">
                        {c.total_score}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          <div className="mt-4 px-4 sm:px-6 lg:px-8">
            <Card>
              <div className="flex items-center justify-between p-5 pb-0">
                <h3 className="text-sm font-semibold text-slate-900">Call Timeline</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm"><Calendar className="size-3.5" /> Today</Button>
                  <Button variant="outline" size="sm"><Download className="size-3.5" /> CSV</Button>
                </div>
              </div>
              <div className="mt-3 divide-y divide-slate-100">
                {detail.timeline.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-slate-400">No calls logged yet.</p>
                ) : (
                  detail.timeline.map((c) => (
                    <div key={c.call_id} className="flex items-center justify-between px-5 py-3 text-sm">
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-xs text-slate-400">{formatTime(c.timestamp)}</span>
                        <span className="font-semibold text-slate-900">{c.call_id}</span>
                      </div>
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 text-xs font-medium",
                          verdictTone[c.lead_verdict] ?? "bg-slate-100 text-slate-500"
                        )}
                      >
                        {c.lead_verdict}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
