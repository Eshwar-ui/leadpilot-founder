"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, RefreshCw, Send } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  ApiError,
  callsApi,
  type CallScore,
  type ChatWithCallResponse,
  type LeadAnalysisDetail,
  type MemoryBubble,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const verdictTone: Record<string, string> = {
  Hot: "bg-emerald-50 text-emerald-600",
  Warm: "bg-blue-50 text-blue-600",
  Cold: "bg-amber-50 text-amber-600",
  Junk: "bg-red-50 text-red-600",
};

const complianceTone: Record<string, string> = {
  followed: "bg-emerald-50 text-emerald-700",
  too_early: "bg-amber-50 text-amber-700",
  too_late: "bg-amber-50 text-amber-700",
  skipped: "bg-red-50 text-red-700",
};

const complianceLabel: Record<string, string> = {
  followed: "Followed",
  too_early: "Too Early",
  too_late: "Too Late",
  skipped: "Skipped",
};

const sentimentDot: Record<string, string> = {
  positive: "bg-emerald-500",
  neutral: "bg-amber-400",
  negative: "bg-red-500",
};

type ChatEntry = { question: string; answer: string };

export default function CallDetailPage({
  params,
}: {
  params: Promise<{ id: string; callId: string }>;
}) {
  const { id, callId } = use(params);

  const [score, setScore] = useState<CallScore | null>(null);
  const [scoreLoading, setScoreLoading] = useState(true);
  const [scoreError, setScoreError] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<LeadAnalysisDetail | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);

  const [memory, setMemory] = useState<MemoryBubble | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(true);
  const [memoryRebuilding, setMemoryRebuilding] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const [question, setQuestion] = useState("");
  const [chatLog, setChatLog] = useState<ChatEntry[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  function loadScore() {
    setScoreLoading(true);
    setScoreError(null);
    callsApi
      .score(callId)
      .then(setScore)
      .catch((e) => setScoreError(e instanceof ApiError ? e.message : "Failed to load call score"))
      .finally(() => setScoreLoading(false));
  }

  function loadAnalysis() {
    setAnalysisLoading(true);
    callsApi
      .leadAnalysis(callId)
      .then(setAnalysis)
      .catch(() => setAnalysis(null))
      .finally(() => setAnalysisLoading(false));
  }

  function loadMemory() {
    setMemoryLoading(true);
    callsApi
      .memory(callId)
      // 404 = this contact has no memory bubble yet; treat as empty, not an error.
      .then(setMemory)
      .catch(() => setMemory(null))
      .finally(() => setMemoryLoading(false));
  }

  async function handleRebuildMemory() {
    setMemoryRebuilding(true);
    setMemoryError(null);
    try {
      setMemory(await callsApi.rebuildMemory(callId));
    } catch (e) {
      // 404 = no analysed calls to build from, so retrying won't help.
      setMemoryError(
        e instanceof ApiError && e.status === 404
          ? "No analysed calls yet — nothing to rebuild."
          : "Couldn’t rebuild memory. Try again.",
      );
    } finally {
      setMemoryRebuilding(false);
    }
  }

  useEffect(loadScore, [callId]);
  useEffect(loadAnalysis, [callId]);
  useEffect(loadMemory, [callId]);

  useEffect(() => {
    let cancelled = false;
    setAudioError(null);
    callsApi
      .fetchAudioBlob(callId)
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        setAudioUrl(url);
      })
      .catch((e) => !cancelled && setAudioError(e instanceof ApiError ? e.message : "Failed to load audio"));
    return () => {
      cancelled = true;
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, [callId]);

  async function handleAsk() {
    const q = question.trim();
    if (!q) return;
    setChatLoading(true);
    setChatError(null);
    try {
      const res: ChatWithCallResponse = await callsApi.chat(callId, q);
      setChatLog((prev) => [...prev, { question: res.question, answer: res.answer }]);
      setQuestion("");
    } catch (e) {
      setChatError(e instanceof ApiError ? e.message : "Failed to get an answer");
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div className="pb-10">
      <div className="px-4 sm:px-6 lg:px-8 pt-6">
        <Link
          href={`/dashboard/telecallers/performance/${id}`}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft className="size-4" /> Back to Telecaller Profile
        </Link>
      </div>

      <div className="mt-4 flex items-center gap-3 px-4 sm:px-6 lg:px-8">
        <h1 className="text-lg font-bold text-slate-900">Call Detail</h1>
        {score?.verdict && (
          <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", verdictTone[score.verdict] ?? "bg-slate-100 text-slate-500")}>
            {score.verdict}
          </span>
        )}
      </div>
      {score?.relevance_reason && (
        <p className="mt-1 px-4 text-xs text-slate-400 sm:px-6 lg:px-8">Relevance note: {score.relevance_reason}</p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900">Recording</h3>
          {audioError ? (
            <p className="mt-3 text-sm text-red-600">{audioError}</p>
          ) : audioUrl ? (
            <audio className="mt-3 w-full" controls src={audioUrl} />
          ) : (
            <p className="mt-3 text-sm text-slate-400">Loading audio…</p>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900">AI Summary</h3>
          {analysisLoading ? (
            <p className="mt-3 text-sm text-slate-400">Loading summary…</p>
          ) : !analysis?.call_summary ? (
            <p className="mt-3 text-sm text-slate-400">No AI summary available for this call.</p>
          ) : (
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p className="font-medium">{analysis.call_summary.headline}</p>
              {analysis.key_points.length > 0 && (
                <ul className="list-inside list-disc space-y-1 text-slate-600">
                  {analysis.key_points.map((kp, i) => (
                    <li key={i}>{kp}</li>
                  ))}
                </ul>
              )}
              {analysis.next_action && (
                <p className="text-xs text-slate-500">
                  Next: {analysis.next_action.recommended_action} via {analysis.next_action.channel} (
                  {analysis.next_action.urgency})
                </p>
              )}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900">Sentiment Timeline</h3>
          {scoreLoading ? (
            <p className="mt-3 text-sm text-slate-400">Loading…</p>
          ) : scoreError ? (
            <p className="mt-3 text-sm text-red-600">{scoreError}</p>
          ) : (
            <>
              <div className="mt-3 flex h-3 overflow-hidden rounded-full">
                {(score?.sentiment_timeline.segments ?? []).map((seg) => (
                  <div
                    key={seg.index}
                    className={cn("h-full flex-1", sentimentDot[seg.label] ?? "bg-slate-200")}
                    title={`${seg.t0} — ${seg.label} (${seg.avg_score})`}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">{score?.sentiment_timeline.caption}</p>
            </>
          )}
        </Card>
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-slate-900">Memory Bubble</h3>
            {memory?.running_verdict && (
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-medium",
                  verdictTone[memory.running_verdict] ?? "bg-slate-100 text-slate-500",
                )}
              >
                {memory.running_verdict}
              </span>
            )}
            {typeof memory?.total_calls === "number" && (
              <span className="text-xs text-slate-400">
                {memory.total_calls} call{memory.total_calls === 1 ? "" : "s"}
              </span>
            )}
            <Button
              variant="secondary"
              className="ml-auto"
              onClick={handleRebuildMemory}
              disabled={memoryRebuilding}
            >
              <RefreshCw className={cn("size-4", memoryRebuilding && "animate-spin")} />
              {memoryRebuilding ? "Rebuilding…" : "Rebuild"}
            </Button>
          </div>
          {memoryError && <p className="mt-2 text-xs text-red-600">{memoryError}</p>}
          {memoryLoading ? (
            <p className="mt-3 text-sm text-slate-400">Loading memory…</p>
          ) : !memory ? (
            <p className="mt-3 text-sm text-slate-400">
              No cumulative memory for this contact yet.
            </p>
          ) : (
            <div className="mt-3 space-y-4 text-sm">
              {memory.headline && (
                <p className="font-medium text-slate-800">{memory.headline}</p>
              )}

              {memory.facts.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Known facts
                  </p>
                  <ul className="mt-1 list-inside list-disc space-y-1 text-slate-600">
                    {memory.facts.map((f, i) => (
                      <li key={i}>
                        {f.text}
                        {f.category && (
                          <span className="ml-1 text-xs text-slate-400">({f.category})</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {memory.open_objections.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Open objections
                    </p>
                    <ul className="mt-1 list-inside list-disc space-y-1 text-slate-600">
                      {memory.open_objections.map((o, i) => (
                        <li key={i}>{o}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {memory.pending_commitments.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Pending commitments
                    </p>
                    <ul className="mt-1 list-inside list-disc space-y-1 text-slate-600">
                      {memory.pending_commitments.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {memory.next_call_strategy && (
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Next-call strategy
                  </p>
                  <p className="mt-1 text-slate-700">{memory.next_call_strategy}</p>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900">Score Breakdown</h3>
          {scoreLoading ? (
            <p className="mt-3 text-sm text-slate-400">Loading…</p>
          ) : (
            <div className="mt-3 space-y-3">
              {(score?.breakdown ?? []).map((d) => (
                <div key={d.key}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{d.label}</span>
                    <span className="font-mono text-xs text-slate-500">
                      {d.score}/{d.max}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-primary-500"
                      style={{ width: `${d.max ? (100 * d.score) / d.max : 0}%` }}
                    />
                  </div>
                  {d.note && <p className="mt-1 text-xs text-slate-400">{d.note}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900">Script Compliance</h3>
          {scoreLoading ? (
            <p className="mt-3 text-sm text-slate-400">Loading…</p>
          ) : (score?.script_compliance ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">No compliance data for this call.</p>
          ) : (
            <div className="mt-3 divide-y divide-slate-100">
              {(score?.script_compliance ?? []).map((entry) => (
                <div key={entry.step} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <span className="font-medium capitalize text-slate-700">{entry.step.replace("_", " ")}</span>
                    {entry.note && <p className="text-xs text-slate-400">{entry.note}</p>}
                  </div>
                  <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", complianceTone[entry.status] ?? "bg-slate-100 text-slate-500")}>
                    {complianceLabel[entry.status] ?? entry.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900">Chat with this call</h3>
          <p className="mt-1 text-xs text-slate-400">Ask a free-form question — answered only from this call&apos;s transcript and analysis.</p>

          {chatLog.length > 0 && (
            <div className="mt-3 space-y-3">
              {chatLog.map((entry, i) => (
                <div key={i} className="rounded-lg bg-slate-50 p-3 text-sm">
                  <p className="font-medium text-slate-700">Q: {entry.question}</p>
                  <p className="mt-1 text-slate-600">{entry.answer}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !chatLoading && handleAsk()}
              placeholder="e.g. What did the customer say about pricing?"
              className="input flex-1"
            />
            <Button onClick={handleAsk} disabled={chatLoading || !question.trim()}>
              {chatLoading ? "Asking…" : <Send className="size-4" />}
            </Button>
          </div>
          {chatError && <p className="mt-2 text-xs text-red-600">{chatError}</p>}
        </Card>
      </div>
    </div>
  );
}
