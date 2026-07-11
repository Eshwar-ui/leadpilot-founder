"use client";

import { useEffect, useState } from "react";
import { Bell, Link2, Megaphone } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TagInput } from "@/components/ui/TagInput";
import { ApiError, authApi, orgApi, type OrgProfile } from "@/lib/api";
import { updateStoredUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

const LANGUAGE_OPTIONS = ["English", "Hindi", "Telugu", "Tamil", "Kannada"];
const VOICE_OPTIONS = ["Premium", "Friendly", "Authoritative", "Casual"];

const PLACEHOLDER_CARDS = [
  {
    icon: Bell,
    title: "Alert Configuration",
    description: "Set thresholds for every alert type.",
  },
  {
    icon: Megaphone,
    title: "Budget Guardrail Rules",
    description: "Configure warn (90%), auto-pause individual (120%), and auto-pause all (115%) rules.",
  },
  {
    icon: Link2,
    title: "Integrations",
    description: "Connect Meta CAPI, Google Offline Conversions, Exotel, WhatsApp Business.",
  },
];

export default function SettingsPage() {
  const [profile, setProfile] = useState<OrgProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [pwOpen, setPwOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);

  function load() {
    setLoading(true);
    setLoadError(null);
    orgApi
      .get()
      .then(setProfile)
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : "Failed to load organisation profile"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function update<K extends keyof OrgProfile>(key: K, value: OrgProfile[K]) {
    setProfile((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  function toggleLanguage(lang: string) {
    if (!profile) return;
    const current = profile.languages ?? [];
    update("languages", current.includes(lang) ? current.filter((l) => l !== lang) : [...current, lang]);
  }

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await orgApi.update({
        name: profile.name,
        industry: profile.industry ?? undefined,
        website_url: profile.website_url ?? undefined,
        services: profile.services ?? [],
        pricing_min: profile.pricing_min ?? undefined,
        pricing_max: profile.pricing_max ?? undefined,
        target_audience: profile.target_audience ?? undefined,
        competitors: profile.competitors ?? [],
        brand_voice: profile.brand_voice ?? undefined,
        languages: profile.languages ?? [],
        usps: profile.usps ?? [],
        monthly_revenue_target: profile.monthly_revenue_target ?? undefined,
      });
      setProfile(updated);
      setSaved(true);
      // Revert the button back to "Save Changes" after a beat so it reads as a
      // transient confirmation, not a stuck state. Editing any field also
      // clears it (see update()).
      window.setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  function openChangePassword() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPwError(null);
    setPwSuccess(false);
    setPwOpen(true);
  }

  async function submitChangePassword() {
    if (newPassword !== confirmPassword) {
      setPwError("New password and confirmation don't match");
      return;
    }
    setPwSubmitting(true);
    setPwError(null);
    try {
      const user = await authApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      updateStoredUser({ must_reset_password: user.must_reset_password });
      setPwSuccess(true);
    } catch (e) {
      setPwError(e instanceof ApiError ? e.message : "Failed to change password");
    } finally {
      setPwSubmitting(false);
    }
  }

  return (
    <div className="pb-10">
      <PageHeader title="Settings" description="Portal configuration, users, integrations, and notification rules" />

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Organisation Profile</p>
              <p className="mt-0.5 text-sm text-slate-500">
                The knowledge base every AI feature — scoring, follow-ups, scripts — reads from.
              </p>
            </div>
            {profile && (
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : saved ? "Saved" : "Save Changes"}
              </Button>
            )}
          </div>

          {loadError && (
            <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {loadError} —{" "}
              <button className="font-semibold underline" onClick={load}>
                Retry
              </button>
            </div>
          )}
          {saveError && <p className="mb-3 text-xs font-medium text-red-600">{saveError}</p>}

          {loading ? (
            <p className="py-6 text-center text-sm text-slate-400">Loading organisation profile…</p>
          ) : profile ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <SettingsField label="Organisation Name">
                <input value={profile.name} onChange={(e) => update("name", e.target.value)} className="input" />
              </SettingsField>
              <SettingsField label="Industry">
                <input
                  value={profile.industry ?? ""}
                  onChange={(e) => update("industry", e.target.value)}
                  placeholder="e.g. Real Estate"
                  className="input"
                />
              </SettingsField>
              <SettingsField label="Website URL" className="sm:col-span-2">
                <input
                  value={profile.website_url ?? ""}
                  onChange={(e) => update("website_url", e.target.value)}
                  placeholder="https://..."
                  className="input"
                />
              </SettingsField>
              <SettingsField label="Services Offered" className="sm:col-span-2">
                <TagInput
                  values={profile.services ?? []}
                  onChange={(v) => update("services", v)}
                  placeholder="Type and press enter..."
                />
              </SettingsField>
              <SettingsField label="Pricing Range — Min (₹)">
                <input
                  type="number"
                  value={profile.pricing_min ?? ""}
                  onChange={(e) => update("pricing_min", e.target.value ? Number(e.target.value) : null)}
                  className="input"
                />
              </SettingsField>
              <SettingsField label="Pricing Range — Max (₹)">
                <input
                  type="number"
                  value={profile.pricing_max ?? ""}
                  onChange={(e) => update("pricing_max", e.target.value ? Number(e.target.value) : null)}
                  className="input"
                />
              </SettingsField>
              <SettingsField label="Monthly Revenue Target (₹)" className="sm:col-span-2">
                <input
                  type="number"
                  min={0}
                  value={profile.monthly_revenue_target ?? ""}
                  onChange={(e) => update("monthly_revenue_target", e.target.value ? Number(e.target.value) : null)}
                  placeholder="e.g. 3600000"
                  className="input"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Drives the Monthly Goal gauge and the target line on the revenue chart in Daily Snapshot.
                </p>
              </SettingsField>
              <SettingsField label="Target Audience" className="sm:col-span-2">
                <textarea
                  value={profile.target_audience ?? ""}
                  onChange={(e) => update("target_audience", e.target.value)}
                  rows={3}
                  placeholder="Describe your ideal customer profile..."
                  className="input resize-none"
                />
              </SettingsField>
              <SettingsField label="Unique Selling Propositions (USPs)" className="sm:col-span-2">
                <TagInput values={profile.usps ?? []} onChange={(v) => update("usps", v)} placeholder="E.g. Free registration..." />
              </SettingsField>
              <SettingsField label="Competitors" className="sm:col-span-2">
                <TagInput
                  values={profile.competitors ?? []}
                  onChange={(v) => update("competitors", v)}
                  placeholder="E.g. Lodha Group, DLF..."
                />
              </SettingsField>
              <SettingsField label="Brand Voice">
                <div className="flex flex-wrap gap-2">
                  {VOICE_OPTIONS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => update("brand_voice", v)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                        profile.brand_voice === v
                          ? "border-primary-500 bg-primary-50 text-primary-700"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </SettingsField>
              <SettingsField label="Languages">
                <div className="flex flex-wrap gap-2">
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => toggleLanguage(lang)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                        (profile.languages ?? []).includes(lang)
                          ? "border-primary-500 bg-primary-50 text-primary-700"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </SettingsField>
            </div>
          ) : null}
        </Card>
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Account &amp; Security</p>
              <p className="mt-0.5 text-sm text-slate-500">Change the password for your own login.</p>
            </div>
            <Button size="sm" variant="outline" onClick={openChangePassword}>
              Change Password
            </Button>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 sm:grid-cols-2">
        {PLACEHOLDER_CARDS.map((c) => (
          <Card key={c.title} className="flex items-start gap-4 p-5">
            <span className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
              <c.icon className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">{c.title}</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Coming soon
                </span>
              </div>
              <p className="mt-0.5 text-sm text-slate-500">{c.description}</p>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        title={pwSuccess ? "Password changed" : "Change Password"}
        footer={
          pwSuccess ? (
            <Button size="sm" className="w-full" onClick={() => setPwOpen(false)}>
              Done
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setPwOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={submitChangePassword}
                disabled={pwSubmitting || !currentPassword || !newPassword || !confirmPassword}
              >
                {pwSubmitting ? "Changing…" : "Change Password"}
              </Button>
            </>
          )
        }
      >
        {pwSuccess ? (
          <p>Your password has been updated. Use it next time you sign in.</p>
        ) : (
          <div className="space-y-3">
            {pwError && <p className="text-xs font-medium text-red-600">{pwError}</p>}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Current Password</label>
              <input
                type="password"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">New Password</label>
              <input
                type="password"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Confirm New Password</label>
              <input
                type="password"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function SettingsField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</label>
      {children}
    </div>
  );
}
