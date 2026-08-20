"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, UserPlus, Users, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { SkeletonTableRow } from "@/components/ui/Skeleton";
import { AddTelecallerModal, EditTelecallerModal } from "@/components/team/TeamMemberModals";
import { ApiError, teamApi, telecallersApi, type TeamHealthEntry, type TeamMember } from "@/lib/api";
import { cn, formatINR, initials, TELECALLER_STATUS_DOT, TELECALLER_STATUS_PILL } from "@/lib/utils";

function connectPct(t: TeamHealthEntry) {
  return t.calls > 0 ? Math.round((t.connected / t.calls) * 100) : 0;
}

function lastCallLabel(t: TeamHealthEntry) {
  if (!t.last_call_at) return "No calls today";
  return new Date(t.last_call_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

const NEEDS_NUDGE_MIN = 15; // matches the Break threshold — idling that long is worth a nudge

type Metric = {
  key: keyof TeamHealthEntry | "connect_pct";
  label: string;
  hint: string;
  lowerBetter?: boolean;
  format: (t: TeamHealthEntry) => string;
  value: (t: TeamHealthEntry) => number | null;
};

const COMPARE_METRICS: Metric[] = [
  { key: "calls", label: "Calls Today", hint: "Total attempted", format: (t) => String(t.calls), value: (t) => t.calls },
  { key: "leads_assigned", label: "Leads Assigned", hint: "Currently in their queue", format: (t) => String(t.leads_assigned), value: (t) => t.leads_assigned },
  { key: "connect_pct", label: "Connect Rate", hint: "Of calls attempted", format: (t) => `${connectPct(t)}%`, value: (t) => connectPct(t) },
  { key: "closed_won", label: "Deals Closed", hint: "Today", format: (t) => String(t.closed_won), value: (t) => t.closed_won },
  { key: "quality", label: "Quality Score", hint: "AI-scored, out of 110", format: (t) => String(t.quality), value: (t) => t.quality },
  {
    key: "idle_minutes",
    label: "Idle Time",
    hint: "Lower is better",
    lowerBetter: true,
    format: (t) => (t.idle_minutes != null ? `${t.idle_minutes}m` : "—"),
    value: (t) => t.idle_minutes,
  },
];

export default function PerformanceMatrixPage() {
  const [telecallers, setTelecallers] = useState<TeamHealthEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  // Role isn't part of the live-status payload (calls/quality/idle etc.) —
  // fetched separately from /api/team, same source Settings > Users and the
  // Telecaller Detail page use, so "Add"/"Edit" here write through the same
  // endpoint and never disagree with what those screens show.
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    telecallersApi
      .status()
      .then((res) => setTelecallers(res.telecallers))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load team status"))
      .finally(() => setLoading(false));
    teamApi.list().then(setMembers).catch(() => setMembers([]));
  }

  useEffect(load, []);

  function toggleSelect(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : prev.length >= 4 ? prev : [...prev, id]
    );
  }

  function toggleCompare() {
    setCompareOpen((o) => !o);
    setSelected([]);
  }

  const totals = useMemo(() => {
    const calls = telecallers.reduce((s, t) => s + t.calls, 0);
    const connected = telecallers.reduce((s, t) => s + t.connected, 0);
    const closed = telecallers.reduce((s, t) => s + t.closed_won, 0);
    const revenue = telecallers.reduce((s, t) => s + t.revenue_today, 0);
    const needingNudge = telecallers.filter((t) => t.idle_minutes != null && t.idle_minutes >= NEEDS_NUDGE_MIN);
    return { calls, connected, closed, revenue, needingNudge };
  }, [telecallers]);

  const picked = telecallers.filter((t) => selected.includes(t.id));

  return (
    <div className="pb-10">
      <PageHeader
        title="Performance Matrix"
        description="Who is working and how today is going"
        action={
          <Button size="sm" onClick={() => setAdding(true)}>
            <UserPlus className="size-3.5" /> Add Team Member
          </Button>
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

      <div className="mt-6 grid grid-cols-2 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-4">
        <StatCard label="Calls Made Today" value={loading ? "—" : String(totals.calls)} />
        <StatCard
          label="Connected"
          value={loading ? "—" : totals.calls > 0 ? `${Math.round((totals.connected / totals.calls) * 100)}%` : "0%"}
          note={loading ? undefined : `${totals.connected} of ${totals.calls} calls`}
        />
        <StatCard
          label="Deals Closed Today"
          value={loading ? "—" : String(totals.closed)}
          note={loading ? undefined : `₹${formatINR(totals.revenue)}`}
        />
        <StatCard
          label="Needs a Nudge"
          value={loading ? "—" : String(totals.needingNudge.length)}
          note={
            loading
              ? undefined
              : totals.needingNudge.length
              ? totals.needingNudge.map((t) => t.name).join(", ")
              : `None — within ${NEEDS_NUDGE_MIN} min`
          }
          noteTone={!loading && totals.needingNudge.length > 0 ? "warning" : "neutral"}
        />
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 p-5 pb-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Users className="size-4 text-primary-600" /> Who Is Working Right Now
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Active = calling now · Break ≤15m idle · Inactive &gt;45m idle or logged out · Absent = not logged in
              </p>
            </div>
            <Button variant={compareOpen ? "secondary" : "outline"} size="sm" onClick={toggleCompare}>
              {compareOpen ? "Cancel Compare" : "Compare"}
            </Button>
          </div>

          {compareOpen && selected.length < 2 && (
            <div className="mx-5 mb-3 rounded-lg bg-primary-50 px-3 py-2 text-xs font-medium text-primary-700">
              Select {2 - selected.length} more telecaller{2 - selected.length === 1 ? "" : "s"} to compare — up to 4.
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {compareOpen && <th className="w-10 px-5 py-2" />}
                  <th className={cn("py-2", compareOpen ? "px-3" : "px-5")}>Telecaller</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Calls</th>
                  <th className="px-3 py-2 text-right">Leads</th>
                  <th className="px-3 py-2 text-right">Connected</th>
                  <th className="px-3 py-2 text-right">Closed</th>
                  <th className="px-3 py-2 text-right">Quality</th>
                  <th className="px-5 py-2">Last Call</th>
                  {!compareOpen && <th className="px-5 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <>
                    <SkeletonTableRow columns={8} />
                    <SkeletonTableRow columns={8} />
                    <SkeletonTableRow columns={8} />
                  </>
                ) : telecallers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-10 text-center text-sm text-slate-400">
                      No telecallers on this team yet.
                    </td>
                  </tr>
                ) : (
                  telecallers.map((t) => {
                    const isSelected = selected.includes(t.id);
                    const row = (
                      <>
                        {compareOpen && (
                          <td className="px-5 py-3">
                            <button
                              onClick={() => toggleSelect(t.id)}
                              aria-label={isSelected ? `Remove ${t.name} from comparison` : `Add ${t.name} to comparison`}
                              className={cn(
                                "flex size-4 items-center justify-center rounded border",
                                isSelected ? "border-primary-600 bg-primary-600" : "border-slate-300 bg-white"
                              )}
                            >
                              {isSelected && <span className="size-1.5 rounded-sm bg-white" />}
                            </button>
                          </td>
                        )}
                        <td className={cn("py-3", compareOpen ? "px-3" : "px-5")}>
                          {compareOpen ? (
                            <button onClick={() => toggleSelect(t.id)} className="flex items-center gap-2.5 text-left">
                              <span className="flex size-8 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700">
                                {initials(t.name)}
                              </span>
                              <span className="font-semibold text-slate-900">{t.name}</span>
                            </button>
                          ) : (
                            <Link href={`/dashboard/telecallers/performance/detail?id=${t.id}`} className="flex items-center gap-2.5">
                              <span className="flex size-8 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700">
                                {initials(t.name)}
                              </span>
                              <span className="font-semibold text-slate-900">{t.name}</span>
                            </Link>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", TELECALLER_STATUS_PILL[t.status])}>
                            <span className={cn("size-1.5 rounded-full", TELECALLER_STATUS_DOT[t.status])} />
                            {t.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums">{t.calls}</td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums">{t.leads_assigned}</td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums">{connectPct(t)}%</td>
                        <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-emerald-600">{t.closed_won}</td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums">{t.quality}</td>
                        <td className="px-5 py-3 text-xs text-slate-500">{lastCallLabel(t)}</td>
                        {!compareOpen && (
                          <td className="px-5 py-3 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!members.find((m) => m.id === t.id)}
                              onClick={() => setEditing(members.find((m) => m.id === t.id) ?? null)}
                            >
                              <Pencil className="size-3.5" /> Edit
                            </Button>
                          </td>
                        )}
                      </>
                    );
                    return (
                      <tr key={t.id} className={cn("hover:bg-slate-50", isSelected && "bg-primary-50/50")}>
                        {row}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {compareOpen && picked.length >= 2 && (
        <div className="mt-4 px-4 sm:px-6 lg:px-8">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between p-5 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Comparison</h3>
                <p className="mt-0.5 text-xs text-slate-400">{picked.length} of 4 selected · best value in each row is tagged</p>
              </div>
              <button onClick={toggleCompare} className="text-slate-400 hover:text-slate-600">
                <X className="size-4" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-2">Metric</th>
                    {picked.map((t) => (
                      <th key={t.id} className="px-3 py-2 text-right">{t.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {COMPARE_METRICS.map((m) => {
                    const values = picked.map((t) => m.value(t)).filter((v): v is number => v != null);
                    const best = values.length ? (m.lowerBetter ? Math.min(...values) : Math.max(...values)) : null;
                    const tie = values.length > 1 && values.every((v) => v === values[0]);
                    return (
                      <tr key={String(m.key)}>
                        <td className="px-5 py-3">
                          <span className="font-medium text-slate-800">{m.label}</span>
                          <span className="block text-xs text-slate-400">{m.hint}</span>
                        </td>
                        {picked.map((t) => {
                          const v = m.value(t);
                          const isBest = !tie && v != null && v === best;
                          return (
                            <td key={t.id} className="px-3 py-3 text-right">
                              <span className={cn("font-mono font-semibold tabular-nums", isBest ? "text-emerald-600" : "text-slate-800")}>
                                {m.format(t)}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      <AddTelecallerModal open={adding} onClose={() => setAdding(false)} onAdded={load} />
      <EditTelecallerModal
        open={editing !== null}
        member={editing}
        onClose={() => setEditing(null)}
        onSaved={(updated) => setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))}
      />
    </div>
  );
}
