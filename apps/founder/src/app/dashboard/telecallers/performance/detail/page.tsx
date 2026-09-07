"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, KeyRound, Pencil, PlayCircle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { InfoTip } from "@/components/ui/InfoTip";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { SkillRadar } from "@/components/charts/SkillRadar";
import { EditTelecallerModal, ResetPasswordModal, ROLE_LABEL } from "@/components/team/TeamMemberModals";
import { ApiError, teamApi, telecallersApi, type TeamMember, type TelecallerPerformanceDetail } from "@/lib/api";
import { cn, formatINR, formatSeconds, initials, TELECALLER_STATUS_DOT, TELECALLER_STATUS_PILL, VERDICT_TONE } from "@/lib/utils";

// The three call lists are tabs over one dataset, not three datasets. Each
// carries its own explanation because "Needs Review" in particular is easy to
// misread as "the lead is bad" when it's actually about the TELECALLER's
// handling of the call.
const CALL_TABS = [
  {
    key: "all" as const,
    label: "All Calls",
    help: "Every call this telecaller made, newest first. Calls still waiting on AI analysis show as 'Not scored' rather than being hidden.",
  },
  {
    key: "best" as const,
    label: "Best Calls",
    help: "Their five highest-scoring calls. The score rates how the TELECALLER handled the conversation — opening, discovery, pitch, objections, closing — not how good the lead was.",
  },
  {
    key: "review" as const,
    label: "Needs Review",
    help: "Their five lowest-scoring calls — the ones worth listening back to for coaching. A low score is about the handling of the call, not a verdict on the lead.",
  },
];

type CallTabKey = (typeof CALL_TABS)[number]["key"];

function callRowsFor(tab: CallTabKey, detail: TelecallerPerformanceDetail) {
  switch (tab) {
    case "best":
      return detail.best_calls;
    case "review":
      return detail.needs_review;
    default:
      return detail.timeline;
  }
}

function emptyCallMessage(tab: CallTabKey) {
  // Best/Needs Review rank on the AI's agent debrief, so they're empty until
  // something has actually been scored — a different situation from "no calls".
  return tab === "all" ? "No calls yet." : "No scored calls yet.";
}

// The All Calls tab is a preview, not the full history. Ten rows is about
// what fits without the section swallowing the page; "Show more" reveals the
// rest of what the backend sent (it caps `timeline` at 20), and "View full
// call log" goes to the paginated, date-filterable page for everything older.
const CALL_ROWS_VISIBLE = 10;

// NULLABLE: a call keeps its timestamp only once the recording has been
// ingested, so a just-uploaded call arrives here with none — `new Date(null)`
// would silently print "01 Jan 1970" instead of admitting it isn't known yet.
function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Date only — for "when was this lead added", where the time of day is noise. */
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtChartDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function TelecallerDetailContent() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const [callTab, setCallTab] = useState<CallTabKey>("all");
  const [callRowsExpanded, setCallRowsExpanded] = useState(false);
  const [detail, setDetail] = useState<TelecallerPerformanceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Role/active-status live on the team member record, not the performance
  // payload — fetched separately (same /api/team list Settings > Users
  // already uses) so the edit modal has real current values, not guesses.
  const [member, setMember] = useState<TeamMember | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  function load() {
    if (!id) {
      setError("No telecaller specified.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    telecallersApi
      .performanceDetail(id)
      .then(setDetail)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load telecaller"))
      .finally(() => setLoading(false));
    teamApi
      .list()
      .then((members) => setMember(members.find((m) => m.id === id) ?? null))
      .catch(() => setMember(null));
  }

  useEffect(load, [id]);

  // daily_calls is a fixed 14-real-calendar-day window that always ends on
  // "today" (see the backend's own comment on that field) — its last entry
  // is today's count regardless of whatever range is applied elsewhere.
  const todaysCalls = detail?.daily_calls.length ? detail.daily_calls[detail.daily_calls.length - 1].count : 0;
  const newLeadsCount = detail?.leads_assigned.filter((l) => l.pipeline_stage === "New").length ?? 0;
  const callRows = detail ? callRowsFor(callTab, detail) : [];
  const visibleCallRows = callRowsExpanded ? callRows : callRows.slice(0, CALL_ROWS_VISIBLE);

  return (
    <div className="pb-10">
      <div className="px-4 pt-6 sm:px-6 lg:px-8">
        <Link href="/dashboard/telecallers/performance" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary-600">
          <ArrowLeft className="size-3.5" /> Performance Matrix
        </Link>
      </div>

      {error && (
        <div role="alert" className="mt-4 mx-4 sm:mx-6 lg:mx-8 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error} —{" "}
          <button className="font-semibold underline" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="mt-4 px-4 sm:px-6 lg:px-8">
          <Skeleton block className="h-8 w-64" />
          <Skeleton block className="mt-3 h-24 w-full rounded-2xl" />
        </div>
      ) : detail ? (
        <>
          <div className="mt-4 px-4 sm:px-6 lg:px-8">
            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary-700">
                    {initials(detail.name)}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-xl font-bold text-slate-900">{detail.name}</h1>
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", TELECALLER_STATUS_PILL[detail.status])}>
                        <span className={cn("size-1.5 rounded-full", TELECALLER_STATUS_DOT[detail.status])} />
                        {detail.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">
                      Quality {detail.quality}/110
                      {detail.idle_minutes != null && <> · idle {detail.idle_minutes}m</>}
                      {member && <> · {ROLE_LABEL[member.role] ?? member.role}</>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setResetOpen(true)} disabled={!member}>
                    <KeyRound className="size-3.5" /> Reset Password
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} disabled={!member}>
                    <Pencil className="size-3.5" /> Edit
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Three cards, not six. Connected sat at 100% for everyone (it only
              asks whether a transcript exists) and Idle Time was blank off-shift,
              so both cost a card to say nothing. Calls and Today's Calls answer
              the same question at two ranges, so they share one card. */}
          <div className="mt-4 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 sm:grid-cols-3">
            <StatCard
              label="Calls"
              value={String(detail.calls)}
              suffix={`· ${todaysCalls} today`}
              help="Total calls in the selected date range, with today's count beside it. Today's number is always today regardless of the range, so you can see whether they're working right now as well as how much they've done overall."
            />
            <StatCard
              label="New Leads"
              value={String(newLeadsCount)}
              help="Leads currently assigned to them and still sitting at the 'New' stage — nobody has started working these yet. A number that keeps climbing means leads are arriving faster than they're being called."
            />
            <StatCard
              label="Talk Time"
              value={formatSeconds(detail.talk_time_seconds)}
              help="Total time actually spent on the phone across the calls in this range, added up from each call's recorded length. Short talk time next to a high call count usually means calls aren't connecting."
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-2">
            <Card className="p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Calls Made — Last 14 Days</h3>
              <div className="mt-3">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={detail.daily_calls} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <XAxis
                      dataKey="date"
                      tickFormatter={fmtChartDate}
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      axisLine={{ stroke: "#eef0f4" }}
                      tickLine={false}
                      interval={2}
                    />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                    <Tooltip
                      formatter={((v: number) => [v, "Calls"]) as never}
                      labelFormatter={((l: string) => fmtChartDate(l)) as never}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                    />
                    <Bar dataKey="count" fill="#4f6ef2" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Skill Breakdown</h3>
              <SkillRadar
                skills={{
                  opening: detail.dimensions.opening,
                  discovery: detail.dimensions.discovery,
                  pitch: detail.dimensions.pitch,
                  objectionHandling: detail.dimensions.objection_handling,
                  closing: detail.dimensions.closing,
                }}
              />
            </Card>
          </div>

          {/* Call Log, Best Calls and Needs Review were three separate cards
              over the same set of calls, each showing a date and one number.
              They're one section with tabs now, and every row carries who the
              call was with, their number, how long it ran and what it scored —
              so the founder can triage without opening each call. */}
          <div className="mt-4 px-4 sm:px-6 lg:px-8">
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
                <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Calls">
                  {CALL_TABS.map((t) => {
                    const rows = callRowsFor(t.key, detail);
                    const active = callTab === t.key;
                    return (
                      <button
                        key={t.key}
                        role="tab"
                        aria-selected={active}
                        onClick={() => {
                          setCallTab(t.key);
                          setCallRowsExpanded(false);
                        }}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                          active ? "bg-primary-600 text-white" : "text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        {t.label}
                        <span
                          className={cn(
                            "rounded-full px-1.5 font-mono text-[10px] font-bold",
                            active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                          )}
                        >
                          {rows.length}
                        </span>
                      </button>
                    );
                  })}
                  <InfoTip
                    className="ml-1"
                    label="What these tabs mean"
                    text={CALL_TABS.find((t) => t.key === callTab)?.help ?? ""}
                  />
                </div>
                <Link
                  href={`/dashboard/telecallers/performance/detail/call-log?id=${id}&name=${encodeURIComponent(detail.name)}`}
                  className="shrink-0 text-xs font-semibold text-primary-600 hover:underline"
                >
                  View full call log →
                </Link>
              </div>

              {callRows.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-600">{emptyCallMessage(callTab)}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        <th className="px-5 py-2.5">Lead</th>
                        <th className="px-3 py-2.5">Date &amp; time</th>
                        <th className="px-3 py-2.5">Duration</th>
                        <th className="px-3 py-2.5">Verdict</th>
                        <th className="px-5 py-2.5 text-right">Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleCallRows.map((c) => (
                        <tr
                          key={c.call_id}
                          onClick={() => router.push(`/dashboard/calls/detail?id=${c.call_id}`)}
                          className="cursor-pointer hover:bg-slate-50"
                        >
                          <td className="px-5 py-3">
                            <span className="flex items-center gap-1.5 font-medium text-slate-900">
                              {c.lead_name}
                              {c.has_audio && (
                                <PlayCircle className="size-3.5 text-emerald-600" aria-label="Recording available" />
                              )}
                            </span>
                            {c.phone && <span className="block font-mono text-xs text-slate-600">{c.phone}</span>}
                          </td>
                          <td className="px-3 py-3 font-mono text-xs text-slate-600">{fmtDateTime(c.timestamp)}</td>
                          <td className="px-3 py-3 font-mono text-xs text-slate-600">{c.duration_label ?? "—"}</td>
                          <td className="px-3 py-3">
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-xs font-medium",
                                VERDICT_TONE[c.lead_verdict ?? ""] ?? "bg-slate-100 text-slate-600"
                              )}
                            >
                              {c.lead_verdict ?? "Unscored"}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            {c.total_score == null ? (
                              <span className="text-xs text-slate-400">Not scored</span>
                            ) : (
                              <span
                                className={cn(
                                  "font-mono font-bold",
                                  c.total_score >= 70
                                    ? "text-emerald-600"
                                    : c.total_score >= 40
                                      ? "text-slate-700"
                                      : "text-amber-600"
                                )}
                              >
                                {c.total_score}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {callRows.length > CALL_ROWS_VISIBLE && (
                    <div className="border-t border-slate-100 px-5 py-3 text-center">
                      <button
                        onClick={() => setCallRowsExpanded((v) => !v)}
                        className="text-xs font-semibold text-primary-600 hover:underline"
                      >
                        {callRowsExpanded
                          ? "Show fewer"
                          : `Show all ${callRows.length} · ${callRows.length - CALL_ROWS_VISIBLE} more`}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>

          <div className="mt-4 px-4 sm:px-6 lg:px-8">
            <Card className="p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Leads Assigned to {detail.name.split(" ")[0]} · {detail.leads_assigned.length}
                <InfoTip
                  className="ml-1.5"
                  label="What Leads Assigned means"
                  text="Open leads currently sitting with this telecaller — Closed Won, Closed Lost and Junk are excluded. Each row shows when it was last called, so you can spot leads going quiet."
                />
              </h3>
              {detail.leads_assigned.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">No open leads assigned.</p>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  {detail.leads_assigned.map((l) => (
                    <Link
                      key={l.id}
                      href={`/dashboard/leads/detail?id=${l.id}`}
                      className="rounded-lg border border-slate-100 px-3 py-2.5 hover:bg-slate-50"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="block text-sm font-medium text-slate-900">{l.name}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600">
                            {l.phone && <span className="font-mono">{l.phone}</span>}
                            {l.source && <span>· {l.source}</span>}
                            {l.created_at && <span>· Added {fmtDate(l.created_at)}</span>}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            {l.pipeline_stage}
                          </span>
                          {l.deal_value != null && (
                            <span className="font-mono text-xs font-semibold text-slate-700">{formatINR(l.deal_value)}</span>
                          )}
                        </div>
                      </div>

                      {/* "Has anyone actually called this lead?" is the whole
                          reason this list is on a performance page. Silence is
                          the finding, so a never-called lead says so loudly
                          rather than showing an empty row. */}
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs">
                        {l.last_call ? (
                          <>
                            <span className="text-slate-500">Last call</span>
                            <span className="font-mono text-slate-700">{fmtDateTime(l.last_call.timestamp)}</span>
                            {l.last_call.duration_label && (
                              <span className="font-mono text-slate-500">· {l.last_call.duration_label}</span>
                            )}
                            <span
                              className={cn(
                                "rounded-full px-1.5 py-0.5 font-medium",
                                VERDICT_TONE[l.last_call.lead_verdict ?? ""] ?? "bg-slate-100 text-slate-600"
                              )}
                            >
                              {l.last_call.lead_verdict ?? "Unscored"}
                            </span>
                            {l.last_call.total_score != null && (
                              <span className="font-mono text-slate-500">· {l.last_call.total_score}/110</span>
                            )}
                          </>
                        ) : (
                          <span className="font-medium text-amber-700">No calls yet</span>
                        )}
                        <span className="text-slate-400">
                          · {l.days_stuck === 0 ? "updated today" : `${l.days_stuck}d since last update`}
                        </span>
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      ) : (
        !error && <p className="mt-6 px-4 text-sm text-slate-600 sm:px-6 lg:px-8">Telecaller not found.</p>
      )}

      <EditTelecallerModal
        open={editOpen}
        member={member}
        onClose={() => setEditOpen(false)}
        onSaved={setMember}
      />
      <ResetPasswordModal
        open={resetOpen}
        member={member}
        onClose={() => setResetOpen(false)}
      />
    </div>
  );
}

export default function TelecallerDetailPage() {
  return (
    <Suspense fallback={<div className="px-4 pt-6 sm:px-6 lg:px-8"><Skeleton block className="h-8 w-64" /></div>}>
      <TelecallerDetailContent />
    </Suspense>
  );
}
