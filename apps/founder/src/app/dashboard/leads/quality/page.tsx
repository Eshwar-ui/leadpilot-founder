"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Skeleton, SkeletonTableRow } from "@/components/ui/Skeleton";
import { ApiError, leadsQualityApi, type LeadQuality, type ScoreDistribution } from "@/lib/api";
import { cn } from "@/lib/utils";

const BAND_TONE: Record<string, "danger" | "warning" | "primary" | "success"> = {
  "0-20": "danger",
  "21-40": "warning",
  "41-60": "warning",
  "61-80": "primary",
  "81-100": "success",
};

const BANT_FACTORS = [
  { key: "budget", label: "Budget", note: "Can they afford it, and is money confirmed" },
  { key: "authority", label: "Authority", note: "Are we talking to the actual decision maker" },
  { key: "need", label: "Need", note: "How real and specific is the need" },
  { key: "timeline", label: "Timeline", note: "How soon they intend to decide" },
];

// "Best Source" is the page's headline recommendation, so it must not be won by
// a sample of one. Sorting purely on positive_pct let a single walk-in with a
// Hot verdict (100%) outrank 300 Meta leads at 62%. Sources below this floor
// are excluded from the ranking entirely rather than silently down-weighted.
const MIN_SOURCE_VOLUME = 10;

export default function LeadQualityPage() {
  const [quality, setQuality] = useState<LeadQuality | null>(null);
  const [qualityLoading, setQualityLoading] = useState(true);
  const [qualityError, setQualityError] = useState<string | null>(null);

  const [distribution, setDistribution] = useState<ScoreDistribution | null>(null);
  const [distributionLoading, setDistributionLoading] = useState(true);
  // Previously `.catch(() => setDistribution(null))` swallowed the failure and
  // the `!distribution` branch rendered "No scored leads yet." — telling the
  // founder they have no scored leads when the request had actually 500'd.
  const [distributionError, setDistributionError] = useState<string | null>(null);

  function load() {
    setQualityLoading(true);
    setQualityError(null);
    leadsQualityApi
      .quality()
      .then(setQuality)
      .catch((e) => setQualityError(e instanceof ApiError ? e.message : "Failed to load lead quality"))
      .finally(() => setQualityLoading(false));

    setDistributionLoading(true);
    setDistributionError(null);
    leadsQualityApi
      .scoreDistribution()
      .then(setDistribution)
      .catch((e) => {
        setDistribution(null);
        setDistributionError(e instanceof ApiError ? e.message : "Failed to load the score distribution");
      })
      .finally(() => setDistributionLoading(false));
  }

  useEffect(load, []);

  // verdict_breakdown counts CONTACTS WITH A COMPLETED ANALYSIS, not leads —
  // the backend builds it from the latest lead_verdict per contact_key across
  // analysed calls. A lead that has never been called isn't in here at all, so
  // this total is deliberately NOT the org's lead count.
  const analysedContacts = quality
    ? Object.values(quality.verdict_breakdown).reduce((s, v) => s + v, 0)
    : 0;
  const junkRate =
    quality && analysedContacts > 0
      ? Math.round((quality.verdict_breakdown.Junk / analysedContacts) * 100)
      : 0;

  // source_matrix rows are built from the Lead table, so their totals DO sum to
  // the real lead count — the same number All Leads shows.
  const totalLeads = quality?.source_matrix.reduce((s, r) => s + r.total, 0) ?? 0;

  const rankableSources = (quality?.source_matrix ?? []).filter((s) => s.total >= MIN_SOURCE_VOLUME);
  const bestSource = rankableSources.length
    ? [...rankableSources].sort((a, b) => b.positive_pct - a.positive_pct || b.total - a.total)[0]
    : null;

  // The backend always emits all 5 bands (it loops over a fixed _SCORE_BANDS
  // list), so `bands.length === 0` is unreachable — a zero-lead org would fall
  // through and show five rows of "0 leads · 0% · 0% close rate". The real
  // empty signal is the total count across the bands.
  const scoredContacts = distribution?.bands.reduce((s, b) => s + b.count, 0) ?? 0;

  return (
    <div className="pb-10">
      {/* Reached from All Leads, so it needs a way back. A real Link, not
          router.back(): a shared URL or a new tab has no history to pop. */}
      <div className="px-4 pt-6 sm:px-6 lg:px-8">
        <Link
          href="/dashboard/leads"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary-600"
        >
          <ArrowLeft className="size-3.5" /> All Leads
        </Link>
      </div>

      <PageHeader title="Lead Quality" description="Which enquiries are worth calling, and which sources send them" />

      {qualityError && (
        <div
          role="alert"
          className="mt-4 mx-4 sm:mx-6 lg:mx-8 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {qualityError} —{" "}
          <button className="font-semibold underline" onClick={load}>
            Retry
          </button>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-4">
        {/* Every value below falls back to "—" rather than 0 on a failed fetch:
            a confident zero reads as a fact about the business, not an outage. */}
        <StatCard
          label="Average Lead Score"
          help="The average AI score (0-100) across every contact who has had at least one analysed call. It answers 'how good is the lead flow overall?' — leads with no analysed call aren't counted at all, rather than counted as zero."
          value={
            qualityLoading ? (
              <Skeleton className="h-6 w-12" />
            ) : qualityError || quality?.avg_bant_score == null ? (
              "—"
            ) : (
              String(quality.avg_bant_score)
            )
          }
          suffix="/100"
        />
        <StatCard
          label="Hot Verdicts"
          help="How many contacts the AI judged 'Hot' on their most recent call. It's a verdict about the conversation, not the deal — so it includes leads that have since closed, been lost, or been marked junk."
          value={
            qualityLoading ? (
              <Skeleton className="h-6 w-12" />
            ) : qualityError ? (
              "—"
            ) : (
              String(quality?.verdict_breakdown.Hot ?? 0)
            )
          }
          // Was "Score 80+ and still in play" — both halves were false.
          // verdict_breakdown.Hot is every contact whose LATEST AI call verdict
          // was Hot, whatever their BANT score and whatever their pipeline
          // stage, so it includes Closed Won, Closed Lost and Junk leads. The
          // payload carries no per-lead stage, so this can only be described
          // honestly, not filtered client-side.
          note={qualityLoading ? undefined : "Latest AI call verdict · any pipeline stage"}
        />
        <StatCard
          label="Junk Rate"
          help="The share of analysed contacts whose latest AI verdict was 'Junk' — wrong numbers, no real conversation, nothing to sell. High junk usually points at a lead source problem, not a telecaller one."
          value={qualityLoading ? <Skeleton className="h-6 w-12" /> : qualityError ? "—" : `${junkRate}%`}
          // Denominator is analysed contacts, not leads — labelling it "leads"
          // made this visibly contradict the lead count on All Leads.
          note={
            qualityLoading || qualityError
              ? undefined
              : `${quality?.verdict_breakdown.Junk ?? 0} of ${analysedContacts} contacts with an AI verdict`
          }
        />
        <StatCard
          label="Best Source"
          help={`The lead source with the highest share of Hot or Warm verdicts. Sources with fewer than ${MIN_SOURCE_VOLUME} leads are excluded, so a single lucky walk-in can't outrank a channel with hundreds.`}
          value={
            qualityLoading ? <Skeleton className="h-6 w-12" /> : qualityError ? "—" : bestSource ? bestSource.source : "—"
          }
          note={
            qualityLoading || qualityError
              ? undefined
              : bestSource
                ? `${bestSource.positive_pct}% positive of ${bestSource.total} leads`
                : totalLeads > 0
                  ? `No source has ${MIN_SOURCE_VOLUME}+ leads yet`
                  : "No source data yet"
          }
        />
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900">Where Your Leads Score</h3>
          <p className="mt-0.5 text-xs text-slate-600">
            The latest AI score (0–100) for every contact that has at least one analysed call
          </p>
          {distributionLoading ? (
            <div className="mt-4 flex flex-col gap-3">
              <Skeleton block className="h-6 w-full" />
              <Skeleton block className="h-6 w-full" />
              <Skeleton block className="h-6 w-full" />
            </div>
          ) : distributionError ? (
            <div role="alert" className="mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {distributionError} —{" "}
              <button className="font-semibold underline" onClick={load}>
                Retry
              </button>
            </div>
          ) : !distribution || scoredContacts === 0 ? (
            <p className="mt-4 text-sm text-slate-600">
              No scored leads yet — scores appear once a call has been recorded and analysed.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {distribution.bands.map((b) => (
                <div key={b.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{b.label}</span>
                    <span className="text-slate-600">
                      {b.count} leads · {b.pct_of_total}% · {b.close_rate_pct}% close rate
                    </span>
                  </div>
                  <ProgressBar value={b.pct_of_total} tone={BAND_TONE[b.label] ?? "primary"} className="mt-1.5" />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="overflow-hidden">
          <div className="p-5 pb-0">
            <h3 className="text-sm font-semibold text-slate-900">Which Sources Send Good Leads</h3>
            <p className="mt-0.5 text-xs text-slate-600">
              Positive rate is how often the AI verdict came back Hot or Warm. Sources under{" "}
              {MIN_SOURCE_VOLUME} leads are too small to rank as “Best Source”.
            </p>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-5 py-2">Source</th>
                  <th scope="col" className="px-3 py-2 text-right">Leads</th>
                  <th scope="col" className="px-3 py-2 text-right">Positive %</th>
                  <th scope="col" className="px-3 py-2 text-right">Junk %</th>
                  <th scope="col" className="px-5 py-2 text-right">Close %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {qualityLoading ? (
                  <>
                    <SkeletonTableRow columns={5} />
                    <SkeletonTableRow columns={5} />
                    <SkeletonTableRow columns={5} />
                  </>
                ) : qualityError ? (
                  // The error banner at the top of the page already explains
                  // this; don't repeat "no leads" underneath it as if it were a
                  // finding about the business.
                  null
                ) : !quality || quality.source_matrix.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-600">
                      No leads with a source recorded yet.
                    </td>
                  </tr>
                ) : (
                  quality.source_matrix.map((s) => (
                    <tr key={s.source} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-900">
                        {s.source}
                        {s.total < MIN_SOURCE_VOLUME && (
                          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                            Low volume
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">{s.total}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-emerald-600">{s.positive_pct}%</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-red-500">{s.junk_pct}%</td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums">{s.close_pct}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900">How The Score Is Worked Out</h3>
          <p className="mt-0.5 text-xs text-slate-600">BANT, scored by the AI from the enquiry and every call — 25 points each, out of 100</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {BANT_FACTORS.map((f) => (
              <div key={f.key} className="flex items-start gap-3 rounded-lg border border-slate-100 px-3 py-2.5">
                <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[10px] font-bold text-primary-700")}>
                  25
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-800">{f.label}</p>
                  <p className="text-xs text-slate-600">{f.note}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
