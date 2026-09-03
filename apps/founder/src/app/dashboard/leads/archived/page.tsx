"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CopyableId } from "@/components/ui/CopyableId";
import { SkeletonTableRow } from "@/components/ui/Skeleton";
import { ApiError, leadsApi, type ArchivedLead } from "@/lib/api";
import { formatINR } from "@/lib/utils";

function whenLabel(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function ArchivedLeadsPage() {
  const [leads, setLeads] = useState<ArchivedLead[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // The lead queued for PERMANENT deletion. Held in state rather than passed
  // to a window.confirm because this is the one irreversible action in the
  // app and it needs to spell out what survives it.
  const [purging, setPurging] = useState<ArchivedLead | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    leadsApi
      .archived()
      .then((res) => setLeads(res.leads))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load archived leads"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function restore(lead: ArchivedLead) {
    setBusyId(lead.id);
    setError(null);
    try {
      const res = await leadsApi.restore(lead.id);
      setNotice(res.message);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to restore this lead");
    } finally {
      setBusyId(null);
    }
  }

  async function purge() {
    if (!purging) return;
    setBusyId(purging.id);
    setError(null);
    try {
      const res = await leadsApi.remove(purging.id, true);
      setNotice(res.message);
      setPurging(null);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to delete this lead");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="pb-10">
      <PageHeader
        title="Archived Leads"
        description={
          leads
            ? `${leads.length} archived. Restoring one brings it back at the stage it left.`
            : undefined
        }
        action={
          <Link href="/dashboard/leads">
            <Button variant="outline" size="sm">
              <ArrowLeft className="size-3.5" /> All Leads
            </Button>
          </Link>
        }
      />

      {notice && (
        <div
          role="status"
          className="mt-4 mx-4 sm:mx-6 lg:mx-8 flex items-start justify-between gap-3 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          <span>{notice}</span>
          <button className="font-semibold underline" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

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

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <th className="px-5 py-2.5">Lead</th>
                  <th className="px-3 py-2.5">Stage When Archived</th>
                  <th className="px-3 py-2.5">Value</th>
                  <th className="px-3 py-2.5">Added By</th>
                  <th className="px-3 py-2.5">Archived By</th>
                  <th className="px-3 py-2.5">Archived On</th>
                  <th className="px-5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <>
                    <SkeletonTableRow columns={7} />
                    <SkeletonTableRow columns={7} />
                    <SkeletonTableRow columns={7} />
                  </>
                ) : error ? (
                  // The red strip above already explains what happened —
                  // don't also assert the archive is empty when we can't know.
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-600">
                      Archived leads couldn&apos;t be loaded.
                    </td>
                  </tr>
                ) : leads?.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-600">
                      Nothing archived. Deleting a lead from its detail page puts it here.
                    </td>
                  </tr>
                ) : (
                  (leads ?? []).map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <span className="block font-medium text-slate-900">{l.name}</span>
                        {l.phone && <span className="block text-xs text-slate-600">{l.phone}</span>}
                        <CopyableId id={l.id} displayId={l.display_id} className="mt-0.5" />
                      </td>
                      <td className="px-3 py-3 text-slate-500">{l.pipeline_stage}</td>
                      <td className="px-3 py-3 font-mono text-slate-700">
                        {l.deal_value != null ? formatINR(l.deal_value) : "—"}
                      </td>
                      <td className="px-3 py-3 text-slate-500">{l.created_by_name ?? "Not recorded"}</td>
                      <td className="px-3 py-3 text-slate-500">{l.deleted_by_name ?? "—"}</td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-600">{whenLabel(l.deleted_at)}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => restore(l)}
                            disabled={busyId === l.id}
                          >
                            <RotateCcw className="size-3.5" /> Restore
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-red-200 text-red-700 hover:bg-red-50"
                            onClick={() => setPurging(l)}
                            disabled={busyId === l.id}
                          >
                            <Trash2 className="size-3.5" /> Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Modal
        open={!!purging}
        onClose={() => setPurging(null)}
        title="Delete permanently?"
        footer={
          <>
            <Button variant="outline" className="flex-1" onClick={() => setPurging(null)} disabled={!!busyId}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700"
              onClick={purge}
              disabled={!!busyId}
            >
              {busyId ? "Deleting…" : "Delete permanently"}
            </Button>
          </>
        }
      >
        <p>
          <span className="font-semibold text-slate-900">{purging?.name}</span> will be removed for
          good, along with its pipeline history and any pending follow-ups. This cannot be undone.
        </p>
        {/* Said plainly rather than left to assumption: a founder who expects
            "delete" to wipe the recordings would otherwise think it had. */}
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Call recordings, transcripts and AI analysis for this contact are kept — they are your
          record of calls that actually happened, and they feed telecaller performance.
        </p>
      </Modal>
    </div>
  );
}
