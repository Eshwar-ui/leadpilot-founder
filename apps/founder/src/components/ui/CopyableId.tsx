"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/** A short, copyable record ID — e.g. for a lead reference in a support
 * conversation. Shows the first 8 characters (a full UUID is too long to sit
 * in a table row) with a click-to-copy-full-ID affordance. */
export function CopyableId({ id, className }: { id: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation(); // don't trigger a parent row's own click-to-navigate
    await navigator.clipboard.writeText(id);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={copy}
      title={copied ? "Copied" : `Copy full ID: ${id}`}
      className={cn(
        "inline-flex items-center gap-1 rounded font-mono text-[11px] text-slate-400 hover:text-primary-600",
        className
      )}
    >
      ID {id.slice(0, 8)}
      {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
    </button>
  );
}
