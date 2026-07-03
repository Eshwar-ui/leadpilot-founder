"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { teamMembers } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "all", label: "All", count: 14 },
  { key: "TELECALLER", label: "Telecallers", count: 8 },
  { key: "AD MANAGER", label: "Ad Managers", count: 4 },
  { key: "ADMIN", label: "Admins", count: 2 },
];

export default function ManageTeamPage() {
  const [tab, setTab] = useState("all");
  const filtered = tab === "all" ? teamMembers : teamMembers.filter((m) => m.role === tab);

  return (
    <div className="pb-10">
      <PageHeader
        title="Manage Team"
        description="Oversee your agents, managers and their productivity"
        action={
          <Button size="sm">
            <UserPlus className="size-3.5" /> Invite Member
          </Button>
        }
      />

      <div className="mt-4 flex flex-wrap gap-2 px-4 sm:px-6 lg:px-8">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.key ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            {t.label}
            <span
              className={cn(
                "rounded px-1.5 text-xs",
                tab === t.key ? "bg-white/20" : "bg-slate-100 text-slate-500"
              )}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 sm:grid-cols-3">
        <StatCard label="Total Members" value="14" suffix="Managed" />
        <StatCard label="Active Now" value="9" suffix="Online" />
        <StatCard label="Pending Invites" value="3" suffix="Sent" />
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3">Team Member</th>
                <th className="px-3 py-3">Role</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Calls</th>
                <th className="px-3 py-3 text-right">Leads</th>
                <th className="px-3 py-3">Quality</th>
                <th className="px-5 py-3 text-right">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((m) => (
                <tr key={m.email}>
                  <td className="px-5 py-3">
                    <p className="font-semibold text-slate-900">{m.name}</p>
                    <p className="text-xs text-slate-400">{m.email}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className="rounded-md bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700">
                      {m.role}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="flex items-center gap-1.5 text-xs font-medium">
                      <span
                        className={cn("size-1.5 rounded-full", m.status === "Active" ? "bg-emerald-500" : "bg-slate-300")}
                      />
                      {m.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-mono">{m.calls}</td>
                  <td className="px-3 py-3 text-right font-mono">{m.leads}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={m.quality} tone="success" className="w-20" />
                      <span className="font-mono text-xs font-semibold text-slate-600">{m.quality}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-slate-500">{m.lastActive}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
