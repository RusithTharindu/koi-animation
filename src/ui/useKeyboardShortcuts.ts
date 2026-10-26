"use client";

import { useEffect } from "react";
import { INTERACTION_MODES } from "@/config/pond.config";
import { MODE_INFO } from "@/interaction/modes";
import { usePondStore } from "@/store/pondStore";

/** 1-6 pick a cursor mode, P / Space pause, Esc leaves remove mode. */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      // Leave typing and slider keys alone.
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      const store = usePondStore.getState();

      const mode = INTERACTION_MODES.find((m) => MODE_INFO[m].key === e.key);
      if (mode) {
        store.setMode(mode);
        return;
      }
      if (e.key === "p" || e.key === "P" || (e.key === " " && !target?.closest("button"))) {
        e.preventDefault();
        store.setPaused(!store.paused);
      } else if (e.key === "Escape" && store.mode === "remove") {
        store.setMode("ripple");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
