"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, LayoutGrid, RotateCw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

// Catches render-time throws anywhere under /dashboard. Without this file a
// single bad response shape (e.g. a page mapping over a field the API returned
// as null) white-screened the whole portal with no way back except a manual
// reload. This boundary renders INSIDE DashboardChrome, so the founder keeps
// the topbar and sidebar and can navigate away even if this segment is broken.
//
// Next 16.2 supersedes `reset` with `unstable_retry` (see
// node_modules/next/dist/docs/.../file-conventions/error.md). `reset` only
// clears error state and re-renders without re-fetching; `unstable_retry`
// re-runs the fetch, which is what a founder hitting "Try again" expects after
// a flaky API call. Both are still passed at runtime.
export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // No error-reporting service is wired up yet, so the console is the only
    // place a support call can recover the stack from.
    console.error("Dashboard render error:", error);
  }, [error]);

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <Card className="w-full max-w-lg px-6 py-10 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertTriangle className="size-6" />
        </span>

        <h1 className="mt-4 text-lg font-bold text-slate-900">This page didn&apos;t load</h1>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">
          Something went wrong while rendering this screen. Your data is safe — nothing was
          changed. Retrying will re-fetch the page.
        </p>

        {/* The message is useful in development and for client-side throws. In
            production a Server Component error is replaced by a generic string
            and only `digest` ties it to a server log, so surface both. */}
        {error.message && (
          <p className="mx-auto mt-4 max-w-md break-words rounded-lg bg-slate-50 px-3 py-2 text-left font-mono text-xs text-slate-500">
            {error.message}
          </p>
        )}
        {error.digest && (
          <p className="mt-2 font-mono text-[11px] text-slate-400">
            Reference: {error.digest}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={() => unstable_retry()}>
            <RotateCw className="size-4" /> Try again
          </Button>
          <Link href="/dashboard">
            <Button variant="outline">
              <LayoutGrid className="size-4" /> Back to dashboard
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
