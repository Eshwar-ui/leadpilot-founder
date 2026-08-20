"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ApiError, orgApi, type OrgProfile } from "@/lib/api";

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
];

export default function AlertConfigPage() {
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
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : "Failed to load alert configuration"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function updateField(key: keyof typeof ALERT_DEFAULTS, value: number | null) {
    setProfile((prev) => {
      if (!prev) return prev;
      const current = prev.alert_config ?? {
        wastage_days: null,
        zombie_days: null,
        performance_gap: null,
        quality_floor: null,
        break_threshold_min: null,
        inactive_threshold_min: null,
      };
      return { ...prev, alert_config: { ...current, [key]: value } };
    });
    setSaved(false);
  }

  async function save() {
    if (!profile) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await orgApi.update({ alert_config: profile.alert_config ?? null });
      setProfile(updated);
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
        <Link href="/dashboard/settings" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary-600">
          <ArrowLeft className="size-3.5" /> Settings
        </Link>
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Alert Configuration</h1>
            <p className="mt-1 text-sm text-slate-500">Set thresholds for every alert type</p>
          </div>
          {profile && (
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Saving…" : saved ? "Saved" : "Save Thresholds"}
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
          <h3 className="text-sm font-semibold text-slate-900">Alert Thresholds</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            What has to happen before something appears in your insights feed. Leave a field blank to use the default.
          </p>
          {saveError && <p className="mt-3 text-xs font-medium text-red-600">{saveError}</p>}
          {loading ? (
            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} block className="h-16 w-full" />
              ))}
            </div>
          ) : profile ? (
            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
              {ALERT_FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">{f.label}</label>
                  <input
                    type="number"
                    min={f.min}
                    max={f.max}
                    value={profile.alert_config?.[f.key] ?? ""}
                    onChange={(e) => updateField(f.key, e.target.value ? Number(e.target.value) : null)}
                    placeholder={`Default: ${ALERT_DEFAULTS[f.key]}`}
                    className="input"
                  />
                  <p className="mt-1 text-xs text-slate-400">{f.hint}</p>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      </div>

      {!loading && profile && (
        <div className="mt-4 px-4 sm:px-6 lg:px-8">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-900">Where These Thresholds Show Up</h3>
            <p className="mt-0.5 text-xs text-slate-400">Change a number above and every one of these updates immediately — nothing else to configure.</p>
            <div className="mt-4 flex flex-col divide-y divide-slate-100">
              {ALERT_FIELDS.map((f) => (
                <div key={f.key} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:gap-4">
                  <span className="w-56 shrink-0 text-sm font-medium text-slate-700">
                    {f.label} <span className="font-mono text-slate-400">= {profile.alert_config?.[f.key] ?? ALERT_DEFAULTS[f.key]}</span>
                  </span>
                  <span className="text-sm text-slate-500">{f.usedIn}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
