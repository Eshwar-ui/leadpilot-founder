"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DateRangePicker, type DateRange } from "@/components/ui/DateRangePicker";
import { ApiError, attendanceApi, type AttendanceRecord, type AttendanceStatus } from "@/lib/api";
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

// UTC ISO -> "YYYY-MM-DDTHH:mm" in local time for a datetime-local input.
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const statusMeta: Record<AttendanceStatus, { dot: string; label: string }> = {
  completed: { dot: "bg-emerald-500", label: "Completed" },
  on_shift: { dot: "bg-blue-500", label: "On shift" },
  auto_closed: { dot: "bg-amber-500", label: "Auto-closed" },
};

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [correcting, setCorrecting] = useState<AttendanceRecord | null>(null);
  const [checkoutInput, setCheckoutInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [correctError, setCorrectError] = useState<string | null>(null);

  // Initialised client-side (matches the backend's own last-30-days default)
  // to avoid an SSR/client Date hydration mismatch.
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  useEffect(() => {
    const now = new Date();
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    setDateRange({ start: iso(start), end: iso(now) });
  }, []);

  function load() {
    if (!dateRange) return;
    setLoading(true);
    setError(null);
    attendanceApi
      .list({ from_date: dateRange.start, to_date: dateRange.end })
      .then((res) => setRecords(res.records))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load attendance"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [dateRange]);

  const onShiftCount = records.filter((r) => r.status === "on_shift").length;
  const missed = records.filter((r) => r.status === "auto_closed");

  function openCorrect(record: AttendanceRecord) {
    setCorrecting(record);
    setCheckoutInput(toLocalInput(record.effective_check_out_at ?? record.check_in_at));
    setCorrectError(null);
  }

  async function submitCorrect() {
    if (!correcting || !checkoutInput) return;
    setSaving(true);
    setCorrectError(null);
    try {
      await attendanceApi.correct(correcting.id, new Date(checkoutInput).toISOString());
      setCorrecting(null);
      load();
    } catch (e) {
      setCorrectError(e instanceof ApiError ? e.message : "Failed to save check-out");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pb-10">
      <PageHeader
        title="Attendance & Shift Monitor"
        description="Check-in · check-out · hours worked per telecaller"
        action={dateRange && <DateRangePicker value={dateRange} onChange={setDateRange} />}
      />

      {error && (
        <div className="mt-4 mx-4 sm:mx-6 lg:mx-8 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error} —{" "}
          <button className="font-semibold underline" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {!loading && onShiftCount > 0 && (
        <div className="mt-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm text-blue-700">
            <span className="size-2 shrink-0 animate-pulse rounded-full bg-blue-500" />
            {onShiftCount} telecaller{onShiftCount > 1 ? "s" : ""} currently on shift.
          </div>
        </div>
      )}

      {missed.length > 0 && (
        <div className="mt-4 space-y-3 px-4 sm:px-6 lg:px-8">
          {missed.map((w) => (
            <div
              key={w.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
            >
              <p className="text-sm text-amber-800">
                <span className="font-semibold text-amber-900">{w.telecaller_name}</span>{" "}
                didn&apos;t check out on {w.date} — auto-closed after 12h. Set the real time if you know it.
              </p>
              <Button variant="outline" size="sm" onClick={() => openCorrect(w)}>
                Set check-out
              </Button>
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
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3">Telecaller</th>
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3 text-right">Check-in</th>
                    <th className="px-3 py-3 text-right">Check-out</th>
                    <th className="px-3 py-3 text-right">Hours Worked</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((a) => {
                    // Fall back if an older backend hasn't shipped `status` yet,
                    // so the page degrades instead of crashing on statusMeta[undefined].
                    const status: AttendanceStatus = a.status ?? (a.check_out_at ? "completed" : "on_shift");
                    const meta = statusMeta[status];
                    return (
                      <tr key={a.id} className={cn(status === "auto_closed" && "bg-amber-50/50")}>
                        <td className="px-5 py-3">
                          <span className="flex items-center gap-2 font-semibold text-slate-900">
                            <span className={cn("size-2 rounded-full", meta.dot)} />
                            {a.telecaller_name}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-600">{a.date}</td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-600">{formatTime(a.check_in_at)}</td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-400">
                          {status === "auto_closed" ? (
                            <span className="italic text-amber-600" title="Auto-capped — no real check-out recorded">
                              {formatTime(a.effective_check_out_at)}*
                            </span>
                          ) : (
                            formatTime(a.check_out_at)
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {status === "on_shift" ? (
                            <Badge tone="info">On shift</Badge>
                          ) : status === "auto_closed" ? (
                            <span className="font-mono tabular-nums text-amber-600">{formatHours(a.hours_worked)}*</span>
                          ) : (
                            <span className="font-mono tabular-nums text-emerald-600">{formatHours(a.hours_worked)}</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {status !== "completed" && (
                            <button className="text-xs font-semibold text-primary-600 hover:underline" onClick={() => openCorrect(a)}>
                              Set check-out
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {missed.length > 0 && (
                <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-400">
                  * Auto-capped at 12h — a check-out was never recorded. Use “Set check-out” to enter the real time.
                </p>
              )}
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={correcting !== null}
        onClose={() => setCorrecting(null)}
        title="Set check-out time"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setCorrecting(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submitCorrect} disabled={saving || !checkoutInput}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Set the check-out for <b>{correcting?.telecaller_name}</b> on {correcting?.date} (checked in at{" "}
            {formatTime(correcting?.check_in_at ?? null)}).
          </p>
          {correctError && <p className="text-xs font-medium text-red-600">{correctError}</p>}
          <input
            type="datetime-local"
            value={checkoutInput}
            onChange={(e) => setCheckoutInput(e.target.value)}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </Modal>
    </div>
  );
}
