import { useSyncExternalStore } from "react";

const mq = window.matchMedia("(prefers-color-scheme: dark)");

export function useDark() {
  return useSyncExternalStore(
    (l) => {
      mq.addEventListener("change", l);
      return () => mq.removeEventListener("change", l);
    },
    () => mq.matches,
  );
}
