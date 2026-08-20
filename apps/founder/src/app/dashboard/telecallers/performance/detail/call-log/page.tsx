"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { DateRangePicker, type DateRange } from "@/components/ui/DateRangePicker";
import { ApiError, telecallersApi, type TelecallerCallLogEntry } from "@/lib/api";
import { cn, VERDICT_TONE } from "@/lib/utils";

const PAGE_SIZE = 25;

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function CallLogContent() {
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
    if (!id || !dateRange) return;
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
    if (!dateRange) return;
    setLoadingMore(true);
    telecallersApi
      .callLog(id, { start: dateRange.start, end: dateRange.end, skip: calls.length, limit: PAGE_SIZE })
      .then((res) => setCalls((prev) => [...prev, ...res.calls]))
      .catch(() => {})
      .finally(() => setLoadingMore(false));
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
              <p className="mt-0.5 text-xs text-slate-400">{total} call{total === 1 ? "" : "s"} in range</p>
            </div>
            {dateRange && <DateRangePicker value={dateRange} onChange={setDateRange} />}
          </div>

          {error && (
            <div className="mx-5 mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
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
            <p className="px-5 py-6 text-sm text-slate-400">No calls in this range.</p>
          ) : (
            <>
              <div className="mt-3 divide-y divide-slate-100">
                {calls.map((c) => (
                  <Link
                    key={c.call_id}
                    href={`/dashboard/calls/detail?id=${c.call_id}`}
                    className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-slate-50"
                  >
                    <span className="font-mono text-xs text-slate-400">{fmtDateTime(c.timestamp)}</span>
                    <span className="flex items-center gap-2">
                      {c.total_score != null && (
                        <span className="font-mono text-xs font-semibold text-slate-500">{c.total_score}</span>
                      )}
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", VERDICT_TONE[c.lead_verdict ?? ""] ?? "bg-slate-100 text-slate-500")}>
                        {c.lead_verdict ?? "Unscored"}
                      </span>
                    </span>
                  </Link>
                ))}
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
