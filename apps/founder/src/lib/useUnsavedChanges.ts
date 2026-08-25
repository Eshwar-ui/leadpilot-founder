"use client";

import { useEffect } from "react";

export const UNSAVED_WARNING = "You have unsaved changes. Leave this page and lose them?";

/**
 * Warns before a dirty form is abandoned.
 *
 * Two listeners are needed because they cover different exits and neither
 * covers the other:
 *
 *  - `beforeunload` handles reload, tab close, and typing a new URL, but does
 *    NOT fire on a client-side route change.
 *  - A capture-phase click handler covers in-app navigation. The links that
 *    actually take you off a settings page live in the Sidebar and Topbar —
 *    components a page can't reach — and the App Router exposes no router-level
 *    navigation blocker, so intercepting the click before it reaches <Link> is
 *    the only way to guard them.
 */
export function useUnsavedChanges(dirty: boolean, message: string = UNSAVED_WARNING) {
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      // Browsers show their own generic wording and ignore whatever we set,
      // but returnValue must be assigned for the prompt to appear at all.
      e.returnValue = message;
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, message]);

  useEffect(() => {
    if (!dirty) return;
    function onClickCapture(e: MouseEvent) {
      // Leave modified clicks (new tab/window), non-primary buttons, and
      // downloads/new-tab links alone — none of them unmount the page.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      if (anchor.origin !== window.location.origin) return;
      if (anchor.pathname === window.location.pathname) return;
      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [dirty, message]);
}
