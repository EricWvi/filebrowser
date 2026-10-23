import { useSyncExternalStore } from "react";

const KEY = "filebrowser.showHidden";
const listeners = new Set<() => void>();

const read = () => localStorage.getItem(KEY) === "1";

export function useShowHidden() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
  );
}

export function setShowHidden(v: boolean) {
  localStorage.setItem(KEY, v ? "1" : "0");
  listeners.forEach((l) => l());
}
