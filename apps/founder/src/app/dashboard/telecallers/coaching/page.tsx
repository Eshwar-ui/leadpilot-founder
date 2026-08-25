"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
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

      {/* Suppressed on error: the queue stays [] after a failed fetch, and the empty
          branch below is an all-clear — it must never render under the error banner. */}
      {!error && (
        <div className="mt-4 px-4 sm:px-6 lg:px-8">
          <Card>
            {loading ? (
              <div className="space-y-3 px-5 py-6">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} block className="h-4 w-full" />
                ))}
              </div>
            ) : visible.length === 0 ? (
              /* The queue is not "telecallers with scored calls" only: the backend
                 emits a High-priority row for anyone with NO scored calls in the
                 window (dashboard.py, _COACHING_WINDOW_DAYS branch), so an empty
                 queue really does mean nobody needs coaching. */
              <div className="px-5 py-6">
                <p className="text-sm font-medium text-slate-700">
                  {telecallerFilter
                    ? "Nothing to coach for this telecaller."
                    : "Nothing to coach right now — nobody is below threshold."}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {telecallerFilter
                    ? "All six scoring dimensions are above threshold across their last 14 days — a telecaller with no scored calls at all would be flagged here as High priority instead."
                    : "No telecaller fell below threshold on any of the six scoring dimensions in the last 14 days. Anyone with no scored calls at all would show up here as a High-priority item, so an empty queue is a clean queue."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {visible.map((rec, i) => (
                  <div key={i} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{rec.telecaller_name}</p>
                      <p className="text-sm text-slate-600">{rec.issue}</p>
                      <p className="mt-1 text-xs text-slate-600">{rec.recommended_action}</p>
                    </div>
                    <Badge tone={priorityTone[rec.priority]}>{rec.priority} Priority</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

export default function CoachingQueuePage() {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-center text-sm text-slate-600 sm:px-6 lg:px-8">Loading…</p>}>
      <CoachingQueueContent />
    </Suspense>
  );
}
