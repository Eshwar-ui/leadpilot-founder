"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { SkillRadar } from "@/components/charts/SkillRadar";
import { telecallers, teamAvg } from "@/lib/mock-data";
import { formatLakhs, cn } from "@/lib/utils";

const METRICS = [
  { key: "calls" as const, label: "Total Calls", team: teamAvg.calls, fmt: (v: number) => String(v) },
  { key: "connectPct" as const, label: "Connection Rate", team: teamAvg.connectPct, fmt: (v: number) => `${v}%` },
  { key: "positivePct" as const, label: "Positive Rate", team: teamAvg.positivePct, fmt: (v: number) => `${v}%` },
  { key: "closePct" as const, label: "Close Rate", team: teamAvg.closePct, fmt: (v: number) => `${v}%` },
  { key: "quality" as const, label: "Quality Score", team: teamAvg.quality, fmt: (v: number) => `${v}/100` },
  { key: "revenue" as const, label: "Revenue (MTD)", team: teamAvg.revenue, fmt: (v: number) => formatLakhs(v) },
];

export default function ComparisonPage() {
  const [selected, setSelected] = useState<string[]>(["arjun-rao", "priya-nair"]);

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  }

  const chosen = telecallers.filter((t) => selected.includes(t.id));

  return (
    <div className="pb-10">
      <PageHeader title="Telecaller Comparison" description="Side-by-side metrics for 2–4 agents vs team average" />

      <div className="mt-4 flex flex-wrap items-center gap-2 px-4 sm:px-6 lg:px-8">
        {telecallers.map((t) => (
          <button
            key={t.id}
            onClick={() => toggle(t.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              selected.includes(t.id)
                ? "border-primary-500 bg-primary-600 text-white"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            <span className="text-xs">{t.initials}</span>
            {t.name.split(" ")[0]}
          </button>
        ))}
        <span className="text-xs text-slate-400">Select 2–4 telecallers</span>
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3">Metric</th>
                <th className="px-3 py-3 text-right">Team Avg</th>
                {chosen.map((t) => (
                  <th key={t.id} className="px-5 py-3 text-right text-primary-600">
                    {t.name.split(" ")[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {METRICS.map((m) => (
                <tr key={m.key}>
                  <td className="px-5 py-4 font-medium text-slate-700">{m.label}</td>
                  <td className="px-3 py-4 text-right font-mono text-slate-400">{m.fmt(m.team)}</td>
                  {chosen.map((t) => {
                    const value = t[m.key] as number;
                    const delta = ((value - m.team) / m.team) * 100;
                    return (
                      <td key={t.id} className="px-5 py-4 text-right">
                        <div className="font-mono font-semibold text-slate-900">{m.fmt(value)}</div>
                        <div className={cn("text-xs font-medium", delta >= 0 ? "text-emerald-600" : "text-red-600")}>
                          {delta >= 0 ? "+" : ""}
                          {delta.toFixed(1)}% vs avg
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900">◎ Skill Radar Overlay</h3>
          <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {chosen.map((t) => (
              <div key={t.id} className="text-center">
                <SkillRadar skills={t.skills} />
                <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                <p className="text-xs text-slate-400">Quality {t.quality}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-center text-xs text-slate-400">Amber dot = lowest scoring dimension · coaching priority</p>
        </Card>
      </div>
    </div>
  );
}
