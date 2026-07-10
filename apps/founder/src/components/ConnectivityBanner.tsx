"use client";

import { useState, useSyncExternalStore } from "react";
import { AlertTriangle } from "lucide-react";
import {
  getReachableSnapshot,
  getServerReachableSnapshot,
  retryNow,
  subscribeReachability,
} from "@/lib/connectivity";

/** App-wide "can't reach the server" banner — mounted once in the root
 * layout so every page gets it for free without checking connectivity
 * itself. Hidden whenever the backend is reachable. */
export function ConnectivityBanner() {
  const reachable = useSyncExternalStore(
    subscribeReachability,
    getReachableSnapshot,
    getServerReachableSnapshot
  );
  const [retrying, setRetrying] = useState(false);

  if (reachable) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
      <AlertTriangle className="size-4 shrink-0" />
      <span>Can&apos;t reach the server — retrying…</span>
      <button
        onClick={async () => {
          setRetrying(true);
          await retryNow();
          setRetrying(false);
        }}
        disabled={retrying}
        className="font-semibold underline underline-offset-2 hover:text-amber-900 disabled:opacity-50"
      >
        {retrying ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
}
