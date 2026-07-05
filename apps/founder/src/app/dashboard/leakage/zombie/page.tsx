"use client";

import { useEffect, useState } from "react";
import { Users, Clock, Settings } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { Modal } from "@/components/ui/Modal";
import { ApiError, leadsQualityApi, type ZombieLeads } from "@/lib/api";

export default function ZombieLeadsPage() {
  const [open, setOpen] = useState(false);
  const [zombie, setZombie] = useState<ZombieLeads | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const leads = zombie?.leads ?? [];
  const avgDays =
    leads.length > 0 ? Math.round(leads.reduce((sum, z) => sum + z.days_stalled, 0) / leads.length) : 0;

  return (
    <div className="pb-10">
      <PageHeader
        title="Zombie Lead Analyzer"
        description={`Stalled ${zombie?.threshold_days ?? 14}+ days with no positive signal — consuming telecaller capacity`}
      />

      {error && (
        <div className="mt-4 mx-4 sm:mx-6 lg:mx-8 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error} —{" "}
          <button className="font-semibold underline" onClick={load}>
            Retry
          </button>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-3">
        <StatCard label="Zombie Leads" value={loading ? "…" : String(leads.length)} tone="danger" icon={Users} />
        <StatCard label="Avg Days Stalled" value={loading ? "…" : `${avgDays}d`} icon={Clock} />
        <StatCard label="Stall Threshold" value={`${zombie?.threshold_days ?? 14}d`} />
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-red-600">{leads.length} zombie leads</span> have been stalled for{" "}
            <span className="font-semibold text-slate-900">{zombie?.threshold_days ?? 14}+ days</span> with zero
            conversion signal.
            <br />
            <span className="text-xs text-slate-400">
              Activate the Auto-Dead rule to automatically clear similar leads going forward.
            </span>
          </p>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Settings className="size-3.5" /> Auto-Dead Rule →
          </Button>
        </div>
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="overflow-hidden">
          {loading ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">Loading zombie leads…</p>
          ) : leads.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">
              No zombie leads right now — nothing stalled past the threshold.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
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
                      <td className="px-3 py-3 text-right font-mono font-semibold text-red-600">{z.days_stalled}d</td>
                      <td className="px-3 py-3 font-mono text-slate-400">{z.telecaller_name ?? "Unassigned"}</td>
                      <td className="px-5 py-3 text-right">
                        <button className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100">
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

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Configure Auto-Dead Rule"
        footer={
          <>
            <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={() => setOpen(false)}>
              Activate Auto-Dead Rule
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Attempt Threshold
            </label>
            <input defaultValue="6 attempts" className="input" />
            <p className="mt-1 text-xs text-slate-400">After this many contacts with no positive signal</p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Day Threshold
            </label>
            <input defaultValue="14 days" className="input" />
            <p className="mt-1 text-xs text-slate-400">After this many days in funnel</p>
          </div>
        </div>
        <div className="mt-4 rounded-lg bg-primary-50 px-3 py-2.5 text-xs text-primary-700">
          Auto-marked leads are moved to &quot;Dead&quot; stage and removed from telecaller queues. This action is
          logged and reversible.
        </div>
      </Modal>
    </div>
  );
}
