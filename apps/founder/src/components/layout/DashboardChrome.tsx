"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { getStoredUser, getToken } from "@/lib/auth";

const CHANGE_PASSWORD_PATH = "/dashboard/change-password";

export function DashboardChrome({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    // A temp password from an invite/reset must be changed before anything
    // else in the dashboard is reachable — see change-password/page.tsx.
    if (getStoredUser()?.must_reset_password && pathname !== CHANGE_PASSWORD_PATH) {
      router.replace(CHANGE_PASSWORD_PATH);
      return;
    }
    setChecked(true);
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
