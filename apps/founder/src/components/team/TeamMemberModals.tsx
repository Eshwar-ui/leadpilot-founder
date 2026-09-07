"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ApiError, teamApi, type TeamMember } from "@/lib/api";
import { cn } from "@/lib/utils";

export const ROLES = ["founder", "admin", "ad_manager", "telecaller"] as const;
export const ROLE_LABEL: Record<string, string> = {
  founder: "Founder",
  admin: "Admin",
  ad_manager: "Ad Manager",
  telecaller: "Telecaller",
};

/// Invite flow — shared by Settings > Users and the Performance Matrix page
/// (previously duplicated only on the former, so a founder adding a
/// telecaller from Performance Matrix had to detour through Settings first).
export function AddTelecallerModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("telecaller");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ email: string; temp_password: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setEmail("");
    setPhone("");
    setRole("telecaller");
    setError(null);
    setResult(null);
  }, [open]);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await teamApi.invite({ name: name.trim(), email: email.trim(), role, phone: phone.trim() || undefined });
      setResult({ email: res.member.email, temp_password: res.temp_password });
      onAdded();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to add team member");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={result ? "Invite Created" : "Add Team Member"}
      footer={
        result ? (
          <Button className="w-full" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={submit} disabled={saving || !name.trim() || !email.trim()}>
              {saving ? "Sending…" : "Send Invite"}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="flex flex-col gap-2">
          <p>
            <b>{result.email}</b> can now sign in with this one-time password — share it with them directly, there&apos;s no invite email yet.
          </p>
          <p className="rounded-lg bg-slate-100 px-3 py-2 font-mono text-sm text-slate-800">{result.temp_password}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">Full Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya Menon" className="input" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">Work Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@yourclinic.in" className="input" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">Phone</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91" className="input" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])} className="input">
              {ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
              ))}
            </select>
          </label>
        </div>
      )}
    </Modal>
  );
}

/// A one-time plaintext credential (temp password) — shown once, then gone,
/// so a quick copy button matters more than for ordinary text.
export function SecretValue({ value, label }: { value: string; label: string }) {
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

/// Reset-password flow — shared by Settings > Users and the Telecaller Detail
/// page, so a founder looking at one telecaller doesn't have to detour
/// through the team list to reset their password.
export function ResetPasswordModal({
  open,
  member,
  onClose,
}: {
  open: boolean;
  member: TeamMember | null;
  onClose: () => void;
}) {
  const [customPassword, setCustomPassword] = useState("");
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCustomPassword("");
    setTempPassword(null);
    setError(null);
  }, [open]);

  async function submit() {
    if (!member) return;
    if (customPassword && customPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { temp_password } = await teamApi.resetPassword(member.id, customPassword || undefined);
      setTempPassword(temp_password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to reset password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tempPassword ? "Password reset" : "Reset Password"}
      footer={
        tempPassword ? (
          <Button size="sm" className="w-full" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button size="sm" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" className="flex-1" onClick={submit} disabled={submitting}>
              {submitting ? "Resetting…" : "Reset Password"}
            </Button>
          </>
        )
      }
    >
      {tempPassword ? (
        <div className="space-y-2">
          <p>
            <span className="font-semibold text-slate-900">{member?.name}</span>&apos;s password was
            reset. Share this {customPassword ? "" : "temporary "}password with them — it won&apos;t be
            shown again.
          </p>
          <SecretValue value={tempPassword} label={customPassword ? "password" : "temporary password"} />
        </div>
      ) : (
        <div className="space-y-3">
          {error && <p role="alert" className="text-xs font-medium text-red-600">{error}</p>}
          <p>
            Reset the password for <span className="font-semibold text-slate-900">{member?.name}</span>?
            Their current password will stop working immediately.
          </p>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              New Password (optional)
            </label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
              value={customPassword}
              onChange={(e) => setCustomPassword(e.target.value)}
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
  );
}

/// Edit flow (details + role + active/inactive) — shared by the Telecaller
/// Detail page and the Performance Matrix page, both of which only ever had
/// read-only telecaller data on-screen and required a detour to Settings >
/// Users to change anything.
export function EditTelecallerModal({
  open,
  member,
  onClose,
  onSaved,
}: {
  open: boolean;
  member: TeamMember | null;
  onClose: () => void;
  onSaved: (updated: TeamMember) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<string>("telecaller");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !member) return;
    setName(member.name);
    setEmail(member.email);
    setPhone(member.phone ?? "");
    setRole(member.role);
    setActive(member.status === "Active");
    setError(null);
  }, [open, member]);

  // The member's email is how they sign in (see the login screen), so moving
  // it moves their account. Surfaced before saving rather than after, because
  // a founder who didn't realise that will be the one fielding the "I can't
  // log in" call.
  const emailChanged = !!member && email.trim().toLowerCase() !== member.email.toLowerCase();

  async function submit() {
    if (!member) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await teamApi.update(member.id, {
        name: name.trim(),
        email: email.trim(),
        // "" is meaningful here — it clears a number typed onto the wrong
        // account — so it's sent as-is rather than collapsed to undefined.
        phone: phone.trim(),
        role,
        is_active: active,
      });
      onSaved(updated);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={member ? `Edit ${member.name}` : "Edit"}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={saving || !name.trim() || !email.trim()}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <p className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="edit-member-name">
            Full Name
          </label>
          <input
            id="edit-member-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Priya Menon"
            className="input"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="edit-member-email">
            Work Email
          </label>
          <input
            id="edit-member-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@yourclinic.in"
            className="input"
          />
          {emailChanged && (
            <p className="mt-1.5 rounded-md border border-amber-100 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
              This is how {member?.name}{" "}
              signs in. They&apos;ll need to use the new address from their next login — their password stays the same.
            </p>
          )}
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="edit-member-phone">
            Phone
          </label>
          <input
            id="edit-member-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91"
            className="input"
          />
          <p className="mt-1 text-xs text-slate-500">Leave blank to remove the stored number.</p>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="edit-member-role">
            Role
          </label>
          <select id="edit-member-role" value={role} onChange={(e) => setRole(e.target.value)} className="input">
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 rounded border-slate-300" />
          Active — unchecking deactivates this account
        </label>
      </div>
    </Modal>
  );
}
