"use client";

import { useEffect, useId, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A small "what is this?" marker that explains a metric in plain words.
 *
 * Opens on hover AND on click/focus, not hover alone: hover-only tooltips are
 * unreachable by keyboard and don't exist on touch, which is where a founder
 * checking numbers on a phone would need them most.
 *
 * The text is rendered into the DOM at all times (visually hidden when shut)
 * and wired up with aria-describedby, so a screen reader gets the explanation
 * as part of the label rather than never hearing it.
 */
export function InfoTip({
  label,
  text,
  className,
  align = "left",
}: {
  /** What this explains, for screen readers: "What Junk Rate means". */
  label: string;
  text: string;
  className?: string;
  /** Which edge the bubble hangs from — flip it near the right edge of a row. */
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);

  // A tooltip pinned open by click has to close on an outside click or Escape,
  // or it follows the founder around the page.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span
      ref={wrapRef}
      className={cn("relative inline-flex items-center", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        aria-expanded={open}
        onClick={(e) => {
          // These often sit inside clickable rows/cards.
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="text-slate-300 transition-colors hover:text-slate-500 focus:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-200 rounded-full"
      >
        <HelpCircle className="size-3.5" />
      </button>
      <span
        id={id}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute bottom-full z-30 mb-1.5 w-56 rounded-lg bg-slate-900 px-3 py-2 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-white shadow-lg transition-opacity",
          align === "right" ? "right-0" : "left-0",
          open ? "opacity-100" : "opacity-0",
          // Kept in the accessibility tree when shut (so aria-describedby still
          // resolves) but out of the way of pointer and layout.
          !open && "invisible"
        )}
      >
        {text}
      </span>
    </span>
  );
}
