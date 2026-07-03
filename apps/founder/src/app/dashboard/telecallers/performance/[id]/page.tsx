import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Sparkles, Download, Calendar } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { SkillRadar } from "@/components/charts/SkillRadar";
import { QualityTrendChart } from "@/components/charts/QualityTrendChart";
import { telecallers } from "@/lib/mock-data";
import { formatLakhs, cn } from "@/lib/utils";

const bestCalls = [
  { id: "#419", label: "Perfect close sequence", score: 96 },
  { id: "#405", label: "Objection reframe", score: 94 },
  { id: "#398", label: "Empathy 10/10", score: 93 },
];

const needsReview = [
  { id: "#412", label: "Aggressive tone at 2:30", score: 54 },
  { id: "#388", label: "Script deviation early", score: 61 },
  { id: "#401", label: "No follow-up set", score: 58 },
];

const timeline = [
  { time: "10:02", id: "#421", name: "Rajesh Kumar", duration: "6m 12s", tone: "positive", score: 84 },
  { time: "09:48", id: "#420", name: "Meena Iyer", duration: "3m 44s", tone: "negative", score: 48 },
];

export async function generateStaticParams() {
  return telecallers.map((t) => ({ id: t.id }));
}

export default async function TelecallerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = telecallers.find((tc) => tc.id === id);
  if (!t) notFound();

  const trend = Array.from({ length: 30 }, (_, i) => ({
    day: i + 1,
    quality: Math.min(t.quality, 74 + Math.round((t.quality - 74) * Math.min(1, i / 14))),
  }));

  return (
    <div className="pb-10">
      <div className="px-4 sm:px-6 lg:px-8 pt-6">
        <Link href="/dashboard/telecallers/performance" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ChevronLeft className="size-4" /> Back to Matrix
        </Link>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 px-4 sm:px-6 lg:px-8">
        <Button variant="outline" size="sm">Compare</Button>
        <Button size="sm">
          <Sparkles className="size-3.5" /> Coach
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-4 px-4 sm:px-6 lg:px-8">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary-600 text-lg font-bold text-white">
          {t.initials}
        </span>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t.name}</h1>
          <p className="text-sm text-slate-500">
            {t.languages} · Joined {t.joined} · {t.tenure} · Team: {t.team}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-4">
        <StatCard label="Total Calls" value={t.calls} suffix="MTD" />
        <StatCard label="Positive Rate" value={`${t.positivePct}%`} />
        <StatCard label="Close Rate" value={`${t.closePct}%`} />
        <StatCard label="Avg Handle Time" value={t.talkTime} />
        <StatCard label="Quality Score" value={t.quality} suffix="/100" />
        <StatCard label="Revenue MTD" value={formatLakhs(t.revenue)} />
        <StatCard label="Script Compliance" value={`${t.scriptCompliance}%`} />
        <StatCard
          label="Follow-up Rate"
          value={`${t.followUp}%`}
          delta={t.followUp < 90 ? "below 90% target" : undefined}
          deltaTone="danger"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900">30-Day Quality &amp; Close Rate</h3>
          <QualityTrendChart data={trend} />
          <p className="text-xs text-slate-400">Quality score trend over 30 days · dashed target = 80</p>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900">AI Skill Radar</h3>
          <SkillRadar skills={t.skills} />
          <p className="text-xs text-amber-600">
            ↓ Follow-up ({t.skills.followUp}) — coaching priority
          </p>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-600">Best Calls (AI-selected)</h3>
          <div className="mt-3 divide-y divide-slate-100">
            {bestCalls.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-slate-600">
                  <span className="mr-2 text-slate-400">{c.id}</span>
                  {c.label}
                </span>
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-700">
                  {c.score}
                </span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-red-600">Needs Review (AI-selected)</h3>
          <div className="mt-3 divide-y divide-slate-100">
            {needsReview.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-slate-600">
                  <span className="mr-2 text-slate-400">{c.id}</span>
                  {c.label}
                </span>
                <span className="rounded-md bg-red-50 px-2 py-0.5 font-mono text-xs font-semibold text-red-700">
                  {c.score}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card>
          <div className="flex items-center justify-between p-5 pb-0">
            <h3 className="text-sm font-semibold text-slate-900">Call Timeline — Today</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm"><Calendar className="size-3.5" /> Today</Button>
              <Button variant="outline" size="sm"><Download className="size-3.5" /> CSV</Button>
            </div>
          </div>
          <div className="mt-3 divide-y divide-slate-100">
            {timeline.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-xs text-slate-400">{c.time}</span>
                  <span className="text-xs text-slate-400">{c.id}</span>
                  <span className="font-semibold text-slate-900">{c.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-xs text-slate-500">{c.duration}</span>
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-xs font-medium",
                      c.tone === "positive" ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-600"
                    )}
                  >
                    {c.tone}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-sm font-semibold",
                      c.score >= 70 ? "text-emerald-600" : "text-red-600"
                    )}
                  >
                    {c.score}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
