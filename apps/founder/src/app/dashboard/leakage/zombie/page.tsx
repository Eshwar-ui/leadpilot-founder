"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Clock, Settings } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import { Modal } from "@/components/ui/Modal";
import { ApiError, leadsApi, leadsQualityApi, type ZombieLead, type ZombieLeads } from "@/lib/api";

export default function ZombieLeadsPage() {
  const [zombie, setZombie] = useState<ZombieLeads | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingDead, setMarkingDead] = useState<ZombieLead | null>(null);
  const [markError, setMarkError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    leadsQualityApi
      .zombie()
      .then(setZombie)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load zombie leads"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function confirmMarkDead() {
    if (!markingDead) return;
    setMarking(true);
    setMarkError(null);
    try {
      await leadsApi.updateStage(markingDead.id, "Junk");
      setZombie((prev) => (prev ? { ...prev, leads: prev.leads.filter((l) => l.id !== markingDead.id) } : prev));
      setMarkingDead(null);
    } catch (e) {
      setMarkError(e instanceof ApiError ? e.message : "Failed to mark lead dead");
    } finally {
      setMarking(false);
    }
  }

  const leads = zombie?.leads ?? [];
  // The stall threshold is the org's configured `zombie_days` (default 7, set in
  // app/api/dashboard.py). Never substitute a literal here — a wrong number would
  // read as fact — so anything that needs it renders a placeholder until it loads.
  const thresholdDays = zombie?.threshold_days ?? null;
  const avgDays =
    leads.length > 0 ? Math.round(leads.reduce((sum, z) => sum + z.days_stalled, 0) / leads.length) : 0;

  return (
    <div className="pb-10">
      <PageHeader
        title="Zombie Lead Analyzer"
        description={
          thresholdDays !== null
            ? `Stalled ${thresholdDays}+ days with no positive signal — consuming telecaller capacity`
            : "Leads sitting in an active stage with no positive signal — consuming telecaller capacity"
        }
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

      <div className="mt-4 grid grid-cols-2 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-3">
        {/* On a failed fetch `leads` is still [], so every stat here would read as a
            confident zero sitting under the error banner. Show "—" instead. */}
        <StatCard
          label="Zombie Leads"
          value={loading ? <Skeleton className="h-7 w-12" /> : error ? "—" : String(leads.length)}
          tone="danger"
          icon={Users}
        />
        <StatCard
          label="Avg Days Stalled"
          value={
            loading ? (
              <Skeleton className="h-7 w-12" />
            ) : error || leads.length === 0 ? (
              "—"
            ) : (
              `${avgDays}d`
            )
          }
          icon={Clock}
        />
        <StatCard
          label="Stall Threshold"
          value={loading ? <Skeleton className="h-7 w-12" /> : thresholdDays !== null ? `${thresholdDays}d` : "—"}
        />
      </div>

      {/* Everything below is data-derived, so it is suppressed entirely while an
          error is showing — otherwise the all-clear copy renders under the banner. */}
      {!error && (
        <>
          <div className="mt-4 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-sm text-slate-600">
                {loading ? (
                  <Skeleton block className="h-4 w-64" />
                ) : leads.length > 0 ? (
                  <p>
                    <span className="font-semibold text-red-600">{leads.length} zombie leads</span> have been stalled
                    for <span className="font-semibold text-slate-900">{thresholdDays}+ days</span> with zero
                    conversion signal.
                  </p>
                ) : (
                  <p>
                    <span className="font-semibold text-emerald-700">Every active-stage lead has moved</span> within
                    the last {thresholdDays} days.
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-600">
                  Leads appear here automatically once they cross the stall threshold. Nothing is marked dead for you —
                  use Mark Dead on a row to move a lead to Junk.
                </p>
              </div>
              {/* The only real, persisted control over this screen's behaviour is the
                  org's `zombie_days` setting, so link there instead of offering a
                  local rule builder that the backend has no concept of. */}
              <Link
                href="/dashboard/settings/alerts"
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Settings className="size-3.5" /> Change stall threshold
              </Link>
            </div>
          </div>

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
                  No zombie leads to clear — nothing has sat in an active pipeline stage for {thresholdDays}+ days.
                  Your pipeline is moving.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-5 py-3">Lead Name</th>
                        <th className="px-3 py-3">Pipeline Stage</th>
                        <th className="px-3 py-3 text-right">Days Stalled</th>
                        <th className="px-3 py-3">Telecaller</th>
                        <th className="px-5 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {leads.map((z) => (
                        <tr key={z.id}>
                          <td className="px-5 py-3 font-semibold text-slate-900">{z.name}</td>
                          <td className="px-3 py-3 text-blue-600">{z.pipeline_stage}</td>
                          <td className="px-3 py-3 text-right font-mono font-semibold text-red-600">
                            {z.days_stalled}d
                          </td>
                          <td className="px-3 py-3 font-mono text-slate-600">{z.telecaller_name ?? "Unassigned"}</td>
                          <td className="px-5 py-3 text-right">
                            <button
                              onClick={() => {
                                setMarkError(null);
                                setMarkingDead(z);
                              }}
                              className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
                            >
                              Mark Dead
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      <Modal
        open={markingDead !== null}
        onClose={() => setMarkingDead(null)}
        title="Mark lead dead"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setMarkingDead(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={confirmMarkDead} disabled={marking}>
              {marking ? "Marking…" : "Mark Dead"}
            </Button>
          </>
        }
      >
        {markError && (
          <p role="alert" className="mb-3 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
            {markError}
          </p>
        )}
        <p>
          Move <b>{markingDead?.name}</b> to the Junk stage and remove it from the pipeline? This can be undone
          later from the Kanban board.
        </p>
      </Modal>
    </div>
  );
}
