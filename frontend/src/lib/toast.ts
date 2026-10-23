import { useSyncExternalStore } from "react";

type Toast = { id: number; text: string } | null;
let current: Toast = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function useToast() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}

export function toast(text: string) {
  const id = Date.now();
  current = { id, text };
  emit();
  setTimeout(() => {
    if (current?.id === id) {
      current = null;
      emit();
    }
  }, 1600);
}

export async function copyText(text: string, done = "已复制") {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Plain-http origins (e.g. LAN during development) have no clipboard API.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  toast(done);
}

export function download(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
