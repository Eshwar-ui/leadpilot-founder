"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { Search, Download } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SkeletonTableRow } from "@/components/ui/Skeleton";
import { ApiError, leadsApi, type BoardLead } from "@/lib/api";
import { cn, formatINR } from "@/lib/utils";

const STAGE_ORDER = [
  "New",
  "Assigned",
  "Contacted",
  "Interested",
  "Proposal Sent",
  "Negotiation",
  "Closed Won",
  "Closed Lost",
  "Junk",
];

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

function freshLabel(daysStuck: number) {
  return daysStuck === 0 ? "Today" : `${daysStuck}d ago`;
}

const ALL = "All";
const ALL_OWNERS = "All owners";
const ALL_SOURCES = "All sources";

export default function AllLeadsPage() {
  const [leads, setLeads] = useState<BoardLead[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [stage, setStage] = useState(ALL);
  const [owner, setOwner] = useState(ALL_OWNERS);
  const [source, setSource] = useState(ALL_SOURCES);

  function load() {
    setLoading(true);
    setError(null);
    leadsApi
      .board()
      .then((res) => setLeads(res.leads))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load leads"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of leads ?? []) counts[l.pipeline_stage] = (counts[l.pipeline_stage] ?? 0) + 1;
    return counts;
  }, [leads]);

  const owners = useMemo(
    () => Array.from(new Set((leads ?? []).map((l) => l.telecaller_name).filter((n): n is string => !!n))).sort(),
    [leads]
  );
  const sources = useMemo(
    () => Array.from(new Set((leads ?? []).map((l) => l.source).filter((s): s is string => !!s))).sort(),
    [leads]
  );

  const visible = useMemo(() => {
    let out = leads ?? [];
    if (stage !== ALL) out = out.filter((l) => l.pipeline_stage === stage);
    if (owner !== ALL_OWNERS) out = out.filter((l) => l.telecaller_name === owner);
    if (source !== ALL_SOURCES) out = out.filter((l) => l.source === source);
    const q = query.trim().toLowerCase();
    if (q) {
      out = out.filter((l) =>
        `${l.name} ${l.phone ?? ""} ${l.reason ?? ""}`.toLowerCase().includes(q)
      );
    }
    return out;
  }, [leads, stage, owner, source, query]);

  function exportCsv() {
    const header = ["Name", "Phone", "Source", "Stage", "Score", "Value", "Owner", "Last Update"];
    const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const rows = visible.map((l) =>
      [l.name, l.phone ?? "", l.source ?? "", l.pipeline_stage, l.score ?? "", l.deal_value ?? "", l.telecaller_name ?? "", `${l.days_stuck}d`]
        .map((c) => escape(String(c)))
        .join(",")
    );
    const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "all-leads.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="pb-10">
      <PageHeader
        title="All Leads"
        description={leads ? `${leads.length} leads in the pipeline` : undefined}
        action={
          <>
            <Link href="/dashboard/leads/quality">
              <Button variant="outline" size="sm">
                Lead Quality
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="size-3.5" /> Export
            </Button>
          </>
        }
      />

      <div className="mt-4 flex flex-col gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-[220px] max-w-sm flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <Search className="size-3.5 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, phone or enquiry"
              aria-label="Search leads by name, phone or enquiry"
              className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
          >
            <option>{ALL_OWNERS}</option>
            {owners.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
          >
            <option>{ALL_SOURCES}</option>
            {sources.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {[ALL, ...STAGE_ORDER].map((s) => {
            const count = s === ALL ? leads?.length ?? 0 : stageCounts[s] ?? 0;
            const active = stage === s;
            return (
              <button
                key={s}
                onClick={() => setStage(s)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  active ? "bg-primary-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                )}
              >
                {s}
                <span
                  className={cn(
                    "rounded-full px-1.5 font-mono text-[10px] font-bold",
                    active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="mt-4 mx-4 sm:mx-6 lg:mx-8 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
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
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-2.5">Lead</th>
                  <th className="px-3 py-2.5">Enquiry</th>
                  <th className="px-3 py-2.5">Source</th>
                  <th className="px-3 py-2.5">Stage</th>
                  <th className="px-3 py-2.5">Score</th>
                  <th className="px-3 py-2.5">Value</th>
                  <th className="px-3 py-2.5">Owner</th>
                  <th className="px-5 py-2.5">Last Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <>
                    <SkeletonTableRow columns={8} />
                    <SkeletonTableRow columns={8} />
                    <SkeletonTableRow columns={8} />
                    <SkeletonTableRow columns={8} />
                    <SkeletonTableRow columns={8} />
                  </>
                ) : visible.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-400">
                      {query || stage !== ALL || owner !== ALL_OWNERS || source !== ALL_SOURCES
                        ? "No leads match these filters."
                        : "No leads yet."}
                    </td>
                  </tr>
                ) : (
                  visible.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <Link href={`/dashboard/leads/detail?id=${l.id}`} className="block font-medium text-slate-900 hover:text-primary-600">
                          {l.name}
                        </Link>
                        {l.phone && <span className="block text-xs text-slate-400">{l.phone}</span>}
                      </td>
                      <td className="max-w-[220px] truncate px-3 py-3 text-slate-500">{l.reason || "—"}</td>
                      <td className="px-3 py-3 text-slate-500">{l.source || "—"}</td>
                      <td className="px-3 py-3">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", stagePill[l.pipeline_stage])}>
                          {l.pipeline_stage}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-mono text-slate-700">{l.score ?? "—"}</td>
                      <td className="px-3 py-3 font-mono text-slate-700">{l.deal_value != null ? formatINR(l.deal_value) : "—"}</td>
                      <td className="px-3 py-3 text-slate-500">{l.telecaller_name || "—"}</td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-400">{freshLabel(l.days_stuck)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!loading && (
            <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
              Showing {visible.length} of {leads?.length ?? 0} leads
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
