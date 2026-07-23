"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { DateRangePicker, type DateRange } from "@/components/ui/DateRangePicker";
import { SkillRadar } from "@/components/charts/SkillRadar";
import {
  ApiError,
  telecallersApi,
  type TelecallerMetrics,
  type TelecallerPerformance,
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

function metricsOf(t: TelecallerMetrics) {
  return [
    { key: "calls", label: "Total Calls", value: t.calls, fmt: (v: number) => String(v) },
    { key: "connect_pct", label: "Connection Rate", value: t.connect_pct, fmt: (v: number) => `${v}%` },
    { key: "positive_pct", label: "Positive Rate", value: t.positive_pct, fmt: (v: number) => `${v}%` },
    { key: "close_pct", label: "Close Rate", value: t.close_pct, fmt: (v: number) => `${v}%` },
    { key: "quality", label: "Quality Score", value: t.quality, fmt: (v: number) => `${v}/110` },
    { key: "talk_time_seconds", label: "Avg Talk Time", value: t.talk_time_seconds, fmt: (v: number) => formatSeconds(v) },
  ] as const;
}

export default function ComparisonPage() {
  const [telecallers, setTelecallers] = useState<TelecallerPerformance[]>([]);
  const [teamAverage, setTeamAverage] = useState<TelecallerMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  // Initialised client-side (this month, matching the Founder Dashboard's own
  // default) to avoid an SSR/client Date hydration mismatch.
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  useEffect(() => {
    const now = new Date();
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setDateRange({ start: iso(new Date(now.getFullYear(), now.getMonth(), 1)), end: iso(now) });
  }, []);

  function load() {
    if (!dateRange) return;
    setLoading(true);
    setError(null);
    telecallersApi
      .performance(dateRange)
      .then((res) => {
        setTelecallers(res.telecallers);
        setTeamAverage(res.team_average);
        // Preserve the founder's picks across a date-range change; only seed
        // a default selection on the very first load.
        setSelected((prev) => (prev.length > 0 ? prev.filter((id) => res.telecallers.some((t) => t.id === id)) : res.telecallers.slice(0, 2).map((t) => t.id)));
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load comparison data"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [dateRange]);

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  }

  const chosen = telecallers.filter((t) => selected.includes(t.id));

  return (
    <div className="pb-10">
      <PageHeader
        title="Telecaller Comparison"
        description="Side-by-side metrics for 2–4 agents vs team average"
        action={dateRange && <DateRangePicker value={dateRange} onChange={setDateRange} />}
      />

      {error && (
        <div className="mt-4 mx-4 sm:mx-6 lg:mx-8 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error} —{" "}
          <button className="font-semibold underline" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <p className="mt-6 px-4 text-center text-sm text-slate-400 sm:px-6 lg:px-8">Loading…</p>
      ) : telecallers.length === 0 && !error ? (
        <p className="mt-6 px-4 text-center text-sm text-slate-400 sm:px-6 lg:px-8">
          No telecallers yet. Invite one from Manage Team to compare performance here.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2 px-4 sm:px-6 lg:px-8">
            {telecallers.map((t) => (
              <button
                key={t.id}
                onClick={() => toggle(t.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  selected.includes(t.id)
                    ? "border-primary-500 bg-primary-600 text-white"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                <span className="text-xs">{initials(t.name)}</span>
                {t.name.split(" ")[0]}
              </button>
            ))}
            <span className="text-xs text-slate-400">Select 2–4 telecallers</span>
          </div>

          <div className="mt-4 px-4 sm:px-6 lg:px-8">
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      <th className="px-5 py-3">Metric</th>
                      <th className="px-3 py-3 text-right">Team Avg</th>
                      {chosen.map((t) => (
                        <th key={t.id} className="px-5 py-3 text-right text-primary-600">
                          {t.name.split(" ")[0]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {teamAverage &&
                      metricsOf(teamAverage).map((m) => (
                        <tr key={m.key}>
                          <td className="px-5 py-4 font-medium text-slate-700">{m.label}</td>
                          <td className="px-3 py-4 text-right font-mono text-slate-400">{m.fmt(m.value)}</td>
                          {chosen.map((t) => {
                            const value = metricsOf(t).find((x) => x.key === m.key)!.value;
                            const delta = m.value === 0 ? 0 : ((value - m.value) / m.value) * 100;
                            return (
                              <td key={t.id} className="px-5 py-4 text-right">
                                <div className="font-mono font-semibold text-slate-900">{m.fmt(value)}</div>
                                <div className={cn("text-xs font-medium", delta >= 0 ? "text-emerald-600" : "text-red-600")}>
                                  {delta >= 0 ? "+" : ""}
                                  {delta.toFixed(1)}% vs avg
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <div className="mt-4 px-4 sm:px-6 lg:px-8">
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-900">◎ Skill Radar Overlay</h3>
              <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {chosen.map((t) => (
                  <div key={t.id} className="text-center">
                    <SkillRadar
                      skills={{
                        opening: t.dimensions.opening,
                        discovery: t.dimensions.discovery,
                        pitch: t.dimensions.pitch,
                        objectionHandling: t.dimensions.objection_handling,
                        closing: t.dimensions.closing,
                      }}
                    />
                    <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-400">Quality {t.quality}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-center text-xs text-slate-400">Each axis is out of 20 points · coaching priority = lowest axis</p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
