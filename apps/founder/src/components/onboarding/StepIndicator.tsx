import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Business Basics", "Services", "Brand & Voice", "Review"];

export function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center">
      {STEPS.map((label, i) => {
        const index = i + 1;
        const isDone = index < step;
        const isActive = index === step;
        return (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold sm:size-8",
                  isDone && "bg-primary-600 text-white",
                  isActive && !isDone && "bg-primary-600 text-white",
                  !isDone && !isActive && "border border-slate-200 text-slate-400"
                )}
              >
                {isDone ? <Check className="size-4" /> : index}
              </div>
              <span
                className={cn(
                  "hidden whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide sm:block",
                  isDone || isActive ? "text-primary-600" : "text-slate-400"
                )}
              >
                {label}
              </span>
            </div>
            {index !== STEPS.length && (
              <div className={cn("mx-2 h-0.5 flex-1 sm:mx-3 sm:mb-5", isDone ? "bg-primary-600" : "bg-slate-200")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
