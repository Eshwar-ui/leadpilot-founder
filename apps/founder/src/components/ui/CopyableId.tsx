"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/** A compact, organisation-scoped public ID for support and exports. The
 * internal UUID remains the route/database key; callers only see and copy the
 * friendlier public identifier (for example, ACME-4F6A10C2). */
export function CopyableId({
  id,
  displayId,
  className,
}: {
  id: string;
  displayId?: string | null;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const publicId = displayId || `LEAD-${id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase()}`;

  async function copy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation(); // don't trigger a parent row's own click-to-navigate
    await navigator.clipboard.writeText(publicId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={copy}
      title={copied ? "Copied" : `Copy lead ID: ${publicId}`}
      className={cn(
        "inline-flex items-center gap-1 rounded font-mono text-[11px] text-slate-400 hover:text-primary-600",
        className
      )}
    >
      {publicId}
      {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
    </button>
  );
}
