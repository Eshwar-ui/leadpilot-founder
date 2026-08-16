import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatINR(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

/** Formats a rupee amount in lakh/crore shorthand, e.g. 2460000 -> "₹24.6L" */
export function formatLakhs(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value}`;
}

/** Formats seconds as "4m 20s", e.g. for average call talk time. */
export function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

/** Up to 2 uppercase initials from a person's name, for avatar chips. */
export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** AI lead-verdict badge colors. Hot = best signal = success green, all the
 * way down to Junk = danger red — same direction as every other tone map in
 * this app (status/severity), so a color scan reads consistently everywhere. */
export const VERDICT_TONE: Record<string, string> = {
  Hot: "bg-emerald-50 text-emerald-700",
  Warm: "bg-blue-50 text-blue-700",
  Cold: "bg-amber-50 text-amber-700",
  Junk: "bg-red-50 text-red-700",
};

/** Telecaller live-status badge colors, shared by the Performance Matrix and
 * Telecaller Detail so a status always reads the same color everywhere. */
export const TELECALLER_STATUS_DOT: Record<string, string> = {
  Active: "bg-emerald-500",
  Break: "bg-amber-500",
  Inactive: "bg-red-500",
  Absent: "bg-slate-400",
};

export const TELECALLER_STATUS_PILL: Record<string, string> = {
  Active: "bg-emerald-50 text-emerald-700",
  Break: "bg-amber-50 text-amber-700",
  Inactive: "bg-red-50 text-red-700",
  Absent: "bg-slate-100 text-slate-500",
};
