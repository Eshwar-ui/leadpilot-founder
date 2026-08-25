"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DateRangePicker, type DateRange } from "@/components/ui/DateRangePicker";
import { ApiError, attendanceApi, teamApi, type AttendanceRecord, type AttendanceStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

// The backend buckets an attendance row's `date` in IST (attendance.py's
// _today_ist), but the check-in/check-out instants are UTC. Rendering the times
// in the browser's own zone made a founder outside IST see a time that
// contradicted the date beside it (a 01:30 IST check-in showing as the previous
// day's 20:00), so every time on this page is formatted in IST explicitly.
const IST_TZ = "Asia/Kolkata";
const IST_OFFSET_MIN = 330;

function formatTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: IST_TZ,
  });
}

function formatHours(value: number | null) {
  if (value === null) return "—";
  const h = Math.floor(value);
  const m = Math.round((value - h) * 60);
  return `${h}h ${m}m`;
}

/** Today's date in IST, as the same "YYYY-MM-DD" string the backend stores. */
function todayIst() {
  return new Date(Date.now() + IST_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
}

// UTC ISO -> "YYYY-MM-DDTHH:mm" IST wall clock for a datetime-local input. The
// input is deliberately driven in IST rather than browser-local time so the
// value the founder types matches the times shown in the table.
function toIstInput(iso: string | null) {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + IST_OFFSET_MIN * 60_000).toISOString().slice(0, 16);
}

/** Inverse of toIstInput: IST wall clock -> UTC ISO for the PATCH body. */
function fromIstInput(value: string) {
  return new Date(new Date(`${value}:00Z`).getTime() - IST_OFFSET_MIN * 60_000).toISOString();
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

  // /api/attendance joins User with no role filter, and the response carries no
  // role, so founder and admin check-ins arrive mixed in with the telecallers'.
  // Roles come from /api/team (the same source Manage Team uses) and are applied
  // client-side. If that call fails we show every record unfiltered rather than
  // silently hiding rows — a missing filter is better than missing people.
  const [roleByUserId, setRoleByUserId] = useState<Record<string, string> | null>(null);

  const [correcting, setCorrecting] = useState<AttendanceRecord | null>(null);
  const [checkoutInput, setCheckoutInput] = useState("");
  const [checkoutMax, setCheckoutMax] = useState("");
  const [saving, setSaving] = useState(false);
  const [correctError, setCorrectError] = useState<string | null>(null);

  // Initialised client-side (matches the backend's own last-30-days default)
  // to avoid an SSR/client Date hydration mismatch.
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  // Same reason: today-in-IST is a client-only value.
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    const now = new Date();
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    setDateRange({ start: iso(start), end: iso(now) });
    setToday(todayIst());
  }, []);

  useEffect(() => {
    teamApi
      .list()
      .then((members) => setRoleByUserId(Object.fromEntries(members.map((m) => [m.id, m.role]))))
      .catch(() => setRoleByUserId(null));
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

  const visible = roleByUserId
    ? records.filter((r) => roleByUserId[r.user_id] === "telecaller")
    : records;

  // "Currently on shift" must mean TODAY. Deriving it from the selected range
  // meant picking last month counted long-closed historical open shifts as
  // people who are on the phone right now.
  const onShiftToday = today
    ? visible.filter((r) => r.status === "on_shift" && r.date === today).length
    : 0;
  const missed = visible.filter((r) => r.status === "auto_closed");

  function openCorrect(record: AttendanceRecord) {
    setCorrecting(record);
    setCheckoutInput(toIstInput(record.effective_check_out_at ?? record.check_in_at));
    setCheckoutMax(toIstInput(new Date().toISOString()));
    setCorrectError(null);
  }

  async function submitCorrect() {
    if (!correcting || !checkoutInput) return;
    // The backend rejects both of these with a 422. Checking here means the
    // founder finds out while the value is still in front of them, and the
    // min/max below stop most of it happening in the first place.
    const chosen = new Date(fromIstInput(checkoutInput)).getTime();
    if (Number.isNaN(chosen)) {
      setCorrectError("Enter a valid date and time");
      return;
    }
    if (correcting.check_in_at && chosen <= new Date(correcting.check_in_at).getTime()) {
      setCorrectError(`Check-out must be after the check-in at ${formatTime(correcting.check_in_at)} IST`);
      return;
    }
    if (chosen > Date.now()) {
      setCorrectError("Check-out can't be in the future");
      return;
    }
    setSaving(true);
    setCorrectError(null);
    try {
      await attendanceApi.correct(correcting.id, new Date(chosen).toISOString());
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
        description="Check-in · check-out · hours worked per telecaller (times in IST)"
        action={dateRange && <DateRangePicker value={dateRange} onChange={setDateRange} />}
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

      {!loading && !error && onShiftToday > 0 && (
        <div className="mt-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm text-blue-700">
            <span className="size-2 shrink-0 animate-pulse rounded-full bg-blue-500" />
            {onShiftToday} telecaller{onShiftToday > 1 ? "s" : ""} currently on shift.
          </div>
        </div>
      )}

      {!error && missed.length > 0 && (
        <div className="mt-4 space-y-3 px-4 sm:px-6 lg:px-8">
          {missed.map((w) => (
            <div
              key={w.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
            >
              <p className="text-sm text-amber-800">
                <span className="font-semibold text-amber-900">{w.telecaller_name ?? "Unknown user"}</span>{" "}
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
            <p className="px-5 py-10 text-center text-sm text-slate-600">Loading attendance…</p>
          ) : error ? (
            // The banner above already says the fetch failed — don't follow it
            // with an empty state that reads as "nobody worked".
            null
          ) : visible.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-600">
              {/* Range-aware: "No records yet" was wrong for what is really
                  "none inside the window you picked". */}
              <p>
                No attendance recorded between {dateRange?.start} and {dateRange?.end}.
              </p>
              <p className="mt-1 text-slate-600">
                {records.length > 0
                  ? "The only check-ins in this range belong to non-telecaller accounts."
                  : "Widen the date range, or check that your telecallers are checking in from the mobile app."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-5 py-3">Telecaller</th>
                    <th scope="col" className="px-3 py-3">Date</th>
                    <th scope="col" className="px-3 py-3 text-right">Check-in (IST)</th>
                    <th scope="col" className="px-3 py-3 text-right">Check-out (IST)</th>
                    <th scope="col" className="px-3 py-3 text-right">Hours Worked</th>
                    <th scope="col" className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((a) => {
                    // Fall back if an older backend hasn't shipped `status` yet,
                    // so the page degrades instead of crashing on statusMeta[undefined].
                    const status: AttendanceStatus = a.status ?? (a.check_out_at ? "completed" : "on_shift");
                    const meta = statusMeta[status];
                    return (
                      <tr key={a.id} className={cn(status === "auto_closed" && "bg-amber-50/50")}>
                        <th scope="row" className="px-5 py-3 text-left font-normal">
                          <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <span className={cn("size-2 rounded-full", meta.dot)} aria-hidden="true" />
                            {/* telecaller_name is nullable — an unnamed account
                                used to render as a blank cell. */}
                            {a.telecaller_name ?? "Unknown user"}
                          </span>
                          <span className="sr-only">{meta.label}</span>
                        </th>
                        <td className="px-3 py-3 text-slate-600">{a.date}</td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-700">{formatTime(a.check_in_at)}</td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-700">
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
                            <button
                              className="text-xs font-semibold text-primary-600 hover:underline"
                              onClick={() => openCorrect(a)}
                            >
                              Set check-out
                              <span className="sr-only"> for {a.telecaller_name ?? "unknown user"} on {a.date}</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {missed.length > 0 && (
                <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-600">
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
            Set the check-out for <b>{correcting?.telecaller_name ?? "this user"}</b> on {correcting?.date} (checked in
            at {formatTime(correcting?.check_in_at ?? null)} IST).
          </p>
          {correctError && (
            <p role="alert" className="text-xs font-medium text-red-600">
              {correctError}
            </p>
          )}
          <label className="block text-xs font-semibold text-slate-500" htmlFor="checkout-at">
            Check-out (IST)
          </label>
          <input
            id="checkout-at"
            type="datetime-local"
            aria-label="Check-out date and time, in IST"
            value={checkoutInput}
            // Bounded so an impossible time is refused by the picker itself
            // instead of only by the server's 422 after a round trip.
            min={toIstInput(correcting?.check_in_at ?? null)}
            max={checkoutMax}
            onChange={(e) => setCheckoutInput(e.target.value)}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          />
          <p className="text-xs text-slate-600">
            Must be after the check-in and no later than now. Entered and saved in IST.
          </p>
        </div>
      </Modal>
    </div>
  );
}
