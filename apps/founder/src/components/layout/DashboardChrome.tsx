"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { clearSession, getToken } from "@/lib/auth";
import { ApiError, authApi } from "@/lib/api";

const CHANGE_PASSWORD_PATH = "/dashboard/change-password";

export function DashboardChrome({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    // Validate the stored token against the backend rather than trusting its
    // mere presence. A stale session (expired, or pointing at a user removed
    // by a DB reseed) otherwise renders a dashboard that 401s on every fetch.
    authApi
      .me(token)
      .then((user) => {
        if (cancelled) return;
        // A temp password from an invite/reset must be changed before anything
        // else in the dashboard is reachable — see change-password/page.tsx.
        if (user.must_reset_password && pathname !== CHANGE_PASSWORD_PATH) {
          router.replace(CHANGE_PASSWORD_PATH);
          return;
        }
        setChecked(true);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          clearSession();
          router.replace("/login");
        } else {
          // Transient/network error — don't nuke a valid session; let the page
          // render and individual fetches surface the problem.
          setChecked(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  if (!checked) return null;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Topbar onMenuClick={() => setNavOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
        <main className="flex-1 overflow-y-auto bg-slate-50">{children}</main>
      </div>
    </div>
  );
}
