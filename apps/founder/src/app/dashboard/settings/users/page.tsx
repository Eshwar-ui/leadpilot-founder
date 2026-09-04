"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SkeletonTableRow } from "@/components/ui/Skeleton";
import { AddTelecallerModal, ROLES, ROLE_LABEL } from "@/components/team/TeamMemberModals";
import { ApiError, orgApi, teamApi, type TeamMember } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
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
  // loadError and actionError are deliberately separate. They used to share one
  // state, and the banner that rendered it appended "— Retry" wired to load(),
  // so every failed save read as nonsense: "Cannot deactivate your own account
  // — Retry". Re-running load() does nothing for a rejected write.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("All");
  const [adding, setAdding] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState<TeamMember | null>(null);

  // Whether telecallers are scoped to only their own leads (Organization.
  // strict_lead_scoping). null while unloaded — the toggle disables itself
  // until it knows the real value, so a stray click can't flip it blind.
  const [scoping, setScoping] = useState<boolean | null>(null);
  const [scopingLoadError, setScopingLoadError] = useState<string | null>(null);
  const [scopingSaving, setScopingSaving] = useState(false);
  const [scopingError, setScopingError] = useState<string | null>(null);

  function loadScoping() {
    setScopingLoadError(null);
    orgApi
      .get()
      .then((p) => setScoping(p.strict_lead_scoping))
      .catch((e) => setScopingLoadError(e instanceof ApiError ? e.message : "Failed to load setting"));
  }

  useEffect(loadScoping, []);

  async function toggleScoping() {
    if (scoping === null || scopingSaving) return;
    const next = !scoping;
    setScopingSaving(true);
    setScopingError(null);
    try {
      const updated = await orgApi.update({ strict_lead_scoping: next });
      setScoping(updated.strict_lead_scoping);
    } catch (e) {
      setScopingError(e instanceof ApiError ? e.message : "Failed to update setting");
    } finally {
      setScopingSaving(false);
    }
  }

  function load() {
    setLoading(true);
    setLoadError(null);
    teamApi
      .list()
      .then(setMembers)
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : "Failed to load team"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  // localStorage is only readable after mount, so this can't be an initialiser.
  useEffect(() => {
    setCurrentUserId(getStoredUser()?.id ?? null);
  }, []);

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { All: members.length };
    for (const m of members) counts[m.role] = (counts[m.role] ?? 0) + 1;
    return counts;
  }, [members]);

  const visible = roleFilter === "All" ? members : members.filter((m) => m.role === roleFilter);

  async function changeRole(id: string, role: string) {
    // Belt-and-braces: the <select> for your own row is already disabled below,
    // but a self-demotion is unrecoverable from inside the product (a sole
    // founder who becomes a Telecaller 403s on every founder endpoint,
    // including this page), so never let one through on any code path.
    if (id === currentUserId) return;
    setSavingId(id);
    setActionError(null);
    try {
      const updated = await teamApi.update(id, { role });
      setMembers((prev) => prev.map((m) => (m.id === id ? updated : m)));
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Failed to update role");
    } finally {
      setSavingId(null);
    }
  }

  // Activating is harmless and stays one-click. Deactivating is destructive
  // (revokes access AND pushes a notification to the member's phone), so it
  // routes through a confirmation naming the person and both consequences.
  function onToggleActiveClick(m: TeamMember) {
    if (m.status === "Active") {
      setDeactivating(m);
      return;
    }
    void setActive(m, true);
  }

  async function setActive(m: TeamMember, isActive: boolean) {
    setSavingId(m.id);
    setActionError(null);
    try {
      const updated = await teamApi.update(m.id, { is_active: isActive });
      setMembers((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
      setDeactivating(null);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Failed to update status");
      setDeactivating(null);
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

      {/* Load failures are retryable — the whole list is missing and load()
          fixes it. */}
      {loadError && (
        <div className="mt-4 mx-4 sm:mx-6 lg:mx-8 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError} —{" "}
          <button className="font-semibold underline" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {/* Action failures are NOT retryable via load(); the list on screen is
          fine and it's the write that was rejected. Dismiss instead. */}
      {actionError && (
        <div className="mt-4 mx-4 sm:mx-6 lg:mx-8 flex items-start justify-between gap-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{actionError}</span>
          <button
            className="shrink-0 font-semibold underline"
            onClick={() => setActionError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="flex items-start justify-between gap-4 p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Telecallers only see their own leads</p>
            <p className="mt-0.5 text-xs text-slate-500">
              When on, each telecaller&apos;s inbox and lead detail screens show only leads assigned to them —
              not every telecaller&apos;s leads. Founders and admins keep full visibility here regardless.
            </p>
            {scopingLoadError && (
              <p className="mt-1.5 text-xs font-medium text-red-600">
                {scopingLoadError} —{" "}
                <button className="underline" onClick={loadScoping}>
                  Retry
                </button>
              </p>
            )}
            {scopingError && <p className="mt-1.5 text-xs font-medium text-red-600">{scopingError}</p>}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={scoping ?? false}
            aria-label="Restrict telecallers to their own leads"
            disabled={scoping === null || scopingSaving}
            onClick={toggleScoping}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              scoping ? "bg-primary-600" : "bg-slate-200"
            )}
          >
            <span
              className={cn(
                "inline-block size-4 transform rounded-full bg-white shadow transition-transform",
                scoping ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </Card>
      </div>

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
                  visible.map((m) => {
                    const isSelf = m.id === currentUserId;
                    return (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex size-8 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700">
                            {initials(m.name)}
                          </span>
                          <div>
                            <span className="block font-medium text-slate-900">
                              {m.name}
                              {isSelf && (
                                <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                  You
                                </span>
                              )}
                            </span>
                            <span className="block text-xs text-slate-400">{m.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {/* You cannot change your own role here. Demoting
                            yourself is a one-way door: the new role 403s on
                            every founder endpoint including this page, so there
                            is no way back from inside the product. */}
                        <select
                          value={m.role}
                          onChange={(e) => changeRole(m.id, e.target.value)}
                          disabled={savingId === m.id || isSelf}
                          title={
                            isSelf
                              ? "You can't change your own role — it would lock you out of the founder portal. Ask another founder or admin to do it."
                              : undefined
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
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
                        {/* Deactivating yourself has the same one-way-door
                            problem as self-demotion — it revokes your own
                            access to this page. */}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={savingId === m.id || (isSelf && m.status === "Active")}
                          title={
                            isSelf && m.status === "Active"
                              ? "You can't deactivate your own account — it would lock you out of the founder portal."
                              : undefined
                          }
                          onClick={() => onToggleActiveClick(m)}
                        >
                          {m.status === "Active" ? "Deactivate" : "Activate"}
                        </Button>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <AddTelecallerModal open={adding} onClose={() => setAdding(false)} onAdded={load} />

      <Modal
        open={deactivating !== null}
        onClose={() => setDeactivating(null)}
        title="Deactivate team member?"
        footer={
          <>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDeactivating(null)}
              disabled={savingId === deactivating?.id}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              disabled={savingId === deactivating?.id}
              onClick={() => deactivating && setActive(deactivating, false)}
            >
              {savingId === deactivating?.id ? "Deactivating…" : "Deactivate"}
            </Button>
          </>
        }
      >
        <p>
          <span className="font-semibold text-slate-900">{deactivating?.name}</span>
          {deactivating?.email && <span className="text-slate-400"> ({deactivating.email})</span>} will:
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li>Lose access immediately — they will be signed out of the mobile app and cannot sign back in.</li>
          <li>Receive a push notification on their phone telling them their account was deactivated.</li>
        </ul>
        <p className="mt-3 text-slate-500">
          Their calls, leads, and history are kept. You can reactivate them from this page at any time.
        </p>
      </Modal>
    </div>
  );
}
