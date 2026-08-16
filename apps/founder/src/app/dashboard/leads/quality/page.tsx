"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Skeleton, SkeletonTableRow } from "@/components/ui/Skeleton";
import { ApiError, leadsQualityApi, type LeadQuality, type ScoreDistribution } from "@/lib/api";
import { cn } from "@/lib/utils";

const BAND_TONE: Record<string, "danger" | "warning" | "primary" | "success"> = {
  "0-20": "danger",
  "21-40": "warning",
  "41-60": "warning",
  "61-80": "primary",
  "81-100": "success",
};

const BANT_FACTORS = [
  { key: "budget", label: "Budget", note: "Can they afford it, and is money confirmed" },
  { key: "authority", label: "Authority", note: "Are we talking to the actual decision maker" },
  { key: "need", label: "Need", note: "How real and specific is the need" },
  { key: "timeline", label: "Timeline", note: "How soon they intend to decide" },
];

export default function LeadQualityPage() {
  const [quality, setQuality] = useState<LeadQuality | null>(null);
  const [qualityLoading, setQualityLoading] = useState(true);
  const [qualityError, setQualityError] = useState<string | null>(null);

  const [distribution, setDistribution] = useState<ScoreDistribution | null>(null);
  const [distributionLoading, setDistributionLoading] = useState(true);

  function load() {
    setQualityLoading(true);
    setQualityError(null);
    leadsQualityApi
      .quality()
      .then(setQuality)
      .catch((e) => setQualityError(e instanceof ApiError ? e.message : "Failed to load lead quality"))
      .finally(() => setQualityLoading(false));

    setDistributionLoading(true);
    leadsQualityApi
      .scoreDistribution()
      .then(setDistribution)
      .catch(() => setDistribution(null))
      .finally(() => setDistributionLoading(false));
  }

  useEffect(load, []);

  const totalLeads = quality ? Object.values(quality.verdict_breakdown).reduce((s, v) => s + v, 0) : 0;
  const junkRate = quality && totalLeads > 0 ? Math.round((quality.verdict_breakdown.Junk / totalLeads) * 100) : 0;
  const bestSource = quality?.source_matrix.length
    ? [...quality.source_matrix].sort((a, b) => b.positive_pct - a.positive_pct)[0]
    : null;

  return (
    <div className="pb-10">
      <PageHeader title="Lead Quality" description="Which enquiries are worth calling, and which sources send them" />

      {qualityError && (
        <div className="mt-4 mx-4 sm:mx-6 lg:mx-8 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {qualityError} —{" "}
          <button className="font-semibold underline" onClick={load}>
            Retry
          </button>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-4">
        <StatCard
          label="Average Lead Score"
          value={qualityLoading ? <Skeleton className="h-6 w-12" /> : quality?.avg_bant_score != null ? String(quality.avg_bant_score) : "—"}
          suffix="/100"
        />
        <StatCard
          label="Hot Leads Open"
          value={qualityLoading ? <Skeleton className="h-6 w-12" /> : String(quality?.verdict_breakdown.Hot ?? 0)}
          note="Score 80+ and still in play"
        />
        <StatCard
          label="Junk Rate"
          value={qualityLoading ? <Skeleton className="h-6 w-12" /> : `${junkRate}%`}
          note={qualityLoading ? undefined : `${quality?.verdict_breakdown.Junk ?? 0} of ${totalLeads} leads`}
        />
        <StatCard
          label="Best Source"
          value={qualityLoading ? <Skeleton className="h-6 w-12" /> : bestSource ? bestSource.source : "—"}
          note={bestSource ? `${bestSource.positive_pct}% positive` : "No source data yet"}
        />
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900">Where Your Leads Score</h3>
          <p className="mt-0.5 text-xs text-slate-400">Every lead is scored 0–100 by the AI on how likely it is to convert</p>
          {distributionLoading ? (
            <div className="mt-4 flex flex-col gap-3">
              <Skeleton block className="h-6 w-full" />
              <Skeleton block className="h-6 w-full" />
              <Skeleton block className="h-6 w-full" />
            </div>
          ) : !distribution || distribution.bands.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No scored leads yet.</p>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {distribution.bands.map((b) => (
                <div key={b.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{b.label}</span>
                    <span className="text-slate-500">
                      {b.count} leads · {b.pct_of_total}% · {b.close_rate_pct}% close rate
                    </span>
                  </div>
                  <ProgressBar value={b.pct_of_total} tone={BAND_TONE[b.label] ?? "primary"} className="mt-1.5" />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="overflow-hidden">
          <div className="p-5 pb-0">
            <h3 className="text-sm font-semibold text-slate-900">Which Sources Send Good Leads</h3>
            <p className="mt-0.5 text-xs text-slate-400">Positive rate is how often the AI verdict came back Hot or Warm</p>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-2">Source</th>
                  <th className="px-3 py-2 text-right">Leads</th>
                  <th className="px-3 py-2 text-right">Positive %</th>
                  <th className="px-3 py-2 text-right">Junk %</th>
                  <th className="px-5 py-2 text-right">Close %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {qualityLoading ? (
                  <>
                    <SkeletonTableRow columns={5} />
                    <SkeletonTableRow columns={5} />
                    <SkeletonTableRow columns={5} />
                  </>
                ) : !quality || quality.source_matrix.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-400">
                      No leads with a source recorded yet.
                    </td>
                  </tr>
                ) : (
                  quality.source_matrix.map((s) => (
                    <tr key={s.source} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-900">{s.source}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">{s.total}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-emerald-600">{s.positive_pct}%</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-red-500">{s.junk_pct}%</td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums">{s.close_pct}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900">How The Score Is Worked Out</h3>
          <p className="mt-0.5 text-xs text-slate-400">BANT, scored by the AI from the enquiry and every call — 25 points each, out of 100</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {BANT_FACTORS.map((f) => (
              <div key={f.key} className="flex items-start gap-3 rounded-lg border border-slate-100 px-3 py-2.5">
                <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[10px] font-bold text-primary-700")}>
                  25
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-800">{f.label}</p>
                  <p className="text-xs text-slate-400">{f.note}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
