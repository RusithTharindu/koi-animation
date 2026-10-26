"use client";

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

  // Positive priority: we take over rendering from R3F.
  useFrame((state, delta) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.syncSize(state.size.width, state.size.height, state.viewport.dpr);
    engine.frame(delta, state.clock.elapsedTime);
  }, 1);

  return null;
}

export default function PondCanvas() {
  const qualityLevel = usePondStore((s) => s.qualityLevel);
  const maxDpr = pondConfig.quality.levels[qualityLevel].dpr;

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
    </Canvas>
  );
}
