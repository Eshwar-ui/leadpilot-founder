"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type DateRange = { start: string; end: string }; // both YYYY-MM-DD (local)

function toISO(d: Date) {
  // Local Y-M-D (NOT toISOString, which shifts to UTC and can roll the date back
  // a day in +offset timezones like IST).
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmt(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISO(d);
}

function monthStart() {
  const d = new Date();
  return toISO(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function dateRangeLabel(r: DateRange) {
  const year = new Date(`${r.end}T00:00:00`).getFullYear();
  return `${fmt(r.start)} – ${fmt(r.end)} ${year}`;
}

export function DateRangePicker({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setDraft(value), [value]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const today = toISO(new Date());
  const presets: { label: string; range: DateRange }[] = [
    { label: "This month", range: { start: monthStart(), end: today } },
    { label: "Last 7 days", range: { start: daysAgo(6), end: today } },
    { label: "Last 30 days", range: { start: daysAgo(29), end: today } },
    { label: "Last 90 days", range: { start: daysAgo(89), end: today } },
  ];

  const invalid = draft.end < draft.start;

  function apply(r: DateRange) {
    onChange(r);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
      >
        <Calendar className="size-3.5 text-slate-400" />
        {dateRangeLabel(value)}
        <ChevronDown className={cn("size-3.5 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex flex-wrap gap-1.5 border-b border-slate-100 p-3">
            {presets.map((p) => {
              const active = p.range.start === value.start && p.range.end === value.end;
              return (
                <button
                  key={p.label}
                  onClick={() => apply(p.range)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                    active ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="space-y-3 p-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">From</span>
                <input
                  type="date"
                  value={draft.start}
                  max={draft.end || today}
                  onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))}
                  className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-700"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">To</span>
                <input
                  type="date"
                  value={draft.end}
                  min={draft.start}
                  max={today}
                  onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))}
                  className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-700"
                />
              </label>
            </div>
            {invalid && <p className="text-[11px] font-medium text-red-600">End date must be on or after the start date.</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => apply(draft)}
                disabled={invalid}
                className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
