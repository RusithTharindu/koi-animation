"use client";

import { pondConfig } from "@/config/pond.config";
import { usePondStore } from "@/store/pondStore";

const LEVEL_NAMES = ["Low", "Medium", "High", "Ultra"];

/** Live frame rate and the quality level chosen by adaptive quality. */
export function PerformanceBadge() {
  const fps = usePondStore((s) => s.fps);
  const level = usePondStore((s) => s.qualityLevel);
  const locked = usePondStore((s) => s.qualityLocked);
  const sim = pondConfig.quality.levels[level].simResolution;
  return (
    <p className="font-mono text-[10px] text-white/45" title={`Ripple simulation: ${sim} texels on the short side`}>
      {fps > 0 ? `${fps} fps` : "measuring…"} · {LEVEL_NAMES[level] ?? level} quality {locked ? "(fixed)" : "(auto)"}
    </p>
  );
}
