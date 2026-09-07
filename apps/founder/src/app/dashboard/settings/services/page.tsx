"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Plus, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { InfoTip } from "@/components/ui/InfoTip";
import { SkeletonTableRow } from "@/components/ui/Skeleton";
import { ApiError, servicesApi, type OrgService } from "@/lib/api";
import { cn, formatINR } from "@/lib/utils";

/** The clinic's treatment list — what a visit can record.
 *
 *  This exists so visits pick from a fixed list instead of typing a name each
 *  time: free text turns "Hair PRP", "hair prp" and "PRP hair" into three
 *  things that can never be totalled, and "which treatments actually sell" is
 *  the report a clinic owner most wants. */

export default function ServicesSettingsPage() {
  const [services, setServices] = useState<OrgService[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRetired, setShowRetired] = useState(false);

  const [editing, setEditing] = useState<OrgService | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importNote, setImportNote] = useState<string | null>(null);

  function load(includeRetired = showRetired) {
    setLoading(true);
    setError(null);
    servicesApi
      .list(includeRetired)
      .then((r) => setServices(r.services))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load services"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(showRetired);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRetired]);

  const grouped = useMemo(() => {
    const out = new Map<string, OrgService[]>();
    for (const s of services ?? []) {
      const key = s.category?.trim() || "Uncategorised";
      out.set(key, [...(out.get(key) ?? []), s]);
    }
    return [...out.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [services]);

  /** Pull the treatments already typed into Organisation Profile → Services
   *  Offered. They were being entered twice; names already here are skipped,
   *  so this is safe to press more than once. */
  async function importFromProfile() {
    setImporting(true);
    setError(null);
    setImportNote(null);
    try {
      const res = await servicesApi.importFromProfile();
      if (res.available === 0) {
        setImportNote(
          "Your organisation profile doesn't list any services yet. Add them under Settings → Organisation Profile, then import."
        );
      } else if (res.created.length === 0) {
        setImportNote(
          res.skipped.length === 1
            ? "Nothing new to add — the one service on your profile is already on this list."
            : `Nothing new to add — all ${res.skipped.length} are already on this list.`
        );
      } else {
        setImportNote(
          `Added ${res.created.length}: ${res.created.join(", ")}. Set their prices below.` +
            (res.skipped.length
              ? ` ${res.skipped.length} ${res.skipped.length === 1 ? "was" : "were"} already here.`
              : "")
        );
        load();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't import from your organisation profile");
    } finally {
      setImporting(false);
    }
  }

  async function toggleActive(service: OrgService) {
    try {
      const updated = await servicesApi.update(service.id, { is_active: !service.is_active });
      setServices((prev) =>
        (prev ?? [])
          .map((s) => (s.id === updated.id ? updated : s))
          // Retiring while retired ones are hidden means it should leave the list.
          .filter((s) => showRetired || s.is_active)
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't update that service");
    }
  }

  return (
    <div className="pb-10">
      <div className="px-4 pt-6 sm:px-6 lg:px-8">
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary-600"
        >
          <ArrowLeft className="size-3.5" /> Settings
        </Link>
      </div>

      <PageHeader
        title="Services"
        description="The treatments you offer. Visits are logged against these, so keep the names consistent."
        action={
          <>
            <Button variant="outline" size="sm" onClick={importFromProfile} disabled={importing}>
              <Download className="size-3.5" />
              {importing ? "Importing…" : "Import from profile"}
            </Button>
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="size-3.5" /> Add service
            </Button>
          </>
        }
      />

      {importNote && (
        <div
          role="status"
          className="mt-4 mx-4 sm:mx-6 lg:mx-8 flex items-start justify-between gap-3 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          <span>{importNote}</span>
          <button className="font-semibold underline" onClick={() => setImportNote(null)}>
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-4 mx-4 sm:mx-6 lg:mx-8 flex items-start justify-between gap-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{error}</span>
          <button className="font-semibold underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <p className="text-xs text-slate-600">
          Naming these consistently is what makes per-treatment reporting possible later.
        </p>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={showRetired}
            onChange={(e) => setShowRetired(e.target.checked)}
            className="size-3.5 rounded border-slate-300"
          />
          Show retired
        </label>
      </div>

      <div className="mt-3 px-4 sm:px-6 lg:px-8">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <th className="px-5 py-2.5">Service</th>
                  <th className="px-3 py-2.5">
                    <span className="flex items-center gap-1.5">
                      Usual price
                      <InfoTip
                        label="What Usual price means"
                        text="The price you normally charge. It prefills when logging a visit and can be changed there — what the client actually paid is recorded on the visit itself."
                      />
                    </span>
                  </th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <>
                    <SkeletonTableRow columns={4} />
                    <SkeletonTableRow columns={4} />
                    <SkeletonTableRow columns={4} />
                  </>
                ) : error ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-600">
                      Services couldn&apos;t be loaded.
                    </td>
                  </tr>
                ) : (services?.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-600">
                      No services yet. Add the treatments you offer — hair, skin, beauty — and they&apos;ll be
                      available when logging a client&apos;s visit. If you already listed them on your
                      organisation profile, use <b>Import from profile</b> above.
                    </td>
                  </tr>
                ) : (
                  grouped.flatMap(([category, rows]) => [
                    <tr key={`h-${category}`} className="bg-slate-50/70">
                      <td colSpan={4} className="px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {category}
                      </td>
                    </tr>,
                    ...rows.map((s) => (
                      <tr key={s.id} className={cn(!s.is_active && "opacity-60")}>
                        <td className="px-5 py-3 font-medium text-slate-900">{s.name}</td>
                        <td className="px-3 py-3 font-mono text-slate-700">
                          {s.default_price != null ? formatINR(s.default_price) : "—"}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-medium",
                              s.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                            )}
                          >
                            {s.is_active ? "Active" : "Retired"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              className="text-xs font-semibold text-primary-600 hover:underline"
                              onClick={() => setEditing(s)}
                            >
                              Edit
                            </button>
                            <button
                              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:underline"
                              onClick={() => toggleActive(s)}
                              title={
                                s.is_active
                                  ? "Retire this service — it stays on past visits but drops out of the picker"
                                  : "Bring this service back into the picker"
                              }
                            >
                              {s.is_active ? "Retire" : (<><RotateCcw className="size-3" /> Restore</>)}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )),
                  ])
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {(adding || editing !== null) && (
        <ServiceModal
          service={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={() => {
            setAdding(false);
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ServiceModal({
  service,
  onClose,
  onSaved,
}: {
  service: OrgService | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Mounted only while open, so these run fresh each time — adding a service
  // straight after editing one can't inherit the edited values.
  const [name, setName] = useState(service?.name ?? "");
  const [price, setPrice] = useState(service?.default_price != null ? String(service.default_price) : "");
  const [category, setCategory] = useState(service?.category ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        // "" clears the price rather than sending 0, which would claim the
        // treatment is free.
        default_price: price.trim() === "" ? null : Number(price),
        category: category.trim(),
      };
      if (service) await servicesApi.update(service.id, payload);
      else await servicesApi.create(payload);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save that service");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={service ? `Edit ${service.name}` : "Add a service"}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={saving || !name.trim()}>
            {saving ? "Saving…" : service ? "Save changes" : "Add service"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Service name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Hair PRP"
            className="input"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Category</span>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Hair, Skin, Beauty"
            className="input"
          />
          <span className="mt-1 block text-xs text-slate-500">Used to group the list. Optional.</span>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Usual price (₹)</span>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            placeholder="8000"
            className="input"
          />
          <span className="mt-1 block text-xs text-slate-500">
            Optional — it just prefills when logging a visit, and can be changed there.
          </span>
        </label>
        {service && !service.is_active && (
          <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            This service is retired. It still shows on past visits, but won&apos;t appear when logging a new one.
          </p>
        )}
      </div>
    </Modal>
  );
}
