import { Phone, IndianRupee, Megaphone } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { leadWastage } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export default function LeadWastagePage() {
  return (
    <div className="pb-10">
      <PageHeader
        title="Lead Wastage Monitor"
        description="Leads that entered the funnel but were never contacted"
      />

      <div className="mt-4 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 sm:grid-cols-3">
        <StatCard label="Total Never Called" value="140" tone="danger" icon={Phone} />
        <StatCard label="Est. Revenue Loss" value="₹3.2L" tone="danger" icon={IndianRupee} />
        <StatCard label="Worst Source" value="Meta (23%)" icon={Megaphone} />
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3">Source</th>
                <th className="px-3 py-3 text-right">Leads In</th>
                <th className="px-3 py-3 text-right">Never Called</th>
                <th className="px-3 py-3 text-right">% Wasted</th>
                <th className="px-5 py-3 text-right">Est. Revenue Loss</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leadWastage.map((w) => (
                <tr key={w.source}>
                  <td className="px-5 py-4 font-semibold text-slate-900">{w.source}</td>
                  <td className="px-3 py-4 text-right font-mono">{w.leadsIn}</td>
                  <td className={cn("px-3 py-4 text-right font-mono font-semibold", w.neverCalled > 10 ? "text-red-600" : "text-slate-700")}>
                    {w.neverCalled}
                  </td>
                  <td className="px-3 py-4 text-right">
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 font-mono text-xs font-semibold",
                        w.wastedPct >= 20 ? "bg-red-50 text-red-600" : w.wastedPct >= 10 ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-600"
                      )}
                    >
                      {w.wastedPct}%
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right font-mono font-semibold text-red-600">{w.revenueLoss}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
