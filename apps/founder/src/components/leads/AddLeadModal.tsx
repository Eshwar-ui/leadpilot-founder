"use client";

import { useEffect, useState } from "react";
import { ApiError, leadsApi, teamApi, type TeamMember } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

// Digits only — the backend normalises country/trunk prefixes itself
// (+91 98765 43210, 098765 43210 and 9876543210 are one lead), so this is
// only about catching a typo before a round-trip, not about reformatting.
function digitCount(phone: string) {
  return phone.replace(/\D/g, "").length;
}

export function AddLeadModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  /** Called after a successful save, with a line the page can surface. */
  onCreated: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("");
  const [reason, setReason] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [telecallers, setTelecallers] = useState<TeamMember[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setPhone("");
    setSource("");
    setReason("");
    setAssignedTo("");
    setError(null);
    setTelecallers(null);
    teamApi
      .list()
      // Only ACTIVE telecallers: the backend rejects an assignment to anyone
      // else, and offering a name that will 422 is worse than not offering it.
      .then((members) => setTelecallers(members.filter((m) => m.role === "telecaller" && m.status === "Active")))
      .catch(() => setTelecallers([]));
  }, [open]);

  const phoneDigits = digitCount(phone);
  const phoneValid = phoneDigits >= 10;
  const canSave = !!name.trim() && phoneValid && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const res = await leadsApi.createLead({
        name: name.trim(),
        phone: phone.trim(),
        source: source.trim() || undefined,
        reason: reason.trim() || undefined,
        // "" is the round-robin option — omit it rather than sending an empty
        // string, which the backend would read as an explicit assignment.
        assigned_to: assignedTo || undefined,
      });
      onCreated(
        res.restored
          ? `${res.name} was restored from the archive with its previous call history.`
          : `${res.name} was added.`
      );
      onClose();
    } catch (e) {
      // A 409 here is the duplicate rule firing, and its message already names
      // the existing lead and who owns it — far more useful than a generic
      // "couldn't save", so it's shown as-is.
      setError(e instanceof ApiError ? e.message : "Failed to add lead");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Lead"
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={save} disabled={!canSave}>
            {saving ? "Saving…" : "Add Lead"}
          </Button>
        </>
      }
    >
      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Full Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Rakesh Sharma"
            className="input"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Phone</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="10-digit number"
            aria-describedby="add-lead-phone-hint"
            className="input"
          />
          <span id="add-lead-phone-hint" className="mt-1 block text-[11px] text-slate-500">
            {phone && !phoneValid
              ? `${phoneDigits}/10 digits — a lead is identified by its number.`
              : "One lead per number. A number already in the pipeline will be rejected."}
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Assign To</span>
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="input"
            disabled={telecallers === null}
          >
            {/* The default is not "nobody" — leaving it unassigned would hide
                the lead from every telecaller once scoping is on. Round-robin
                picks the telecaller with the smallest queue. */}
            <option value="">Auto — telecaller with the fewest leads</option>
            {(telecallers ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {telecallers?.length === 0 && (
            <span className="mt-1 block text-[11px] text-amber-700">
              No active telecallers yet — this lead will stay unassigned and visible only to you.
            </span>
          )}
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Source / Campaign</span>
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="e.g. Referral, Meta Ads"
            className="input"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Enquiry</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="What are they asking about?"
            className="input"
          />
        </label>
      </div>
    </Modal>
  );
}
