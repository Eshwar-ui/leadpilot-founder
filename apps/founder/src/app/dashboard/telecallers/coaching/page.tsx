"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { ApiError, coachingApi, type CoachingRecommendation } from "@/lib/api";

const priorityTone: Record<CoachingRecommendation["priority"], BadgeTone> = {
  High: "danger",
  Medium: "warning",
  Low: "neutral",
};

function CoachingQueueContent() {
  const searchParams = useSearchParams();
  const telecallerFilter = searchParams.get("telecaller_id");

  const [queue, setQueue] = useState<CoachingRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    coachingApi
      .queue()
      .then((res) => setQueue(res.queue))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load coaching queue"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const visible = telecallerFilter ? queue.filter((r) => r.telecaller_id === telecallerFilter) : queue;

  return (
    <div className="pb-10">
      <PageHeader
        title="Coaching & Development"
        description="AI-derived recommendations from each telecaller's trailing 14-day scoring pattern — read-only, no sessions are logged here yet."
      />

      {error && (
        <div className="mt-4 mx-4 sm:mx-6 lg:mx-8 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error} —{" "}
          <button className="font-semibold underline" onClick={load}>
            Retry
          </button>
        </div>
      )}

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card>
          {loading ? (
            <p className="px-5 py-6 text-sm text-slate-400">Loading recommendations…</p>
          ) : visible.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">
              {telecallerFilter
                ? "No recommendations for this telecaller right now — nothing scored below threshold in the last 14 days."
                : "No coaching recommendations right now. This covers telecallers with scored calls in the last 14 days — anyone with no scored calls yet won't appear here."}
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {visible.map((rec, i) => (
                <div key={i} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{rec.telecaller_name}</p>
                    <p className="text-sm text-slate-600">{rec.issue}</p>
                    <p className="mt-1 text-xs text-slate-400">{rec.recommended_action}</p>
                  </div>
                  <Badge tone={priorityTone[rec.priority]}>{rec.priority} Priority</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function CoachingQueuePage() {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-center text-sm text-slate-400 sm:px-6 lg:px-8">Loading…</p>}>
      <CoachingQueueContent />
    </Suspense>
  );
}
