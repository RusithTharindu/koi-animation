"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";
import type { InteractionMode } from "@/config/pond.config";
import { usePondStore } from "@/store/pondStore";
import { ModeIcon } from "@/ui/ModeIcon";

gsap.registerPlugin(useGSAP);

const TINT: Record<InteractionMode, string> = {
  ripple: "#e8fbff",
  trail: "#b9f3ff",
  feed: "#ffd9a0",
  attract: "#ffe7f0",
  scatter: "#fff3b0",
  hand: "#ffe4cf",
  remove: "#ff9a8a",
};

const GHOSTS = 4;

/**
 * Mouse/pen cursor that matches the active interaction mode. Touch input has
 * no hover, so the cursor stays hidden there and the native UI takes over.
 */
export function CustomCursor() {
  const mode = usePondStore((s) => s.mode);
  const reducedMotion = usePondStore((s) => s.reducedMotion);
  const rootRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const pulseRef = useRef<HTMLDivElement>(null);
  const ghostRefs = useRef<Array<HTMLDivElement | null>>([]);

  // Follow the pointer.
  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;
      const follow = reducedMotion ? 0.01 : 0.12;
      const xTo = gsap.quickTo(root, "x", { duration: follow, ease: "power3.out" });
      const yTo = gsap.quickTo(root, "y", { duration: follow, ease: "power3.out" });
      const ghosts = ghostRefs.current.filter((g): g is HTMLDivElement => g !== null);
      const ghostTo = ghosts.map((g, i) => ({
        x: gsap.quickTo(g, "x", { duration: 0.18 + i * 0.12, ease: "power2.out" }),
        y: gsap.quickTo(g, "y", { duration: 0.18 + i * 0.12, ease: "power2.out" }),
      }));
      let visible = false;

      const show = (on: boolean) => {
        if (on === visible) return;
        visible = on;
        gsap.to([root, ...ghosts], { autoAlpha: on ? 1 : 0, duration: 0.2, overwrite: "auto" });
      };

      const onMove = (e: PointerEvent) => {
        if (e.pointerType === "touch") return show(false);
        const overUi = e.target instanceof Element && e.target.closest("[data-ui]");
        show(!overUi);
        xTo(e.clientX);
        yTo(e.clientY);
        for (const g of ghostTo) {
          g.x(e.clientX);
          g.y(e.clientY);
        }
      };
      const onDown = (e: PointerEvent) => {
        if (e.pointerType === "touch" || !visible) return;
        const pulse = pulseRef.current;
        if (!pulse || reducedMotion) return;
        gsap.fromTo(pulse, { scale: 0.6, opacity: 0.9 }, { scale: 2.2, opacity: 0, duration: 0.6, ease: "power2.out" });
        gsap.fromTo(iconRef.current, { scale: 0.82 }, { scale: 1, duration: 0.35, ease: "back.out(3)" });
      };
      const onLeave = () => show(false);

      gsap.set([root, ...ghosts], { autoAlpha: 0 });
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerdown", onDown);
      document.documentElement.addEventListener("pointerleave", onLeave);
      return () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerdown", onDown);
        document.documentElement.removeEventListener("pointerleave", onLeave);
      };
    },
    { dependencies: [reducedMotion] },
  );

  // Morph between modes.
  useGSAP(
    () => {
      if (reducedMotion) return;
      gsap.fromTo(
        iconRef.current,
        { scale: 0.4, rotate: -40, opacity: 0 },
        { scale: 1, rotate: 0, opacity: 1, duration: 0.45, ease: "back.out(2.2)" },
      );
    },
    { dependencies: [mode, reducedMotion] },
  );

  const color = TINT[mode];
  return (
    <>
      {Array.from({ length: GHOSTS }, (_, i) => (
        <div
          key={i}
          ref={(el) => {
            ghostRefs.current[i] = el;
          }}
          aria-hidden
          className="pointer-events-none fixed top-0 left-0 z-30 rounded-full"
          style={{
            width: 10 - i * 2,
            height: 10 - i * 2,
            marginLeft: -(5 - i),
            marginTop: -(5 - i),
            background: color,
            opacity: 0,
            display: mode === "trail" ? "block" : "none",
            filter: "blur(0.5px)",
          }}
        />
      ))}
      <div
        ref={rootRef}
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 z-30"
        style={{ opacity: 0, color }}
      >
        <div
          ref={pulseRef}
          className="absolute -top-5 -left-5 h-10 w-10 rounded-full border-2 opacity-0"
          style={{ borderColor: color }}
        />
        <div
          ref={iconRef}
          className="absolute -top-5 -left-5 flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/10 shadow-[0_0_18px_rgba(255,255,255,0.25)] backdrop-blur-[2px]"
        >
          <ModeIcon mode={mode} size={22} />
        </div>
      </div>
    </>
  );
}
