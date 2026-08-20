"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, Eye, LayoutGrid, Users, Target, FileText, Filter, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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

      <div className="mt-4 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-2 print:block print:px-0">
        <div className="space-y-4 print:hidden">
          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FileText className="size-4" /> Report Type
            </h3>
            <div className="mt-3 space-y-2">
              {REPORT_OPTIONS.map((r) => {
                const Icon = r.icon;
                return (
                  <button
                    key={r.key}
                    onClick={() => setSelected(r.key)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                      selected === r.key ? "border-primary-500 bg-primary-50" : "border-transparent bg-slate-50 hover:bg-slate-100"
                    )}
                  >
                    <span className="flex size-8 items-center justify-center rounded-lg bg-white text-slate-500">
                      <Icon className="size-4" />
                    </span>
                    <span>
                      <span className={cn("block text-sm font-semibold", selected === r.key ? "text-primary-700" : "text-slate-900")}>
                        {r.name}
                      </span>
                      <span className="block text-xs text-slate-500">{r.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Download className="size-4" /> Export
            </h3>
            <p className="mt-1 text-xs text-slate-400">Scheduled email delivery is coming soon — export on demand works now.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={downloadPdf} disabled={!preview}>
                Export PDF
              </Button>
              <Button variant="outline" onClick={downloadCsv} disabled={!preview}>
                Export CSV
              </Button>
            </div>
          </Card>
        </div>

        <Card className="p-5 print:border-none print:p-0 print:shadow-none" id="report-print-area">
          <div className="flex items-center justify-between print:hidden">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Eye className="size-4" /> Report Preview
            </h3>
            <Button size="sm" variant="outline" onClick={() => load(selected)} disabled={loading}>
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} /> Refresh
            </Button>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden">
              {error} —{" "}
              <button className="font-semibold underline" onClick={() => load(selected)}>
                Retry
              </button>
            </div>
          )}

          <div className="mt-4 rounded-xl bg-slate-50 p-4 print:mt-0 print:rounded-none print:bg-white print:px-0">
            <p className="font-semibold text-slate-900">{selectedReport.name}</p>
            <p className="text-xs text-slate-400">
              {preview
                ? `Generated at ${new Date(preview.generated_at).toLocaleString()} · LeadPilot AI`
                : loading
                ? "Loading…"
                : "No data yet."}
            </p>
          </div>

          <div className="mt-3">
            {loading ? (
              <p className="py-6 text-center text-sm text-slate-400 print:hidden">Loading report…</p>
            ) : !preview ? (
              <p className="py-6 text-center text-sm text-slate-400 print:hidden">No report data yet.</p>
            ) : (
              <div className="max-h-[28rem] overflow-auto pr-1 print:max-h-none print:overflow-visible">
                <ReportView data={preview.data} />
              </div>
            )}
          </div>
        </Card>
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
