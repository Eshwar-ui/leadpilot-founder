"use client";

import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StatCard } from "@/components/ui/StatCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ApiError, teamApi, type TeamMember } from "@/lib/api";
import { cn } from "@/lib/utils";

const ROLE_TABS = [
  { key: "all", label: "All" },
  { key: "telecaller", label: "Telecallers" },
  { key: "ad_manager", label: "Ad Managers" },
  { key: "admin", label: "Admins" },
];

const ROLE_LABEL: Record<string, string> = {
  founder: "FOUNDER",
  admin: "ADMIN",
  ad_manager: "AD MANAGER",
  telecaller: "TELECALLER",
};

function formatLastActive(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function ManageTeamPage() {
  const [tab, setTab] = useState("all");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRole, setInviteRole] = useState("telecaller");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  function loadTeam() {
    setLoading(true);
    setError(null);
    teamApi
      .list()
      .then(setMembers)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load team"))
      .finally(() => setLoading(false));
  }

  useEffect(loadTeam, []);

  const filtered = tab === "all" ? members : members.filter((m) => m.role === tab);
  const activeCount = members.filter((m) => m.status === "Active").length;
  const inactiveCount = members.length - activeCount;

  function openInvite() {
    setInviteEmail("");
    setInviteName("");
    setInvitePhone("");
    setInviteRole("telecaller");
    setInviteError(null);
    setTempPassword(null);
    setInviteOpen(true);
  }

  async function submitInvite() {
    setInviteSubmitting(true);
    setInviteError(null);
    try {
      const { member, temp_password } = await teamApi.invite({
        email: inviteEmail,
        name: inviteName,
        role: inviteRole,
        phone: invitePhone || undefined,
      });
      setMembers((prev) => [...prev, member]);
      setTempPassword(temp_password);
    } catch (e) {
      setInviteError(e instanceof ApiError ? e.message : "Failed to invite member");
    } finally {
      setInviteSubmitting(false);
    }
  }

  return (
    <div className="pb-10">
      <PageHeader
        title="Manage Team"
        description="Oversee your agents, managers and their productivity"
        action={
          <Button size="sm" onClick={openInvite}>
            <UserPlus className="size-3.5" /> Invite Member
          </Button>
        }
      />

      <div className="mt-4 flex flex-wrap gap-2 px-4 sm:px-6 lg:px-8">
        {ROLE_TABS.map((t) => (
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
              {t.key === "all" ? members.length : members.filter((m) => m.role === t.key).length}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 sm:grid-cols-3">
        <StatCard label="Total Members" value={String(members.length)} suffix="Managed" />
        <StatCard label="Active" value={String(activeCount)} suffix="Enabled" />
        <StatCard label="Inactive" value={String(inactiveCount)} suffix="Disabled" />
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="overflow-hidden">
          {error && (
            <div className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">
              {error} —{" "}
              <button className="font-semibold underline" onClick={loadTeam}>
                Retry
              </button>
            </div>
          )}
          {loading ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">Loading team…</div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">
              No team members yet. Invite your first member to get started.
            </div>
          ) : (
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
                    <tr key={m.id}>
                      <td className="px-5 py-3">
                        <p className="font-semibold text-slate-900">{m.name}</p>
                        <p className="text-xs text-slate-400">
                          {m.email}
                          {m.phone && <span> · {m.phone}</span>}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-md bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700">
                          {ROLE_LABEL[m.role] ?? m.role.toUpperCase()}
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
                        {m.quality === null ? (
                          <span className="text-xs text-slate-400">No calls yet</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <ProgressBar value={m.quality} tone="success" className="w-20" />
                            <span className="font-mono text-xs font-semibold text-slate-600">{m.quality}%</span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-slate-500">{formatLastActive(m.last_active)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title={tempPassword ? "Member invited" : "Invite Member"}
        footer={
          tempPassword ? (
            <Button size="sm" className="w-full" onClick={() => setInviteOpen(false)}>
              Done
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" className="flex-1" onClick={submitInvite} disabled={inviteSubmitting || !inviteEmail || !inviteName}>
                {inviteSubmitting ? "Inviting…" : "Send Invite"}
              </Button>
            </>
          )
        }
      >
        {tempPassword ? (
          <div className="space-y-2">
            <p>
              <span className="font-semibold text-slate-900">{inviteName}</span> was added. Share this
              temporary password with them — it won&apos;t be shown again.
            </p>
            <code className="block rounded-lg bg-slate-100 px-3 py-2 font-mono text-sm text-slate-800">
              {tempPassword}
            </code>
            {inviteRole === "telecaller" && (
              <p className="text-xs text-slate-500">
                They&apos;ll use this email + password to sign in on the LeadPilot mobile app —
                telecallers don&apos;t get a web account.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {inviteError && <p className="text-xs font-medium text-red-600">{inviteError}</p>}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Name</label>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Email</label>
              <input
                type="email"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Phone (optional)</label>
              <input
                type="tel"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={invitePhone}
                onChange={(e) => setInvitePhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Role</label>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                <option value="telecaller">Telecaller</option>
                <option value="ad_manager">Ad Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
