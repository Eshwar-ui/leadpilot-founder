"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ApiError, attendanceApi, type AttendanceRecord } from "@/lib/api";
import { cn } from "@/lib/utils";

function formatTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatHours(value: number | null) {
  if (value === null) return "—";
  const h = Math.floor(value);
  const m = Math.round((value - h) * 60);
  return `${h}h ${m}m`;
}

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    attendanceApi
      .list()
      .then((res) => setRecords(res.records))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load attendance"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const missingCheckout = records.filter((r) => r.check_in_at && !r.check_out_at);

  return (
    <div className="pb-10">
      <PageHeader
        title="Attendance & Shift Monitor"
        description="Check-in · check-out · hours worked per telecaller"
      />

      {error && (
        <div className="mt-4 mx-4 sm:mx-6 lg:mx-8 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error} —{" "}
          <button className="font-semibold underline" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {missingCheckout.length > 0 && (
        <div className="mt-4 space-y-3 px-4 sm:px-6 lg:px-8">
          {missingCheckout.map((w) => (
            <div key={w.id} className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <span className="size-2 shrink-0 rounded-full bg-amber-500" />
              <p className="text-sm text-amber-800">
                <span className="font-semibold text-amber-900">{w.telecaller_name}</span>{" "}
                checked in but hasn&apos;t checked out yet on {w.date}.
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="overflow-hidden">
          {loading ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">Loading attendance…</p>
          ) : records.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">No attendance records yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3">Telecaller</th>
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3 text-right">Check-in</th>
                    <th className="px-3 py-3 text-right">Check-out</th>
                    <th className="px-5 py-3 text-right">Hours Worked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((a) => (
                    <tr key={a.id} className={cn(!a.check_out_at && a.check_in_at && "bg-amber-50/50")}>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-2 font-semibold text-slate-900">
                          <span className={cn("size-2 rounded-full", a.check_out_at ? "bg-emerald-500" : "bg-amber-500")} />
                          {a.telecaller_name}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{a.date}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-600">{formatTime(a.check_in_at)}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-400">{formatTime(a.check_out_at)}</td>
                      <td className="px-5 py-3 text-right">
                        {a.hours_worked === null ? (
                          <Badge tone="warning">In progress</Badge>
                        ) : (
                          <span className="font-mono tabular-nums text-emerald-600">{formatHours(a.hours_worked)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
