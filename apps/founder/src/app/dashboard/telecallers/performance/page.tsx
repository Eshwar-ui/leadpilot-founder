"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DateRangePicker, type DateRange } from "@/components/ui/DateRangePicker";
import { Sparkline } from "@/components/charts/Sparkline";
import { SkeletonTableRow } from "@/components/ui/Skeleton";
import { ApiError, telecallersApi, type TelecallerPerformance } from "@/lib/api";
import { formatSeconds, cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export default function PerformanceMatrixPage() {
  const [telecallers, setTelecallers] = useState<TelecallerPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      .then((res) => setTelecallers(res.telecallers))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load telecaller performance"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [dateRange]);

  return (
    <div className="pb-10">
      <PageHeader
        title="Team Performance Overview"
        description="Ranked by AI call quality — click on a telecaller to view their complete profile."
        action={
          <>
            {dateRange && <DateRangePicker value={dateRange} onChange={setDateRange} />}
            <Button variant="outline" size="sm">
              <Download className="size-3.5" /> CSV
            </Button>
          </>
        }
      />

      {error && (
        <div className="mt-4 mx-4 sm:mx-6 lg:mx-8 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error} —{" "}
          <button className="font-semibold underline" onClick={load}>
            Retry
          </button>
        </div>
      )}

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        {!loading && telecallers.length === 0 && !error ? (
          <p className="py-10 text-center text-sm text-slate-400">
            No telecallers yet. Invite one from Manage Team to see their performance here.
          </p>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3">Telecaller</th>
                    <th className="px-3 py-3 text-right">Calls</th>
                    <th className="px-3 py-3 text-right">Connect %</th>
                    <th className="px-3 py-3 text-right">Positive %</th>
                    <th className="px-3 py-3 text-right">Close %</th>
                    <th className="px-3 py-3 text-right">Talk Time</th>
                    <th className="px-3 py-3 text-right">Quality</th>
                    <th className="px-5 py-3 text-right">30D</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <>
                      <SkeletonTableRow columns={8} />
                      <SkeletonTableRow columns={8} />
                      <SkeletonTableRow columns={8} />
                      <SkeletonTableRow columns={8} />
                      <SkeletonTableRow columns={8} />
                    </>
                  ) : (
                  telecallers.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <Link href={`/dashboard/telecallers/performance/detail?id=${t.id}`} className="flex items-center gap-2.5">
                          <span className="flex size-8 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700">
                            {initials(t.name)}
                          </span>
                          <span className="font-semibold text-slate-900">{t.name}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">{t.calls}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">{t.connect_pct}%</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">{t.positive_pct}%</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">{t.close_pct}%</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">{formatSeconds(t.talk_time_seconds)}</td>
                      <td className="px-3 py-3 text-right">
                        <span
                          className={cn(
                            "font-mono font-semibold tabular-nums",
                            // Thresholds scaled to the same 80%/60%-of-max bar as
                            // before, now that quality is /110 (5 dims + punctuality).
                            t.quality >= 88 ? "text-emerald-600" : t.quality >= 66 ? "text-amber-600" : "text-red-600"
                          )}
                        >
                          {t.quality}
                        </span>
                        <span className="text-slate-400">/110</span>
                      </td>
                      <td className="px-5 py-3">
                        {t.trend ? (
                          <Sparkline trend={t.trend} className="ml-auto h-6 w-20" />
                        ) : (
                          <span className="block text-right text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
        <p className="mt-3 text-xs text-slate-400">
          Quality Score = Opening (20) + Discovery (20) + Pitch (20) + Objection Handling (20) + Closing (20)
        </p>
      </div>
    </div>
  );
}
