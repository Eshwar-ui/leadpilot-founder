import { cn } from "@/lib/utils";

export type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "primary";

const toneStyles: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-600",
  info: "bg-blue-50 text-blue-600",
  primary: "bg-primary-50 text-primary-700",
};

export function Badge({
  tone = "neutral",
  dot,
  className,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium",
        toneStyles[tone],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            "size-1.5 rounded-full",
            tone === "success" && "bg-emerald-500",
            tone === "warning" && "bg-amber-500",
            tone === "danger" && "bg-red-500",
            tone === "info" && "bg-blue-500",
            tone === "primary" && "bg-primary-600",
            tone === "neutral" && "bg-slate-400"
          )}
        />
      )}
      {children}
    </span>
  );
}
