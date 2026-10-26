"use client";

import dynamic from "next/dynamic";
import { useReducedMotionSync } from "@/lib/useReducedMotion";
import { ControlPanel } from "./ControlPanel";

// WebGL needs the browser: never prerender the canvas.
const PondCanvas = dynamic(() => import("@/scene/PondCanvas"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#0d2a2a]" />,
});

export default function PondApp() {
  useReducedMotionSync();
  return (
    <main className="fixed inset-0 overflow-hidden bg-[#0d2a2a] select-none">
      <PondCanvas />
      <ControlPanel />
    </main>
  );
}
