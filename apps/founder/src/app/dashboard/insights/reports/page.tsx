"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, LayoutGrid, Users, Target, Filter, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { getStoredUser } from "@/lib/auth";
import { ApiError, reportsApi, type ReportPreview, type ReportType } from "@/lib/api";
import { cn } from "@/lib/utils";

const REPORT_OPTIONS: { key: ReportType; name: string; description: string; icon: typeof LayoutGrid }[] = [
  {
    key: "weekly_summary",
    name: "Founder Weekly",
    description: "Revenue, team health, top insights, leakage summary",
    icon: LayoutGrid,
  },
  {
    key: "telecaller_performance",
    name: "Telecaller Scorecard",
    description: "Per-agent quality score, call metrics, skill breakdown",
    icon: Users,
  },
  {
    key: "lead_quality",
    name: "Lead Quality Audit",
    description: "Source matrix, verdict distribution, BANT scoring",
    icon: Target,
  },
  {
    key: "leakage",
    name: "Leakage Report",
    description: "Every wasted and stalled lead, with your alert thresholds",
    icon: Filter,
  },
];

const REPORT_KEYS = REPORT_OPTIONS.map((r) => r.key) as string[];

function isReportType(v: string | null): v is ReportType {
  return v !== null && REPORT_KEYS.includes(v);
}

function ReportGeneratorContent() {
  const typeParam = useSearchParams().get("type");
  const [selected, setSelected] = useState<ReportType>(isReportType(typeParam) ? typeParam : "weekly_summary");
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const orgName = getStoredUser()?.org_name ?? "";

  const selectedReport = REPORT_OPTIONS.find((r) => r.key === selected)!;

  function load(type: ReportType) {
    setLoading(true);
    setError(null);
    reportsApi
      .preview(type)
      .then(setPreview)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load report"))
      .finally(() => setLoading(false));
  }

  // Loads immediately on mount and every time a different report type is
  // picked — the report is the whole point of this page, so it shouldn't sit
  // behind an extra "Generate Preview" click.
  useEffect(() => {
    setPreview(null);
    load(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  function downloadPdf() {
    // The browser's own print-to-PDF, scoped to just the report card via
    // #report-print-area (see the @media print rule below) — no extra
    // dependency needed for something a native browser feature already does.
    window.print();
  }

  function downloadCsv() {
    if (!preview) return;
    const blob = new Blob([reportToCsv(preview.data)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selected}-${new Date(preview.generated_at).toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="pb-10">
      <PageHeader title="AI Report Generator" description="Live reports, generated from your current data" />

      <div className="mt-4 px-4 sm:px-6 lg:px-8 print:mt-0 print:px-0">
        {/* Report switcher — jumping between report types stays a click away,
            but it's a compact control above the document, not a big picker
            column competing with it for attention. */}
        <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 print:hidden" role="tablist" aria-label="Report type">
          {REPORT_OPTIONS.map((r) => (
            <button
              key={r.key}
              role="tab"
              aria-selected={selected === r.key}
              onClick={() => setSelected(r.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                selected === r.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {r.name}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden">
            {error} —{" "}
            <button className="font-semibold underline" onClick={() => load(selected)}>
              Retry
            </button>
          </div>
        )}

        {/* The report itself, styled as a document — a page you'd actually
            hand to someone, not a dashboard panel of raw data. */}
        <div className="mx-auto mt-4 max-w-3xl print:mt-0 print:max-w-none">
          <div
            id="report-print-area"
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)] print:rounded-none print:border-none print:shadow-none"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-8 py-7 sm:px-10 print:px-0 print:pb-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-600">{orgName || "LeadPilot"}</p>
                <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">{selectedReport.name}</h1>
                <p className="mt-1 text-sm text-slate-500">{selectedReport.description}</p>
                <p className="mt-3 text-xs text-slate-400">
                  {preview
                    ? `Generated ${new Date(preview.generated_at).toLocaleString()} · LeadPilot AI`
                    : loading
                    ? "Loading…"
                    : "No data yet."}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 print:hidden">
                <button
                  onClick={() => load(selected)}
                  disabled={loading}
                  aria-label="Refresh report"
                  className="flex size-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RefreshCw className={cn("size-4", loading && "animate-spin")} />
                </button>
                <Button variant="outline" size="sm" onClick={downloadCsv} disabled={!preview}>
                  CSV
                </Button>
                <Button size="sm" onClick={downloadPdf} disabled={!preview}>
                  <Download className="size-3.5" /> Download PDF
                </Button>
              </div>
            </div>

            <div className="px-8 py-7 sm:px-10 print:px-0 print:py-4">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton block className="h-16 w-full rounded-xl" />
                  <Skeleton block className="h-16 w-full rounded-xl" />
                  <Skeleton block className="h-40 w-full rounded-xl" />
                </div>
              ) : !preview ? (
                <p className="py-10 text-center text-sm text-slate-400">No report data yet.</p>
              ) : (
                <ReportView data={preview.data} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReportGeneratorPage() {
  return (
    <Suspense fallback={null}>
      <ReportGeneratorContent />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Report renderer — turns the backend's report `data` object into a readable
// layout (stat tiles for scalars, tables for arrays of rows, subsections for
// nested objects) instead of dumping raw JSON. Shape-agnostic so it renders
// all three report types without per-type field mapping.
// ---------------------------------------------------------------------------

function humanize(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\bpct\b/gi, "%")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatScalar(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return value.toLocaleString("en-IN");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Flattens a report's `data` into CSV text: a "Summary" block of top-level
// scalar fields, then one table block per array-of-objects section — the
// same two shapes ReportView already renders, just serialized instead of
// laid out visually.
function reportToCsv(data: unknown): string {
  if (!isPlainObject(data)) return formatScalar(data);
  const escape = (v: unknown) => {
    const s = formatScalar(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const blocks: string[] = [];
  const scalarEntries = Object.entries(data).filter(([, v]) => !isPlainObject(v) && !Array.isArray(v));
  if (scalarEntries.length > 0) {
    blocks.push(
      ["Summary", ...scalarEntries.map(([k, v]) => `${humanize(k)},${escape(v)}`)].join("\n")
    );
  }

  for (const [k, v] of Object.entries(data)) {
    if (Array.isArray(v) && v.length > 0 && isPlainObject(v[0])) {
      const rows = v as Record<string, unknown>[];
      const columns: string[] = [];
      for (const row of rows) {
        for (const c of Object.keys(row)) {
          if (!columns.includes(c) && !isPlainObject(row[c]) && !Array.isArray(row[c])) columns.push(c);
        }
      }
      const lines = [
        humanize(k),
        columns.map(humanize).join(","),
        ...rows.map((row) => columns.map((c) => escape(row[c])).join(",")),
      ];
      blocks.push(lines.join("\n"));
    }
  }

  return blocks.join("\n\n");
}

function ScalarGrid({ entries }: { entries: [string, unknown][] }) {
  if (entries.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {entries.map(([k, v]) => (
        <div key={k} className="rounded-lg bg-slate-50 p-3 print:border print:border-slate-200">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{humanize(k)}</p>
          <p className="mt-0.5 font-mono text-sm font-bold text-slate-900">{formatScalar(v)}</p>
        </div>
      ))}
    </div>
  );
}

function RowsTable({ rows }: { rows: Record<string, unknown>[] }) {
  // Union of scalar keys across rows, in first-seen order (nested cells skipped).
  const columns: string[] = [];
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (!columns.includes(k) && !isPlainObject(row[k]) && !Array.isArray(row[k])) columns.push(k);
    }
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-100">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50 text-left font-semibold uppercase tracking-wide text-slate-400">
            {columns.map((c) => (
              <th key={c} className="px-3 py-2">{humanize(c)}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c} className="px-3 py-2 font-mono text-slate-700">{formatScalar(row[c])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportView({ data, level = 0 }: { data: unknown; level?: number }) {
  if (!isPlainObject(data)) {
    return <p className="text-sm text-slate-600">{formatScalar(data)}</p>;
  }

  const scalarEntries: [string, unknown][] = [];
  const complexEntries: [string, unknown][] = [];
  for (const [k, v] of Object.entries(data)) {
    if (isPlainObject(v) || Array.isArray(v)) complexEntries.push([k, v]);
    else scalarEntries.push([k, v]);
  }

  const Heading = level === 0 ? "h4" : "h5";

  return (
    <div className="space-y-4">
      <ScalarGrid entries={scalarEntries} />
      {complexEntries.map(([k, v]) => (
        <div key={k} className="space-y-2">
          <Heading className="text-xs font-semibold uppercase tracking-wide text-slate-500">{humanize(k)}</Heading>
          {Array.isArray(v) ? (
            v.length === 0 ? (
              <p className="text-xs text-slate-400">None.</p>
            ) : isPlainObject(v[0]) ? (
              <RowsTable rows={v as Record<string, unknown>[]} />
            ) : (
              <p className="text-sm text-slate-600">{(v as unknown[]).map(formatScalar).join(", ")}</p>
            )
          ) : (
            <div className="rounded-lg bg-slate-50 p-3">
              <ReportView data={v} level={level + 1} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
