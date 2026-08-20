"use client";

import { Suspense, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Play, Pause, Square, Languages } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  ApiError,
  callsApi,
  type CallHeader,
  type CallScore,
  type LeadAnalysisDetail,
  type TranscriptTurn,
} from "@/lib/api";
import { cn, VERDICT_TONE } from "@/lib/utils";

const sentimentColor: Record<string, string> = {
  Positive: "bg-emerald-400",
  Neutral: "bg-slate-300",
  Objection: "bg-red-400",
  Negative: "bg-red-400",
};

const compliancePill: Record<string, string> = {
  followed: "bg-emerald-50 text-emerald-700",
  too_early: "bg-amber-50 text-amber-700",
  too_late: "bg-amber-50 text-amber-700",
  skipped: "bg-red-50 text-red-700",
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function fmtTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function ScoreRingCard({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const tone = pct >= 80 ? "text-emerald-600" : pct >= 60 ? "text-amber-600" : "text-red-600";
  return (
    <div className="flex flex-col items-center rounded-xl border border-slate-100 p-4">
      <span className={cn("font-mono text-2xl font-bold", tone)}>{value}</span>
      <span className="text-xs text-slate-400">/{max}</span>
      <span className="mt-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
    </div>
  );
}

function CallAnalysisContent() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();

  const [header, setHeader] = useState<CallHeader | null>(null);
  const [score, setScore] = useState<CallScore | null>(null);
  const [analysis, setAnalysis] = useState<LeadAnalysisDetail | null>(null);
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [translated, setTranslated] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translatedTurns, setTranslatedTurns] = useState<TranscriptTurn[] | null>(null);
  const [sourceLangName, setSourceLangName] = useState<string | null>(null);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  // The Audio object is an imperative handle, not render data — a ref (not
  // state) so seeking/stopping can mutate it directly without tripping the
  // "don't mutate useState values" lint rule.
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  function load() {
    if (!id) {
      setError("No call specified.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([callsApi.header(id), callsApi.score(id), callsApi.leadAnalysis(id), callsApi.transcript(id)])
      .then(([h, s, a, t]) => {
        setHeader(h);
        setScore(s);
        setAnalysis(a);
        setTurns(t.transcript?.turns ?? []);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load call analysis"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  // This page re-renders in place when `id` changes (e.g. navigating between
  // two calls via a Link) rather than remounting, so the audio player state
  // from the previous call was surviving into the new one — togglePlay()
  // would find a leftover `audioEl` and just resume playback of the prior
  // call's recording under the new call's header/transcript. Fetching the
  // recording eagerly (rather than on first click) also means the scrubber
  // knows the real duration before playback ever starts.
  useEffect(() => {
    audioElRef.current?.pause();
    audioElRef.current = null;
    setAudioReady(false);
    setAudioUrl(null);
    setPlaying(false);
    setAudioError(null);
    setDuration(0);
    setCurrentTime(0);

    if (!id) return;
    let cancelled = false;
    setAudioLoading(true);
    callsApi
      .fetchAudioBlob(id)
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        const el = new Audio(url);
        el.onloadedmetadata = () => setDuration(el.duration);
        el.ontimeupdate = () => setCurrentTime(el.currentTime);
        el.onended = () => {
          setPlaying(false);
          setCurrentTime(0);
        };
        el.onplay = () => setPlaying(true);
        el.onpause = () => setPlaying(false);
        setAudioUrl(url);
        audioElRef.current = el;
        setAudioReady(true);
      })
      .catch(() => !cancelled && setAudioError("Recording unavailable."))
      .finally(() => !cancelled && setAudioLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function toggleTranslate() {
    if (translated) {
      setTranslated(false);
      return;
    }
    if (translatedTurns) {
      setTranslated(true);
      return;
    }
    setTranslating(true);
    try {
      const res = await callsApi.translateTranscript(id, "en");
      setTranslatedTurns(res.turns);
      setSourceLangName(res.source_lang_name ?? res.source_lang);
      setTranslated(true);
    } catch {
      // Leave the toggle off — original transcript is still shown, nothing breaks.
    } finally {
      setTranslating(false);
    }
  }

  function togglePlay() {
    const el = audioElRef.current;
    if (!el) return;
    if (playing) el.pause();
    else el.play();
  }

  function handleSeek(e: ChangeEvent<HTMLInputElement>) {
    const t = Number(e.target.value);
    if (audioElRef.current) audioElRef.current.currentTime = t;
    setCurrentTime(t);
  }

  function handleStop() {
    const el = audioElRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    setCurrentTime(0);
  }

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const shownTurns = translated && translatedTurns ? translatedTurns : turns;

  return (
    <div className="pb-10">
      <div className="px-4 pt-6 sm:px-6 lg:px-8">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary-600">
          <ArrowLeft className="size-3.5" /> Back
        </button>
      </div>

      {error && (
        <div className="mt-4 mx-4 sm:mx-6 lg:mx-8 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
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
      ) : header && score ? (
        <>
          <div className="mt-4 px-4 sm:px-6 lg:px-8">
            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-600">AI Call Analysis</p>
                  <h1 className="mt-0.5 text-xl font-bold text-slate-900">
                    {header.lead_name} · {header.telecaller_name ?? "Unknown telecaller"}
                  </h1>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {header.timestamp ? fmtDateTime(header.timestamp) : "—"}
                    {header.duration_label && <> · {header.duration_label}</>}
                  </p>
                </div>
                {score.verdict && (
                  <span className={cn("rounded-full px-3 py-1 text-sm font-semibold", VERDICT_TONE[score.verdict] ?? "bg-slate-100 text-slate-500")}>
                    {score.verdict}
                  </span>
                )}
              </div>
            </Card>
          </div>

          <div className="mt-4 px-4 sm:px-6 lg:px-8">
            <Card className="p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Overall Call Score</h3>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <ScoreRingCard label="Overall" value={score.rings.overall.value} max={score.rings.overall.max} />
                <ScoreRingCard label="Telecaller" value={score.rings.telecaller.value} max={score.rings.telecaller.max} />
                <ScoreRingCard label="Lead Quality" value={score.rings.lead_quality.value} max={score.rings.lead_quality.max} />
                <ScoreRingCard label="Sentiment" value={score.rings.sentiment.value} max={score.rings.sentiment.max} />
              </div>

              <div className="mt-5 border-t border-slate-100 pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Recording</h3>
                {audioError ? (
                  <p className="mt-3 text-sm font-medium text-red-600">{audioError}</p>
                ) : (
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={togglePlay}
                      disabled={!audioReady || audioLoading}
                      aria-label={playing ? "Pause call recording" : "Play call recording"}
                      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white shadow-sm transition-all hover:bg-primary-700 hover:shadow active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {audioLoading ? (
                        <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      ) : playing ? (
                        <Pause className="size-4" fill="currentColor" />
                      ) : (
                        <Play className="ml-0.5 size-4" fill="currentColor" />
                      )}
                    </button>

                    <button
                      onClick={handleStop}
                      disabled={!audioReady || (!playing && currentTime === 0)}
                      aria-label="Stop and rewind recording"
                      className="flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Square className="size-3.5" fill="currentColor" />
                    </button>

                    <div className="min-w-0 flex-1 pl-1">
                      <div className="relative flex h-4 items-center">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-primary-600 transition-[width] duration-150"
                            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                          />
                        </div>
                        <div
                          className="pointer-events-none absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-primary-600 shadow ring-2 ring-white transition-[left] duration-150"
                          style={{ left: `calc(${duration > 0 ? (currentTime / duration) * 100 : 0}% - 6px)` }}
                        />
                        <input
                          type="range"
                          min={0}
                          max={duration || 0}
                          step={0.1}
                          value={currentTime}
                          onChange={handleSeek}
                          disabled={!duration}
                          aria-label="Seek recording"
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                        />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between font-mono text-[11px] tabular-nums text-slate-400">
                        <span>{fmtTime(currentTime)}</span>
                        <span>{duration ? fmtTime(duration) : audioLoading ? "Loading…" : "0:00"}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {score.sentiment_timeline.segments.length > 0 && (
            <div className="mt-4 px-4 sm:px-6 lg:px-8">
              <Card className="p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sentiment Across The Call</h3>
                <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full">
                  {score.sentiment_timeline.segments.map((s) => (
                    <div
                      key={s.index}
                      className={cn("h-full", sentimentColor[s.label] ?? "bg-slate-300")}
                      style={{ width: `${Math.max(2, ((s.t1_sec - s.t0_sec) / Math.max(1, score.sentiment_timeline.segments.at(-1)!.t1_sec)) * 100)}%` }}
                      title={`${s.label} · ${s.t0}`}
                    />
                  ))}
                </div>
                <p className="mt-2 text-sm text-slate-500">{score.sentiment_timeline.caption}</p>
              </Card>
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-2">
            <Card className="p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Score Breakdown</h3>
              <div className="mt-3 flex flex-col gap-3">
                {score.breakdown.map((d) => (
                  <div key={d.key}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{d.label}</span>
                      <span className="font-mono text-slate-500">
                        {d.score}/{d.max}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-primary-500" style={{ width: `${(d.score / d.max) * 100}%` }} />
                    </div>
                    {d.note && <p className="mt-1 text-xs text-slate-400">{d.note}</p>}
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Script Compliance</h3>
              {score.script_compliance.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">No script checklist for this call.</p>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  {score.script_compliance.map((c, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                      <span className="text-slate-700">{c.step}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", compliancePill[c.status])}>
                        {c.status.replace("_", " ")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {analysis?.call_summary && (
            <div className="mt-4 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-2">
              <Card className="p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Key Points Discussed</h3>
                <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm text-slate-700">
                  {analysis.call_summary.key_moments.map((k, i) => (
                    <li key={i}>{k}</li>
                  ))}
                </ul>
              </Card>
              <Card className="p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Objections Raised</h3>
                {analysis.call_summary.objections_raised.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-400">None raised on this call.</p>
                ) : (
                  <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm text-slate-700">
                    {analysis.call_summary.objections_raised.map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card className="p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Commitments Made</h3>
                {analysis.call_summary.commitments_made.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-400">None made on this call.</p>
                ) : (
                  <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm text-slate-700">
                    {analysis.call_summary.commitments_made.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card className="p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Suggested Next Step</h3>
                {analysis.next_action ? (
                  <div className="mt-3 rounded-lg bg-primary-50 px-3 py-2.5 text-sm text-primary-800">
                    <span className="font-semibold">{analysis.next_action.recommended_action}</span>
                    <span className="block text-xs text-primary-600">
                      via {analysis.next_action.channel} · {analysis.next_action.urgency}
                    </span>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-400">No next step suggested.</p>
                )}
              </Card>
            </div>
          )}

          <div className="mt-4 px-4 sm:px-6 lg:px-8">
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2 p-5 pb-3">
                <h3 className="text-sm font-semibold text-slate-900">Transcript</h3>
                <Button variant="outline" size="sm" onClick={toggleTranslate} disabled={translating}>
                  <Languages className="size-3.5" />
                  {translating ? "Translating…" : translated ? "Show Original" : "Translate To English"}
                </Button>
              </div>
              {translated && sourceLangName && (
                <p className="px-5 pb-2 text-xs text-slate-400">Translated from {sourceLangName}</p>
              )}
              {shownTurns.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-400">No transcript available.</p>
              ) : (
                <div className="mt-1 flex flex-col gap-3 px-5 pb-5">
                  {shownTurns.map((t, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="w-10 shrink-0 font-mono text-xs text-slate-400">{t.timestamp}</span>
                      <div>
                        <span className={cn("text-xs font-semibold uppercase tracking-wide", t.role === "AGENT" ? "text-primary-600" : "text-slate-500")}>
                          {t.role === "AGENT" ? "Telecaller" : "Lead"}
                        </span>
                        <p className="text-sm text-slate-700">{t.content_translated ?? t.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      ) : (
        !error && <p className="mt-6 px-4 text-sm text-slate-400 sm:px-6 lg:px-8">Call not found.</p>
      )}
    </div>
  );
}

export default function CallAnalysisPage() {
  return (
    <Suspense fallback={<div className="px-4 pt-6 sm:px-6 lg:px-8"><Skeleton block className="h-8 w-64" /></div>}>
      <CallAnalysisContent />
    </Suspense>
  );
}
