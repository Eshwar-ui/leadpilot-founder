import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found — LeadPilot",
};

// Replaces Next's stock, unbranded "404 This page could not be found".
// Handles every unmatched URL in the app, so it is deliberately NOT wrapped in
// DashboardChrome: a 404 can be hit by a signed-out visitor following a stale
// link, and DashboardChrome would bounce them to /login and swallow the 404.
//
// Under `output: "export"` this is emitted as out/404.html. A static host must
// be pointed at that file (e.g. nginx `error_page 404 /404.html`) to actually
// serve it with a 404 status — Firebase Hosting picks up 404.html by default.
//
// No props (Next passes none to not-found) and no headers()/cookies(), which
// are unsupported under static export.
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white px-6 py-10 text-center shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary-50 font-mono text-lg font-bold text-primary-700">
          404
        </span>

        <h1 className="mt-4 text-lg font-bold text-slate-900">Page not found</h1>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">
          This page doesn&apos;t exist, or it moved. Check the address, or head back to your
          dashboard and navigate from the sidebar.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-700"
          >
            Back to dashboard
          </Link>
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
