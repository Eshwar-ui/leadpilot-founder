"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ApiError, leadsApi, type BoardLead } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Clock, AlertTriangle } from "lucide-react";

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

function freshLabel(daysStuck: number) {
  return daysStuck === 0 ? "Fresh" : `${daysStuck}d stuck`;
}

export default function KanbanBoardPage() {
  const [stages, setStages] = useState<string[]>([]);
  const [leads, setLeads] = useState<BoardLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [closingLead, setClosingLead] = useState<BoardLead | null>(null);
  const [dealValueInput, setDealValueInput] = useState("");

  function load() {
    setLoading(true);
    setError(null);
    leadsApi
      .board()
      .then((res) => {
        setStages(res.stages);
        setLeads(res.leads);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load leads board"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function moveStage(lead: BoardLead, stage: string, dealValue?: number) {
    if (stage === lead.pipeline_stage) return;
    setMovingId(lead.id);
    const prevStage = lead.pipeline_stage;
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, pipeline_stage: stage } : l)));
    try {
      await leadsApi.updateStage(lead.id, stage, dealValue);
    } catch {
      // Revert on failure — don't leave the board showing a move that didn't persist.
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, pipeline_stage: prevStage } : l)));
    } finally {
      setMovingId(null);
    }
  }

  function handleStagePick(lead: BoardLead, stage: string) {
    if (stage === "Closed Won") {
      // Revenue reporting needs a deal value to be worth anything — ask for it
      // before persisting the move instead of silently recording ₹0.
      setDealValueInput("");
      setClosingLead(lead);
      return;
    }
    moveStage(lead, stage);
  }

  function confirmCloseWon() {
    if (!closingLead) return;
    const value = Number(dealValueInput);
    moveStage(closingLead, "Closed Won", Number.isFinite(value) && value > 0 ? value : undefined);
    setClosingLead(null);
  }

  const stuckList = useMemo(
    () =>
      [...leads]
        .filter((l) => l.days_stuck > 0)
        .sort((a, b) => b.days_stuck - a.days_stuck)
        .map((l) => ({
          ...l,
          action: l.days_stuck >= 5 ? "CRITICAL" : l.days_stuck >= 3 ? "HIGH" : "MEDIUM",
        })),
    [leads]
  );

  const staleCount = leads.filter((l) => l.days_stuck >= 5).length;
  const overdueCount = leads.filter((l) => l.days_stuck >= 2).length;
  const avgDaysStuck = leads.length ? (leads.reduce((sum, l) => sum + l.days_stuck, 0) / leads.length).toFixed(1) : "0";

  return (
    <div className="pb-10">
      <PageHeader
        title="Lead Kanban Board"
        description="9-stage funnel view — use the stage picker on a card to move it"
        action={
          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">All</div>
            <Button variant="outline" size="sm">
              <Download className="size-3.5" /> Export
            </Button>
          </div>
        }
      />

      <div className="mt-4 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 sm:grid-cols-3">
        <StatCard label="Stale Leads (5+ days)" value={String(staleCount)} tone={staleCount > 0 ? "danger" : "default"} icon={Clock} />
        <StatCard label="Overdue (48h+)" value={String(overdueCount)} tone={overdueCount > 0 ? "danger" : "default"} icon={AlertTriangle} />
        <StatCard label="Avg Days Stuck" value={`${avgDaysStuck}d`} icon={Clock} />
      </div>

      {error && (
        <div className="mt-4 mx-4 sm:mx-6 lg:mx-8 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error} —{" "}
          <button className="font-semibold underline" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <p className="mt-6 px-4 text-center text-sm text-slate-400 sm:px-6 lg:px-8">Loading leads…</p>
      ) : leads.length === 0 && !error ? (
        <p className="mt-6 px-4 text-center text-sm text-slate-400 sm:px-6 lg:px-8">
          No leads yet. Leads created via the mobile app or the leads API will show up here.
        </p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto px-4 sm:px-6 lg:px-8 pb-2">
            <div className="flex gap-3" style={{ width: "max-content" }}>
              {stages.map((stage) => {
                const stageLeads = leads.filter((l) => l.pipeline_stage === stage);
                return (
                  <div key={stage} className="w-64 shrink-0">
                    <div className="mb-2 flex items-center justify-between px-1">
                      <span className="text-sm font-semibold text-slate-700">{stage}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                        {stageLeads.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {stageLeads.map((lead) => (
                        <Card key={lead.id} className={cn("border-t-2 p-3", stageBorder[stage])}>
                          <p className="text-sm font-semibold text-slate-900">{lead.name}</p>
                          <div className="mt-1.5 flex items-center gap-2 text-xs">
                            {lead.source && (
                              <span className={cn("font-medium", sourceTone[lead.source] ?? "text-slate-500")}>
                                {lead.source}
                              </span>
                            )}
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-semibold text-slate-600">
                              {lead.score !== null ? `Score ${lead.score}` : "Not scored"}
                            </span>
                          </div>
                          <div className="mt-1.5 text-xs text-slate-400">
                            {lead.telecaller_name ?? "Unassigned"} · {freshLabel(lead.days_stuck)}
                          </div>
                          <select
                            value={lead.pipeline_stage}
                            disabled={movingId === lead.id}
                            onChange={(e) => handleStagePick(lead, e.target.value)}
                            className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 disabled:opacity-50"
                          >
                            {stages.map((s) => (
                              <option key={s} value={s}>
                                Move to {s}
                              </option>
                            ))}
                          </select>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {stuckList.length > 0 && (
            <div className="mt-4 px-4 sm:px-6 lg:px-8">
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        <th className="px-5 py-3">Lead</th>
                        <th className="px-3 py-3">Source</th>
                        <th className="px-3 py-3">Stage</th>
                        <th className="px-3 py-3">Telecaller</th>
                        <th className="px-3 py-3 text-right">Days Stuck</th>
                        <th className="px-5 py-3 text-right">Action Needed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stuckList.map((lead) => (
                        <tr key={lead.id}>
                          <td className="px-5 py-3 font-semibold text-slate-900">{lead.name}</td>
                          <td className={cn("px-3 py-3 font-medium", sourceTone[lead.source ?? ""] ?? "text-slate-500")}>
                            {lead.source ?? "—"}
                          </td>
                          <td className="px-3 py-3 text-slate-600">{lead.pipeline_stage}</td>
                          <td className="px-3 py-3 text-slate-600">{lead.telecaller_name ?? "Unassigned"}</td>
                          <td className="px-3 py-3 text-right font-mono font-semibold text-red-600">{lead.days_stuck}d</td>
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
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      <Modal
        open={closingLead !== null}
        onClose={() => setClosingLead(null)}
        title="Deal value"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setClosingLead(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={confirmCloseWon}>
              Mark Closed Won
            </Button>
          </>
        }
      >
        <p className="mb-3">
          Moving <b>{closingLead?.name}</b> to Closed Won. Enter the deal value so it shows up in the revenue
          dashboard (leave blank if unknown).
        </p>
        <input
          autoFocus
          type="number"
          min={0}
          placeholder="e.g. 85000"
          value={dealValueInput}
          onChange={(e) => setDealValueInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && confirmCloseWon()}
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
        />
      </Modal>
    </div>
  );
}
