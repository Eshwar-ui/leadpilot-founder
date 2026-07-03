import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  max = 100,
  tone = "primary",
  className,
  trackClassName,
}: {
  value: number;
  max?: number;
  tone?: "primary" | "success" | "warning" | "danger";
  className?: string;
  trackClassName?: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const toneClass = {
    primary: "bg-primary-600",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
  }[tone];

  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-slate-100", trackClassName)}>
      <div
        className={cn("h-full rounded-full", toneClass, className)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
