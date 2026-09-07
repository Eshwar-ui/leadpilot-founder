"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, Layers, Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StatCard } from "@/components/ui/StatCard";
import { InfoTip } from "@/components/ui/InfoTip";
import {
  ApiError,
  packagesApi,
  servicesApi,
  visitsApi,
  type ClientPackage,
  type ClientRecord,
  type ClientVisit,
  type OrgService,
} from "@/lib/api";
import { cn, formatINR } from "@/lib/utils";

/** After-sale record for a client: what they've had, when, and what it was worth.
 *
 *  Shown only once a lead is a client. A clinic's returning customer is the
 *  whole business, and until now the product had nothing to say about anyone
 *  past the moment they converted. */

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** `<input type="date">` wants YYYY-MM-DD in LOCAL time. Slicing an ISO string
 *  would use UTC and show yesterday for anyone east of Greenwich — which is
 *  everyone here. */
function toDateInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function ClientTab({
  leadId,
  leadName,
  record,
  onChanged,
}: {
  leadId: string;
  leadName: string;
  record: ClientRecord;
  onChanged: (next: ClientRecord) => void;
}) {
  const [services, setServices] = useState<OrgService[]>([]);
  const [logging, setLogging] = useState(false);
  const [addingPackage, setAddingPackage] = useState(false);
  const [editing, setEditing] = useState<ClientVisit | null>(null);
  const [deleting, setDeleting] = useState<ClientVisit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    servicesApi
      .list()
      // Non-fatal: without the list a visit can still be logged, just typed by
      // hand rather than picked.
      .then((r) => setServices(r.services))
      .catch(() => setServices([]));
  }, []);

  async function removePackage(pkg: ClientPackage) {
    setBusy(true);
    setError(null);
    try {
      onChanged(await packagesApi.remove(pkg.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't delete that package");
    } finally {
      setBusy(false);
    }
  }

  async function removeVisit(visit: ClientVisit) {
    setBusy(true);
    setError(null);
    try {
      onChanged(await visitsApi.remove(visit.id));
      setDeleting(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't delete that visit");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-lg border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-700"
        >
          <span>{error}</span>
          <button className="font-semibold underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Lifetime Value"
          value={formatINR(record.lifetime_value)}
          help="What this client has actually paid, added up across every visit. Deliberately not the deal value from when they converted — that's one number from one moment and says nothing about repeat business."
        />
        <StatCard
          label="Visits"
          value={String(record.visit_count)}
          help="How many times they've been in. Counted from the visits logged here, so it's only as complete as what's been recorded."
        />
        <StatCard
          label="Last Visit"
          value={fmtDate(record.last_visit_at)}
          hint={record.first_visit_at ? `First visit ${fmtDate(record.first_visit_at)}` : undefined}
          help="When they were last seen. The gap since is what tells you who's due a recall."
        />
      </div>

      {/* Packages sit above the visit history because "how many sessions are
          left?" is the question reception gets asked at the desk, before
          anyone opens the history. */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <Layers className="size-4 text-primary-600" />
              Packages
              <InfoTip
                label="What Packages means"
                text="Prepaid blocks of sessions, like 6 PRP sessions for ₹40,000. The money counts once, when they buy it — each session they use afterwards is logged as a visit but charged nothing, so their lifetime value stays right."
              />
            </h3>
            <p className="mt-0.5 text-xs text-slate-600">Prepaid sessions and what&apos;s left</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setAddingPackage(true)}>
            <Layers className="size-3.5" /> Add a package
          </Button>
        </div>

        {record.packages.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-slate-600">
            No packages. Add one when a client pays up front for a block of sessions.
          </p>
        ) : (
          <div className="flex flex-col gap-2 px-5 pb-5">
            {record.packages.map((p) => (
              <div
                key={p.id}
                className={cn(
                  "rounded-lg border px-3 py-2.5",
                  p.is_exhausted ? "border-slate-200 bg-slate-50" : "border-emerald-100 bg-emerald-50/40"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="block text-sm font-medium text-slate-900">{p.service_name}</span>
                    <span className="mt-0.5 block text-xs text-slate-600">
                      {p.amount != null ? `${formatINR(p.amount)} · ` : ""}
                      {`bought ${fmtDate(p.purchased_at)}`}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                        p.is_exhausted ? "bg-slate-200 text-slate-600" : "bg-emerald-100 text-emerald-800"
                      )}
                    >
                      {p.is_exhausted
                        ? "All used"
                        : `${p.sessions_remaining} of ${p.total_sessions} left`}
                    </span>
                    <button
                      className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-300"
                      onClick={() => removePackage(p)}
                      disabled={busy || p.sessions_used > 0}
                      title={
                        p.sessions_used > 0
                          ? "Sessions have already been used from this package, so it can't be deleted"
                          : "Delete this package"
                      }
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white">
                  <div
                    className={cn("h-full rounded-full", p.is_exhausted ? "bg-slate-400" : "bg-emerald-500")}
                    style={{
                      width: `${p.total_sessions ? (p.sessions_used / p.total_sessions) * 100 : 0}%`,
                    }}
                  />
                </div>
                {p.notes && <p className="mt-1.5 text-xs text-slate-600">{p.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              Visit History
              <InfoTip
                label="What Visit History means"
                text="Every appointment this client has attended, with the treatments given and what they paid. Add one after each visit so the client's value and recall date stay accurate."
              />
            </h3>
            <p className="mt-0.5 text-xs text-slate-600">What {leadName.split(" ")[0]} has had, and when</p>
          </div>
          <Button size="sm" onClick={() => setLogging(true)}>
            <CalendarPlus className="size-3.5" /> Log a visit
          </Button>
        </div>

        {record.visits.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-slate-600">
            {`No visits recorded yet. Log the first one to start tracking what ${
              leadName.split(" ")[0]
            } has had and what they're worth.`}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <th className="px-5 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Services</th>
                  <th className="px-3 py-2.5">Notes</th>
                  <th className="px-3 py-2.5 text-right">Paid</th>
                  <th className="px-5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {record.visits.map((v) => (
                  <tr key={v.id}>
                    <td className="whitespace-nowrap px-5 py-3">
                      <span className="font-medium text-slate-900">{fmtDate(v.visited_at)}</span>
                      {v.logged_by && (
                        <span className="mt-0.5 block text-xs text-slate-500">Logged by {v.logged_by}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {v.services.length === 0 ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {v.services.map((s) => (
                            <span
                              key={s.id}
                              className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                              title={s.price != null ? formatINR(s.price) : undefined}
                            >
                              {s.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-3 text-slate-600">{v.notes || "—"}</td>
                    <td className="px-3 py-3 text-right font-mono text-slate-800">
                      {v.amount != null ? formatINR(v.amount) : <span className="text-xs text-slate-400">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline"
                          onClick={() => setEditing(v)}
                        >
                          <Pencil className="size-3" /> Edit
                        </button>
                        <button
                          className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline"
                          onClick={() => setDeleting(v)}
                        >
                          <Trash2 className="size-3" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {addingPackage && (
        <PackageModal
          leadId={leadId}
          services={services}
          onClose={() => setAddingPackage(false)}
          onSaved={(next) => {
            setAddingPackage(false);
            onChanged(next);
          }}
        />
      )}

      {(logging || editing !== null) && (
        <VisitModal
          leadId={leadId}
          visit={editing}
          services={services}
          packages={record.packages}
          onClose={() => {
            setLogging(false);
            setEditing(null);
          }}
          onSaved={(next) => {
            setLogging(false);
            setEditing(null);
            onChanged(next);
          }}
        />
      )}

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete this visit?"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setDeleting(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleting && removeVisit(deleting)}
              disabled={busy}
            >
              {busy ? "Deleting…" : "Delete visit"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          The visit on <b>{fmtDate(deleting?.visited_at ?? null)}</b> will be removed, and
          {deleting?.amount != null ? ` ${formatINR(deleting.amount)} will come off ` : " nothing will change in "}
          this client&apos;s lifetime value. This can&apos;t be undone.
        </p>
      </Modal>
    </div>
  );
}

function VisitModal({
  leadId,
  visit,
  services,
  packages,
  onClose,
  onSaved,
}: {
  leadId: string;
  visit: ClientVisit | null;
  services: OrgService[];
  packages: ClientPackage[];
  onClose: () => void;
  onSaved: (next: ClientRecord) => void;
}) {
  // Mounted only while open (see the call site), so these initialisers run
  // fresh each time — editing one visit then logging a new one can't inherit
  // the previous form's values.
  const [date, setDate] = useState(() =>
    visit?.visited_at ? toDateInput(new Date(visit.visited_at)) : toDateInput(new Date())
  );
  const [chosen, setChosen] = useState<
    { service_id?: string; name: string; price: number | null; package_id?: string }[]
  >(
    () =>
      visit?.services.map((s) => ({
        service_id: s.service_id ?? undefined,
        name: s.name,
        price: s.price,
        package_id: s.package_id ?? undefined,
      })) ?? []
  );
  const [amount, setAmount] = useState(visit?.amount != null ? String(visit.amount) : "");
  const [notes, setNotes] = useState(visit?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Suggest the total of the chosen treatments, so the common case (they paid
  // list price) is one click rather than mental arithmetic.
  // Package sessions contribute nothing — they were paid for at purchase.
  const servicesTotal = useMemo(
    () => chosen.reduce((sum, c) => sum + (c.package_id ? 0 : c.price ?? 0), 0),
    [chosen]
  );

  function addService(id: string) {
    const svc = services.find((s) => s.id === id);
    if (!svc || chosen.some((c) => c.service_id === id && !c.package_id)) return;
    setChosen((prev) => [...prev, { service_id: svc.id, name: svc.name, price: svc.default_price }]);
  }

  /** Draw this session from a package the client already paid for. The line
   *  loses its price, because charging again would double-count money that was
   *  banked at purchase. */
  function drawSession(pkg: ClientPackage) {
    setChosen((prev) => [
      ...prev,
      {
        service_id: pkg.service_id ?? undefined,
        name: pkg.service_name,
        price: null,
        package_id: pkg.id,
      },
    ]);
  }

  // Only packages with sessions left, and not already drawn on this visit.
  const drawable = packages.filter(
    (p) => !p.is_exhausted && !chosen.some((c) => c.package_id === p.id)
  );

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        visited_at: date,
        amount: amount.trim() === "" ? null : Number(amount),
        notes: notes.trim(),
        services: chosen.map((c) => ({
          service_id: c.service_id,
          name: c.name,
          price: c.price,
          package_id: c.package_id,
        })),
      };
      const next = visit
        ? await visitsApi.update(visit.id, payload)
        : await visitsApi.create(leadId, payload);
      onSaved(next);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save that visit");
    } finally {
      setSaving(false);
    }
  }

  const available = services.filter((s) => !chosen.some((c) => c.service_id === s.id));

  return (
    <Modal
      open
      onClose={onClose}
      title={visit ? "Edit visit" : "Log a visit"}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={saving || !date}>
            {saving ? "Saving…" : visit ? "Save changes" : "Log visit"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Visit date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
        </label>

        {drawable.length > 0 && (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2.5">
            <span className="block text-xs font-semibold text-emerald-900">Use a prepaid session</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {drawable.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => drawSession(p)}
                  className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
                >
                  {`${p.service_name} · ${p.sessions_remaining} left`}
                </button>
              ))}
            </div>
            <span className="mt-1.5 block text-[11px] text-emerald-800/80">
              Already paid for, so nothing is charged for this visit.
            </span>
          </div>
        )}

        <div>
          <span className="mb-1 block text-xs font-semibold text-slate-500">Treatments given</span>
          {chosen.length > 0 && (
            <div className="mb-2 flex flex-col gap-1.5">
              {chosen.map((c, i) => (
                <div key={`${c.service_id ?? c.name}-${i}`} className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex-1 truncate rounded-lg px-2.5 py-1.5 text-sm",
                      c.package_id ? "bg-emerald-50 text-emerald-900" : "bg-slate-100 text-slate-800"
                    )}
                  >
                    {c.name}
                    {c.package_id && <span className="ml-1 text-xs font-semibold">· from package</span>}
                  </span>
                  <input
                    value={c.package_id ? "" : c.price ?? ""}
                    disabled={!!c.package_id}
                    placeholder={c.package_id ? "prepaid" : "₹"}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d]/g, "");
                      setChosen((prev) =>
                        prev.map((x, j) => (j === i ? { ...x, price: v === "" ? null : Number(v) } : x))
                      );
                    }}
                    inputMode="numeric"
                    aria-label={`Price for ${c.name}`}
                    className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-right font-mono text-sm disabled:bg-slate-50 disabled:text-slate-400"
                  />
                  <button
                    onClick={() => setChosen((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={`Remove ${c.name}`}
                    className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {services.length === 0 ? (
            <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              No services set up yet. Add them under Settings → Services and they&apos;ll appear here.
            </p>
          ) : (
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) addService(e.target.value);
              }}
              aria-label="Add a treatment"
              className="input"
              disabled={available.length === 0}
            >
              <option value="">{available.length === 0 ? "All services added" : "Add a treatment…"}</option>
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.default_price != null ? ` · ${formatINR(s.default_price)}` : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Amount paid (₹)</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            placeholder="0"
            className="input"
          />
          <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            What they actually paid — discounts and packages mean this often differs from the list price.
            {servicesTotal > 0 && Number(amount || 0) !== servicesTotal && (
              <button
                type="button"
                className="font-semibold text-primary-600 underline"
                onClick={() => setAmount(String(servicesTotal))}
              >
                Use {formatINR(servicesTotal)}
              </button>
            )}
          </span>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="How it went, what to watch for next time…"
            className={cn("input", "resize-y")}
          />
        </label>
      </div>
    </Modal>
  );
}

/** Recording that a client paid up front for a block of sessions. */
function PackageModal({
  leadId,
  services,
  onClose,
  onSaved,
}: {
  leadId: string;
  services: OrgService[];
  onClose: () => void;
  onSaved: (next: ClientRecord) => void;
}) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [customName, setCustomName] = useState("");
  const [sessions, setSessions] = useState("6");
  const [amount, setAmount] = useState("");
  const [purchasedAt, setPurchasedAt] = useState(() => toDateInput(new Date()));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = services.find((s) => s.id === serviceId);
  const sessionCount = Number(sessions || 0);
  // What the same sessions would cost one at a time — the number that makes a
  // package price meaningful.
  const listTotal = chosen?.default_price != null ? chosen.default_price * sessionCount : null;
  const paid = amount.trim() === "" ? null : Number(amount);
  const saving_amount = listTotal != null && paid != null ? listTotal - paid : null;

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      onSaved(
        await packagesApi.create(leadId, {
          ...(serviceId ? { service_id: serviceId } : { service_name: customName.trim() }),
          total_sessions: sessionCount,
          amount: paid,
          purchased_at: purchasedAt,
          notes: notes.trim(),
        })
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save that package");
    } finally {
      setSaving(false);
    }
  }

  const nameGiven = serviceId ? true : customName.trim().length > 0;

  return (
    <Modal
      open
      onClose={onClose}
      title="Add a package"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={saving || !nameGiven || sessionCount < 1}>
            {saving ? "Saving…" : "Add package"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Treatment</span>
          {services.length === 0 ? (
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Hair PRP"
              className="input"
            />
          ) : (
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="input">
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.default_price != null ? ` · ${formatINR(s.default_price)} each` : ""}
                </option>
              ))}
            </select>
          )}
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">Sessions</span>
            <input
              value={sessions}
              onChange={(e) => setSessions(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              className="input"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">Package price (₹)</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              placeholder="40000"
              className="input"
            />
          </label>
        </div>

        {listTotal != null && sessionCount > 0 && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {`${sessionCount} × ${formatINR(chosen!.default_price!)} = ${formatINR(listTotal)} at the usual price.`}
            {saving_amount != null && saving_amount > 0 && (
              <span className="font-semibold text-emerald-700">{` They save ${formatINR(saving_amount)}.`}</span>
            )}
          </p>
        )}

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Bought on</span>
          <input
            type="date"
            value={purchasedAt}
            onChange={(e) => setPurchasedAt(e.target.value)}
            className="input"
          />
          <span className="mt-1 block text-xs text-slate-500">
            The price counts toward their lifetime value on this date. Sessions used later are logged as visits
            but charged nothing.
          </span>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Anything worth remembering about this package…"
            className={cn("input", "resize-y")}
          />
        </label>
      </div>
    </Modal>
  );
}
