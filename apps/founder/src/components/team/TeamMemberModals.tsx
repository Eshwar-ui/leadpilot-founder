"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ApiError, teamApi, type TeamMember } from "@/lib/api";

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

/// Edit flow (role + active/inactive) — shared by the Telecaller Detail page
/// and the Performance Matrix page, both of which only ever had read-only
/// telecaller data on-screen and required a detour to Settings > Users to
/// change anything.
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
  const [role, setRole] = useState<string>("telecaller");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !member) return;
    setRole(member.role);
    setActive(member.status === "Active");
    setError(null);
  }, [open, member]);

  async function submit() {
    if (!member) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await teamApi.update(member.id, { role, is_active: active });
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
          <Button size="sm" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <p className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="input">
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
