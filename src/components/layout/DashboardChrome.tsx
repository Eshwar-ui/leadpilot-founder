"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export function DashboardChrome({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);

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
