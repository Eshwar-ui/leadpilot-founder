"use client";

import { useState } from "react";
import { Eye, LayoutGrid, Users, Target, FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ApiError, reportsApi, type ReportPreview, type ReportType } from "@/lib/api";
import { cn } from "@/lib/utils";

const REPORT_OPTIONS: { key: ReportType; name: string; description: string; icon: typeof LayoutGrid }[] = [
  {
    key: "weekly_summary",
    name: "Weekly Summary",
    description: "Revenue, team health, top insights, leakage summary",
    icon: LayoutGrid,
  },
  {
    key: "telecaller_performance",
    name: "Telecaller Performance",
    description: "Per-agent quality score, call metrics, skill breakdown",
    icon: Users,
  },
  {
    key: "lead_quality",
    name: "Lead Quality",
    description: "Source matrix, verdict distribution, BANT scoring",
    icon: Target,
  },
];

export default function ReportGeneratorPage() {
  const [selected, setSelected] = useState<ReportType>("weekly_summary");
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedReport = REPORT_OPTIONS.find((r) => r.key === selected)!;

  function generatePreview() {
    setLoading(true);
    setError(null);
    reportsApi
      .preview(selected)
      .then(setPreview)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to generate report preview"))
      .finally(() => setLoading(false));
  }

  return (
    <div className="pb-10">
      <PageHeader title="AI Report Generator" description="Preview reports on demand" />

      <div className="mt-4 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-2">
        <div className="space-y-4">
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
                    onClick={() => {
                      setSelected(r.key);
                      setPreview(null);
                      setError(null);
                    }}
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
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">⚙ Export</h3>
            <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
              PDF export and scheduled email delivery are coming soon.
            </div>
            <Button className="mt-3 w-full" disabled>
              Export — Coming Soon
            </Button>
          </Card>
        </div>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Eye className="size-4" /> Report Preview
            </h3>
            <Button size="sm" onClick={generatePreview} disabled={loading}>
              {loading ? "Generating…" : "Generate Preview"}
            </Button>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error} —{" "}
              <button className="font-semibold underline" onClick={generatePreview}>
                Retry
              </button>
            </div>
          )}

          <div className="mt-4 rounded-xl bg-slate-50 p-4">
            <p className="font-semibold text-slate-900">{selectedReport.name}</p>
            <p className="text-xs text-slate-400">
              {preview
                ? `Generated at ${new Date(preview.generated_at).toLocaleString()} · LeadPilot AI`
                : "Click Generate Preview to fetch the latest data"}
            </p>
          </div>

          <div className="mt-3">
            {loading ? (
              <p className="py-6 text-center text-sm text-slate-400">Loading preview…</p>
            ) : !preview ? (
              <p className="py-6 text-center text-sm text-slate-400">No preview generated yet.</p>
            ) : (
              <pre className="max-h-80 overflow-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
                {JSON.stringify(preview.data, null, 2)}
              </pre>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
