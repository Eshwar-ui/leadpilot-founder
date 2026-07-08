"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import {
  ApiError,
  leadsQualityApi,
  type AgeingLead,
  type LeadAgeing,
  type LeadQuality,
  type ScoreDistribution,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const VERDICT_TONE: Record<string, "success" | "primary" | "warning" | "danger"> = {
  Hot: "success",
  Warm: "primary",
  Cold: "warning",
  Junk: "danger",
};

const AGEING_BUCKET_TONE: Record<AgeingLead["bucket"], string> = {
  "0-3": "text-slate-600",
  "3-7": "text-amber-600",
  "7+": "text-red-600",
};

export default function LeadQualityPage() {
  const [quality, setQuality] = useState<LeadQuality | null>(null);
  const [qualityLoading, setQualityLoading] = useState(true);
  const [qualityError, setQualityError] = useState<string | null>(null);

  const [distribution, setDistribution] = useState<ScoreDistribution | null>(null);
  const [distributionLoading, setDistributionLoading] = useState(true);

  const [ageing, setAgeing] = useState<LeadAgeing | null>(null);
  const [ageingLoading, setAgeingLoading] = useState(true);
  const [ageingError, setAgeingError] = useState<string | null>(null);

  function loadQuality() {
    setQualityLoading(true);
    setQualityError(null);
    leadsQualityApi
      .quality()
      .then(setQuality)
      .catch((e) => setQualityError(e instanceof ApiError ? e.message : "Failed to load lead quality"))
      .finally(() => setQualityLoading(false));
  }

  function loadDistribution() {
    setDistributionLoading(true);
    leadsQualityApi
      .scoreDistribution()
      .then(setDistribution)
      .catch(() => setDistribution(null))
      .finally(() => setDistributionLoading(false));
  }

  function loadAgeing() {
    setAgeingLoading(true);
    setAgeingError(null);
    leadsQualityApi
      .ageing()
      .then(setAgeing)
      .catch((e) => setAgeingError(e instanceof ApiError ? e.message : "Failed to load lead ageing"))
      .finally(() => setAgeingLoading(false));
  }

  useEffect(loadQuality, []);
  useEffect(loadDistribution, []);
  useEffect(loadAgeing, []);

  const verdictEntries = Object.entries(quality?.verdict_breakdown ?? {}) as [
    keyof NonNullable<LeadQuality["verdict_breakdown"]>,
    number
  ][];
  const maxVerdictLeads = Math.max(1, ...verdictEntries.map(([, count]) => count));
  const maxBandCount = Math.max(1, ...(distribution?.bands.map((b) => b.count) ?? [0]));

  return (
    <div className="pb-10">
      <PageHeader
        title="Lead Quality Deep Dive"
        description="Source quality matrix, score distribution, and lead ageing — sorted by volume"
      />

      {qualityError && (
        <div className="mt-4 mx-4 sm:mx-6 lg:mx-8 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {qualityError} —{" "}
          <button className="font-semibold underline" onClick={loadQuality}>
            Retry
          </button>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <h3 className="flex items-center gap-2 p-5 pb-3 text-sm font-semibold text-slate-900">
            ▤ Source Quality Matrix
          </h3>
          {qualityLoading ? (
            <p className="px-5 pb-5 text-sm text-slate-400">Loading…</p>
          ) : (quality?.source_matrix ?? []).length === 0 ? (
            <p className="px-5 pb-5 text-sm text-slate-400">No lead source data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-y border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-2.5">Source</th>
                    <th className="px-3 py-2.5 text-right">Leads</th>
                    <th className="px-3 py-2.5 text-right">Junk%</th>
                    <th className="px-3 py-2.5 text-right">Positive%</th>
                    <th className="px-5 py-2.5 text-right">Close%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(quality?.source_matrix ?? []).map((row) => (
                    <tr key={row.source}>
                      <td className="px-5 py-3 font-semibold text-slate-900">{row.source}</td>
                      <td className="px-3 py-3 text-right font-mono">{row.total}</td>
                      <td className={cn("px-3 py-3 text-right font-mono", row.junk_pct >= 20 && "text-red-600")}>
                        {row.junk_pct}%
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-emerald-600">{row.positive_pct}%</td>
                      <td className="px-5 py-3 text-right font-mono">{row.close_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900">▦ Verdict Distribution</h3>
          <div className="mt-3 rounded-lg bg-primary-50 px-3 py-2 text-xs text-primary-700">
            <span className="font-semibold">Avg BANT Score:</span>{" "}
            {quality?.avg_bant_score === null || quality?.avg_bant_score === undefined
              ? "Not enough data yet"
              : quality.avg_bant_score}
          </div>
          {qualityLoading ? (
            <p className="mt-4 text-sm text-slate-400">Loading…</p>
          ) : (
            <div className="mt-4 space-y-4">
              {verdictEntries.map(([verdict, count]) => (
                <div key={verdict}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{verdict}</span>
                    <span className="text-slate-400">{count} leads</span>
                  </div>
                  <div className="mt-1">
                    <ProgressBar value={count} max={maxVerdictLeads} tone={VERDICT_TONE[verdict] ?? "primary"} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900">Lead Score Distribution</h3>
          {distributionLoading ? (
            <p className="mt-4 text-sm text-slate-400">Loading…</p>
          ) : !distribution || distribution.bands.every((b) => b.count === 0) ? (
            <p className="mt-4 text-sm text-slate-400">No scored leads yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {distribution.bands.map((band) => (
                <div key={band.label}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{band.label}</span>
                    <span className="text-slate-400">
                      {band.count} leads ({band.pct_of_total}%) · {band.close_rate_pct}% close rate
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-primary-500"
                      style={{ width: `${(100 * band.count) / maxBandCount}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 p-5 pb-3">
            <h3 className="text-sm font-semibold text-slate-900">Lead Ageing Report</h3>
            {ageing && (
              <div className="flex gap-3 text-xs text-slate-500">
                <span>0-3d: <b className="text-slate-900">{ageing.summary["0-3"]}</b></span>
                <span>3-7d: <b className="text-amber-600">{ageing.summary["3-7"]}</b></span>
                <span>7d+: <b className="text-red-600">{ageing.summary["7+"]}</b></span>
              </div>
            )}
          </div>
          {ageingError ? (
            <p className="px-5 pb-5 text-sm text-red-600">
              {ageingError} —{" "}
              <button className="font-semibold underline" onClick={loadAgeing}>
                Retry
              </button>
            </p>
          ) : ageingLoading ? (
            <p className="px-5 pb-5 text-sm text-slate-400">Loading…</p>
          ) : (ageing?.leads.length ?? 0) === 0 ? (
            <p className="px-5 pb-5 text-sm text-slate-400">No open leads — nothing ageing right now.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-y border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-2.5">Lead</th>
                    <th className="px-3 py-2.5">Source</th>
                    <th className="px-3 py-2.5">Stage</th>
                    <th className="px-5 py-2.5 text-right">Days Stuck</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(ageing?.leads ?? []).slice(0, 50).map((lead) => (
                    <tr key={lead.id}>
                      <td className="px-5 py-3 font-semibold text-slate-900">{lead.name}</td>
                      <td className="px-3 py-3 text-slate-600">{lead.source ?? "Unknown"}</td>
                      <td className="px-3 py-3 text-slate-600">{lead.pipeline_stage}</td>
                      <td className={cn("px-5 py-3 text-right font-mono font-semibold", AGEING_BUCKET_TONE[lead.bucket])}>
                        {lead.days_stuck}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
