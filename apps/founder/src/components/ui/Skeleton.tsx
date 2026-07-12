import { cn } from "@/lib/utils";

export function Skeleton({ className, block }: { className?: string; block?: boolean }) {
  // A <span> (not <div>) so it's valid inside <p>/<span> placeholders — StatCard
  // wraps its value in a <span>, and the revenue/goal cards place skeletons
  // inside <p>, so a <div> there caused hydration/DOM-nesting errors. inline-block
  // by default so width/height apply; pass `block` for the stacked composites below.
  return <span className={cn("shimmer rounded-md", block ? "block" : "inline-block", className)} />;
}

export function SkeletonStatCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="size-7 rounded-lg" />
      </div>
      <Skeleton block className="mt-3 h-7 w-16" />
      <Skeleton block className="mt-2 h-3 w-20" />
    </div>
  );
}

export function SkeletonTableRow({ columns = 6 }: { columns?: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-5 py-3">
          <Skeleton className="h-4 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonTable({ rows = 5, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <tbody className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} columns={columns} />
      ))}
    </tbody>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", className)}>
      <Skeleton block className="h-4 w-32" />
      <Skeleton block className="mt-3 h-3 w-full" />
      <Skeleton block className="mt-2 h-3 w-5/6" />
      <Skeleton block className="mt-2 h-3 w-2/3" />
    </div>
  );
}

export function SkeletonKanbanColumn() {
  return (
    <div className="flex w-72 shrink-0 flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
      <Skeleton className="h-4 w-24" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <Skeleton block className="h-4 w-3/4" />
          <Skeleton block className="mt-2 h-3 w-1/2" />
          <Skeleton block className="mt-3 h-3 w-full" />
        </div>
      ))}
    </div>
  );
}
