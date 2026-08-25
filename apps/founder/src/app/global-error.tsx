"use client"; // Error boundaries must be Client Components

// Last-resort boundary for a throw in the ROOT layout itself — the one place
// dashboard/error.tsx cannot reach, because an error.js never catches errors
// from the layout in its own segment. This file REPLACES the root layout when
// active, so it must render its own <html> and <body> and import global styles
// itself (the root layout's own `import "./globals.css"` never runs here).
import "./globals.css";

// Note: `metadata` / `generateMetadata` are not supported in a Client
// Component, so the tab title is set with React's <title> element instead.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <title>Something went wrong — LeadPilot</title>
      </head>
      {/* The Inter/JetBrains font variables are defined by the root layout,
          which is bypassed here — fall back to the system UI stack rather than
          rendering in an unstyled serif. */}
      <body className="flex min-h-full items-center justify-center bg-slate-50 px-4 py-16 font-[system-ui,sans-serif] text-slate-900">
        <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white px-6 py-10 text-center shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-red-50 text-2xl text-red-600">
            !
          </span>

          <h1 className="mt-4 text-lg font-bold text-slate-900">LeadPilot couldn&apos;t start</h1>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">
            The application failed to load. This is usually temporary — retrying will reload
            LeadPilot from scratch. If it keeps happening, sign out and sign back in.
          </p>

          {error.digest && (
            <p className="mt-4 font-mono text-[11px] text-slate-400">
              Reference: {error.digest}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => unstable_retry()}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-700"
            >
              Try again
            </button>
            {/* A plain <a>, not next/link: the router is part of what may have
                failed here, so force a real document request. */}
            <a
              href="/dashboard"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Reload dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
