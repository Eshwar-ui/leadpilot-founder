"use client";

import { useEffect, useState } from "react";
import { BellRing, Check, Copy, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StatCard } from "@/components/ui/StatCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SkeletonStatCard, SkeletonTableRow } from "@/components/ui/Skeleton";
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

// Quality is a 0–110 composite score (5 skill dimensions + punctuality), NOT a
// percentage — render it as "/110" to match the Performance and Comparison
// pages instead of a misleading "%".
const QUALITY_MAX = 110;

// The green "Active" dot must reflect recent activity, not whether the account
// is enabled. A just-invited telecaller who has never made a call is enabled
// but not "Active" — derive the dot from last_active so it reads honestly, and
// surface the enabled/disabled state as a separate badge.
const ACTIVE_WINDOW_DAYS = 7;
function activityState(lastActive: string | null): { dot: string; label: string } {
  if (!lastActive) return { dot: "bg-slate-300", label: "Never active" };
  const days = (Date.now() - new Date(lastActive).getTime()) / 86_400_000;
  if (days <= ACTIVE_WINDOW_DAYS) return { dot: "bg-emerald-500", label: "Active" };
  return { dot: "bg-amber-500", label: "Idle" };
}

/** A one-time secret (temp password) shown with a real copy affordance.
 * Adapted from ui/CopyableId — that one truncates to 8 chars for table rows,
 * which would silently hand the founder half a password. Here the value must
 * be shown and copied in full, because the API never returns it again. */
function SecretValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API is unavailable on insecure origins / older browsers —
      // the value is still visible above, so failing silently is safe. Select
      // it so the founder can copy by hand.
      setCopied(false);
    }
  }

  return (
    <div className="flex items-stretch gap-2">
      <code className="flex-1 select-all break-all rounded-lg bg-slate-100 px-3 py-2 font-mono text-sm text-slate-800">
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? `${label} copied to clipboard` : `Copy ${label} to clipboard`}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors",
          copied
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-slate-200 text-slate-700 hover:bg-slate-50"
        )}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
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

  const [resetMember, setResetMember] = useState<TeamMember | null>(null);
  const [resetCustomPassword, setResetCustomPassword] = useState("");
  const [resetTempPassword, setResetTempPassword] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSubmitting, setResetSubmitting] = useState(false);

  const [notifyMember, setNotifyMember] = useState<TeamMember | null>(null);
  const [notifyTitle, setNotifyTitle] = useState("Message from your founder");
  const [notifyMessage, setNotifyMessage] = useState("");
  const [notifyError, setNotifyError] = useState<string | null>(null);
  const [notifySubmitting, setNotifySubmitting] = useState(false);
  const [notifySent, setNotifySent] = useState(false);

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

  // Both modals hand back a PLAINTEXT credential. Clearing it only on the next
  // open left the secret sitting in React state (and therefore in a devtools
  // component inspection / a React error overlay) for the rest of the session,
  // long after the founder closed the dialog. Wipe it on every close path —
  // including the X, the Cancel button and the Done button.
  function closeInvite() {
    setInviteOpen(false);
    setTempPassword(null);
  }

  function closeReset() {
    setResetMember(null);
    setResetTempPassword(null);
    setResetCustomPassword("");
  }

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

  function openResetPassword(member: TeamMember) {
    setResetMember(member);
    setResetCustomPassword("");
    setResetTempPassword(null);
    setResetError(null);
  }

  async function submitResetPassword() {
    if (!resetMember) return;
    if (resetCustomPassword && resetCustomPassword.length < 8) {
      setResetError("Password must be at least 8 characters");
      return;
    }
    setResetSubmitting(true);
    setResetError(null);
    try {
      const { temp_password } = await teamApi.resetPassword(resetMember.id, resetCustomPassword || undefined);
      setResetTempPassword(temp_password);
    } catch (e) {
      setResetError(e instanceof ApiError ? e.message : "Failed to reset password");
    } finally {
      setResetSubmitting(false);
    }
  }

  function openNotification(member: TeamMember) {
    setNotifyMember(member);
    setNotifyTitle("Message from your founder");
    setNotifyMessage("");
    setNotifyError(null);
    setNotifySent(false);
  }

  async function submitNotification() {
    if (!notifyMember) return;
    const title = notifyTitle.trim();
    const message = notifyMessage.trim();
    if (!title || !message) {
      setNotifyError("Enter both a title and message");
      return;
    }
    setNotifySubmitting(true);
    setNotifyError(null);
    try {
      await teamApi.sendNotification(notifyMember.id, { title, message });
      setNotifySent(true);
    } catch (e) {
      setNotifyError(e instanceof ApiError ? e.message : "Failed to send notification");
    } finally {
      setNotifySubmitting(false);
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
            aria-pressed={tab === t.key}
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
              {error ? "—" : t.key === "all" ? members.length : members.filter((m) => m.role === t.key).length}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 sm:grid-cols-3">
        {loading ? (
          <>
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
          </>
        ) : (
          <>
            {/* On a failed fetch `members` is [], so a raw count would render a
                confident "0 Total Members" for what is actually "unknown". */}
            <StatCard label="Total Members" value={error ? "—" : String(members.length)} suffix="Managed" />
            <StatCard label="Active" value={error ? "—" : String(activeCount)} suffix="Enabled" />
            <StatCard label="Inactive" value={error ? "—" : String(inactiveCount)} suffix="Disabled" />
          </>
        )}
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="overflow-hidden">
          {error && (
            <div role="alert" className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">
              {error} —{" "}
              <button className="font-semibold underline" onClick={loadTeam}>
                Retry
              </button>
            </div>
          )}
          {/* Gated on `!error`: a failed fetch also leaves `filtered` empty, and
              rendering "No team members yet" under the red banner told the
              founder their team was empty when the request had actually failed. */}
          {!loading && error ? null : !loading && filtered.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-600">
              {members.length === 0
                ? "No team members yet. Invite your first member to get started."
                : `No ${ROLE_TABS.find((t) => t.key === tab)?.label.toLowerCase() ?? "members"} on the team yet.`}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-5 py-3">Team Member</th>
                    <th scope="col" className="px-3 py-3">Role</th>
                    <th scope="col" className="px-3 py-3">Status</th>
                    <th scope="col" className="px-3 py-3 text-right">Calls</th>
                    <th scope="col" className="px-3 py-3 text-right">Leads</th>
                    <th scope="col" className="px-3 py-3">Quality</th>
                    <th scope="col" className="px-5 py-3 text-right">Last Active</th>
                    <th scope="col" className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <>
                      <SkeletonTableRow columns={8} />
                      <SkeletonTableRow columns={8} />
                      <SkeletonTableRow columns={8} />
                      <SkeletonTableRow columns={8} />
                    </>
                  ) : (
                  filtered.map((m) => (
                    <tr key={m.id}>
                      <td className="px-5 py-3">
                        <p className="font-semibold text-slate-900">{m.name}</p>
                        <p className="text-xs text-slate-600">
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
                        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                          <span className={cn("size-1.5 rounded-full", activityState(m.last_active).dot)} />
                          {activityState(m.last_active).label}
                          {m.status === "Inactive" && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                              Disabled
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-mono">{m.calls}</td>
                      <td className="px-3 py-3 text-right font-mono">{m.leads}</td>
                      <td className="px-3 py-3">
                        {m.quality === null ? (
                          <span className="text-xs text-slate-600">No calls yet</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <ProgressBar value={Math.round((m.quality / QUALITY_MAX) * 100)} tone="success" className="w-20" />
                            <span className="font-mono text-xs font-semibold text-slate-600">{m.quality}/{QUALITY_MAX}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-slate-600">{formatLastActive(m.last_active)}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {m.role === "telecaller" && m.status === "Active" && (
                            <button
                              className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline"
                              onClick={() => openNotification(m)}
                            >
                              <BellRing className="size-3.5" /> Notify
                            </button>
                          )}
                          <button
                            className="text-xs font-semibold text-primary-600 hover:underline"
                            onClick={() => openResetPassword(m)}
                          >
                            Reset Password
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={inviteOpen}
        onClose={closeInvite}
        title={tempPassword ? "Member invited" : "Invite Member"}
        footer={
          tempPassword ? (
            <Button size="sm" className="w-full" onClick={closeInvite}>
              Done
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" className="flex-1" onClick={closeInvite}>
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
            <SecretValue value={tempPassword} label="temporary password" />
            {inviteRole === "telecaller" && (
              <p className="text-xs text-slate-600">
                They&apos;ll use this email + password to sign in on the LeadPilot mobile app —
                telecallers don&apos;t get a web account.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {inviteError && <p role="alert" className="text-xs font-medium text-red-600">{inviteError}</p>}
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
              <label className="mb-1 block text-xs font-semibold text-slate-500" htmlFor="invite-role">
                Role
              </label>
              <select
                id="invite-role"
                aria-label="Role for the invited member"
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

      <Modal
        open={notifyMember !== null}
        onClose={() => setNotifyMember(null)}
        title={notifySent ? "Notification sent" : `Notify ${notifyMember?.name ?? "telecaller"}`}
        footer={
          notifySent ? (
            <Button size="sm" className="w-full" onClick={() => setNotifyMember(null)}>
              Done
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setNotifyMember(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={submitNotification}
                disabled={notifySubmitting || !notifyTitle.trim() || !notifyMessage.trim()}
              >
                {notifySubmitting ? "Sending…" : "Send Notification"}
              </Button>
            </>
          )
        }
      >
        {notifySent ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
            The notification was accepted by Firebase for {notifyMember?.name}&apos;s registered device.
          </div>
        ) : (
          <div className="space-y-3">
            {notifyError && <p role="alert" className="text-xs font-medium text-red-600">{notifyError}</p>}
            <p className="text-xs text-slate-500">
              This sends a push only to this telecaller. They must have opened and signed in to the mobile app at least once.
            </p>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Title</label>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={notifyTitle}
                maxLength={80}
                onChange={(e) => setNotifyTitle(e.target.value)}
              />
              <p className="mt-1 text-right text-[11px] text-slate-400">{notifyTitle.length}/80</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Message</label>
              <textarea
                className="min-h-28 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={notifyMessage}
                maxLength={240}
                onChange={(e) => setNotifyMessage(e.target.value)}
                placeholder="Write a short update for this telecaller"
              />
              <p className="mt-1 text-right text-[11px] text-slate-400">{notifyMessage.length}/240</p>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={resetMember !== null}
        onClose={closeReset}
        title={resetTempPassword ? "Password reset" : "Reset Password"}
        footer={
          resetTempPassword ? (
            <Button size="sm" className="w-full" onClick={closeReset}>
              Done
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" className="flex-1" onClick={closeReset}>
                Cancel
              </Button>
              <Button size="sm" className="flex-1" onClick={submitResetPassword} disabled={resetSubmitting}>
                {resetSubmitting ? "Resetting…" : "Reset Password"}
              </Button>
            </>
          )
        }
      >
        {resetTempPassword ? (
          <div className="space-y-2">
            <p>
              <span className="font-semibold text-slate-900">{resetMember?.name}</span>&apos;s password was
              reset. Share this {resetCustomPassword ? "" : "temporary "}password with them — it won&apos;t be
              shown again.
            </p>
            <SecretValue
              value={resetTempPassword}
              label={resetCustomPassword ? "password" : "temporary password"}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {resetError && <p role="alert" className="text-xs font-medium text-red-600">{resetError}</p>}
            <p>
              Reset the password for <span className="font-semibold text-slate-900">{resetMember?.name}</span>?
              Their current password will stop working immediately.
            </p>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                New Password (optional)
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
                value={resetCustomPassword}
                onChange={(e) => setResetCustomPassword(e.target.value)}
                placeholder="Leave blank to auto-generate one"
              />
              <p className="mt-1 text-xs text-slate-400">
                Set a specific password, or leave this blank to generate a random temporary one.
                Either way, they&apos;ll need to change it the next time they log in.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
