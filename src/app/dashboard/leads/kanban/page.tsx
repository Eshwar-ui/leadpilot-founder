import { Download } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import { kanbanStages, kanbanLeads } from "@/lib/mock-data";
import { formatLakhs, cn } from "@/lib/utils";
import { Clock, AlertTriangle, Activity } from "lucide-react";

const sourceTone: Record<string, string> = {
  Meta: "text-blue-600",
  Google: "text-amber-600",
  "Walk-in": "text-violet-600",
  Referral: "text-emerald-600",
};

const stageBorder: Record<string, string> = {
  New: "border-t-slate-300",
  Assigned: "border-t-amber-400",
  Contacted: "border-t-violet-400",
  Interested: "border-t-blue-400",
  "Proposal Sent": "border-t-red-400",
  Negotiation: "border-t-indigo-400",
  "Closed Won": "border-t-emerald-500",
  "Closed Lost": "border-t-red-500",
  Junk: "border-t-slate-400",
};

const actionTone: Record<string, "danger" | "warning" | "info"> = {
  CRITICAL: "danger",
  HIGH: "warning",
  MEDIUM: "info",
};

const stuckList = [...kanbanLeads]
  .filter((l) => l.daysStuck > 0)
  .sort((a, b) => b.daysStuck - a.daysStuck)
  .map((l) => ({
    ...l,
    action: l.daysStuck >= 5 ? "CRITICAL" : l.daysStuck >= 3 ? "HIGH" : "MEDIUM",
  }));

export default function KanbanBoardPage() {
  return (
    <div className="pb-10">
      <PageHeader
        title="Lead Kanban Board"
        description="9-stage funnel view — click any card to move stage"
        action={
          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">All</div>
            <Button variant="outline" size="sm">
              <Download className="size-3.5" /> Export
            </Button>
          </div>
        }
      />

      <div className="mt-4 grid grid-cols-2 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-4">
        <StatCard label="Stale Leads (5+ days)" value="3" tone="danger" icon={Clock} />
        <StatCard label="Overdue (48h+)" value="9" tone="danger" icon={AlertTriangle} />
        <StatCard label="Revenue at Risk" value="₹25.4L" tone="danger" icon={Activity} />
        <StatCard label="Avg Days Stuck" value="3.7d" icon={Clock} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-red-500" /> Stale (5+ days)</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-500" /> Overdue (48h+)</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-500" /> Closed Won</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-slate-400" /> Lost / Junk</span>
      </div>

      <div className="mt-4 overflow-x-auto px-4 sm:px-6 lg:px-8 pb-2">
        <div className="flex gap-3" style={{ width: "max-content" }}>
          {kanbanStages.map((stage) => {
            const leads = kanbanLeads.filter((l) => l.stage === stage);
            return (
              <div key={stage} className="w-64 shrink-0">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-sm font-semibold text-slate-700">{stage}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                    {leads.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {leads.map((lead) => (
                    <Card
                      key={lead.id}
                      className={cn("cursor-pointer border-t-2 p-3 hover:shadow-md", stageBorder[stage])}
                    >
                      <p className="text-sm font-semibold text-slate-900">{lead.name}</p>
                      <div className="mt-1.5 flex items-center gap-2 text-xs">
                        <span className={cn("font-medium", sourceTone[lead.source])}>{lead.source}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-semibold text-slate-600">
                          Score {lead.score}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-xs text-slate-400">
                        <span>
                          {lead.telecaller} · {lead.freshLabel || "Fresh"}
                        </span>
                        {lead.revenue > 0 && <span className="font-mono text-slate-600">{formatLakhs(lead.revenue)}</span>}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3">Lead</th>
                <th className="px-3 py-3">Source</th>
                <th className="px-3 py-3">Stage</th>
                <th className="px-3 py-3">Telecaller</th>
                <th className="px-3 py-3 text-right">Days Stuck</th>
                <th className="px-3 py-3 text-right">Revenue</th>
                <th className="px-5 py-3 text-right">Action Needed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stuckList.map((lead) => (
                <tr key={lead.id}>
                  <td className="px-5 py-3 font-semibold text-slate-900">{lead.name}</td>
                  <td className={cn("px-3 py-3 font-medium", sourceTone[lead.source])}>{lead.source}</td>
                  <td className="px-3 py-3 text-slate-600">{lead.stage}</td>
                  <td className="px-3 py-3 text-slate-600">{lead.telecaller}</td>
                  <td className="px-3 py-3 text-right font-mono font-semibold text-red-600">{lead.daysStuck}d</td>
                  <td className="px-3 py-3 text-right font-mono text-slate-700">{formatLakhs(lead.revenue)}</td>
                  <td className="px-5 py-3 text-right">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold",
                        actionTone[lead.action] === "danger" && "bg-red-50 text-red-600",
                        actionTone[lead.action] === "warning" && "bg-amber-50 text-amber-600",
                        actionTone[lead.action] === "info" && "bg-blue-50 text-blue-600"
                      )}
                    >
                      ● {lead.action}
                    </span>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={5} className="bg-red-50 px-5 py-3 font-semibold text-slate-900">
                  Total Revenue at Risk (5+ days stale)
                </td>
                <td colSpan={2} className="bg-red-50 px-5 py-3 text-right font-mono text-lg font-bold text-red-600">
                  ₹25.4L
                </td>
              </tr>
            </tbody>
          </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
