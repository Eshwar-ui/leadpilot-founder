"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { Pause, Play, Square, X } from "lucide-react";
import { ApiError, callsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

function fmtTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Playback for one call's recording — the whole thing: fetch, state, controls.
 *
 * Extracted from the Call Analysis page when Lead Detail grew a "Latest Call"
 * section. Two copies would have drifted immediately: the error taxonomy below
 * is the fiddly part, and it has to stay identical on both screens or the same
 * failure explains itself two different ways.
 *
 * Audio needs a Bearer header, which `<audio src="...">` cannot attach — hence
 * fetching a blob and handing an object URL to an Audio element rather than
 * pointing the DOM at the endpoint.
 */
export function CallAudioPlayer({
  callId,
  className,
  stickyLabel,
}: {
  callId: string | null;
  className?: string;
  /** Shown on the docked bar so it's obvious WHICH recording is playing once
   *  the inline player has scrolled out of view. Omit to skip the bar. */
  stickyLabel?: string;
}) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  // The Audio object is an imperative handle, not render data — a ref (not
  // state) so seeking/stopping can mutate it directly without tripping the
  // "don't mutate useState values" lint rule.
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [audioError, setAudioError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [audioLoading, setAudioLoading] = useState(true);
  // Bumped by the Retry button to re-run the fetch effect.
  const [audioAttempt, setAudioAttempt] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);


  // Both host pages re-render in place when `callId` changes (navigating
  // between two calls via a Link) rather than remounting, so player state from
  // the previous call would otherwise survive into the new one — togglePlay()
  // would find a leftover element and resume the PRIOR call's recording under
  // the new call's header. Fetching eagerly (rather than on first click) also
  // means the scrubber knows the real duration before playback starts.
  useEffect(() => {
    audioElRef.current?.pause();
    audioElRef.current = null;
    setAudioReady(false);
    setAudioUrl(null);
    setPlaying(false);
    setAudioError(null);
    setDuration(0);
    setCurrentTime(0);

    if (!callId) return;
    let cancelled = false;
    setAudioLoading(true);
    callsApi
      .fetchAudioBlob(callId)
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
  }, [callId, audioAttempt]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

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

  // Once playback starts the founder scrolls on — through the transcript, the
  // touchpoints, the next lead — and loses the controls. The docked bar keeps
  // play/pause and the position reachable without scrolling back.
  //
  // Portalled to <body> because the inline player is nested inside the
  // scrolling <main>; a fixed element there would still be clipped by an
  // ancestor's overflow. Left offset clears the sidebar, which is static from
  // `lg` and off-canvas below it. Top offset clears the 4rem Topbar.
  const stickyBar =
    // `document` is absent while the page is prerendered to static HTML. No
    // mounted-state flag is needed: the guard below is false on the first
    // render either way (nothing is playing yet and the position is 0), so
    // the portal can never appear during hydration and mismatch.
    typeof document !== "undefined" && stickyLabel && (playing || currentTime > 0) ? (
      createPortal(
        <div className="pointer-events-none fixed inset-x-0 top-16 z-40 px-3 sm:px-5 lg:pl-[17rem]">
          <div className="pointer-events-auto mx-auto flex max-w-5xl items-center gap-3 rounded-b-xl border border-t-0 border-slate-200 bg-white/95 px-4 py-2 shadow-lg backdrop-blur">
            <button
              onClick={togglePlay}
              aria-label={playing ? "Pause call recording" : "Resume call recording"}
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white hover:bg-primary-700"
            >
              {playing ? <Pause className="size-3.5" fill="currentColor" /> : <Play className="ml-0.5 size-3.5" fill="currentColor" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-900">{stickyLabel}</p>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-primary-600"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>
            </div>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-slate-600">
              {fmtTime(currentTime)} / {duration ? fmtTime(duration) : "0:00"}
            </span>
            <button
              onClick={handleStop}
              aria-label="Stop recording and close player bar"
              className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>,
        document.body
      )
    ) : null;

  if (audioError) {
    return (
      <p role="alert" className={cn("text-sm font-medium text-red-700", className)}>
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
    );
  }

  return (
    <>
      {stickyBar}
      <div className={cn("flex items-center gap-2", className)}>
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
    </>
  );
}
