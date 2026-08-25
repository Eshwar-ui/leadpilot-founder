"use client";

import { Suspense, useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, Play, Pause, RotateCw, Square, Languages, User } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  ApiError,
  callsApi,
  type CallHeader,
  type CallScore,
  type LeadAnalysisDetail,
  type ProcessingStatus,
  type ScoreEvidence,
  type TranscriptTurn,
} from "@/lib/api";
import { cn, VERDICT_TONE } from "@/lib/utils";

// How often to re-ask the backend which pipeline stage a call is on. Slow
// enough not to hammer the API, fast enough that Upload → Transcribe →
// Analyse visibly moves while a founder watches.
const POLL_INTERVAL_MS = 4000;

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

// Spoken by whom — the transcript uses AGENT/USER, the evidence quotes reuse
// the same two roles.
const SPEAKER_LABEL: Record<string, string> = { AGENT: "Telecaller", USER: "Lead" };

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function fmtTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** "+4 vs last call" / "−3 vs last call" — `trend` is a POINT DELTA against
 * this contact's previous call, and null when there wasn't one. */
function trendLabel(trend: number | null) {
  if (trend == null) return "No prior call";
  if (trend === 0) return "Same as last call";
  return `${trend > 0 ? "+" : "−"}${Math.abs(trend)} vs last call`;
}

function ScoreRingCard({
  label,
  value,
  max,
  trend,
  muted,
}: {
  label: string;
  value: number;
  max: number;
  trend: number | null;
  // `muted` = the analysis failed and these are the backend's zeroed
  // placeholders, not a real result — render them grey and toneless so nobody
  // reads a persisted failure as a genuine 0.
  muted?: boolean;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const tone = muted
    ? "text-slate-400"
    : pct >= 80
    ? "text-emerald-600"
    : pct >= 60
    ? "text-amber-600"
    : "text-red-600";
  return (
    <div className={cn("flex flex-col items-center rounded-xl border border-slate-100 p-4", muted && "bg-slate-50")}>
      <span className={cn("font-mono text-2xl font-bold", tone)}>{muted ? "—" : value}</span>
      <span className="text-xs text-slate-600">/{max}</span>
      <span className="mt-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {!muted && (
        <span
          className={cn(
            "mt-1 text-[10px] font-medium",
            trend == null ? "text-slate-500" : trend > 0 ? "text-emerald-600" : trend < 0 ? "text-red-600" : "text-slate-500"
          )}
        >
          {trendLabel(trend)}
        </span>
      )}
    </div>
  );
}

/** The auditable quotes the scorer justified a dimension with. Collapsed by
 * default — six dimensions of open quote lists would bury the scores. */
function EvidenceQuotes({ evidence }: { evidence: ScoreEvidence[] }) {
  if (evidence.length === 0) return null;
  return (
    <details className="mt-1.5">
      <summary className="cursor-pointer text-xs font-semibold text-primary-600">
        {evidence.length} quote{evidence.length === 1 ? "" : "s"} from the call
      </summary>
      <ul className="mt-1.5 flex flex-col gap-1.5 border-l-2 border-slate-100 pl-3">
        {evidence.map((e, i) => (
          <li key={i} className="text-xs text-slate-600">
            <span className="font-mono text-[10px] text-slate-500">{e.t}</span>{" "}
            <span className="font-semibold text-slate-700">{SPEAKER_LABEL[e.speaker] ?? e.speaker}:</span>{" "}
            <span className="italic">&ldquo;{e.text}&rdquo;</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Upload → Transcribe → Analyse → Done. Shown while /score and
 * /lead-analysis still 404 — which they do for every call until the pipeline
 * finishes. Never show the founder that raw 404 (it literally reads "Run POST
 * /api/calls/{id}/lead-analysis first"). */
function ProcessingCard({ status, error }: { status: ProcessingStatus | null; error: string | null }) {
  if (error) {
    return (
      <Card className="p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">AI Analysis</h3>
        <p role="alert" className="mt-2 text-sm text-slate-600">
          This call hasn&apos;t been analysed yet, and we couldn&apos;t check its progress. {error}
        </p>
      </Card>
    );
  }
  if (!status) {
    return (
      <Card className="p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">AI Analysis</h3>
        <p className="mt-2 text-sm text-slate-600">Checking where this call is in the pipeline…</p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">AI Analysis</h3>
        <span className="font-mono text-xs font-semibold text-slate-600">{status.percent}%</span>
      </div>

      {status.failed ? (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700">
          Processing failed{status.error ? `: ${status.error}` : "."} Ask the telecaller to re-upload the recording.
        </p>
      ) : (
        <p className="mt-2 text-sm text-slate-600">
          {status.current_stage === "done"
            ? "Processing finished — the scorecard should appear shortly."
            : "Still processing. The scorecard, verdict and coaching notes appear here once it finishes."}
        </p>
      )}

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", status.failed ? "bg-red-500" : "bg-primary-500")}
          style={{ width: `${Math.min(100, Math.max(0, status.percent))}%` }}
        />
      </div>

      <ol className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-3">
        {status.stages.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                s.status === "done"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : s.status === "active"
                  ? "border-primary-600 bg-primary-50 text-primary-700"
                  : s.status === "failed"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-slate-200 bg-white text-slate-500"
              )}
            >
              {s.status === "done" ? (
                <Check className="size-3" />
              ) : s.status === "failed" ? (
                <AlertTriangle className="size-3" />
              ) : s.status === "active" ? (
                <RotateCw className="size-3 animate-spin" />
              ) : (
                i + 1
              )}
            </span>
            <span className={cn("text-xs font-medium", s.status === "pending" ? "text-slate-500" : "text-slate-700")}>
              {s.label}
              {/* Icon + colour alone don't say what state a step is in. */}
              <span className="sr-only"> — {s.status}</span>
            </span>
            {i < status.stages.length - 1 && <span aria-hidden className="ml-1 text-slate-300">→</span>}
          </li>
        ))}
      </ol>
    </Card>
  );
}

function CallAnalysisContent() {
  const id = useSearchParams().get("id") ?? "";

  const [header, setHeader] = useState<CallHeader | null>(null);
  const [score, setScore] = useState<CallScore | null>(null);
  const [analysis, setAnalysis] = useState<LeadAnalysisDetail | null>(null);
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // /score and /lead-analysis 404 for every call until the pipeline finishes.
  // That's a "not ready yet" signal, not a page failure — it switches this
  // page to the progress stepper instead of an error.
  const [awaitingAnalysis, setAwaitingAnalysis] = useState(false);
  const [processing, setProcessing] = useState<ProcessingStatus | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  // Auto-reload at most once per call when the poll reports "done" — a backend
  // that says done while /score still 404s would otherwise spin load() forever.
  const reloadedOnDoneRef = useRef(false);

  const [translated, setTranslated] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translatedTurns, setTranslatedTurns] = useState<TranscriptTurn[] | null>(null);
  const [sourceLangName, setSourceLangName] = useState<string | null>(null);
  const [alreadyEnglish, setAlreadyEnglish] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  // The Audio object is an imperative handle, not render data — a ref (not
  // state) so seeking/stopping can mutate it directly without tripping the
  // "don't mutate useState values" lint rule.
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [audioError, setAudioError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [audioLoading, setAudioLoading] = useState(true);
  // Bumped by the recording's own Retry button to re-run the fetch effect.
  const [audioAttempt, setAudioAttempt] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  function load() {
    // No ?id= can never resolve — load() would re-check this and set the same
    // error forever, so the old Retry button was permanently dead. The
    // dedicated "no call specified" branch below handles it instead.
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setNotFound(false);
    setProcessingError(null);
    // allSettled, NOT all: while a call is being analysed /score and
    // /lead-analysis 404, and Promise.all threw away the header, transcript
    // and recording that HAD loaded along with them — leaving the founder one
    // red banner quoting a raw backend instruction to run an API call. Each
    // resource now stands or falls on its own.
    Promise.allSettled([
      callsApi.header(id),
      callsApi.score(id),
      callsApi.leadAnalysis(id),
      callsApi.transcript(id),
    ])
      .then(([h, s, a, t]) => {
        if (h.status === "fulfilled") {
          setHeader(h.value);
        } else {
          setHeader(null);
          // A 404 on the header is terminal: deleted, or another org's call
          // (the backend scopes by org and 404s rather than 403s). Retrying
          // can only produce the same 404.
          if (h.reason instanceof ApiError && h.reason.status === 404) setNotFound(true);
          else setError(h.reason instanceof ApiError ? h.reason.message : "Failed to load this call.");
        }

        setScore(s.status === "fulfilled" ? s.value : null);
        setAnalysis(a.status === "fulfilled" ? a.value : null);
        setTurns(t.status === "fulfilled" ? t.value.transcript?.turns ?? [] : []);

        // Header loaded but no score = the pipeline hasn't produced one yet.
        // Ask the processing endpoint what stage it's on.
        setAwaitingAnalysis(h.status === "fulfilled" && s.status === "rejected");
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  useEffect(() => {
    reloadedOnDoneRef.current = false;
    setProcessing(null);
  }, [id]);

  // Poll Upload → Transcribe → Analyse → Done while the call is still being
  // processed. Stops on "done", on a reported failure, and on unmount.
  useEffect(() => {
    if (!id || !awaitingAnalysis) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      try {
        const status = await callsApi.processingStatus(id);
        if (cancelled) return;
        setProcessing(status);
        setProcessingError(null);
        if (status.failed) return; // terminal — the card shows the error
        if (status.current_stage === "done") {
          setAwaitingAnalysis(false);
          if (!reloadedOnDoneRef.current) {
            reloadedOnDoneRef.current = true;
            load(); // the scorecard exists now — go get it
          }
          return;
        }
        timer = setTimeout(tick, POLL_INTERVAL_MS);
      } catch (e) {
        if (cancelled) return;
        // Don't retry-loop a broken status endpoint; say so once and stop.
        setProcessingError(e instanceof ApiError ? e.message : "Couldn't check this call's progress.");
      }
    }

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // `load` is deliberately not a dependency: it closes over nothing but `id`
    // (already a dep) and state setters, and listing it would restart the poll
    // on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, awaitingAnalysis]);

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
      .catch((e) => {
        if (cancelled) return;
        // Every cause used to collapse into "Recording unavailable." — a call
        // that was simply never recorded read exactly like an unreachable
        // server, and neither offered a way to try again. Split them, and
        // offer Retry only where a retry could change the outcome.
        if (e instanceof ApiError) {
          if (e.status === 404) setAudioError({ message: "No recording was uploaded for this call.", retryable: false });
          else if (e.status === 401)
            setAudioError({ message: "Your session has expired. Sign in again to play this recording.", retryable: false });
          else if (e.status === 403)
            setAudioError({ message: "You don't have access to this recording.", retryable: false });
          else if (e.status >= 500)
            setAudioError({ message: "The server couldn't return this recording.", retryable: true });
          else setAudioError({ message: e.message, retryable: true });
        } else {
          // fetchAudioBlob uses a bare fetch(), which throws (not rejects with
          // a status) when the server is unreachable.
          setAudioError({ message: "Couldn't reach the server to load this recording.", retryable: true });
        }
      })
      .finally(() => !cancelled && setAudioLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, audioAttempt]);

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
    setTranslateError(null);
    try {
      const res = await callsApi.translateTranscript(id, "en");
      setTranslatedTurns(res.turns);
      // When the transcript is already English the backend sets
      // already_in_target and sends no source_lang_name — falling back to
      // source_lang made the banner claim "Translated from en", a translation
      // that never happened.
      setAlreadyEnglish(res.already_in_target);
      setSourceLangName(res.already_in_target ? null : res.source_lang_name ?? res.source_lang);
      setTranslated(true);
    } catch (e) {
      // Was a bare `catch {}`: the spinner stopped, the toggle snapped back and
      // the founder was never told anything had failed.
      setTranslateError(e instanceof ApiError ? e.message : "Couldn't translate this transcript. Try again.");
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
  // "failed" means the numbers in `score` are the zeroed placeholder the
  // backend persists when the AI pipeline errored — never a real 0/100.
  const analysisFailed = score?.analysis_status === "failed";

  // router.back() breaks on a direct link (a shared URL, a new tab, an email
  // link) — there's no history entry to go back to. Always link somewhere real,
  // preferring the lead this call belongs to.
  const backHref = header?.lead_id ? `/dashboard/leads/detail?id=${header.lead_id}` : "/dashboard/leads";
  const backLabel = header?.lead_id ? `Back to ${header.lead_name}` : "All Leads";

  if (!id || notFound) {
    return (
      <div className="pb-10">
        <div className="px-4 pt-6 sm:px-6 lg:px-8">
          <Link href="/dashboard/leads" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary-600">
            <ArrowLeft className="size-3.5" /> All Leads
          </Link>
        </div>
        <div className="mt-4 px-4 sm:px-6 lg:px-8">
          <Card className="p-6">
            <h1 className="text-base font-semibold text-slate-900">{id ? "Call not found" : "No call specified"}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {id
                ? "This call has been deleted, or it belongs to another organisation."
                : "This page needs a call to open. Open one from a lead's touchpoints or a telecaller's call log."}
            </p>
            <Link href="/dashboard/leads" className="mt-4 inline-block">
              <Button size="sm">Go to All Leads</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <div className="px-4 pt-6 sm:px-6 lg:px-8">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary-600">
          <ArrowLeft className="size-3.5" /> {backLabel}
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
      ) : header ? (
        <>
          <div className="mt-4 px-4 sm:px-6 lg:px-8">
            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-600">AI Call Analysis</p>
                  <h1 className="mt-0.5 text-xl font-bold text-slate-900">
                    {header.lead_name} · {header.telecaller_name ?? "Unknown telecaller"}
                  </h1>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {header.timestamp ? fmtDateTime(header.timestamp) : "—"}
                    {header.duration_label && <> · {header.duration_label}</>}
                  </p>
                  {header.lead_id && (
                    <Link
                      href={`/dashboard/leads/detail?id=${header.lead_id}`}
                      className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline"
                    >
                      <User className="size-3.5" /> Open {header.lead_name}&apos;s full lead record →
                    </Link>
                  )}
                </div>
                {score && !analysisFailed && score.verdict && (
                  <div className="text-right">
                    <span className={cn("rounded-full px-3 py-1 text-sm font-semibold", VERDICT_TONE[score.verdict] ?? "bg-slate-100 text-slate-600")}>
                      {score.verdict}
                    </span>
                    {score.relevance_reason && (
                      <p className="mt-1 max-w-xs text-xs text-slate-600">{score.relevance_reason}</p>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {analysisFailed && (
            <div className="mt-4 px-4 sm:px-6 lg:px-8">
              <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-500" />
                <div className="text-sm text-red-800">
                  <p className="font-semibold">AI analysis failed for this call — the scores below are not real.</p>
                  <p className="mt-1">
                    The backend saved a zeroed placeholder when the pipeline errored, so treat every number here as
                    &ldquo;not scored&rdquo;, not as a 0.
                    {score?.analysis_error ? ` Reason: ${score.analysis_error}` : ""}
                  </p>
                  <p className="mt-1">The recording and transcript below are unaffected. Re-run the analysis to get a real score.</p>
                </div>
              </div>
            </div>
          )}

          {/* Recording lives in its own card, outside the score section, so a
              call that hasn't been analysed yet still plays. */}
          <div className="mt-4 px-4 sm:px-6 lg:px-8">
            <Card className="p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recording</h3>
              {audioError ? (
                <p role="alert" className="mt-3 text-sm font-medium text-red-700">
                  {audioError.message}
                  {audioError.retryable && (
                    <>
                      {" "}
                      <button className="font-semibold underline" onClick={() => setAudioAttempt((n) => n + 1)}>
                        Retry
                      </button>
                    </>
                  )}
                </p>
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
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
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
                    <div className="mt-1.5 flex items-center justify-between font-mono text-[11px] tabular-nums text-slate-600">
                      <span>{fmtTime(currentTime)}</span>
                      <span>{duration ? fmtTime(duration) : audioLoading ? "Loading…" : "0:00"}</span>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {!score ? (
            <div className="mt-4 px-4 sm:px-6 lg:px-8">
              <ProcessingCard status={processing} error={processingError} />
            </div>
          ) : (
            <>
              <div className="mt-4 px-4 sm:px-6 lg:px-8">
                <Card className="p-5" aria-disabled={analysisFailed || undefined}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Overall Call Score</h3>
                    <span className="font-mono text-sm font-bold text-slate-700">
                      {analysisFailed ? "Not scored" : `${score.call_score}/100`}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <ScoreRingCard
                      label="Overall"
                      value={score.rings.overall.value}
                      max={score.rings.overall.max}
                      trend={score.rings.overall.trend}
                      muted={analysisFailed}
                    />
                    <ScoreRingCard
                      label="Telecaller"
                      value={score.rings.telecaller.value}
                      max={score.rings.telecaller.max}
                      trend={score.rings.telecaller.trend}
                      muted={analysisFailed}
                    />
                    <ScoreRingCard
                      label="Lead Quality"
                      value={score.rings.lead_quality.value}
                      max={score.rings.lead_quality.max}
                      trend={score.rings.lead_quality.trend}
                      muted={analysisFailed}
                    />
                    <ScoreRingCard
                      label="Sentiment"
                      value={score.rings.sentiment.value}
                      max={score.rings.sentiment.max}
                      trend={score.rings.sentiment.trend}
                      muted={analysisFailed}
                    />
                  </div>
                </Card>
              </div>

              {!analysisFailed && (score.strengths.length > 0 || score.improvements.length > 0) && (
                <div className="mt-4 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-2">
                  <Card className="p-5">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">What Went Well</h3>
                    {score.strengths.length === 0 ? (
                      <p className="mt-3 text-sm text-slate-600">Nothing flagged as a strength on this call.</p>
                    ) : (
                      <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm text-slate-700">
                        {score.strengths.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    )}
                  </Card>
                  <Card className="p-5">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">What To Coach</h3>
                    {score.improvements.length === 0 ? (
                      <p className="mt-3 text-sm text-slate-600">No coaching points raised on this call.</p>
                    ) : (
                      <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm text-slate-700">
                        {score.improvements.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    )}
                  </Card>
                </div>
              )}

              {score.sentiment_timeline.segments.length > 0 && (
                <div className="mt-4 px-4 sm:px-6 lg:px-8">
                  <Card className="p-5">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sentiment Across The Call</h3>
                    <div
                      role="img"
                      aria-label={`Sentiment by segment: ${score.sentiment_timeline.segments.map((s) => `${s.t0} ${s.label}`).join(", ")}`}
                      className="mt-3 flex h-3 w-full overflow-hidden rounded-full"
                    >
                      {score.sentiment_timeline.segments.map((s) => (
                        <div
                          key={s.index}
                          className={cn("h-full", sentimentColor[s.label] ?? "bg-slate-300")}
                          style={{ width: `${Math.max(2, ((s.t1_sec - s.t0_sec) / Math.max(1, score.sentiment_timeline.segments.at(-1)!.t1_sec)) * 100)}%` }}
                          title={`${s.label} · ${s.t0}`}
                        />
                      ))}
                    </div>
                    {/* The bar encodes sentiment in colour alone — this is the
                        same data as readable text. */}
                    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                      {score.sentiment_timeline.segments.map((s) => (
                        <li key={s.index}>
                          <span className="font-mono text-slate-500">{s.t0}</span> {s.label}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-sm text-slate-600">{score.sentiment_timeline.caption}</p>
                  </Card>
                </div>
              )}

              <div className="mt-4 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-2">
                <Card className="p-5" aria-disabled={analysisFailed || undefined}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Score Breakdown</h3>
                  {analysisFailed && (
                    <p className="mt-2 text-xs font-medium text-red-700">Greyed out — analysis failed, these are placeholders.</p>
                  )}
                  <div className="mt-3 flex flex-col gap-3">
                    {score.breakdown.map((d) => (
                      <div key={d.key}>
                        <div className="flex items-center justify-between text-sm">
                          <span className={cn("font-medium", analysisFailed ? "text-slate-500" : "text-slate-700")}>{d.label}</span>
                          <span className="font-mono text-slate-600">{analysisFailed ? `—/${d.max}` : `${d.score}/${d.max}`}</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={cn("h-full rounded-full", analysisFailed ? "bg-slate-200" : "bg-primary-500")}
                            style={{ width: analysisFailed ? "100%" : `${(d.score / d.max) * 100}%` }}
                          />
                        </div>
                        {d.note && <p className="mt-1 text-xs text-slate-600">{d.note}</p>}
                        {/* The scorer's own auditable quotes — the reason a
                            dimension got the score it did. */}
                        {!analysisFailed && <EvidenceQuotes evidence={d.evidence} />}
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Script Compliance</h3>
                  {score.script_compliance.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-600">No script checklist for this call.</p>
                  ) : (
                    <div className="mt-3 flex flex-col gap-2">
                      {score.script_compliance.map((c, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                          <span className="text-slate-700">{c.step}</span>
                          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", compliancePill[c.status] ?? "bg-slate-100 text-slate-600")}>
                            {c.status.replace("_", " ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </>
          )}

          {analysis?.call_summary && (
            <div className="mt-4 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 lg:grid-cols-2">
              <Card className="p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Key Points Discussed</h3>
                <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm text-slate-700">
                  {analysis.call_summary.key_moments.map((k, i) => (
                    <li key={i}>{k}</li>
                  ))}
                </ul>
              </Card>
              <Card className="p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Objections Raised</h3>
                {analysis.call_summary.objections_raised.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-600">None raised on this call.</p>
                ) : (
                  <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm text-slate-700">
                    {analysis.call_summary.objections_raised.map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card className="p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Commitments Made</h3>
                {analysis.call_summary.commitments_made.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-600">None made on this call.</p>
                ) : (
                  <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm text-slate-700">
                    {analysis.call_summary.commitments_made.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card className="p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested Next Step</h3>
                {analysis.next_action ? (
                  <div className="mt-3 rounded-lg bg-primary-50 px-3 py-2.5 text-sm text-primary-800">
                    <span className="font-semibold">{analysis.next_action.recommended_action}</span>
                    <span className="block text-xs text-primary-600">
                      via {analysis.next_action.channel} · {analysis.next_action.urgency}
                    </span>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">No next step suggested.</p>
                )}
              </Card>
            </div>
          )}

          <div className="mt-4 px-4 sm:px-6 lg:px-8">
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2 p-5 pb-3">
                <h3 className="text-sm font-semibold text-slate-900">Transcript</h3>
                <Button variant="outline" size="sm" onClick={toggleTranslate} disabled={translating || shownTurns.length === 0}>
                  <Languages className="size-3.5" />
                  {translating ? "Translating…" : translated ? "Show Original" : "Translate To English"}
                </Button>
              </div>
              {translateError && (
                <p role="alert" className="px-5 pb-2 text-xs font-medium text-red-700">
                  {translateError}
                </p>
              )}
              {translated && (alreadyEnglish || sourceLangName) && (
                <p className="px-5 pb-2 text-xs text-slate-600">
                  {alreadyEnglish ? "Already in English — nothing to translate." : `Translated from ${sourceLangName}`}
                </p>
              )}
              {shownTurns.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-600">
                  {awaitingAnalysis ? "The transcript appears once this call has been transcribed." : "No transcript available."}
                </p>
              ) : (
                <div className="mt-1 flex flex-col gap-3 px-5 pb-5">
                  {shownTurns.map((t, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="w-10 shrink-0 font-mono text-xs text-slate-600">{t.timestamp}</span>
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
        !error && <p className="mt-6 px-4 text-sm text-slate-600 sm:px-6 lg:px-8">Call not found.</p>
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
