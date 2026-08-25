"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Phone, Megaphone } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import { ApiError, leadsQualityApi, type LeadWastage } from "@/lib/api";

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
  // The org's configured wastage_days, straight from the server. Null until the
  // fetch lands (or if it failed) — never substitute a literal here, the whole
  // point is that the client has no business inventing this number.
  const thresholdDays = wastage?.threshold_days ?? null;
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

      <div className="mt-4 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 sm:grid-cols-3">
        {/* A failed fetch leaves `wastage` null and `leads` empty, which would render
            a confident "0 / —" under the error banner. Show "—" so a broken load is
            never mistaken for a clean funnel. */}
        <StatCard
          label="Total Never Called"
          value={
            loading ? <Skeleton className="h-7 w-12" /> : error ? "—" : String(wastage?.total_wasted ?? 0)
          }
          tone="danger"
          icon={Phone}
        />
        <StatCard
          label="Worst Source"
          value={
            loading ? <Skeleton className="h-7 w-24" /> : error || !worstSource ? "—" : worstSource[0]
          }
          icon={Megaphone}
        />
        <StatCard
          label="Wasted Leads Listed"
          value={loading ? <Skeleton className="h-7 w-12" /> : error ? "—" : String(leads.length)}
        />
      </div>

      {/* The table region is suppressed while an error is showing: `leads` is [] on a
          failed fetch, so the empty branch would otherwise assert an all-clear
          directly underneath the red banner. */}
      {!error && (
        <div className="mt-4 px-4 sm:px-6 lg:px-8">
          <Card className="overflow-hidden">
            {loading ? (
              <div className="space-y-3 px-5 py-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} block className="h-4 w-full" />
                ))}
              </div>
            ) : leads.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-600">
                Nothing is being wasted — every lead in New or Assigned has either been called or is still
                inside your {thresholdDays !== null ? `${thresholdDays}-day` : ""} untouched-lead window.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
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
                        {/* Every row returned is already past the org's threshold, so
                            the colour marks how far past: 2x the configured window is
                            the point worth escalating. Driven by the server's own
                            wastage_days — never a cutoff invented on the client. */}
                        <td
                          className={`px-3 py-4 text-right font-mono font-semibold ${
                            thresholdDays !== null && w.days_since_created >= thresholdDays * 2
                              ? "text-red-700"
                              : "text-slate-700"
                          }`}
                        >
                          {w.days_since_created}d
                          {thresholdDays !== null && w.days_since_created >= thresholdDays * 2 && (
                            <span className="ml-1.5 text-[11px] font-semibold uppercase tracking-wide">
                              overdue
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right font-mono text-slate-600">{w.pipeline_stage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {leads.length > 0 && !loading && (
            <p className="mt-3 text-xs text-slate-600">
              Every lead listed has gone{" "}
              {thresholdDays !== null ? `${thresholdDays}+ days` : "past your threshold"} without a call.{" "}
              <Link href="/dashboard/settings/alerts" className="font-semibold text-primary-700 underline">
                Change the threshold
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
