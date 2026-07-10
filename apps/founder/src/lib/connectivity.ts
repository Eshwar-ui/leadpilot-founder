// Global "can the app reach the backend" store, fed by every request in
// api.ts (see markReachable/markUnreachable there) and read by
// <ConnectivityBanner> via useSyncExternalStore. A plain module-level store
// rather than React context because api.ts's request()/authedRequest() are
// not components — they need to push a signal into React from outside it.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Listener = () => void;

let reachable = true;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener();
}

/** Called on any response below 500 — proof the server is up. */
export function markReachable() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (!reachable) {
    reachable = true;
    notify();
  }
}

/** Called on a fetch failure (network/DNS/timeout) or a 5xx response. */
export function markUnreachable() {
  if (reachable) {
    reachable = false;
    notify();
  }
  scheduleRetry();
}

export function subscribeReachability(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getReachableSnapshot(): boolean {
  return reachable;
}

/** Always "reachable" on the server render, so hydration never mismatches
 * on a state that only ever changes client-side. */
export function getServerReachableSnapshot(): boolean {
  return true;
}

// ── Background auto-retry, so the banner clears itself without the user
// having to act, plus a manual retryNow() for the banner's Retry button. ──

let retryTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRetry() {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(attemptRetry, 6000);
}

async function pingHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${API_URL}/health`, { signal: controller.signal });
    clearTimeout(timer);
    return res.status < 500;
  } catch {
    return false;
  }
}

async function attemptRetry() {
  if (await pingHealth()) {
    markReachable();
  } else if (!reachable) {
    scheduleRetry();
  }
}

export function retryNow(): Promise<void> {
  if (retryTimer) clearTimeout(retryTimer);
  return attemptRetry();
}
