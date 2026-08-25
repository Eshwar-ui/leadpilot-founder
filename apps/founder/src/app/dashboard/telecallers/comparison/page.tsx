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

// `higherIsBetter` decides whether the "vs avg" delta is coloured as a win or a
// loss — the same idea as the Performance Matrix page's `lowerBetter` flag.
// `null` means neither direction is unambiguously good, and the delta is
// rendered neutral: average talk time was previously green whenever it was
// above average, so a telecaller whose calls ran 60% long got a reassuring
// "+60.0% vs avg" for what is just as likely to be rambling as thorough.
function metricsOf(t: TelecallerMetrics) {
  return [
    { key: "calls", label: "Total Calls", value: t.calls, higherIsBetter: true, fmt: (v: number) => String(v) },
    { key: "connect_pct", label: "Connection Rate", value: t.connect_pct, higherIsBetter: true, fmt: (v: number) => `${v}%` },
    { key: "positive_pct", label: "Positive Rate", value: t.positive_pct, higherIsBetter: true, fmt: (v: number) => `${v}%` },
    { key: "close_pct", label: "Close Rate", value: t.close_pct, higherIsBetter: true, fmt: (v: number) => `${v}%` },
    { key: "quality", label: "Quality Score", value: t.quality, higherIsBetter: true, fmt: (v: number) => `${v}/110` },
    {
      key: "talk_time_seconds",
      label: "Avg Talk Time",
      value: t.talk_time_seconds,
      higherIsBetter: null,
      fmt: (v: number) => formatSeconds(v),
    },
  ] as const;
}

function deltaClass(delta: number, higherIsBetter: boolean | null) {
  if (higherIsBetter === null || delta === 0) return "text-slate-600";
  const good = higherIsBetter ? delta > 0 : delta < 0;
  return good ? "text-emerald-600" : "text-red-600";
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

  // With no calls in the selected range every metric legitimately computes to
  // zero, so the table rendered a full grid of "0", "0%", "0/110" and
  // "+0.0% vs avg" — indistinguishable from a team that worked and scored
  // nothing. team_average.calls === 0 means nobody called at all in this window.
  const rangeEmpty = teamAverage !== null && teamAverage.calls === 0;

  return (
    <div className="pb-10">
      <PageHeader
        title="Telecaller Comparison"
        description="Side-by-side metrics for 2–4 agents vs team average"
        action={dateRange && <DateRangePicker value={dateRange} onChange={setDateRange} />}
      />

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

      {loading ? (
        <p className="mt-6 px-4 text-center text-sm text-slate-600 sm:px-6 lg:px-8">Loading…</p>
      ) : error ? null : telecallers.length === 0 ? (
        <p className="mt-6 px-4 text-center text-sm text-slate-600 sm:px-6 lg:px-8">
          No telecallers yet. Invite one from Manage Team to compare performance here.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2 px-4 sm:px-6 lg:px-8">
            {telecallers.map((t) => (
              <button
                key={t.id}
                onClick={() => toggle(t.id)}
                aria-pressed={selected.includes(t.id)}
                aria-label={`${selected.includes(t.id) ? "Remove" : "Add"} ${t.name} ${selected.includes(t.id) ? "from" : "to"} the comparison`}
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
            <span className="text-xs text-slate-600">Select 2–4 telecallers</span>
          </div>

          {rangeEmpty ? (
            <div className="mt-4 px-4 sm:px-6 lg:px-8">
              <Card className="p-8 text-center">
                <p className="text-sm font-semibold text-slate-900">No calls in this date range</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
                  Nobody on the team logged a call between {dateRange?.start} and {dateRange?.end}, so there is
                  nothing to compare. Widen the range to see how these telecallers stack up.
                </p>
              </Card>
            </div>
          ) : (
          <>
          <div className="mt-4 px-4 sm:px-6 lg:px-8">
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <th scope="col" className="px-5 py-3">Metric</th>
                      <th scope="col" className="px-3 py-3 text-right">Team Avg</th>
                      {chosen.map((t) => (
                        <th key={t.id} scope="col" className="px-5 py-3 text-right text-primary-600">
                          {t.name.split(" ")[0]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {teamAverage &&
                      metricsOf(teamAverage).map((m) => (
                        <tr key={m.key}>
                          <th scope="row" className="px-5 py-4 text-left font-medium text-slate-700">
                            {m.label}
                          </th>
                          <td className="px-3 py-4 text-right font-mono text-slate-600">{m.fmt(m.value)}</td>
                          {chosen.map((t) => {
                            const value = metricsOf(t).find((x) => x.key === m.key)!.value;
                            const delta = m.value === 0 ? 0 : ((value - m.value) / m.value) * 100;
                            return (
                              <td key={t.id} className="px-5 py-4 text-right">
                                <div className="font-mono font-semibold text-slate-900">{m.fmt(value)}</div>
                                <div className={cn("text-xs font-medium", deltaClass(delta, m.higherIsBetter))}>
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
              {/* Renamed from "Skill Radar Overlay": this is a grid of one
                  radar per telecaller, not a single overlaid chart. A true
                  overlay needs four <Radar> series inside one <RadarChart>,
                  which SkillRadar's single-`skills` prop can't express — and
                  that component is owned elsewhere, so the honest fix here is
                  the heading. */}
              <h3 className="text-sm font-semibold text-slate-900">◎ Skill Radar — one per telecaller</h3>
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
                    <p className="text-xs text-slate-600">Quality {t.quality}/110</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-center text-xs text-slate-600">Each axis is out of 20 points · coaching priority = lowest axis</p>
            </Card>
          </div>
          </>
          )}
        </>
      )}
    </div>
  );
}
