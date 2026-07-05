"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ApiError, leadsQualityApi, type LeadQuality } from "@/lib/api";

const VERDICT_TONE: Record<string, "success" | "primary" | "warning" | "danger"> = {
  Hot: "success",
  Warm: "primary",
  Cold: "warning",
  Junk: "danger",
};

export default function LeadQualityPage() {
  const [quality, setQuality] = useState<LeadQuality | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    leadsQualityApi
      .quality()
      .then(setQuality)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load lead quality"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const sourceEntries = Object.entries(quality?.source_breakdown ?? {}).sort((a, b) => b[1] - a[1]);
  const verdictEntries = Object.entries(quality?.verdict_breakdown ?? {}) as [
    keyof NonNullable<LeadQuality["verdict_breakdown"]>,
    number
  ][];
  const maxVerdictLeads = Math.max(1, ...verdictEntries.map(([, count]) => count));

  return (
    <div className="pb-10">
      <PageHeader
        title="Lead Quality Deep Dive"
        description="Source breakdown + verdict distribution — sorted by volume"
      />

      {error && (
        <div className="mt-4 mx-4 sm:mx-6 lg:mx-8 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error} —{" "}
          <button className="font-semibold underline" onClick={load}>
            Retry
          </button>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <h3 className="flex items-center gap-2 p-5 pb-3 text-sm font-semibold text-slate-900">
            ▤ Source Breakdown
          </h3>
          {loading ? (
            <p className="px-5 pb-5 text-sm text-slate-400">Loading…</p>
          ) : sourceEntries.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-slate-400">No lead source data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[360px] text-sm">
                <thead>
                  <tr className="border-y border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-2.5">Source</th>
                    <th className="px-5 py-2.5 text-right">Leads</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sourceEntries.map(([source, count]) => (
                    <tr key={source}>
                      <td className="px-5 py-3 font-semibold text-slate-900">{source}</td>
                      <td className="px-5 py-3 text-right font-mono">{count}</td>
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
          {loading ? (
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
    </div>
  );
}
