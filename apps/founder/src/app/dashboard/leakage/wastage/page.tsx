"use client";

import { useEffect, useState } from "react";
import { Phone, Megaphone } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { ApiError, leadsQualityApi, type LeadWastage } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function LeadWastagePage() {
  const [wastage, setWastage] = useState<LeadWastage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    leadsQualityApi
      .wastage()
      .then(setWastage)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load lead wastage"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const leads = wastage?.leads ?? [];
  const sourceCounts = leads.reduce<Record<string, number>>((acc, l) => {
    const key = l.source ?? "Unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const worstSource = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="pb-10">
      <PageHeader
        title="Lead Wastage Monitor"
        description="Leads that entered the funnel but were never contacted"
      />

      {error && (
        <div className="mt-4 mx-4 sm:mx-6 lg:mx-8 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error} —{" "}
          <button className="font-semibold underline" onClick={load}>
            Retry
          </button>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 sm:grid-cols-3">
        <StatCard
          label="Total Never Called"
          value={loading ? "…" : String(wastage?.total_wasted ?? 0)}
          tone="danger"
          icon={Phone}
        />
        <StatCard
          label="Worst Source"
          value={loading ? "…" : worstSource ? worstSource[0] : "—"}
          icon={Megaphone}
        />
        <StatCard label="Wasted Leads Listed" value={loading ? "…" : String(leads.length)} />
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="overflow-hidden">
          {loading ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">Loading wasted leads…</p>
          ) : leads.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">
              No wasted leads — every lead has been contacted.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3">Lead</th>
                    <th className="px-3 py-3">Source</th>
                    <th className="px-3 py-3 text-right">Days Since Created</th>
                    <th className="px-5 py-3 text-right">Pipeline Stage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.map((w) => (
                    <tr key={w.id}>
                      <td className="px-5 py-4 font-semibold text-slate-900">{w.name}</td>
                      <td className="px-3 py-4 text-slate-600">{w.source ?? "Unknown"}</td>
                      <td
                        className={cn(
                          "px-3 py-4 text-right font-mono font-semibold",
                          w.days_since_created > 5 ? "text-red-600" : "text-slate-700"
                        )}
                      >
                        {w.days_since_created}d
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-slate-500">{w.pipeline_stage}</td>
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
