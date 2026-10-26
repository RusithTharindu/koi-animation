"use client";

import { useId, type CSSProperties } from "react";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}

export function Slider({ label, value, min, max, step, onChange, format }: SliderProps) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <label htmlFor={id} className="text-white/80">
          {label}
        </label>
        <output htmlFor={id} className="font-mono text-[11px] text-white/60">
          {format ? format(value) : value.toFixed(2)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="pond-range w-full"
        style={{ "--fill": `${pct}%` } as CSSProperties}
      />
    </div>
  );
}
