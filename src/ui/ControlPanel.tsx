"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef, useState } from "react";
import { usePondStore } from "@/store/pondStore";
import { Button } from "./Button";
import { FishControls } from "./FishControls";

gsap.registerPlugin(useGSAP);

/** Collapsible glass panel floating over the pond. */
export function ControlPanel() {
  const [open, setOpen] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePondStore((s) => s.reducedMotion);
  const resetScene = usePondStore((s) => s.resetScene);

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
      // Stop pointer events from reaching the pond underneath.
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto absolute top-4 right-4 z-20 w-[min(320px,calc(100vw-2rem))] rounded-2xl border border-white/15 bg-[#0b1f1f]/55 text-white shadow-2xl shadow-black/40 backdrop-blur-xl"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
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
            <FishControls />
          </div>
          <div data-stagger className="border-t border-white/10 pt-4">
            <Button onClick={resetScene} className="w-full">
              Reset to default scene
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
