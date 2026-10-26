"use client";

import dynamic from "next/dynamic";
import { useReducedMotionSync } from "@/lib/useReducedMotion";
import { CustomCursor } from "@/interaction/CustomCursor";
import { usePondStore } from "@/store/pondStore";
import { ControlPanel } from "./ControlPanel";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

// WebGL needs the browser: never prerender the canvas.
const PondCanvas = dynamic(() => import("@/scene/PondCanvas"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#0d2a2a]" />,
});

export default function PondApp() {
  useReducedMotionSync();
  useKeyboardShortcuts();
  const paused = usePondStore((s) => s.paused);
  return (
    <main className="pond-root fixed inset-0 overflow-hidden bg-[#0d2a2a] select-none">
      <PondCanvas />
      <ControlPanel />
      {paused && (
        <div
          role="status"
          className="pointer-events-none absolute top-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/15 bg-black/40 px-4 py-1.5 text-xs tracking-[0.2em] text-white/85 uppercase backdrop-blur-md"
        >
          Paused
        </div>
      )}
      <CustomCursor />
    </main>
  );
}
