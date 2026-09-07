"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ApiError, orgApi, type AlertConfig, type OrgProfile } from "@/lib/api";
import { useUnsavedChanges } from "@/lib/useUnsavedChanges";

// Placeholders show the insights engine's built-in defaults (see
// app/api/dashboard.py _alert_config) so a blank field clearly means "use
// default", not "zero".
const ALERT_DEFAULTS = {
  wastage_days: 3,
  zombie_days: 7,
  performance_gap: 15,
  quality_floor: 40,
  break_threshold_min: 15,
  inactive_threshold_min: 45,
  recall_days: 90,
};

const ALERT_FIELDS: { key: keyof typeof ALERT_DEFAULTS; label: string; hint: string; min: number; max: number; usedIn: string }[] = [
  {
    key: "wastage_days",
    label: "Untouched Lead Alert (Days)",
    hint: "Flag New/Assigned leads with no calls after this many days.",
    min: 1,
    max: 90,
    usedIn: "Live Activity alerts, Lead Wastage, the Leakage Report",
  },
  {
    key: "zombie_days",
    label: "Stalled Lead Alert (Days)",
    hint: "Flag mid-pipeline leads not progressing after this many days.",
    min: 1,
    max: 90,
    usedIn: "Lead Detail's “Stuck in stage” banner, Zombie Leads, the Leakage Report",
  },
  {
    key: "performance_gap",
    label: "Underperformer Gap (Points)",
    hint: "Flag a telecaller this many quality points below team average.",
    min: 1,
    max: 110,
    usedIn: "The Insight Feed's underperformer flags",
  },
  {
    key: "quality_floor",
    label: "Lead Quality Floor (/100)",
    hint: "Alert when the average BANT score drops below this.",
    min: 0,
    max: 100,
    usedIn: "The Insight Feed's lead-quality flags",
  },
  {
    key: "break_threshold_min",
    label: "Break Threshold (Minutes)",
    hint: "A checked-in telecaller with no call in this long shows as “Break” instead of “Active”.",
    min: 1,
    max: 180,
    usedIn: "The Team Health board and Telecaller Detail's live status",
  },
  {
    key: "inactive_threshold_min",
    label: "Inactive Threshold (Minutes)",
    hint: "A checked-in telecaller with no call in this long shows as “Inactive”. Must be longer than the Break threshold above.",
    min: 1,
    max: 480,
    usedIn: "The Team Health board and Telecaller Detail's live status",
  },
  {
    key: "recall_days",
    label: "Client Recall Window (Days)",
    hint: "A client who hasn't visited in this long shows as due for recall. Hair and skin treatment cycles differ a lot, so tune this to what you actually offer.",
    min: 7,
    max: 730,
    usedIn: "The Clients page's “Due for recall” filter and count",
  },
];

const EMPTY_CONFIG: AlertConfig = {
  wastage_days: null,
  zombie_days: null,
  performance_gap: null,
  quality_floor: null,
  break_threshold_min: null,
  inactive_threshold_min: null,
  recall_days: null,
};

/** Fixed key order so JSON.stringify is a reliable dirty check. */
function configSnapshot(c: AlertConfig | null): string {
  const cfg = c ?? EMPTY_CONFIG;
  return JSON.stringify(ALERT_FIELDS.map((f) => cfg[f.key] ?? null));
}

/** The value the engine will actually use for a field — the override if one is
 * set, otherwise the built-in default. */
function effective(cfg: AlertConfig | null, key: keyof typeof ALERT_DEFAULTS): number {
  return cfg?.[key] ?? ALERT_DEFAULTS[key];
}

/**
 * Everything the server would reject, checked here first. The min/max
 * attributes on the inputs are inert on their own: without a <form> the
 * browser never runs constraint validation, so out-of-range values used to
 * reach the API and come back as an unreadable 422.
 */
function validate(cfg: AlertConfig | null): Partial<Record<keyof typeof ALERT_DEFAULTS, string>> {
  const errors: Partial<Record<keyof typeof ALERT_DEFAULTS, string>> = {};
  for (const f of ALERT_FIELDS) {
    const v = cfg?.[f.key];
    if (v === null || v === undefined) continue; // blank = use the default
    if (!Number.isInteger(v)) errors[f.key] = "Whole numbers only.";
    else if (v < f.min || v > f.max) errors[f.key] = `Must be between ${f.min} and ${f.max}.`;
  }
  // The Inactive hint has always claimed "Must be longer than the Break
  // threshold above" — but nothing enforced it. When it is violated the
  // Team Health board silently loses a status: _telecaller_status returns
  // "Active" for anything under the break threshold, so the "Break" branch
  // can never be reached.
  const brk = effective(cfg, "break_threshold_min");
  const inactive = effective(cfg, "inactive_threshold_min");
  if (!errors.inactive_threshold_min && inactive <= brk) {
    errors.inactive_threshold_min = `Must be longer than the Break threshold (${brk} min), or telecallers never show as "Break".`;
  }
  return errors;
}

export default function AlertConfigPage() {
  const [profile, setProfile] = useState<OrgProfile | null>(null);
  // The last server-confirmed state — what "dirty" and the summary card
  // compare against. The summary must never read unsaved input: it used to,
  // while its own subtitle promised the numbers were already live.
  const [savedProfile, setSavedProfile] = useState<OrgProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const formId = useId();
  const fieldId = useId();

  const fieldErrors = useMemo(() => validate(profile?.alert_config ?? null), [profile]);
  const hasErrors = Object.keys(fieldErrors).length > 0;

  const dirty = useMemo(
    () => Boolean(profile && savedProfile && configSnapshot(profile.alert_config) !== configSnapshot(savedProfile.alert_config)),
    [profile, savedProfile]
  );

  useUnsavedChanges(dirty);

  function load() {
    setLoading(true);
    setLoadError(null);
    orgApi
      .get()
      .then((p) => {
        setProfile(p);
        setSavedProfile(p);
      })
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : "Failed to load alert configuration"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function updateField(key: keyof typeof ALERT_DEFAULTS, value: number | null) {
    setProfile((prev) => {
      if (!prev) return prev;
      // EMPTY_CONFIG rather than an inline literal, so adding a threshold
      // means touching one place instead of two that silently drift apart.
      const current = prev.alert_config ?? EMPTY_CONFIG;
      return { ...prev, alert_config: { ...current, [key]: value } };
    });
    setSaved(false);
  }

  function resetToDefaults() {
    setProfile((prev) => (prev ? { ...prev, alert_config: { ...EMPTY_CONFIG } } : prev));
    setSaved(false);
  }

  async function save() {
    if (!profile || hasErrors) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await orgApi.update({ alert_config: profile.alert_config ?? null });
      setProfile(updated);
      setSavedProfile(updated);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : "Failed to save alert thresholds");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pb-10">
      <div className="px-4 pt-6 sm:px-6 lg:px-8">
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-primary-600"
        >
          <ArrowLeft className="size-3.5" /> Settings
        </Link>
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Alert Configuration</h1>
            <p className="mt-1 text-sm text-slate-600">Set thresholds for every alert type</p>
          </div>
          {profile && (
            <div className="flex shrink-0 items-center gap-3">
              {dirty && !saving && (
                <span className="text-xs font-medium text-amber-700">Unsaved changes</span>
              )}
              <Button variant="outline" size="sm" onClick={resetToDefaults} disabled={saving}>
                Reset to defaults
              </Button>
              <Button size="sm" type="submit" form={formId} disabled={saving || !dirty || hasErrors}>
                {saving ? "Saving…" : saved ? "Saved" : "Save Thresholds"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {loadError && (
        <div role="alert" className="mt-4 mx-4 sm:mx-6 lg:mx-8 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError} —{" "}
          <button className="font-semibold underline" onClick={load}>
            Retry
          </button>
        </div>
      )}

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900">Alert Thresholds</h3>
          <p className="mt-0.5 text-xs text-slate-600">
            What has to happen before something appears in your insights feed. Leave a field blank to use the default.
          </p>
          {saveError && (
            <p role="alert" className="mt-3 text-sm font-medium text-red-700">
              {saveError}
            </p>
          )}
          {loading ? (
            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
              {ALERT_FIELDS.map((f) => (
                <Skeleton key={f.key} block className="h-16 w-full" />
              ))}
            </div>
          ) : profile ? (
            <form
              id={formId}
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
              className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2"
            >
              {ALERT_FIELDS.map((f) => {
                const err = fieldErrors[f.key];
                const inputId = `${fieldId}-${f.key}`;
                const overridden = profile.alert_config?.[f.key] != null;
                return (
                  <div key={f.key}>
                    <label
                      htmlFor={inputId}
                      className="mb-1.5 flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600"
                    >
                      {f.label}
                      {!overridden && (
                        <span className="font-medium normal-case tracking-normal text-slate-500">
                          using default
                        </span>
                      )}
                    </label>
                    <input
                      id={inputId}
                      type="number"
                      inputMode="numeric"
                      min={f.min}
                      max={f.max}
                      value={profile.alert_config?.[f.key] ?? ""}
                      onChange={(e) => updateField(f.key, e.target.value ? Number(e.target.value) : null)}
                      placeholder={`Default: ${ALERT_DEFAULTS[f.key]}`}
                      aria-invalid={err ? true : undefined}
                      aria-describedby={err ? `${inputId}-error` : `${inputId}-hint`}
                      className={`input ${err ? "border-red-400 focus:border-red-500 focus:ring-red-200" : ""}`}
                    />
                    {err ? (
                      <p id={`${inputId}-error`} role="alert" className="mt-1 text-xs font-medium text-red-700">
                        {err}
                      </p>
                    ) : (
                      <p id={`${inputId}-hint`} className="mt-1 text-xs text-slate-600">
                        {f.hint}
                      </p>
                    )}
                  </div>
                );
              })}
            </form>
          ) : null}
        </Card>
      </div>

      {!loading && savedProfile && (
        <div className="mt-4 px-4 sm:px-6 lg:px-8">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-900">Where These Thresholds Show Up</h3>
            <p className="mt-0.5 text-xs text-slate-600">
              {dirty
                ? "These are the thresholds currently live. Your unsaved edits are marked — save to apply them."
                : "These thresholds are live right now — nothing else to configure."}
            </p>
            <div className="mt-4 flex flex-col divide-y divide-slate-100">
              {ALERT_FIELDS.map((f) => (
                <div key={f.key} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:gap-4">
                  <span className="min-w-56 shrink-0 text-sm font-medium text-slate-700">
                    {f.label}{" "}
                    <span className="font-mono text-slate-600">
                      = {effective(savedProfile.alert_config, f.key)}
                    </span>
                    {/* Pending edits are shown as a delta rather than replacing
                        the live number — the whole defect here was a summary
                        that presented unsaved input as though it were active. */}
                    {profile && effective(profile.alert_config, f.key) !== effective(savedProfile.alert_config, f.key) && (
                      <span className="ml-2 font-mono text-xs font-semibold text-amber-700">
                        → {effective(profile.alert_config, f.key)} unsaved
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-slate-600">{f.usedIn}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
