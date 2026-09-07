"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, BellRing, Download, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CopyableId } from "@/components/ui/CopyableId";
import { StatCard } from "@/components/ui/StatCard";
import { SkeletonTableRow } from "@/components/ui/Skeleton";
import { ApiError, followUpsApi, leadsApi, type BoardLead } from "@/lib/api";
import { cn, formatINR } from "@/lib/utils";

/** Who the org's actual customers are — as opposed to where a deal sits in the
 *  pipeline. Reads the same /leads/board payload the pipeline pages use and
 *  filters on `is_client`, so a client shows up here regardless of stage: a
 *  reopened deal is still a customer. */

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function monthsSince(value: string | null) {
  if (!value) return null;
  const then = new Date(value);
  if (Number.isNaN(then.getTime())) return null;
  const months = Math.max(0, Math.round((Date.now() - then.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
  return months;
}

export default function ClientsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<BoardLead[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [recallDays, setRecallDays] = useState(90);
  // Off by default: the page's job is "who are my customers", and jumping
  // straight to a filtered subset would hide most of them.
  const [recallOnly, setRecallOnly] = useState(false);
  const [creatingFollowUp, setCreatingFollowUp] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    leadsApi
      .board()
      .then((res) => {
        setLeads(res.leads);
        // The window comes from the server so the copy below can't drift from
        // the rule that actually decides `recall_due`.
        setRecallDays(res.recall_days);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load clients"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  // Newest customers first — the ones most likely to need onboarding
  // attention. Nulls (a client whose date predates the column) sort last
  // rather than pretending to be the oldest.
  const clients = useMemo(() => {
    const out = (leads ?? []).filter((l) => l.is_client);
    return out.sort((a, b) => {
      if (!a.client_since && !b.client_since) return 0;
      if (!a.client_since) return 1;
      if (!b.client_since) return -1;
      return new Date(b.client_since).getTime() - new Date(a.client_since).getTime();
    });
  }, [leads]);

  const recallCount = useMemo(() => clients.filter((l) => l.recall_due).length, [clients]);

  const visible = useMemo(() => {
    let out = recallOnly ? clients.filter((l) => l.recall_due) : clients;
    const q = query.trim().toLowerCase();
    if (q) {
      out = out.filter((l) =>
        `${l.display_id} ${l.name} ${l.phone ?? ""} ${l.telecaller_name ?? ""}`.toLowerCase().includes(q)
      );
    }
    return out;
  }, [clients, query, recallOnly]);

  /** Turn a recall into an actual task, rather than something the founder has
   *  to remember. Reuses the follow-up system the telecaller app already
   *  shows, so it lands in the right person's list. */
  async function scheduleRecall(lead: BoardLead) {
    // A recall with no owner would land on the founder's own list, which no
    // screen shows — better to say so than to create a task that vanishes.
    if (!lead.assigned_to) {
      setError(`${lead.name} isn't assigned to a telecaller — assign an owner first, then schedule the recall.`);
      return;
    }
    setCreatingFollowUp(lead.id);
    setNotice(null);
    setError(null);
    try {
      await followUpsApi.create({
        lead_id: lead.id,
        telecaller_id: lead.assigned_to,
        note: `Recall — no visit since ${formatDate(lead.last_visit_at)}`,
        // Tomorrow morning: soon enough to matter, not a task that's already
        // overdue the moment it's created.
        due_at: (() => {
          const d = new Date();
          d.setDate(d.getDate() + 1);
          d.setHours(10, 0, 0, 0);
          return d.toISOString();
        })(),
      });
      setNotice(`Follow-up created for ${lead.name}${lead.telecaller_name ? ` — ${lead.telecaller_name} will see it` : ""}.`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't create that follow-up");
    } finally {
      setCreatingFollowUp(null);
    }
  }

  // Lifetime value across every client — real money received, summed from
  // logged visits rather than the one-off deal figure.
  const totalValue = useMemo(() => clients.reduce((sum, l) => sum + l.lifetime_value, 0), [clients]);
  const withVisits = useMemo(() => clients.filter((l) => l.last_visit_at).length, [clients]);

  function exportCsv() {
    const header = ["Lead ID", "Name", "Phone", "Client Since", "Stage", "Lifetime Value", "Last Visit", "Deal Value", "Owner", "Source"];
    const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const rows = visible.map((l) =>
      [
        l.display_id,
        l.name,
        l.phone ?? "",
        l.client_since ? new Date(l.client_since).toLocaleDateString() : "",
        l.pipeline_stage,
        l.lifetime_value,
        l.last_visit_at ? new Date(l.last_visit_at).toLocaleDateString() : "",
        l.deal_value ?? "",
        l.telecaller_name ?? "",
        l.source ?? "",
      ]
        .map((c) => escape(String(c)))
        .join(",")
    );
    const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clients.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="pb-10">
      <PageHeader
        title="Clients"
        description={leads ? `${clients.length} ${clients.length === 1 ? "customer" : "customers"}` : undefined}
        action={
          <>
            <Link href="/dashboard/leads">
              <Button variant="outline" size="sm">
                All Leads
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!visible.length}>
              <Download className="size-3.5" /> Export
            </Button>
          </>
        }
      />

      <div className="mt-6 grid grid-cols-2 gap-3 px-4 sm:px-6 lg:px-8 lg:grid-cols-3">
        <StatCard
          label="Total Clients"
          value={loading ? "…" : error ? "—" : String(clients.length)}
          icon={BadgeCheck}
          help="Everyone who has converted, whatever stage their current deal sits at — a client who came back for a new treatment still counts."
        />
        <StatCard
          label="Lifetime Value"
          value={loading ? "…" : error ? "—" : formatINR(totalValue)}
          help="What all your clients have actually paid, added up from logged visits. It only reflects what's been recorded — a client with no visits logged contributes nothing, however much they really spent."
          note={
            error
              ? undefined
              : withVisits < clients.length
                ? `${clients.length - withVisits} with no visits logged yet`
                : undefined
          }
          noteTone={withVisits < clients.length ? "warning" : "neutral"}
        />
        <StatCard
          label="Due For Recall"
          value={loading ? "…" : error ? "—" : String(recallCount)}
          tone={recallCount > 0 ? "danger" : "default"}
          help={`Clients who haven't visited in over ${recallDays} days. Change the window under Settings → Alert Configuration. Clients with no visits logged aren't counted — that's a record-keeping gap, not someone who stopped coming.`}
          note={recallCount > 0 ? `Not seen in ${recallDays}+ days` : undefined}
          noteTone={recallCount > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="New This Month"
          value={
            loading || error
              ? "—"
              : String(
                  clients.filter((l) => {
                    const m = monthsSince(l.client_since);
                    return m !== null && m < 1;
                  }).length
                )
          }
        />
      </div>

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

      <div className="mt-4 flex flex-wrap items-center gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-[220px] max-w-sm flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <Search className="size-3.5 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients by name, phone or owner"
            aria-label="Search clients by name, phone or owner"
            className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
        </div>
        <label
          className={cn(
            "inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
            recallOnly ? "border-red-200 bg-red-50 text-red-800" : "border-slate-200 bg-white text-slate-600"
          )}
        >
          <input
            type="checkbox"
            checked={recallOnly}
            onChange={(e) => setRecallOnly(e.target.checked)}
            className="size-3.5 rounded border-slate-300"
          />
          Due for recall
          {recallCount > 0 && (
            <span className="rounded-full bg-white/70 px-1.5 font-mono text-[10px] font-bold">{recallCount}</span>
          )}
        </label>
      </div>

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
                  <th className="px-5 py-2.5">Client</th>
                  <th className="px-3 py-2.5">Client Since</th>
                  <th className="px-3 py-2.5">Stage</th>
                  <th className="px-3 py-2.5">Lifetime Value</th>
                  <th className="px-3 py-2.5">Last Visit</th>
                  <th className="px-3 py-2.5">Owner</th>
                  <th className="px-5 py-2.5 text-right">Recall</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <>
                    <SkeletonTableRow columns={6} />
                    <SkeletonTableRow columns={6} />
                    <SkeletonTableRow columns={6} />
                  </>
                ) : error ? (
                  // Never assert "no clients" off a failed fetch — that's a
                  // claim about the org's data the app can't make right now.
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-600">
                      Clients couldn&apos;t be loaded.
                    </td>
                  </tr>
                ) : visible.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-600">
                      {recallOnly ? (
                        <>
                          {`No clients are due for recall — nobody has gone more than ${recallDays} days without a visit.`}{" "}
                          <button className="font-semibold text-primary-600 underline" onClick={() => setRecallOnly(false)}>
                            Show all clients
                          </button>
                        </>
                      ) : query.trim() ? (
                        <>
                          No clients match &ldquo;{query.trim()}&rdquo;.{" "}
                          <button className="font-semibold text-primary-600 underline" onClick={() => setQuery("")}>
                            Clear search
                          </button>
                        </>
                      ) : (
                        <>
                          No clients yet. A lead becomes a client when you close it won — or mark one by hand from its
                          detail page.
                        </>
                      )}
                    </td>
                  </tr>
                ) : (
                  visible.map((l) => {
                    const months = monthsSince(l.client_since);
                    return (
                      <tr
                        key={l.id}
                        onClick={() => router.push(`/dashboard/leads/detail?id=${l.id}`)}
                        className="cursor-pointer hover:bg-slate-50"
                      >
                        <td className="px-5 py-3">
                          <Link
                            href={`/dashboard/leads/detail?id=${l.id}`}
                            className="block font-medium text-slate-900 hover:text-primary-600"
                          >
                            {l.name}
                          </Link>
                          {l.phone && <span className="block text-xs text-slate-600">{l.phone}</span>}
                          <CopyableId id={l.id} displayId={l.display_id} className="mt-0.5" />
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {formatDate(l.client_since)}
                          {months !== null && (
                            <span className="block text-xs text-slate-500">
                              {months === 0 ? "This month" : months === 1 ? "1 month" : `${months} months`}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-medium",
                              l.pipeline_stage === "Closed Won"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            )}
                          >
                            {l.pipeline_stage}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="font-mono text-slate-800">{formatINR(l.lifetime_value)}</span>
                          {l.deal_value != null && l.deal_value !== l.lifetime_value && (
                            <span className="block text-xs text-slate-500">
                              {`deal ${formatINR(l.deal_value)}`}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {l.last_visit_at ? (
                            formatDate(l.last_visit_at)
                          ) : (
                            <span className="text-xs text-amber-700">No visits yet</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-slate-500">{l.telecaller_name || "—"}</td>
                        <td className="px-5 py-3 text-right">
                          {l.recall_due ? (
                            <button
                              onClick={(e) => {
                                // The row itself navigates to the lead.
                                e.stopPropagation();
                                scheduleRecall(l);
                              }}
                              disabled={creatingFollowUp === l.id}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                            >
                              <BellRing className="size-3" />
                              {creatingFollowUp === l.id ? "Adding…" : "Schedule call"}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {!loading && !error && (
            <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-600">
              Showing {visible.length} of {clients.length} clients
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
