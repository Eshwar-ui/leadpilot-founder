"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2, Upload } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TagInput } from "@/components/ui/TagInput";
import { Skeleton } from "@/components/ui/Skeleton";
import { getStoredUser, updateStoredOrgName } from "@/lib/auth";
import { ApiError, orgApi, type AuthUser, type OrgProfile, type OrgProfileInput } from "@/lib/api";
import { useUnsavedChanges, UNSAVED_WARNING } from "@/lib/useUnsavedChanges";
import { cn, initials } from "@/lib/utils";
import { INDUSTRY_OPTIONS } from "@/lib/industries";

const LANGUAGE_OPTIONS = ["English", "Hindi", "Telugu", "Tamil", "Kannada"];
const VOICE_OPTIONS = ["Premium", "Friendly", "Authoritative", "Casual"];
const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const LOGO_TYPES = new Set(["image/svg+xml", "image/png", "image/jpeg"]);


function SettingsField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  /** Receives the generated id so the control it renders can carry it — the
   * label is useless to a screen reader (and to click-to-focus) without it. */
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

/** Empty/whitespace-only text means "unset", not "the empty string" — send an
 * explicit null so the column is actually cleared. */
function textOrNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/** Just the editable fields, in a fixed key order, so JSON.stringify is a
 * reliable dirty check against the last saved snapshot. */
function editableSnapshot(p: OrgProfile): string {
  return JSON.stringify([
    p.name,
    p.logo_url ?? null,
    p.industry ?? null,
    p.website_url ?? null,
    p.address ?? null,
    p.services ?? [],
    p.pricing_min ?? null,
    p.pricing_max ?? null,
    p.monthly_revenue_target ?? null,
    p.target_audience ?? null,
    p.usps ?? [],
    p.competitors ?? [],
    p.brand_voice ?? null,
    p.languages ?? [],
  ]);
}

type FieldErrors = Partial<Record<"name" | "pricing_min" | "pricing_max" | "monthly_revenue_target", string>>;

export default function OrgProfilePage() {
  const [me, setMe] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<OrgProfile | null>(null);
  // The last server-confirmed state. Everything "is this dirty?" compares
  // against this, never against the in-progress edits.
  const [savedProfile, setSavedProfile] = useState<OrgProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saved, setSaved] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const formId = useId();
  const logoInputRef = useRef<HTMLInputElement>(null);

  function load() {
    setLoading(true);
    setLoadError(null);
    orgApi
      .get()
      .then((p) => {
        setProfile(p);
        setSavedProfile(p);
      })
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : "Failed to load organisation profile"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);
  useEffect(() => setMe(getStoredUser()), []);

  const dirty = useMemo(
    () => Boolean(profile && savedProfile && editableSnapshot(profile) !== editableSnapshot(savedProfile)),
    [profile, savedProfile]
  );

  // Both exits (reload/close and in-app navigation) are covered by the
  // shared hook — see src/lib/useUnsavedChanges.ts for why it takes two.
  useUnsavedChanges(dirty);

  function update<K extends keyof OrgProfile>(key: K, value: OrgProfile[K]) {
    setProfile((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  function toggleLanguage(lang: string) {
    if (!profile) return;
    const current = profile.languages ?? [];
    update("languages", current.includes(lang) ? current.filter((l) => l !== lang) : [...current, lang]);
  }

  function handleLogoSelect(file: File | undefined) {
    setLogoError(null);
    if (!file) return;
    if (!LOGO_TYPES.has(file.type)) {
      setLogoError("Use an SVG, PNG, or JPG file.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError("File is too large — maximum 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update("logo_url", reader.result as string);
    reader.onerror = () => setLogoError("Couldn’t read that file — try another.");
    reader.readAsDataURL(file);
  }

  function validate(p: OrgProfile): FieldErrors {
    const errors: FieldErrors = {};
    if (p.name.trim().length < 2) errors.name = "Organisation name needs at least 2 characters.";
    if (p.pricing_min != null && p.pricing_min < 0) errors.pricing_min = "Can't be negative.";
    if (p.pricing_max != null && p.pricing_max < 0) errors.pricing_max = "Can't be negative.";
    if (p.monthly_revenue_target != null && p.monthly_revenue_target < 0) {
      errors.monthly_revenue_target = "Can't be negative.";
    }
    if (p.pricing_min != null && p.pricing_max != null && p.pricing_min > p.pricing_max) {
      errors.pricing_max = "Maximum must be at least the minimum.";
    }
    return errors;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;

    const errors = validate(profile);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      // NOTE the `?? null` rather than `?? undefined`. JSON.stringify DROPS
      // undefined keys, and the backend's PATCH uses model_dump(exclude_unset)
      // — so a field sent as undefined was never sent, never unset, and the
      // old value sprang straight back into the input. There was no way at all
      // to clear a pricing range or a revenue target. The schema types these
      // as Optional[int]/Optional[str] (schemas_auth.py), so an explicit null
      // is valid and does clear the column.
      const payload: OrgProfileInput = {
        name: profile.name.trim(),
        logo_url: profile.logo_url ?? null,
        industry: textOrNull(profile.industry),
        website_url: textOrNull(profile.website_url),
        services: profile.services ?? [],
        pricing_min: profile.pricing_min ?? null,
        pricing_max: profile.pricing_max ?? null,
        target_audience: textOrNull(profile.target_audience),
        competitors: profile.competitors ?? [],
        brand_voice: textOrNull(profile.brand_voice),
        languages: profile.languages ?? [],
        usps: profile.usps ?? [],
        monthly_revenue_target: profile.monthly_revenue_target ?? null,
        address: textOrNull(profile.address),
      };
      const updated = await orgApi.update(payload);
      setProfile(updated);
      setSavedProfile(updated);
      // The Topbar's org chip reads org_name out of the stored session, so a
      // rename left the OLD name in the header until the next login. Keep the
      // stored copy in step. (Topbar snapshots localStorage on mount, so the
      // chip refreshes on the next full page load rather than instantly —
      // making it live would mean changing Topbar itself.)
      updateStoredOrgName(updated.name);
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
        <Link
          href="/dashboard/settings"
          // Next's own client-side navigation never reaches the capture-phase
          // click guard's confirm in time, so <Link> gets the supported hook.
          onNavigate={(e) => {
            if (dirty && !window.confirm(UNSAVED_WARNING)) e.preventDefault();
          }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-primary-600"
        >
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
              <p className="truncate text-xs text-slate-600">
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
            <p className="mt-1 text-sm text-slate-600">
              The knowledge base every AI feature — scoring, follow-ups, scripts — reads from
            </p>
          </div>
          {profile && (
            <div className="flex shrink-0 flex-col items-end gap-1">
              {/* Outside the <form> (it sits in the page header), so it needs
                  form= to associate — which also makes Enter submit the form. */}
              <Button size="sm" type="submit" form={formId} disabled={saving || !dirty}>
                {saving ? "Saving…" : saved ? "Saved" : "Save Changes"}
              </Button>
              {dirty && !saving && <span className="text-xs font-medium text-amber-600">Unsaved changes</span>}
            </div>
          )}
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="mt-4 mx-4 sm:mx-6 lg:mx-8 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {loadError} —{" "}
          <button className="font-semibold underline" onClick={load}>
            Retry
          </button>
        </div>
      )}

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="p-5">
          {saveError && (
            <p role="alert" className="mb-3 text-xs font-medium text-red-600">
              {saveError}
            </p>
          )}
          {loading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} block className="h-16 w-full" />
              ))}
            </div>
          ) : profile ? (
            <form id={formId} onSubmit={handleSave} className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <SettingsField label="Organisation Name">
                {(id) => (
                  <>
                    <input
                      id={id}
                      value={profile.name}
                      onChange={(e) => update("name", e.target.value)}
                      required
                      minLength={2}
                      aria-invalid={fieldErrors.name ? true : undefined}
                      aria-describedby={fieldErrors.name ? `${id}-error` : undefined}
                      className="input"
                    />
                    {fieldErrors.name && (
                      <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-medium text-red-600">
                        {fieldErrors.name}
                      </p>
                    )}
                  </>
                )}
              </SettingsField>
              <SettingsField label="Industry">
                {(id) => (
                  <>
                    <input
                      id={id}
                      list={`${id}-options`}
                      value={profile.industry ?? ""}
                      onChange={(e) => update("industry", e.target.value)}
                      placeholder="e.g. Real Estate"
                      className="input"
                    />
                    <datalist id={`${id}-options`}>
                      {INDUSTRY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt} />
                      ))}
                    </datalist>
                  </>
                )}
              </SettingsField>
              <SettingsField label="Organisation Logo" className="sm:col-span-2">
                {(id) => (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <input
                      ref={logoInputRef}
                      id={id}
                      type="file"
                      accept="image/svg+xml,image/png,image/jpeg"
                      className="sr-only"
                      onChange={(e) => {
                        handleLogoSelect(e.target.files?.[0]);
                        e.currentTarget.value = "";
                      }}
                    />
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-2">
                        {profile.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={profile.logo_url} alt="Organisation logo preview" className="size-full object-contain" />
                        ) : (
                          <span className="text-lg font-bold text-slate-400">{initials(profile.name) || "ORG"}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">
                          {profile.logo_url ? "Logo ready" : "Add your organisation logo"}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-600">
                          Shown to telecallers in the mobile app. SVG, PNG, or JPG; maximum 5 MB.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => logoInputRef.current?.click()}>
                            <Upload className="size-3.5" /> {profile.logo_url ? "Replace Logo" : "Upload Logo"}
                          </Button>
                          {profile.logo_url && (
                            <Button type="button" size="sm" variant="outline" onClick={() => update("logo_url", null)}>
                              <Trash2 className="size-3.5" /> Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    {logoError && <p role="alert" className="mt-2 text-xs font-medium text-red-600">{logoError}</p>}
                  </div>
                )}
              </SettingsField>
              <SettingsField label="Website URL" className="sm:col-span-2">
                {(id) => (
                  <input
                    id={id}
                    value={profile.website_url ?? ""}
                    onChange={(e) => update("website_url", e.target.value)}
                    placeholder="https://..."
                    className="input"
                  />
                )}
              </SettingsField>
              <SettingsField label="Business Address" className="sm:col-span-2">
                {(id) => (
                  <textarea
                    id={id}
                    value={profile.address ?? ""}
                    onChange={(e) => update("address", e.target.value)}
                    rows={2}
                    placeholder="Street, area, city, PIN"
                    className="input resize-none"
                  />
                )}
              </SettingsField>
              <SettingsField label="Services Offered" className="sm:col-span-2">
                {() => (
                  <TagInput
                    values={profile.services ?? []}
                    onChange={(v) => update("services", v)}
                    placeholder="Type and press enter..."
                  />
                )}
              </SettingsField>
              <SettingsField label="Pricing Range — Min (₹)">
                {(id) => (
                  <>
                    <input
                      id={id}
                      type="number"
                      min={0}
                      value={profile.pricing_min ?? ""}
                      onChange={(e) => update("pricing_min", e.target.value ? Number(e.target.value) : null)}
                      aria-invalid={fieldErrors.pricing_min ? true : undefined}
                      aria-describedby={fieldErrors.pricing_min ? `${id}-error` : undefined}
                      className="input"
                    />
                    {fieldErrors.pricing_min && (
                      <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-medium text-red-600">
                        {fieldErrors.pricing_min}
                      </p>
                    )}
                  </>
                )}
              </SettingsField>
              <SettingsField label="Pricing Range — Max (₹)">
                {(id) => (
                  <>
                    <input
                      id={id}
                      type="number"
                      min={0}
                      value={profile.pricing_max ?? ""}
                      onChange={(e) => update("pricing_max", e.target.value ? Number(e.target.value) : null)}
                      aria-invalid={fieldErrors.pricing_max ? true : undefined}
                      aria-describedby={fieldErrors.pricing_max ? `${id}-error` : undefined}
                      className="input"
                    />
                    {fieldErrors.pricing_max && (
                      <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-medium text-red-600">
                        {fieldErrors.pricing_max}
                      </p>
                    )}
                  </>
                )}
              </SettingsField>
              <SettingsField label="Monthly Revenue Target (₹)" className="sm:col-span-2">
                {(id) => (
                  <>
                    <input
                      id={id}
                      type="number"
                      min={0}
                      value={profile.monthly_revenue_target ?? ""}
                      onChange={(e) =>
                        update("monthly_revenue_target", e.target.value ? Number(e.target.value) : null)
                      }
                      placeholder="e.g. 3600000"
                      aria-invalid={fieldErrors.monthly_revenue_target ? true : undefined}
                      aria-describedby={
                        fieldErrors.monthly_revenue_target ? `${id}-error` : `${id}-hint`
                      }
                      className="input"
                    />
                    {fieldErrors.monthly_revenue_target ? (
                      <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-medium text-red-600">
                        {fieldErrors.monthly_revenue_target}
                      </p>
                    ) : (
                      <p id={`${id}-hint`} className="mt-1 text-xs text-slate-600">
                        Drives the target line on the Dashboard revenue chart. Clear it to remove the line.
                      </p>
                    )}
                  </>
                )}
              </SettingsField>
              <SettingsField label="Target Audience" className="sm:col-span-2">
                {(id) => (
                  <textarea
                    id={id}
                    value={profile.target_audience ?? ""}
                    onChange={(e) => update("target_audience", e.target.value)}
                    rows={3}
                    placeholder="Describe your ideal customer..."
                    className="input resize-none"
                  />
                )}
              </SettingsField>
              <SettingsField label="Unique Selling Propositions (USPs)" className="sm:col-span-2">
                {() => (
                  <TagInput
                    values={profile.usps ?? []}
                    onChange={(v) => update("usps", v)}
                    placeholder="E.g. Free trial, 24/7 support..."
                  />
                )}
              </SettingsField>
              <SettingsField label="Competitors" className="sm:col-span-2">
                {() => (
                  <TagInput
                    values={profile.competitors ?? []}
                    onChange={(v) => update("competitors", v)}
                    placeholder="E.g. your top competitors..."
                  />
                )}
              </SettingsField>

              {/* Chip groups, not single controls — a <label for> would have
                  nothing to point at, so the group gets an aria-labelledby
                  heading and each chip reports its own pressed state. Toggle
                  buttons rather than role="radio"/"checkbox": those roles
                  promise arrow-key navigation these chips don't implement. */}
              <div role="group" aria-labelledby={`${formId}-voice`}>
                <span
                  id={`${formId}-voice`}
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600"
                >
                  Brand Voice
                </span>
                <div className="flex flex-wrap gap-2">
                  {VOICE_OPTIONS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={profile.brand_voice === v}
                      onClick={() => update("brand_voice", profile.brand_voice === v ? null : v)}
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
              </div>

              <div role="group" aria-labelledby={`${formId}-langs`}>
                <span
                  id={`${formId}-langs`}
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600"
                >
                  Languages
                </span>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      aria-pressed={(profile.languages ?? []).includes(lang)}
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
              </div>
            </form>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
