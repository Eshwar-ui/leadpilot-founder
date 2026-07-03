"use client";

import { useState } from "react";
import { AlertTriangle, Megaphone } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { campaigns } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const platformTone: Record<string, string> = {
  Meta: "bg-blue-50 text-blue-600",
  Google: "bg-red-50 text-red-600",
};

export default function CampaignOverviewPage() {
  const [pauseTarget, setPauseTarget] = useState<string | null>(null);
  const overspend = campaigns.find((c) => c.status === "Overspend")!;

  return (
    <div className="pb-10">
      <PageHeader
        title="Campaign Overview"
        description="Live spend, CPL, ROI, and budget guardrails across all active campaigns"
        action={
          <Button size="sm">
            <Megaphone className="size-3.5" /> New Campaign
          </Button>
        }
      />

      <div className="mt-4 grid grid-cols-2 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-5">
        <StatCard label="Active Campaigns" value="4" />
        <StatCard label="Total Daily Budget" value="₹40,000" />
        <StatCard label="Spent Today" value="₹34,360" delta="-1 vs last mo" deltaTone="danger" />
        <StatCard label="Total Leads Today" value="1,201" />
        <StatCard label="Avg CPL" value="₹29" />
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="flex flex-wrap items-center gap-2 text-sm text-red-700">
            <AlertTriangle className="size-4" />
            <span className="font-semibold text-red-900">{overspend.name}</span> is{" "}
            <span className="font-semibold">{overspend.pct - 100}% over</span> daily cap (₹
            {overspend.spent.toLocaleString("en-IN")} / ₹{overspend.budgetDay.toLocaleString("en-IN")}).
            <span className="text-red-400">Auto-pause rule triggers at 120%.</span>
          </p>
          <Button variant="danger" size="sm" onClick={() => setPauseTarget(overspend.name)}>
            Pause Now
          </Button>
        </div>
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900">▦ Budget Utilisation — Today</h3>
          <div className="mt-4 space-y-4">
            {campaigns.map((c) => (
              <div key={c.name}>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded px-1.5 py-0.5 text-xs font-semibold", platformTone[c.platform])}>
                      {c.platform}
                    </span>
                    <span className="font-medium text-slate-800">{c.name}</span>
                    {c.status === "Overspend" && <Badge tone="danger">Overspend</Badge>}
                    {c.status === "Paused" && <Badge tone="neutral">Paused</Badge>}
                  </span>
                  <span className="font-mono text-xs text-slate-500">
                    ₹{c.spent.toLocaleString("en-IN")} / ₹{c.budgetDay.toLocaleString("en-IN")}{" "}
                    <span
                      className={cn(
                        "ml-1 font-semibold",
                        c.pct > 100 ? "text-red-600" : "text-slate-600"
                      )}
                    >
                      {c.status === "Paused" ? "—" : `${c.pct}%`}
                    </span>
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn("h-full rounded-full", c.pct > 100 ? "bg-red-500" : c.status === "Paused" ? "bg-slate-200" : "bg-primary-600")}
                    style={{ width: `${Math.min(100, c.pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">▪ Dotted line = 100% daily budget cap</p>
        </Card>
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="overflow-hidden">
          <h3 className="p-5 pb-3 text-sm font-semibold text-slate-900">▦ Campaign Details</h3>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-y border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2.5">Campaign</th>
                <th className="px-3 py-2.5">Platform</th>
                <th className="px-3 py-2.5 text-right">Budget/Day</th>
                <th className="px-3 py-2.5 text-right">Spent</th>
                <th className="px-3 py-2.5 text-right">Leads</th>
                <th className="px-3 py-2.5 text-right">CPL</th>
                <th className="px-3 py-2.5 text-right">CPC</th>
                <th className="px-3 py-2.5 text-right">ROAS</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-5 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {campaigns.map((c) => (
                <tr key={c.name} className={cn(c.status === "Paused" && "text-slate-400")}>
                  <td className="px-5 py-3 font-semibold text-slate-900">{c.name}</td>
                  <td className="px-3 py-3">
                    <span className={cn("rounded px-1.5 py-0.5 text-xs font-semibold", platformTone[c.platform])}>
                      {c.platform}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-mono">₹{c.budgetDay.toLocaleString("en-IN")}</td>
                  <td className={cn("px-3 py-3 text-right font-mono", c.status === "Overspend" && "font-semibold text-red-600")}>
                    {c.spent ? `₹${c.spent.toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td className="px-3 py-3 text-right font-mono">{c.leads || "—"}</td>
                  <td className="px-3 py-3 text-right font-mono">{c.cpl ? `₹${c.cpl}` : "—"}</td>
                  <td className="px-3 py-3 text-right font-mono">{c.cpc ? `₹${c.cpc}` : "—"}</td>
                  <td className="px-3 py-3 text-right font-mono font-semibold text-emerald-600">
                    {c.roas ? `${c.roas}×` : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={c.status === "Overspend" ? "danger" : c.status === "Paused" ? "neutral" : "success"}>
                      {c.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {c.status === "Paused" ? (
                      <Button variant="outline" size="sm" className="border-emerald-200 text-emerald-700">
                        Resume
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => setPauseTarget(c.name)}>
                        Pause
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold text-slate-900">
                <td className="px-5 py-3">Total (Active)</td>
                <td />
                <td className="px-3 py-3 text-right font-mono">₹40,000</td>
                <td className="px-3 py-3 text-right font-mono">₹34,360</td>
                <td className="px-3 py-3 text-right font-mono">1,201</td>
                <td className="px-3 py-3 text-right font-mono">₹29</td>
                <td colSpan={4} />
              </tr>
            </tbody>
          </table>
          </div>
        </Card>
      </div>

      <Modal
        open={pauseTarget !== null}
        onClose={() => setPauseTarget(null)}
        title="Pause Campaign"
        footer={
          <>
            <Button variant="secondary" className="flex-1" onClick={() => setPauseTarget(null)}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={() => setPauseTarget(null)}>
              Pause Campaign
            </Button>
          </>
        }
      >
        <p>
          Pause <span className="font-semibold text-slate-900">{pauseTarget}</span>? Current spend is{" "}
          <span className="font-semibold text-red-600">₹{overspend.spent.toLocaleString("en-IN")}</span> vs ₹
          {overspend.budgetDay.toLocaleString("en-IN")} daily cap ({overspend.pct - 100}% over).
        </p>
        <p className="mt-3">Pausing will stop new leads from this campaign immediately.</p>
      </Modal>
    </div>
  );
}
