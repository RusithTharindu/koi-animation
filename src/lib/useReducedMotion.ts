"use client";

import { useEffect } from "react";
import { usePondStore } from "@/store/pondStore";

/** Mirrors `prefers-reduced-motion` into the pond store. */
export function useReducedMotionSync() {
  const setReducedMotion = usePondStore((s) => s.setReducedMotion);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [setReducedMotion]);
}
