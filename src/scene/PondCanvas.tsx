"use client";

import { PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { pondConfig } from "@/config/pond.config";
import { usePondStore } from "@/store/pondStore";
import { PondEngine } from "./PondEngine";

/** Mounts the imperative engine and drives it from R3F's frame loop. */
function EngineBridge() {
  const gl = useThree((s) => s.gl);
  const engineRef = useRef<PondEngine | null>(null);

  useEffect(() => {
    const engine = new PondEngine(gl);
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [gl]);

  const fpsRef = useRef({ frames: 0, since: 0 });

  // Positive priority: we take over rendering from R3F.
  useFrame((state, delta) => {
    const engine = engineRef.current;
    if (!engine) return;

    // Publish the frame rate about once a second for the panel.
    const meter = fpsRef.current;
    const now = performance.now();
    if (meter.since === 0) meter.since = now;
    meter.frames++;
    if (now - meter.since >= 1000) {
      usePondStore.getState().setPerformance((meter.frames * 1000) / (now - meter.since));
      meter.frames = 0;
      meter.since = now;
    }

    engine.syncSize(state.size.width, state.size.height, state.viewport.dpr);
    engine.frame(delta, state.clock.elapsedTime);
  }, 1);

  return null;
}

/**
 * Adaptive quality: steps the level (DPR, simulation and underwater
 * resolution) down when the frame rate sags and back up when there is
 * headroom, then locks after a few swings to avoid flicker.
 */
function AdaptiveQuality() {
  const q = pondConfig.quality;
  const step = (delta: number) => {
    const { qualityLevel, setQualityLevel } = usePondStore.getState();
    const next = Math.min(Math.max(qualityLevel + delta, 0), q.levels.length - 1);
    if (next !== qualityLevel) setQualityLevel(next);
  };
  return (
    <PerformanceMonitor
      bounds={() => [q.lowerFps, q.upperFps]}
      flipflops={q.maxFlipflops}
      onIncline={() => step(1)}
      onDecline={() => step(-1)}
      onFallback={() => usePondStore.getState().setPerformance(usePondStore.getState().fps, true)}
    />
  );
}

export default function PondCanvas() {
  const qualityLevel = usePondStore((s) => s.qualityLevel);
  const maxDpr = pondConfig.quality.levels[qualityLevel].dpr;

  // Phones and tablets start at a lighter level; the monitor adjusts from there.
  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) {
      usePondStore.getState().setQualityLevel(pondConfig.quality.mobileStartLevel);
    }
  }, []);

  return (
    <Canvas
      className="absolute! inset-0"
      dpr={[1, maxDpr]}
      flat
      linear
      gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }}
      frameloop="always"
    >
      <EngineBridge />
      <AdaptiveQuality />
    </Canvas>
  );
}
