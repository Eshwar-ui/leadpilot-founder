import { cn } from "@/lib/utils";
import { InfoTip } from "@/components/ui/InfoTip";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  suffix,
  delta,
  deltaTone = "success",
  note,
  noteTone = "neutral",
  icon: Icon,
  tone = "default",
  className,
  help,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  suffix?: string;
  delta?: string;
  deltaTone?: "success" | "danger";
  note?: string;
  noteTone?: "neutral" | "warning";
  icon?: LucideIcon;
  tone?: "default" | "danger";
  className?: string;
  /** Plain-words explanation of what this number is and how it's worked out,
   *  shown behind a "?" next to the label. A KPI nobody can define is a KPI
   *  nobody trusts. */
  help?: string;
  /** One short line under the value, for the same purpose as `help` but always
   *  visible — use it for the metric's unit or basis ("of calls attempted"). */
  hint?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]",
        tone === "danger" ? "border-red-200 bg-red-50/40" : "border-slate-200",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <span className="truncate">{label}</span>
          {help && <InfoTip label={`What ${label} means`} text={help} />}
        </span>
        {Icon && <Icon className="size-4 shrink-0 text-slate-300" />}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span
          className={cn(
            "font-mono text-[1.75rem] font-bold tracking-tight tabular-nums",
            tone === "danger" ? "text-red-600" : "text-slate-900"
          )}
        >
          {value}
        </span>
        {suffix && (
          <span className="text-xs font-medium text-slate-400">{suffix}</span>
        )}
      </div>
      {hint && <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{hint}</p>}
      {delta && (
        <p
          className={cn(
            "mt-1 text-xs font-medium",
            deltaTone === "success" ? "text-emerald-600" : "text-red-600"
          )}
        >
          {deltaTone === "success" ? "↗ " : "↘ "}
          {delta}
        </p>
      )}
      {note && (
        <span
          className={cn(
            "mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium",
            noteTone === "warning" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"
          )}
        >
          {note}
        </span>
      )}
    </div>
  );
}
