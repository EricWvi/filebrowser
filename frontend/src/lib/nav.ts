import { useEffect, useLayoutEffect } from "react";
import { navigate as wouterNavigate } from "wouter/use-browser-location";
import { toUrl } from "./paths";

/**
 * In-app history depth lives in history.state, so "返回" knows whether the
 * previous entry belongs to the app; on a fresh tab it goes to the parent.
 */
type NavState = { depth: number } | null;
const depth = () => (history.state as NavState)?.depth ?? 0;

let lastWasPush = false;
window.addEventListener("popstate", () => (lastWasPush = false));
history.scrollRestoration = "manual";

export function go(path: string, search = "") {
  saveScroll();
  lastWasPush = true;
  wouterNavigate(toUrl(path) + search, { state: { depth: depth() + 1 } });
}

export function replaceSearch(search: string) {
  wouterNavigate(location.pathname + search, { replace: true, state: history.state });
}

export const canGoBack = () => depth() > 0;

export function back() {
  saveScroll();
  history.back();
}

// --- scroll restoration -------------------------------------------------------

const scrollKey = () => "scroll:" + location.pathname + location.search;

function saveScroll() {
  sessionStorage.setItem(scrollKey(), String(window.scrollY));
}

/**
 * Restores the scroll position of a page reached with back/forward once its
 * content is ready; pages reached by a link start at the top.
 */
export function useScrollRestore(ready: boolean, key: string) {
  useLayoutEffect(() => {
    if (!ready) return;
    if (lastWasPush) {
      window.scrollTo(0, 0);
      return;
    }
    const y = Number(sessionStorage.getItem(scrollKey()) ?? 0);
    window.scrollTo(0, y);
  }, [ready, key]);

  useEffect(() => {
    let t = 0;
    const on = () => {
      clearTimeout(t);
      t = window.setTimeout(saveScroll, 120);
    };
    window.addEventListener("scroll", on, { passive: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", on);
    };
  }, [key]);
}
