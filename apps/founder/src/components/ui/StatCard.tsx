import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  suffix,
  delta,
  deltaTone = "success",
  icon: Icon,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  suffix?: string;
  delta?: string;
  deltaTone?: "success" | "danger";
  icon?: LucideIcon;
  tone?: "default" | "danger";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-white p-4 shadow-sm",
        tone === "danger" ? "border-red-200 bg-red-50/40" : "border-slate-200",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </span>
        {Icon && (
          <span className="flex size-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <Icon className="size-3.5" />
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span
          className={cn(
            "font-mono text-2xl font-bold tabular-nums",
            tone === "danger" ? "text-red-600" : "text-slate-900"
          )}
        >
          {value}
        </span>
        {suffix && (
          <span className="text-xs font-medium text-slate-400">{suffix}</span>
        )}
      </div>
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
    </div>
  );
}
