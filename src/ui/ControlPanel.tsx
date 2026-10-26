"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef, useState, useSyncExternalStore } from "react";
import { usePondStore } from "@/store/pondStore";
import { Button } from "./Button";
import { FishControls } from "./FishControls";
import { ModePicker } from "./ModePicker";
import { PerformanceBadge } from "./PerformanceBadge";
import { WaterControls } from "./WaterControls";

gsap.registerPlugin(useGSAP);

const SMALL_SCREEN = "(max-width: 640px)";
const subscribeSmall = (cb: () => void) => {
  const mq = window.matchMedia(SMALL_SCREEN);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const isSmallScreen = () => window.matchMedia(SMALL_SCREEN).matches;

/** Collapsible glass panel floating over the pond. */
export function ControlPanel() {
  // On phones the panel would cover the pond, so it starts collapsed until the user opens it.
  const small = useSyncExternalStore(subscribeSmall, isSmallScreen, () => false);
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? !small;
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePondStore((s) => s.reducedMotion);
  const resetScene = usePondStore((s) => s.resetScene);
  const paused = usePondStore((s) => s.paused);
  const setPaused = usePondStore((s) => s.setPaused);

  useGSAP(
    () => {
      const body = bodyRef.current;
      if (!body) return;
      const duration = reducedMotion ? 0 : 0.45;
      if (open) {
        gsap.set(body, { display: "block" });
        gsap.fromTo(
          body,
          { height: 0, opacity: 0 },
          { height: "auto", opacity: 1, duration, ease: "power3.out" },
        );
        gsap.fromTo(
          body.querySelectorAll("[data-stagger]"),
          { y: 8, opacity: 0 },
          { y: 0, opacity: 1, duration, stagger: reducedMotion ? 0 : 0.05, ease: "power2.out" },
        );
      } else {
        gsap.to(body, {
          height: 0,
          opacity: 0,
          duration: duration * 0.7,
          ease: "power3.in",
          onComplete: () => {
            gsap.set(body, { display: "none" });
          },
        });
      }
    },
    { dependencies: [open, reducedMotion], scope: panelRef },
  );

  return (
    <aside
      ref={panelRef}
      data-ui
      // Stop pointer events from reaching the pond underneath.
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto absolute top-4 right-4 z-20 w-[min(320px,calc(100vw-2rem))] rounded-2xl border border-white/15 bg-[#0b1f1f]/55 text-white shadow-2xl shadow-black/40 backdrop-blur-xl"
    >
      <button
        type="button"
        onClick={() => setUserOpen(!open)}
        aria-expanded={open}
        aria-controls="pond-controls"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold tracking-wide">Koi Pond</span>
        <span
          aria-hidden
          className={`text-white/70 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
        <span className="sr-only">{open ? "Collapse controls" : "Expand controls"}</span>
      </button>

      <div ref={bodyRef} id="pond-controls" className="overflow-hidden">
        <div className="max-h-[calc(100dvh-6rem)] space-y-5 overflow-y-auto px-4 pb-4">
          <div data-stagger>
            <ModePicker />
          </div>
          <div data-stagger className="border-t border-white/10 pt-4">
            <FishControls />
          </div>
          <div data-stagger className="border-t border-white/10 pt-4">
            <WaterControls />
          </div>
          <div data-stagger className="grid grid-cols-2 gap-1.5 border-t border-white/10 pt-4">
            <Button tone={paused ? "active" : "default"} aria-pressed={paused} onClick={() => setPaused(!paused)}>
              {paused ? "▶ Resume" : "❚❚ Pause"}
            </Button>
            <Button onClick={resetScene}>Reset scene</Button>
          </div>
          <div data-stagger className="space-y-1">
            <p className="text-[10px] leading-relaxed text-white/40">
              Keys: 1–6 cursor modes · P pause · Esc stop removing
            </p>
            <PerformanceBadge />
          </div>
        </div>
      </div>
    </aside>
  );
}
