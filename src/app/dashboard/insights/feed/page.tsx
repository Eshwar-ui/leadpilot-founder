"use client";

import { useState } from "react";
import { RefreshCw, Users, AlertTriangle, Zap, Volume2, Clock, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { insights } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const CATEGORIES = ["All Categories", "Telecaller Performance", "Revenue At Risk", "Quick Win", "Campaign Efficiency", "Team Pattern"];

const categoryMeta: Record<string, { icon: typeof Users; border: string }> = {
  "TELECALLER PERFORMANCE": { icon: Users, border: "border-l-amber-400" },
  "REVENUE AT RISK": { icon: AlertTriangle, border: "border-l-red-500" },
  "QUICK WIN": { icon: Zap, border: "border-l-amber-400" },
  "CAMPAIGN EFFICIENCY": { icon: Volume2, border: "border-l-blue-400" },
  "TEAM PATTERN": { icon: Clock, border: "border-l-blue-400" },
};

const severityTone = {
  CRITICAL: "danger",
  HIGH: "warning",
  MEDIUM: "info",
} as const;

export default function InsightFeedPage() {
  const [category, setCategory] = useState("All Categories");

  const filtered = insights.filter((i) => {
    if (category === "All Categories") return true;
    return i.category.toLowerCase() === category.toLowerCase();
  });

  return (
    <div className="pb-10">
      <PageHeader
        title="AI Insight Feed"
        description="Plain-language insights from your live data — refreshed hourly, sorted by urgency"
        action={
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">Last updated: 05:47 pm</span>
            <button className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
              <RefreshCw className="size-3.5" /> Refresh
            </button>
          </div>
        }
      />

      <div className="mt-4 flex flex-wrap gap-2 px-4 sm:px-6 lg:px-8">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              category === c
                ? "border-primary-600 bg-primary-600 text-white"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-4 px-4 sm:px-6 lg:px-8">
        {filtered.map((insight) => {
          const meta = categoryMeta[insight.category];
          const Icon = meta.icon;
          return (
            <Card key={insight.category} className={cn("border-l-4 p-5", meta.border)}>
              <div className="flex items-start justify-between gap-4">
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-slate-100">
                    <Icon className="size-3.5" />
                  </span>
                  {insight.category}
                </span>
                <Badge tone={severityTone[insight.severity]} dot>
                  {insight.severity}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-700">{insight.text}</p>
              <button className="mt-3 flex items-center gap-1.5 rounded-lg border border-primary-100 bg-primary-50 px-3 py-1.5 text-sm font-semibold text-primary-700 hover:bg-primary-100">
                {insight.action} <ArrowRight className="size-3.5" />
              </button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
