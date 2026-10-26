"use client";

import { usePondStore } from "@/store/pondStore";
import { Slider } from "./Slider";

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Formats a 0..1 day fraction as a clock time plus a phase name. */
const clock = (t: number) => {
  const minutes = Math.round(t * 24 * 60) % (24 * 60);
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  const phase = t < 0.2 || t > 0.82 ? "night" : t < 0.32 ? "dawn" : t < 0.68 ? "day" : "dusk";
  return `${hh}:${mm} ${phase}`;
};

export function WaterControls() {
  const params = usePondStore((s) => s.params);
  const setParam = usePondStore((s) => s.setParam);

  return (
    <section aria-labelledby="water-heading" className="space-y-3">
      <h2 id="water-heading" className="text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">
        Water &amp; light
      </h2>
      <Slider
        label="Ripple strength"
        value={params.rippleStrength}
        min={0}
        max={1}
        step={0.01}
        format={pct}
        onChange={(v) => setParam("rippleStrength", v)}
      />
      <Slider
        label="Ripple damping"
        value={params.rippleDamping}
        min={0}
        max={1}
        step={0.01}
        format={pct}
        onChange={(v) => setParam("rippleDamping", v)}
      />
      <Slider
        label="Swim speed"
        value={params.swimSpeed}
        min={0.2}
        max={2.5}
        step={0.05}
        format={(v) => `${v.toFixed(2)}×`}
        onChange={(v) => setParam("swimSpeed", v)}
      />
      <Slider
        label="Time of day"
        value={params.timeOfDay}
        min={0}
        max={1}
        step={0.005}
        format={clock}
        onChange={(v) => setParam("timeOfDay", v)}
      />
    </section>
  );
}
