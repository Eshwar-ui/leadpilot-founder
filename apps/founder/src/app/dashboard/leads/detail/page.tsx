"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Phone, Copy, Flame, Sparkles, Pencil, Trash2, BadgeCheck, AudioLines } from "lucide-react";
import { CallAudioPlayer } from "@/components/calls/CallAudioPlayer";
import { Card } from "@/components/ui/Card";
import { ClientTab } from "@/components/clients/ClientTab";
import { InfoTip } from "@/components/ui/InfoTip";
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
// Long threads get unwieldy fast; ten covers the recent history a founder
// actually reads, and the rest is one click away.
const TOUCHPOINTS_VISIBLE = 10;

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

/** Converting is a REVENUE event — it moves the lead to Closed Won and the
 *  deal value lands in the month's figures — so it confirms rather than firing
 *  on a single click. */
function ConvertToClientModal({
  lead,
  saving,
  onClose,
  onConfirm,
}: {
  lead: LeadDetail;
  saving: boolean;
  onClose: () => void;
  onConfirm: (dealValue: number | null) => void;
}) {
  // Mounted only while open (see the call site), so this initialiser runs
  // fresh on each open — no reset-on-open effect, and no stale value from the
  // last time it was shown.
  const [dealValue, setDealValue] = useState(lead.deal_value != null ? String(lead.deal_value) : "");
  const alreadyWon = lead.pipeline_stage === "Closed Won";

  return (
    <Modal
      open
      onClose={onClose}
      title={`Mark ${lead.name} as a client`}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => onConfirm(dealValue.trim() === "" ? null : Number(dealValue))} disabled={saving}>
            {saving ? "Saving…" : "Mark as client"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-600">
          {alreadyWon ? (
            <>This lead is already at Closed Won. Marking them a client opens their visit history.</>
          ) : (
            <>
              This also moves <b>{lead.name}</b> from <b>{lead.pipeline_stage ?? "their current stage"}</b> to{" "}
              <b>Closed Won</b>, so the deal counts toward this month&apos;s revenue.
            </>
          )}
        </p>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Deal value (₹)</span>
          <input
            value={dealValue}
            onChange={(e) => setDealValue(e.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            placeholder="Optional"
            className="input"
          />
          <span className="mt-1 block text-xs text-slate-500">
            Optional — leave it blank if nothing is agreed yet. What they actually pay gets recorded per visit
            afterwards.
          </span>
        </label>
      </div>
    </Modal>
  );
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
  const [touchpointsExpanded, setTouchpointsExpanded] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  // Which pane of the lead page is showing. The Client tab only exists once
  // they've converted, so an un-marked client falls back to Overview.
  const [tab, setTab] = useState<"overview" | "client">("overview");
  const [clientSaving, setClientSaving] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  // Bound once: TypeScript can't carry the `lead.client !== null` narrowing
  // into the render callbacks below.
  const clientRecord = lead?.is_client ? lead.client : null;

  const visibleTouchpoints = touchpointsExpanded
    ? (lead?.touchpoints ?? [])
    : (lead?.touchpoints ?? []).slice(0, TOUCHPOINTS_VISIBLE);
  const notRelevantCount = (lead?.touchpoints ?? []).filter(
    (t) => t.analysis_status === "not_relevant"
  ).length;

  // The PATCH returns a SUBSET of the lead (no touchpoints/memory/latest_call
  // — see LeadDetailsPatch), so its fields are MERGED into what's on screen.
  // Assigning the response wholesale stripped those arrays and crashed the
  // next render on `touchpoints.length`.
  /** Converting moves the lead to Closed Won and feeds revenue, so it goes
   *  through a dialog (see ConvertToClientModal). Un-marking is reversible and
   *  changes no money, so it just runs. */
  async function setClient(isClient: boolean, dealValue?: number | null) {
    if (!lead?.id) return;
    setClientSaving(true);
    setClientError(null);
    try {
      const patched = await leadsApi.setClient(lead.id, isClient, dealValue);
      setLead((prev) => (prev ? { ...prev, ...patched } : prev));
      setConvertOpen(false);
      // The client block (visits, lifetime value) and the stage move both come
      // from the full detail payload, which this PATCH deliberately does not
      // return — see LeadDetailsPatch.
      load();
    } catch (e) {
      setClientError(e instanceof ApiError ? e.message : "Couldn't update customer status");
    } finally {
      setClientSaving(false);
    }
  }

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
                    {/* Sits alongside the stage pill, not inside it — customer
                        status is a separate fact from pipeline position. */}
                    {lead.is_client && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-emerald-700">
                        <BadgeCheck className="size-3" /> Client
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {lead.phone ?? "No phone on file"}
                    {lead.telecaller_name && <> · Assigned to {lead.telecaller_name}</>}
                    {lead.is_client && lead.client_since && (
                      <> · Client since {new Date(lead.client_since).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</>
                    )}
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
                    onClick={() => (lead.is_client ? setClient(false) : setConvertOpen(true))}
                    disabled={!lead.id || clientSaving}
                    title={
                      lead.id
                        ? lead.is_client
                          ? "Remove customer status — this does not change the pipeline stage"
                          : "Mark as a customer — this does not change the pipeline stage"
                        : "This contact doesn't have a lead record yet"
                    }
                  >
                    <BadgeCheck className="size-3.5" />
                    {clientSaving ? "Saving…" : lead.is_client ? "Remove Client" : "Mark as Client"}
                  </Button>
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

          {clientError && (
            <div
              role="alert"
              className="mt-3 mx-4 sm:mx-6 lg:mx-8 flex items-start justify-between gap-3 rounded-lg border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-700"
            >
              <span>{clientError}</span>
              <button className="font-semibold underline" onClick={() => setClientError(null)}>
                Dismiss
              </button>
            </div>
          )}

          {convertOpen && (
            <ConvertToClientModal
              lead={lead}
              saving={clientSaving}
              onClose={() => setConvertOpen(false)}
              onConfirm={(dealValue) => setClient(true, dealValue)}
            />
          )}

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

          {clientRecord && (
            <div className="mt-4 flex items-center gap-1 border-b border-slate-200 px-4 sm:px-6 lg:px-8" role="tablist">
              {(["overview", "client"] as const).map((key) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={cn(
                    "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                    tab === key
                      ? "border-primary-600 text-primary-700"
                      : "border-transparent text-slate-600 hover:text-slate-900"
                  )}
                >
                  {key === "overview" ? "Overview" : "Client"}
                  {key === "client" && clientRecord.visit_count > 0 && (
                    <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 font-mono text-[10px] font-bold text-slate-600">
                      {clientRecord.visit_count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {clientRecord && tab === "client" ? (
            <div className="mt-4 px-4 sm:px-6 lg:px-8">
              <ClientTab
                leadId={lead.id!}
                leadName={lead.name}
                record={clientRecord}
                onChanged={(next) => setLead((prev) => (prev ? { ...prev, client: next } : prev))}
              />
            </div>
          ) : (
            <>
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

          {/* Latest Call — sits directly under the lead's own details, which
              is where a founder looks first: what was actually said on the most
              recent call, and the recording to check it against. Rendered from
              the `latest_call` block returned inline with lead detail, so this
              costs no extra request. Omitted entirely when nothing has been
              analysed yet. */}
          {lead.latest_call && (
            <div className="mt-4 px-4 sm:px-6 lg:px-8">
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <AudioLines className="size-4 text-primary-600" />
                      <h3 className="text-sm font-semibold text-slate-900">Latest Call</h3>
                      {lead.latest_call.lead_verdict && (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            VERDICT_TONE[lead.latest_call.lead_verdict] ?? "bg-slate-100 text-slate-600"
                          )}
                        >
                          {lead.latest_call.lead_verdict}
                        </span>
                      )}
                      {lead.latest_call.sentiment_label && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-600">
                          {lead.latest_call.sentiment_label}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {fmtDateTime(lead.latest_call.timestamp)}
                      {lead.latest_call.duration_label && <> · {lead.latest_call.duration_label}</>}
                      {lead.latest_call.capture_source?.startsWith("auto_detected") && <> · auto-captured</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {lead.latest_call.score != null && (
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-sm font-bold text-slate-700">
                        {Math.round(lead.latest_call.score)}/100
                      </span>
                    )}
                    <Link href={`/dashboard/calls/detail?id=${lead.latest_call.call_id}`}>
                      <Button variant="outline" size="sm">
                        Open full call
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Only mount the player where a recording actually exists —
                    otherwise it would fetch, 404, and show an error for a call
                    that simply was never recorded. */}
                {lead.latest_call.has_audio ? (
                  <CallAudioPlayer
                    callId={lead.latest_call.call_id}
                    className="mt-4"
                    stickyLabel={`${lead.name} · latest call`}
                  />
                ) : (
                  <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    No recording was captured for this call.
                  </p>
                )}

                {lead.latest_call.headline && (
                  <p className="mt-4 text-sm font-medium text-slate-800">{lead.latest_call.headline}</p>
                )}

                {lead.latest_call.key_points.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">What the AI heard</h4>
                    <ul className="mt-1.5 list-inside list-disc space-y-1 text-sm text-slate-700">
                      {lead.latest_call.key_points.map((point, i) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {(lead.latest_call.call_summary?.objections_raised?.length ?? 0) > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Objections raised</h4>
                      <ul className="mt-1.5 space-y-1 text-sm text-amber-800">
                        {lead.latest_call.call_summary!.objections_raised!.map((o, i) => (
                          <li key={i} className="rounded-md bg-amber-50 px-2 py-1">{o}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(lead.latest_call.call_summary?.commitments_made?.length ?? 0) > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Commitments made</h4>
                      <ul className="mt-1.5 space-y-1 text-sm text-emerald-800">
                        {lead.latest_call.call_summary!.commitments_made!.map((c, i) => (
                          <li key={i} className="rounded-md bg-emerald-50 px-2 py-1">{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {lead.latest_call.next_steps.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Recommended next steps</h4>
                    <ol className="mt-1.5 list-inside list-decimal space-y-1 text-sm text-slate-700">
                      {lead.latest_call.next_steps.map((step, i) => (
                        <li key={i}>{step.text ?? step.action_label ?? ""}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </Card>
            </div>
          )}

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
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 p-5 pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Every Touchpoint</h3>
                  <p className="mt-0.5 text-xs text-slate-600">Calls in one thread, newest first</p>
                </div>
                <InfoTip
                  align="right"
                  label="What the touchpoint score means"
                  text="Score is the AI's read on the LEAD out of 100 (budget, authority, need, timeline) from that call — not a mark for the telecaller. Calls the AI judged not relevant show no score, because it isn't a judgement about the lead."
                />
              </div>
              {lead.touchpoints.length === 0 ? (
                <p className="px-5 pb-6 text-sm text-slate-600">No contact yet. The first call will show up here.</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-y border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                          <th className="px-5 py-2.5">When</th>
                          <th className="px-3 py-2.5">Duration</th>
                          <th className="px-3 py-2.5">Verdict</th>
                          <th className="px-3 py-2.5">Sentiment</th>
                          <th className="px-3 py-2.5 text-right">Score</th>
                          <th className="px-5 py-2.5" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {visibleTouchpoints.map((t) => {
                          // The analyser explicitly marks some calls not
                          // relevant — a wrong number, or no real conversation.
                          // Those still belong in the thread (they happened),
                          // but printing their score next to genuinely scored
                          // calls reads as a verdict the AI never gave.
                          const notRelevant = t.analysis_status === "not_relevant";
                          return (
                            <tr key={t.call_id} className={cn(notRelevant && "bg-slate-50/60")}>
                              <td className="whitespace-nowrap px-5 py-3">
                                <span className="font-mono text-xs text-slate-700">{fmtDateTime(t.timestamp)}</span>
                                {t.summary && (
                                  <span className="mt-0.5 block max-w-[280px] truncate text-xs text-slate-500">
                                    {t.summary}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3 font-mono text-xs text-slate-600">
                                {t.duration_label ?? "—"}
                              </td>
                              <td className="px-3 py-3">
                                {notRelevant ? (
                                  <span
                                    className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600"
                                    title={t.relevance_reason ?? undefined}
                                  >
                                    Not relevant
                                  </span>
                                ) : t.lead_verdict ? (
                                  <span
                                    className={cn(
                                      "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                      VERDICT_TONE[t.lead_verdict] ?? "bg-slate-100 text-slate-600"
                                    )}
                                  >
                                    {t.lead_verdict}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-3 py-3">
                                {t.sentiment ? (
                                  <span
                                    className={cn(
                                      "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                                      sentimentPill[t.sentiment] ?? "bg-slate-100 text-slate-600"
                                    )}
                                  >
                                    {t.sentiment}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-right">
                                {notRelevant || t.score == null ? (
                                  <span className="text-xs text-slate-400">—</span>
                                ) : (
                                  <span className="font-mono text-sm font-bold text-slate-700">
                                    {t.score}
                                    <span className="text-xs font-normal text-slate-400">/100</span>
                                  </span>
                                )}
                              </td>
                              <td className="whitespace-nowrap px-5 py-3 text-right">
                                <Link
                                  href={`/dashboard/calls/detail?id=${t.call_id}`}
                                  className="text-xs font-semibold text-primary-600 hover:underline"
                                >
                                  Open →
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-xs text-slate-600">
                    <span>
                      {lead.touchpoints.length} {lead.touchpoints.length === 1 ? "call" : "calls"}
                      {notRelevantCount > 0 && <> · {notRelevantCount} not relevant</>}
                    </span>
                    {lead.touchpoints.length > TOUCHPOINTS_VISIBLE && (
                      <button
                        onClick={() => setTouchpointsExpanded((v) => !v)}
                        className="font-semibold text-primary-600 hover:underline"
                      >
                        {touchpointsExpanded
                          ? "Show fewer"
                          : `View all ${lead.touchpoints.length}`}
                      </button>
                    )}
                  </div>
                </>
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
