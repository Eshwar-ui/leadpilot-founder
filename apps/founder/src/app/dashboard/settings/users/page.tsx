"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SkeletonTableRow } from "@/components/ui/Skeleton";
import { AddTelecallerModal, ROLES, ROLE_LABEL } from "@/components/team/TeamMemberModals";
import { ApiError, teamApi, type TeamMember } from "@/lib/api";
import { cn, initials } from "@/lib/utils";

const statusPill: Record<string, string> = {
  Active: "bg-emerald-50 text-emerald-700",
  Inactive: "bg-slate-100 text-slate-500",
};

function lastActiveLabel(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export default function UserManagementPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("All");
  const [adding, setAdding] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    teamApi
      .list()
      .then(setMembers)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load team"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { All: members.length };
    for (const m of members) counts[m.role] = (counts[m.role] ?? 0) + 1;
    return counts;
  }, [members]);

  const visible = roleFilter === "All" ? members : members.filter((m) => m.role === roleFilter);

  async function changeRole(id: string, role: string) {
    setSavingId(id);
    try {
      const updated = await teamApi.update(id, { role });
      setMembers((prev) => prev.map((m) => (m.id === id ? updated : m)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to update role");
    } finally {
      setSavingId(null);
    }
  }

  async function toggleActive(m: TeamMember) {
    setSavingId(m.id);
    try {
      const updated = await teamApi.update(m.id, { is_active: m.status !== "Active" });
      setMembers((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to update status");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="pb-10">
      <div className="px-4 pt-6 sm:px-6 lg:px-8">
        <Link href="/dashboard/settings" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary-600">
          <ArrowLeft className="size-3.5" /> Settings
        </Link>
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">User Management</h1>
            <p className="mt-1 text-sm text-slate-500">Who is on the team and what they can see</p>
          </div>
          <Button size="sm" onClick={() => setAdding(true)}>
            <UserPlus className="size-3.5" /> Add Team Member
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-4 mx-4 sm:mx-6 lg:mx-8 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error} —{" "}
          <button className="font-semibold underline" onClick={load}>
            Retry
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5 px-4 sm:px-6 lg:px-8">
        {["All", ...ROLES].map((r) => (
          <button
            key={r}
            onClick={() => setRoleFilter(r)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
              roleFilter === r ? "bg-primary-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            {r === "All" ? "All" : ROLE_LABEL[r]}
            <span className={cn("rounded-full px-1.5 font-mono text-[10px] font-bold", roleFilter === r ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>
              {roleCounts[r] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Team Member</th>
                  <th className="px-3 py-3">Role</th>
                  <th className="px-3 py-3 text-right">Calls</th>
                  <th className="px-3 py-3 text-right">Leads</th>
                  <th className="px-3 py-3 text-right">Quality</th>
                  <th className="px-3 py-3">Last Active</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <>
                    <SkeletonTableRow columns={8} />
                    <SkeletonTableRow columns={8} />
                    <SkeletonTableRow columns={8} />
                  </>
                ) : visible.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-400">
                      No team members{roleFilter !== "All" ? ` with the ${ROLE_LABEL[roleFilter]} role` : ""} yet.
                    </td>
                  </tr>
                ) : (
                  visible.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex size-8 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700">
                            {initials(m.name)}
                          </span>
                          <div>
                            <span className="block font-medium text-slate-900">{m.name}</span>
                            <span className="block text-xs text-slate-400">{m.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <select
                          value={m.role}
                          onChange={(e) => changeRole(m.id, e.target.value)}
                          disabled={savingId === m.id}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">{m.calls}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">{m.leads}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">{m.quality ?? "—"}</td>
                      <td className="px-3 py-3 text-xs text-slate-500">{lastActiveLabel(m.last_active)}</td>
                      <td className="px-3 py-3">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", statusPill[m.status])}>{m.status}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button variant="outline" size="sm" disabled={savingId === m.id} onClick={() => toggleActive(m)}>
                          {m.status === "Active" ? "Deactivate" : "Activate"}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <AddTelecallerModal open={adding} onClose={() => setAdding(false)} onAdded={load} />
    </div>
  );
}
