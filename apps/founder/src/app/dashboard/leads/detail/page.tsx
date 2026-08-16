"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Phone, Copy, Flame, Sparkles, Pencil } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { ApiError, leadsApi, orgApi, teamApi, type LeadDetail, type TeamMember } from "@/lib/api";
import { cn, formatINR, VERDICT_TONE } from "@/lib/utils";

function EditLeadModal({
  lead,
  open,
  onClose,
  onSaved,
}: {
  lead: LeadDetail;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(lead.name);
  const [phone, setPhone] = useState(lead.phone ?? "");
  const [source, setSource] = useState(lead.source ?? "");
  const [dealValue, setDealValue] = useState(lead.deal_value != null ? String(lead.deal_value) : "");
  const [reason, setReason] = useState(lead.reason ?? "");
  const [assignedTo, setAssignedTo] = useState("");
  const [telecallers, setTelecallers] = useState<TeamMember[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(lead.name);
    setPhone(lead.phone ?? "");
    setSource(lead.source ?? "");
    setDealValue(lead.deal_value != null ? String(lead.deal_value) : "");
    setReason(lead.reason ?? "");
    setAssignedTo("");
    setError(null);
    teamApi
      .list()
      .then((members) => setTelecallers(members.filter((m) => m.role === "telecaller")))
      .catch(() => setTelecallers([]));
  }, [open, lead]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await leadsApi.updateDetails(lead.id, {
        name: name.trim(),
        phone: phone.trim() || null,
        source: source.trim() || null,
        reason: reason.trim() || null,
        deal_value: dealValue.trim() ? Number(dealValue) : null,
        assigned_to: assignedTo || undefined, // "" means the "(keep current)" option — omit, don't clear
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Lead"
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={save} disabled={saving || !name.trim()}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </>
      }
    >
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      <div className="flex flex-col gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Full Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Phone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Source / Campaign</span>
          <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Referral, Meta Ads" className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Assigned Telecaller</span>
          <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="input">
            <option value="">{lead.telecaller_name ?? "Unassigned"} (keep current)</option>
            {telecallers.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Deal Value (₹)</span>
          <input type="number" value={dealValue} onChange={(e) => setDealValue(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Notes / Enquiry</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="input" />
        </label>
      </div>
    </Modal>
  );
}

const stagePill: Record<string, string> = {
  New: "bg-blue-50 text-blue-700",
  Assigned: "bg-slate-100 text-slate-600",
  Contacted: "bg-slate-100 text-slate-600",
  Interested: "bg-blue-50 text-blue-700",
  "Proposal Sent": "bg-blue-50 text-blue-700",
  Negotiation: "bg-amber-50 text-amber-700",
  "Closed Won": "bg-emerald-50 text-emerald-700",
  "Closed Lost": "bg-red-50 text-red-700",
  Junk: "bg-slate-100 text-slate-400",
};

const factDot: Record<string, string> = {
  budget: "bg-emerald-500",
  concern: "bg-amber-500",
  decision_maker: "bg-violet-500",
  preference: "bg-violet-500",
  commitment: "bg-blue-500",
  objection: "bg-red-500",
  personal: "bg-slate-400",
};

const OPEN_STAGES = ["New", "Assigned", "Contacted", "Interested", "Proposal Sent", "Negotiation"];
// Falls back to the insights engine's own built-in default (see
// ALERT_DEFAULTS.zombie_days in settings/alerts/page.tsx and _alert_config in
// app/api/dashboard.py) until the org's configured threshold loads — never a
// second, disconnected number a founder's Alert Configuration change can't reach.
const DEFAULT_ZOMBIE_DAYS = 7;

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function followUpLabel(dueAt: string) {
  const due = new Date(dueAt);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round((startOfDay(due).getTime() - startOfDay(now).getTime()) / 86_400_000);
  const time = due.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  const dateLabel = due.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });

  if (dayDiff < 0) return `Overdue — was due ${dateLabel}`;
  if (dayDiff === 0) return `Today · ${time}`;
  return `${dateLabel} · ${time}`;
}

function LeadDetailContent() {
  const id = useSearchParams().get("id") ?? "";
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [zombieDays, setZombieDays] = useState(DEFAULT_ZOMBIE_DAYS);

  function load() {
    if (!id) {
      setError("No lead specified.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    leadsApi
      .detail(id)
      .then(setLead)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load lead"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);
  useEffect(() => {
    orgApi
      .get()
      .then((org) => {
        if (org.alert_config?.zombie_days != null) setZombieDays(org.alert_config.zombie_days);
      })
      .catch(() => {}); // keep the built-in default — this banner still degrades gracefully
  }, []);

  const stuck = !!lead && OPEN_STAGES.includes(lead.pipeline_stage) && lead.days_stuck >= zombieDays;

  return (
    <div className="pb-10">
      <div className="px-4 pt-6 sm:px-6 lg:px-8">
        <Link href="/dashboard/leads" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary-600">
          <ArrowLeft className="size-3.5" /> All Leads
        </Link>
      </div>

      {error && (
        <div className="mt-4 mx-4 sm:mx-6 lg:mx-8 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error} —{" "}
          <button className="font-semibold underline" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="mt-4 px-4 sm:px-6 lg:px-8">
          <Skeleton block className="h-8 w-64" />
          <Skeleton block className="mt-3 h-24 w-full rounded-2xl" />
        </div>
      ) : lead ? (
        <>
          {stuck && (
            <div className="mt-4 px-4 sm:px-6 lg:px-8">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <span className="font-semibold">Stuck in {lead.pipeline_stage} for {lead.days_stuck} days.</span>{" "}
                {lead.deal_value != null ? `${formatINR(lead.deal_value)} at risk.` : "No deal value recorded yet."}
              </div>
            </div>
          )}

          <div className="mt-4 px-4 sm:px-6 lg:px-8">
            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-slate-900">{lead.name}</h1>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", stagePill[lead.pipeline_stage])}>
                      {lead.pipeline_stage}
                    </span>
                    {lead.score != null && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-700">
                        Score {lead.score}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {lead.phone ?? "No phone on file"}
                    {lead.telecaller_name && <> · Assigned to {lead.telecaller_name}</>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {lead.phone && (
                    <a href={`tel:${lead.phone}`}>
                      <Button size="sm">
                        <Phone className="size-3.5" /> Call
                      </Button>
                    </a>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    <Pencil className="size-3.5" /> Edit Lead
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          <EditLeadModal lead={lead} open={editing} onClose={() => setEditing(false)} onSaved={load} />

          <div className="mt-4 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Lead Details</h3>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-slate-400">Enquiry</dt>
                  <dd className="mt-0.5 text-slate-800">{lead.reason || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Source</dt>
                  <dd className="mt-0.5 text-slate-800">{lead.source || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Deal Value</dt>
                  <dd className="mt-0.5 font-mono text-slate-800">{lead.deal_value != null ? formatINR(lead.deal_value) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Owner</dt>
                  <dd className="mt-0.5 text-slate-800">{lead.telecaller_name || "Unassigned"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Created</dt>
                  <dd className="mt-0.5 text-slate-800">{fmtDateTime(lead.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Calls So Far</dt>
                  <dd className="mt-0.5 text-slate-800">{lead.touchpoints.length}</dd>
                </div>
              </dl>
            </Card>

            <Card className="p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Next Follow-up</h3>
              {lead.follow_up ? (
                <>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {lead.follow_up.due_at ? followUpLabel(lead.follow_up.due_at) : "Scheduled"}
                  </p>
                  {lead.follow_up.note && <p className="mt-1 text-sm text-slate-500">{lead.follow_up.note}</p>}
                </>
              ) : (
                <p className="mt-2 text-sm text-slate-400">No follow-up scheduled.</p>
              )}
            </Card>
          </div>

          <div className="mt-4 px-4 sm:px-6 lg:px-8">
            <Card className="p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary-600" />
                <h3 className="text-sm font-semibold text-slate-900">Memory Bubble</h3>
                {lead.memory?.running_verdict && (
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", VERDICT_TONE[lead.memory.running_verdict])}>
                    {lead.memory.running_verdict}
                  </span>
                )}
              </div>
              {!lead.memory ? (
                <p className="mt-3 text-sm text-slate-400">Not enough contact yet for the AI to build a picture.</p>
              ) : (
                <>
                  {lead.memory.headline && <p className="mt-2 text-sm font-medium text-slate-700">{lead.memory.headline}</p>}
                  <p className="mt-1 text-xs text-slate-400">
                    Built from {lead.memory.total_calls} {lead.memory.total_calls === 1 ? "call" : "calls"}
                    {lead.memory.sentiment_trend && <> · sentiment {lead.memory.sentiment_trend}</>}
                  </p>
                  {lead.memory.facts.length > 0 && (
                    <ul className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {lead.memory.facts.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                          <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", factDot[f.category ?? ""] ?? "bg-slate-400")} />
                          {f.text}
                        </li>
                      ))}
                    </ul>
                  )}
                  {lead.memory.open_objections.length > 0 && (
                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-red-500">Open Objections</p>
                      <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm text-slate-600">
                        {lead.memory.open_objections.map((o, i) => (
                          <li key={i}>{o}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {lead.memory.pending_commitments.length > 0 && (
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">Pending Commitments</p>
                      <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm text-slate-600">
                        {lead.memory.pending_commitments.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {lead.memory.next_call_strategy && (
                    <div className="mt-4 rounded-lg bg-primary-50 px-3 py-2.5 text-sm text-primary-800">
                      <span className="font-semibold">Next call:</span> {lead.memory.next_call_strategy}
                    </div>
                  )}
                </>
              )}
            </Card>
          </div>

          <div className="mt-4 px-4 sm:px-6 lg:px-8">
            <Card>
              <div className="p-5 pb-0">
                <h3 className="text-sm font-semibold text-slate-900">Every Touchpoint</h3>
                <p className="mt-0.5 text-xs text-slate-400">Calls in one thread, newest first</p>
              </div>
              {lead.touchpoints.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-400">No contact yet. The first call will show up here.</p>
              ) : (
                <div className="mt-3 divide-y divide-slate-100">
                  {lead.touchpoints.map((t) => (
                    <div key={t.call_id} className="flex flex-col gap-1.5 px-5 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-slate-400">{fmtDateTime(t.timestamp)}</span>
                        {t.score != null && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-600">
                            Score {t.score}
                          </span>
                        )}
                        {t.lead_verdict && (
                          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", VERDICT_TONE[t.lead_verdict] ?? "bg-slate-100 text-slate-500")}>
                            {t.lead_verdict}
                          </span>
                        )}
                        <Link
                          href={`/dashboard/calls/detail?id=${t.call_id}`}
                          className="ml-auto text-xs font-semibold text-primary-600 hover:underline"
                        >
                          Open AI call analysis →
                        </Link>
                      </div>
                      {t.summary && <p className="text-sm text-slate-600">{t.summary}</p>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {lead.duplicates.length > 0 && (
            <div className="mt-4 px-4 sm:px-6 lg:px-8">
              <Card className="p-5">
                <div className="flex items-center gap-2">
                  <Copy className="size-4 text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-900">Possible Duplicates</h3>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">Same phone number seen on other leads</p>
                <div className="mt-3 flex flex-col gap-2">
                  {lead.duplicates.map((d) => (
                    <Link
                      key={d.id}
                      href={`/dashboard/leads/detail?id=${d.id}`}
                      className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      <span className="font-medium text-slate-800">{d.name}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", stagePill[d.pipeline_stage])}>
                        {d.pipeline_stage}
                      </span>
                    </Link>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {lead.score_history.length > 1 && (
            <div className="mt-4 px-4 sm:px-6 lg:px-8">
              <Card className="p-5">
                <div className="flex items-center gap-2">
                  <Flame className="size-4 text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-900">Score History</h3>
                </div>
                <div className="mt-3 flex items-end gap-2">
                  {lead.score_history.map((p, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1">
                      <span className="font-mono text-xs font-bold text-slate-700">{p.score}</span>
                      <div className="flex h-16 w-full flex-col justify-end overflow-hidden rounded bg-slate-100">
                        <div
                          className="w-full rounded bg-primary-500"
                          style={{ height: `${Math.max(4, (p.score / 100) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </>
      ) : (
        !error && <p className="mt-6 px-4 text-sm text-slate-400 sm:px-6 lg:px-8">Lead not found.</p>
      )}
    </div>
  );
}

export default function LeadDetailPage() {
  return (
    <Suspense fallback={<div className="px-4 pt-6 sm:px-6 lg:px-8"><Skeleton block className="h-8 w-64" /></div>}>
      <LeadDetailContent />
    </Suspense>
  );
}
