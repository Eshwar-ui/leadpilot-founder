"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Users, AlertTriangle, Zap, Volume2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { ApiError, insightsApi, type Insight, type InsightCategory, type InsightSeverity } from "@/lib/api";
import { cn } from "@/lib/utils";

const CATEGORIES: { key: "all" | InsightCategory; label: string }[] = [
  { key: "all", label: "All Categories" },
  { key: "wastage", label: "Wastage" },
  { key: "zombie", label: "Zombie" },
  { key: "performance", label: "Performance" },
  { key: "quality", label: "Quality" },
];

const categoryMeta: Record<InsightCategory, { icon: typeof Users; border: string }> = {
  performance: { icon: Users, border: "border-l-amber-400" },
  wastage: { icon: AlertTriangle, border: "border-l-red-500" },
  zombie: { icon: Zap, border: "border-l-amber-400" },
  quality: { icon: Volume2, border: "border-l-blue-400" },
};

const severityTone = {
  high: "danger",
  medium: "warning",
  low: "info",
} as const;

// The backend appends insights in a fixed category order (wastage → zombie →
// performance → quality, see dashboard.py _insights), NOT by severity — so a
// medium wastage item used to render above a high zombie one while the header
// claimed "sorted by urgency". Sort here so the claim is true.
const severityRank: Record<InsightSeverity, number> = { high: 0, medium: 1, low: 2 };

export default function InsightFeedPage() {
  const [category, setCategory] = useState<"all" | InsightCategory>("all");
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    insightsApi
      .list()
      .then((res) => setInsights(res.insights))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load insights"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const filtered = (category === "all" ? insights : insights.filter((i) => i.category === category))
    .slice()
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  const activeCategoryLabel = CATEGORIES.find((c) => c.key === category)?.label ?? "";

  return (
    <div className="pb-10">
      <PageHeader
        title="AI Insight Feed"
        description="Plain-language insights from your live data, sorted by urgency"
        action={
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="size-3.5" /> Refresh
          </button>
        }
      />

      {error && (
        <div
          role="alert"
          className="mt-4 mx-4 sm:mx-6 lg:mx-8 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error} —{" "}
          <button className="font-semibold underline" onClick={load}>
            Retry
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 px-4 sm:px-6 lg:px-8">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            aria-pressed={category === c.key}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              category === c.key
                ? "border-primary-600 bg-primary-600 text-white"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* The feed list is suppressed while an error is showing: `insights` stays []
          on a failed fetch, so the empty branch would otherwise tell the founder
          everything is clear directly under the red banner. */}
      {!error && (
        <div className="mt-4 space-y-4 px-4 sm:px-6 lg:px-8">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : filtered.length === 0 ? (
            /* The endpoint returns a bare list, so "healthy" and "no data yet" are
               indistinguishable from here — the copy has to hold in both cases. */
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-slate-700">
                {category === "all"
                  ? "All clear — nothing has crossed your alert thresholds."
                  : `All clear on ${activeCategoryLabel.toLowerCase()} — nothing in this category has crossed your alert thresholds.`}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {category === "all"
                  ? "No untouched leads, no stalled leads, no telecaller performance gaps, no lead-quality alerts. An org with no leads or calls yet also lands here."
                  : "Switch to All Categories to see the rest of the feed."}
              </p>
            </div>
          ) : (
            filtered.map((insight) => {
              const meta = categoryMeta[insight.category];
              const Icon = meta.icon;
              return (
                <Card key={insight.id} className={cn("border-l-4 p-5", meta.border)}>
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                      <span className="flex size-7 items-center justify-center rounded-lg bg-slate-100">
                        <Icon className="size-3.5" />
                      </span>
                      {insight.category}
                    </span>
                    <Badge tone={severityTone[insight.severity]} dot>
                      {insight.severity.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-900">{insight.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-700">{insight.description}</p>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
