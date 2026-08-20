"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TagInput } from "@/components/ui/TagInput";
import { Skeleton } from "@/components/ui/Skeleton";
import { getStoredUser } from "@/lib/auth";
import { ApiError, orgApi, type AuthUser, type OrgProfile } from "@/lib/api";
import { cn, initials } from "@/lib/utils";

const LANGUAGE_OPTIONS = ["English", "Hindi", "Telugu", "Tamil", "Kannada"];
const VOICE_OPTIONS = ["Premium", "Friendly", "Authoritative", "Casual"];

function SettingsField({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</label>
      {children}
    </div>
  );
}

export default function OrgProfilePage() {
  const [me, setMe] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<OrgProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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
  useEffect(() => setMe(getStoredUser()), []);

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
        address: profile.address ?? undefined,
      });
      setProfile(updated);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pb-10">
      <div className="px-4 pt-6 sm:px-6 lg:px-8">
        <Link href="/dashboard/settings" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary-600">
          <ArrowLeft className="size-3.5" /> Settings
        </Link>
      </div>

      {me && (
        <div className="mt-4 px-4 sm:px-6 lg:px-8">
          <Card className="flex items-center gap-3 p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white">
              {initials(me.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{me.name}</p>
              <p className="truncate text-xs text-slate-500">
                {me.email} · <span className="capitalize">{me.role}</span> at {me.org_name}
              </p>
            </div>
          </Card>
        </div>
      )}

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Organisation Profile</h1>
            <p className="mt-1 text-sm text-slate-500">
              The knowledge base every AI feature — scoring, follow-ups, scripts — reads from
            </p>
          </div>
          {profile && (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : saved ? "Saved" : "Save Changes"}
            </Button>
          )}
        </div>
      </div>

      {loadError && (
        <div className="mt-4 mx-4 sm:mx-6 lg:mx-8 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError} —{" "}
          <button className="font-semibold underline" onClick={load}>
            Retry
          </button>
        </div>
      )}

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="p-5">
          {saveError && <p className="mb-3 text-xs font-medium text-red-600">{saveError}</p>}
          {loading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} block className="h-16 w-full" />
              ))}
            </div>
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
              <SettingsField label="Business Address" className="sm:col-span-2">
                <textarea
                  value={profile.address ?? ""}
                  onChange={(e) => update("address", e.target.value)}
                  rows={2}
                  placeholder="Street, area, city, PIN"
                  className="input resize-none"
                />
              </SettingsField>
              <SettingsField label="Services Offered" className="sm:col-span-2">
                <TagInput values={profile.services ?? []} onChange={(v) => update("services", v)} placeholder="Type and press enter..." />
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
                <p className="mt-1 text-xs text-slate-400">Drives the target line on the Dashboard revenue chart.</p>
              </SettingsField>
              <SettingsField label="Target Audience" className="sm:col-span-2">
                <textarea
                  value={profile.target_audience ?? ""}
                  onChange={(e) => update("target_audience", e.target.value)}
                  rows={3}
                  placeholder="Describe your ideal customer..."
                  className="input resize-none"
                />
              </SettingsField>
              <SettingsField label="Unique Selling Propositions (USPs)" className="sm:col-span-2">
                <TagInput values={profile.usps ?? []} onChange={(v) => update("usps", v)} placeholder="E.g. Free trial, 24/7 support..." />
              </SettingsField>
              <SettingsField label="Competitors" className="sm:col-span-2">
                <TagInput values={profile.competitors ?? []} onChange={(v) => update("competitors", v)} placeholder="E.g. your top competitors..." />
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
                        profile.brand_voice === v ? "border-primary-500 bg-primary-50 text-primary-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
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
                        (profile.languages ?? []).includes(lang) ? "border-primary-500 bg-primary-50 text-primary-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
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
    </div>
  );
}
