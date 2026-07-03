import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { leadQualitySources, scoreDistribution } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export default function LeadQualityPage() {
  const maxLeads = Math.max(...scoreDistribution.map((s) => s.leads));

  return (
    <div className="pb-10">
      <PageHeader
        title="Lead Quality Deep Dive"
        description="Source quality matrix + score distribution — sorted by true conversion rate"
      />

      <div className="mt-4 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <h3 className="flex items-center gap-2 p-5 pb-3 text-sm font-semibold text-slate-900">
            ▤ Source Quality Matrix
          </h3>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-y border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2.5">Source</th>
                <th className="px-3 py-2.5 text-right">Leads</th>
                <th className="px-3 py-2.5 text-right">Junk%</th>
                <th className="px-3 py-2.5 text-right">Positive%</th>
                <th className="px-3 py-2.5 text-right">Close%</th>
                <th className="px-5 py-2.5 text-right">CPL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leadQualitySources.map((s) => (
                <tr key={s.source}>
                  <td className="px-5 py-3 font-semibold text-slate-900">{s.source}</td>
                  <td className="px-3 py-3 text-right font-mono">{s.leads}</td>
                  <td className="px-3 py-3 text-right">
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold",
                        s.junkPct >= 15 ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600"
                      )}
                    >
                      {s.junkPct}%
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-slate-700">{s.positivePct}%</td>
                  <td className="px-3 py-3 text-right font-mono font-semibold text-emerald-600">{s.closePct}%</td>
                  <td className="px-5 py-3 text-right font-mono text-slate-500">{s.cpl}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900">▦ Lead Score Distribution</h3>
          <div className="mt-3 rounded-lg bg-primary-50 px-3 py-2 text-xs text-primary-700">
            <span className="font-semibold">Benchmark:</span> A healthy funnel has 60%+ of leads scoring above 60.
            Currently: <span className="font-bold text-amber-600">30%</span>
          </div>
          <div className="mt-4 space-y-4">
            {scoreDistribution.map((s) => (
              <div key={s.band}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">{s.band}</span>
                  <span className="text-slate-400">
                    {s.leads} leads ·{" "}
                    <span
                      className={cn(
                        "font-semibold",
                        s.tone === "success" && "text-emerald-600",
                        s.tone === "info" && "text-blue-600",
                        s.tone === "warning" && "text-amber-600",
                        s.tone === "danger" && "text-red-600",
                        s.tone === "neutral" && "text-slate-500"
                      )}
                    >
                      Close {s.closePct}%
                    </span>{" "}
                    · {s.revenue}
                  </span>
                </div>
                <div className="mt-1">
                  <ProgressBar
                    value={s.leads}
                    max={maxLeads}
                    tone={s.tone === "success" || s.tone === "warning" || s.tone === "danger" ? s.tone : "primary"}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
