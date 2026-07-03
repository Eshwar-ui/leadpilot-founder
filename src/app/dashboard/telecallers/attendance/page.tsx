import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { attendance } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export default function AttendancePage() {
  const warnings = attendance.filter((a) => a.status === "warn");

  return (
    <div className="pb-10">
      <PageHeader
        title="Attendance & Shift Monitor"
        description="Login · first call · idle time · active hours per telecaller today"
      />

      <div className="mt-4 space-y-3 px-4 sm:px-6 lg:px-8">
        {warnings.map((w) => (
          <div key={w.id} className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle className="size-5 shrink-0 text-amber-500" />
            <p className="text-sm text-amber-800">
              <span className="font-semibold text-amber-900">{w.name}</span> has exceeded idle threshold on{" "}
              <span className="font-semibold">{w.pattern?.replace("d pattern", " consecutive days")}</span>. Pattern
              may indicate disengagement — escalate to manager.
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3">Telecaller</th>
                <th className="px-3 py-3 text-right">Login</th>
                <th className="px-3 py-3 text-right">First Call</th>
                <th className="px-3 py-3 text-right">Breaks</th>
                <th className="px-3 py-3 text-right">Active Hours</th>
                <th className="px-3 py-3 text-right">Idle Hours</th>
                <th className="px-5 py-3 text-right">Idle 3-Day Pattern</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attendance.map((a) => (
                <tr key={a.id} className={cn(a.status === "warn" && "bg-amber-50/50")}>
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-2 font-semibold text-slate-900">
                      <span className={cn("size-2 rounded-full", a.status === "warn" ? "bg-red-500" : "bg-emerald-500")} />
                      {a.name}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-600">{a.login}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-400">{a.firstCall}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-600">{a.breaks}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-emerald-600">{a.active}</td>
                  <td
                    className={cn(
                      "px-3 py-3 text-right font-mono tabular-nums",
                      a.status === "warn" ? "text-amber-600" : "text-slate-600"
                    )}
                  >
                    {a.idle}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {a.pattern ? <Badge tone="warning">{a.pattern} ⚠</Badge> : <span className="text-xs text-slate-400">OK</span>}
                  </td>
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
