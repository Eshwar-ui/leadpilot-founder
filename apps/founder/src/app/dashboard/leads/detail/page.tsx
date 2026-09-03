"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Phone, Copy, Flame, Sparkles, Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CopyableId } from "@/components/ui/CopyableId";
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
    // Preselect the lead's actual owner. The old "" default meant the dropdown
    // opened on a "(keep current)" placeholder, so the founder had to read the
    // Owner row elsewhere on the page to know who it was already assigned to.
    setAssignedTo(lead.assigned_to ?? "");
    setError(null);
    teamApi
      .list()
      .then((members) => setTelecallers(members.filter((m) => m.role === "telecaller")))
      .catch(() => setTelecallers([]));
  }, [open, lead]);

  async function save() {
    // A contact that has calls but no Lead row comes back with id: null — there
    // is no record on the server to PATCH, so refuse rather than build a
    // /api/leads/null/details URL.
    if (!lead.id) {
      setError("This contact doesn't have a lead record yet, so there's nothing to edit.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await leadsApi.updateDetails(lead.id, {
        name: name.trim(),
        phone: phone.trim() || null,
        source: source.trim() || null,
        reason: reason.trim() || null,
        deal_value: dealValue.trim() ? Number(dealValue) : null,
        // "" is the Unassigned option, which is a real choice (a lead can be
        // parked with no owner), so it is sent rather than omitted.
        assigned_to: assignedTo || undefined,
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
            <option value="">Unassigned</option>
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

function DeleteLeadModal({
  lead,
  open,
  onClose,
  onDeleted,
}: {
  lead: LeadDetail;
  open: boolean;
  onClose: () => void;
  onDeleted: (message: string) => void;
}) {
  // Permanent deletion is deliberately a second, explicit opt-in inside this
  // dialog rather than a separate button next to Archive: the two sit one
  // click apart and only one of them is recoverable, so the irreversible one
  // has to be chosen, not merely aimed at.
  const [permanent, setPermanent] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPermanent(false);
    setError(null);
  }, [open]);

  async function confirm() {
    if (!lead.id) return;
    setWorking(true);
    setError(null);
    try {
      const res = await leadsApi.remove(lead.id, permanent);
      onDeleted(res.message);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to delete this lead");
      setWorking(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={permanent ? "Delete permanently?" : "Archive this lead?"}
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={working}>
            Cancel
          </Button>
          <Button
            className={cn("flex-1", permanent && "bg-red-600 hover:bg-red-700")}
            onClick={confirm}
            disabled={working}
          >
            {working ? "Working…" : permanent ? "Delete permanently" : "Archive lead"}
          </Button>
        </>
      }
    >
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      <p>
        <span className="font-semibold text-slate-900">{lead.name}</span>{" "}
        {permanent ? (
          <>will be removed for good, along with its pipeline history and any pending follow-ups. This cannot be undone.</>
        ) : (
          <>
            will be removed from the pipeline and from its telecaller&apos;s list. You can restore it
            from Archived Leads at the stage it left.
          </>
        )}
      </p>
      {/* Stated in both modes: a founder who assumes "delete" wipes the
          recordings would otherwise believe it had. */}
      <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Call recordings, transcripts and AI analysis for this contact are kept either way — they are
        your record of calls that actually happened, and they feed telecaller performance.
      </p>
      <label className="mt-4 flex items-start gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={permanent}
          onChange={(e) => setPermanent(e.target.checked)}
          className="mt-0.5"
        />
        <span>Delete permanently instead of archiving. This cannot be undone.</span>
      </label>
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
  Junk: "bg-slate-100 text-slate-600",
};

// Per-call sentiment from the debrief. Always rendered WITH its label — the
// pill colour is a second channel, never the only one carrying the meaning.
const sentimentPill: Record<string, string> = {
  Positive: "bg-emerald-50 text-emerald-700",
  Neutral: "bg-slate-100 text-slate-600",
  Mixed: "bg-amber-50 text-amber-700",
  Objection: "bg-amber-50 text-amber-700",
  Negative: "bg-red-50 text-red-700",
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
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Set once the lead is gone, so the page stops showing a record that no
  // longer exists instead of re-fetching it into a 404.
  const [removed, setRemoved] = useState<string | null>(null);
  const [zombieDays, setZombieDays] = useState(DEFAULT_ZOMBIE_DAYS);

  function load() {
    // No ?id= is not a transient failure — load() would re-check this and set
    // the same error forever, so the old Retry button could never succeed.
    // The dedicated "no lead specified" branch below handles it instead.
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setNotFound(false);
    leadsApi
      .detail(id)
      .then(setLead)
      .catch((e) => {
        // 404 = deleted, or an id belonging to another org (the backend scopes
        // by org and 404s rather than 403s). Either way retrying can only
        // produce the same 404 — send it to a dead-end state, not a red banner
        // with a Retry that will never work.
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setError(e instanceof ApiError ? e.message : "Failed to load lead");
      })
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

  // pipeline_stage is null for a contact with calls but no Lead row — it can't
  // be "stuck in a stage" it was never in.
  const stuck = !!lead?.pipeline_stage && OPEN_STAGES.includes(lead.pipeline_stage) && lead.days_stuck >= zombieDays;

  const backLink = (
    <div className="px-4 pt-6 sm:px-6 lg:px-8">
      <Link href="/dashboard/leads" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary-600">
        <ArrowLeft className="size-3.5" /> All Leads
      </Link>
    </div>
  );

  if (removed) {
    return (
      <div className="pb-10">
        {backLink}
        <div className="mt-4 px-4 sm:px-6 lg:px-8">
          <Card className="p-6">
            <h1 className="text-base font-semibold text-slate-900">Lead removed</h1>
            <p className="mt-1 text-sm text-slate-600">{removed}</p>
            <div className="mt-4 flex gap-2">
              <Link href="/dashboard/leads">
                <Button size="sm">Go to All Leads</Button>
              </Link>
              <Link href="/dashboard/leads/archived">
                <Button variant="outline" size="sm">
                  Archived Leads
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (!id || notFound) {
    return (
      <div className="pb-10">
        {backLink}
        <div className="mt-4 px-4 sm:px-6 lg:px-8">
          <Card className="p-6">
            <h1 className="text-base font-semibold text-slate-900">{id ? "Lead not found" : "No lead specified"}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {id
                ? "This lead has been deleted, or it belongs to another organisation."
                : "This page needs a lead to open. Pick one from the leads list."}
            </p>
            <Link href="/dashboard/leads" className="mt-4 inline-block">
              <Button size="sm">Go to All Leads</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-10">
      {backLink}

      {error && (
        <div role="alert" className="mt-4 mx-4 sm:mx-6 lg:mx-8 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
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
                    {/* A contact with calls but no Lead row has no stage yet —
                        say so rather than rendering an empty, untoned pill. */}
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        stagePill[lead.pipeline_stage ?? ""] ?? "bg-slate-100 text-slate-600"
                      )}
                    >
                      {lead.pipeline_stage ?? "No stage yet"}
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
                  {/* No Lead row = no id to copy — a support conversation has
                      nothing to reference yet. */}
                  {lead.id && <CopyableId id={lead.id} displayId={lead.display_id} className="mt-1" />}
                </div>
                <div className="flex items-center gap-2">
                  {lead.phone && (
                    <a href={`tel:${lead.phone}`}>
                      <Button size="sm">
                        <Phone className="size-3.5" /> Call
                      </Button>
                    </a>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(true)}
                    disabled={!lead.id}
                    title={lead.id ? undefined : "This contact doesn't have a lead record to edit yet"}
                  >
                    <Pencil className="size-3.5" /> Edit Lead
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-200 text-red-700 hover:bg-red-50"
                    onClick={() => setDeleting(true)}
                    disabled={!lead.id}
                    title={lead.id ? undefined : "This contact doesn't have a lead record to delete"}
                  >
                    <Trash2 className="size-3.5" /> Delete
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          <EditLeadModal lead={lead} open={editing} onClose={() => setEditing(false)} onSaved={load} />
          <DeleteLeadModal
            lead={lead}
            open={deleting}
            onClose={() => setDeleting(false)}
            onDeleted={(message) => {
              setDeleting(false);
              setRemoved(message);
            }}
          />

          <div className="mt-4 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Lead Details</h3>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-slate-600">Enquiry</dt>
                  <dd className="mt-0.5 text-slate-800">{lead.reason || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-600">Source</dt>
                  <dd className="mt-0.5 text-slate-800">{lead.source || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-600">Deal Value</dt>
                  <dd className="mt-0.5 font-mono text-slate-800">{lead.deal_value != null ? formatINR(lead.deal_value) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-600">Owner</dt>
                  <dd className="mt-0.5 text-slate-800">{lead.telecaller_name || "Unassigned"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-600">Created</dt>
                  <dd className="mt-0.5 text-slate-800">{fmtDateTime(lead.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-600">Added By</dt>
                  {/* Distinct from Owner above: a founder can add a lead and
                      hand it to a telecaller, and both facts matter. Leads
                      predating this audit trail say so instead of guessing. */}
                  <dd className="mt-0.5 text-slate-800">
                    {lead.created_by_name ?? <span className="text-slate-500">Not recorded</span>}
                    {lead.created_by_name && lead.created_by_role && (
                      <span className="ml-1 text-xs text-slate-500">({lead.created_by_role})</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-600">Calls So Far</dt>
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
                <p className="mt-2 text-sm text-slate-600">No follow-up scheduled.</p>
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
                <p className="mt-3 text-sm text-slate-600">Not enough contact yet for the AI to build a picture.</p>
              ) : (
                <>
                  {lead.memory.headline && <p className="mt-2 text-sm font-medium text-slate-700">{lead.memory.headline}</p>}
                  <p className="mt-1 text-xs text-slate-600">
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
                <p className="mt-0.5 text-xs text-slate-600">Calls in one thread, newest first</p>
              </div>
              {lead.touchpoints.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-600">No contact yet. The first call will show up here.</p>
              ) : (
                <div className="mt-3 divide-y divide-slate-100">
                  {lead.touchpoints.map((t) => (
                    <div key={t.call_id} className="flex flex-col gap-1.5 px-5 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-slate-600">{fmtDateTime(t.timestamp)}</span>
                        {t.score != null && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-600">
                            Score {t.score}
                          </span>
                        )}
                        {t.lead_verdict && (
                          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", VERDICT_TONE[t.lead_verdict] ?? "bg-slate-100 text-slate-600")}>
                            {t.lead_verdict}
                          </span>
                        )}
                        {t.sentiment && (
                          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", sentimentPill[t.sentiment] ?? "bg-slate-100 text-slate-600")}>
                            {t.sentiment} sentiment
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
                <p className="mt-0.5 text-xs text-slate-600">Same phone number seen on other leads</p>
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
        !error && <p className="mt-6 px-4 text-sm text-slate-600 sm:px-6 lg:px-8">Lead not found.</p>
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
