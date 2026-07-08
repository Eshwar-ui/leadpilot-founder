"use client";

import { Megaphone, PlugZap } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";

export default function CampaignOverviewPage() {
  return (
    <div className="pb-10">
      <PageHeader
        title="Campaign Overview"
        description="Live spend, CPL, ROI, and budget guardrails across all active campaigns"
      />

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-primary-50 text-primary-600">
            <Megaphone className="size-6" />
          </span>
          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-slate-900">Coming Soon</h3>
            <p className="mx-auto max-w-md text-sm text-slate-500">
              Campaign spend, CPL, and ROAS will appear here once your Meta and Google Ads
              accounts are connected. This integration is on the roadmap and not yet live.
            </p>
          </div>
          <div className="mt-1 flex items-center gap-2 rounded-full bg-slate-50 px-3.5 py-1.5 text-xs font-medium text-slate-500">
            <PlugZap className="size-3.5" />
            Ad platform integration not connected
          </div>
        </Card>
      </div>
    </div>
  );
}
