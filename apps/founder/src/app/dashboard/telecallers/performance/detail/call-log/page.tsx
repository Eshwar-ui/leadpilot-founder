"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, PlayCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { DateRangePicker, type DateRange } from "@/components/ui/DateRangePicker";
import { ApiError, telecallersApi, type TelecallerCallLogEntry } from "@/lib/api";
import { cn, VERDICT_TONE } from "@/lib/utils";

const PAGE_SIZE = 25;

// NULLABLE: a call row keeps its timestamp only once the recording has been
// ingested — an in-flight upload has none yet, so never hand this to `new Date()`.
function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function CallLogContent() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const name = params.get("name");

  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [calls, setCalls] = useState<TelecallerCallLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    setDateRange({ start: toISO(new Date(now.getFullYear(), now.getMonth(), 1)), end: toISO(now) });
  }, []);

  function load() {
    // `loading` starts true, so every early return here has to decide whether
    // the skeleton is still telling the truth. A null dateRange lasts a single
    // render (the effect above fills it in on mount) — that one IS still
    // loading. A missing ?id= never resolves, and used to leave this page in a
    // permanent skeleton with no error at all.
    if (!dateRange) return;
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    telecallersApi
      .callLog(id, { start: dateRange.start, end: dateRange.end, skip: 0, limit: PAGE_SIZE })
      .then((res) => {
        setCalls(res.calls);
        setTotal(res.total);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load call log"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id, dateRange]);

  function loadMore() {
    if (!dateRange || !id) return;
    setLoadingMore(true);
    telecallersApi
      .callLog(id, { start: dateRange.start, end: dateRange.end, skip: calls.length, limit: PAGE_SIZE })
      .then((res) => setCalls((prev) => [...prev, ...res.calls]))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load more calls"))
      .finally(() => setLoadingMore(false));
  }

  if (!id) {
    return (
      <div className="pb-10">
        <div className="px-4 pt-6 sm:px-6 lg:px-8">
          <Link
            href="/dashboard/telecallers/performance"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary-600"
          >
            <ArrowLeft className="size-3.5" /> Performance Matrix
          </Link>
        </div>
        <div className="mt-4 px-4 sm:px-6 lg:px-8">
          <Card className="p-6">
            <h1 className="text-base font-semibold text-slate-900">No telecaller specified</h1>
            <p className="mt-1 text-sm text-slate-600">
              This call log needs a telecaller to open. Pick one from the performance matrix.
            </p>
            <Link href="/dashboard/telecallers/performance" className="mt-4 inline-block">
              <Button size="sm">Go to Performance Matrix</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <div className="px-4 pt-6 sm:px-6 lg:px-8">
        <Link
          href={`/dashboard/telecallers/performance/detail?id=${id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary-600"
        >
          <ArrowLeft className="size-3.5" /> {name ?? "Telecaller"}
        </Link>
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-0">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Call Log{name ? ` — ${name}` : ""}</h3>
              <p className="mt-0.5 text-xs text-slate-600">{total} call{total === 1 ? "" : "s"} in range</p>
            </div>
            {dateRange && <DateRangePicker value={dateRange} onChange={setDateRange} />}
          </div>

          {error && (
            <div role="alert" className="mx-5 mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error} —{" "}
              <button className="font-semibold underline" onClick={load}>
                Retry
              </button>
            </div>
          )}

          {loading ? (
            <div className="p-5">
              <Skeleton block className="h-10 w-full" />
              <Skeleton block className="mt-2 h-10 w-full" />
              <Skeleton block className="mt-2 h-10 w-full" />
            </div>
          ) : calls.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-600">No calls in this range.</p>
          ) : (
            <>
              {/* Same columns as the Telecaller Detail page's tabs — arriving
                  here via "View full call log" shouldn't lose the lead name,
                  number and duration the founder was just reading. */}
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      <th className="px-5 py-2.5">Lead</th>
                      <th className="px-3 py-2.5">Date &amp; time</th>
                      <th className="px-3 py-2.5">Duration</th>
                      <th className="px-3 py-2.5">Verdict</th>
                      <th className="px-5 py-2.5 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {calls.map((c) => (
                      <tr
                        key={c.call_id}
                        onClick={() => router.push(`/dashboard/calls/detail?id=${c.call_id}`)}
                        className="cursor-pointer hover:bg-slate-50"
                      >
                        <td className="px-5 py-3">
                          <span className="flex items-center gap-1.5 font-medium text-slate-900">
                            {c.lead_name}
                            {c.has_audio && (
                              <PlayCircle className="size-3.5 text-emerald-600" aria-label="Recording available" />
                            )}
                          </span>
                          {c.phone && <span className="block font-mono text-xs text-slate-600">{c.phone}</span>}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-slate-600">{fmtDateTime(c.timestamp)}</td>
                        <td className="px-3 py-3 font-mono text-xs text-slate-600">{c.duration_label ?? "—"}</td>
                        <td className="px-3 py-3">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-medium",
                              VERDICT_TONE[c.lead_verdict ?? ""] ?? "bg-slate-100 text-slate-600"
                            )}
                          >
                            {c.lead_verdict ?? "Unscored"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          {c.total_score == null ? (
                            <span className="text-xs text-slate-400">Not scored</span>
                          ) : (
                            <span className="font-mono font-bold text-slate-700">{c.total_score}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {calls.length < total && (
                <div className="flex justify-center border-t border-slate-100 p-4">
                  <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? "Loading…" : `Load more (${calls.length} of ${total})`}
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function CallLogPage() {
  return (
    <Suspense fallback={<div className="px-4 pt-6 sm:px-6 lg:px-8"><Skeleton block className="h-8 w-64" /></div>}>
      <CallLogContent />
    </Suspense>
  );
}
