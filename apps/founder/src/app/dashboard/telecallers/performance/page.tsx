import Link from "next/link";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Sparkline } from "@/components/charts/Sparkline";
import { telecallers } from "@/lib/mock-data";
import { formatLakhs, cn } from "@/lib/utils";

export default function PerformanceMatrixPage() {
  const idle = telecallers.find((t) => t.id === "priya-nair")!;

  return (
    <div className="pb-10">
      <PageHeader
        title="Team Performance Overview"
        description="Ranked by AI call quality — click on a telecaller to view their complete profile."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs">
              {["This week", "This month", "Custom"].map((r) => (
                <span
                  key={r}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 font-medium",
                    r === "This month" ? "bg-slate-900 text-white" : "text-slate-400"
                  )}
                >
                  {r}
                </span>
              ))}
            </div>
            <Button variant="outline" size="sm">
              <Download className="size-3.5" /> CSV
            </Button>
          </div>
        }
      />

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">
            <span className="font-semibold text-amber-900">{idle.name}</span> — idle 52 min. Watch: approaching idle
            threshold.
          </p>
          <Button size="sm" className="bg-amber-500 hover:bg-amber-600">
            Ping Manager
          </Button>
        </div>
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3">Telecaller</th>
                <th className="px-3 py-3 text-right">Calls</th>
                <th className="px-3 py-3 text-right">Connect %</th>
                <th className="px-3 py-3 text-right">Positive %</th>
                <th className="px-3 py-3 text-right">Close %</th>
                <th className="px-3 py-3 text-right">Talk Time</th>
                <th className="px-3 py-3 text-right">Quality</th>
                <th className="px-3 py-3 text-right">Revenue</th>
                <th className="px-5 py-3 text-right">30D</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {telecallers.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link href={`/dashboard/telecallers/performance/${t.id}`} className="flex items-center gap-2.5">
                      <span className="flex size-8 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700">
                        {t.initials}
                      </span>
                      <span className="font-semibold text-slate-900">{t.name}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{t.calls}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{t.connectPct}%</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{t.positivePct}%</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{t.closePct}%</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{t.talkTime}</td>
                  <td className="px-3 py-3 text-right">
                    <span
                      className={cn(
                        "font-mono font-semibold tabular-nums",
                        t.quality >= 80 ? "text-emerald-600" : t.quality >= 60 ? "text-amber-600" : "text-red-600"
                      )}
                    >
                      {t.quality}
                    </span>
                    <span className="text-slate-400">/100</span>
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{formatLakhs(t.revenue)}</td>
                  <td className="px-5 py-3">
                    <Sparkline trend={t.trend} className="ml-auto h-6 w-20" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
        <p className="mt-3 text-xs text-slate-400">
          Quality Score = Script compliance (25%) + Tone (25%) + Objection handling (20%) + Closing (20%) + Punctuality
          (10%)
        </p>
      </div>
    </div>
  );
}
