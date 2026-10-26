"use client";

import { KOI_VARIETIES, pondConfig, type KoiVariety } from "@/config/pond.config";
import { VARIETIES } from "@/fish/varieties";
import { selectActiveCount, usePondStore } from "@/store/pondStore";
import { Button } from "./Button";

export function FishControls() {
  const count = usePondStore(selectActiveCount);
  const total = usePondStore((s) => s.fish.length);
  const addFish = usePondStore((s) => s.addFish);
  const removeLast = usePondStore((s) => s.removeLast);
  const clearFish = usePondStore((s) => s.clearFish);
  const picking = usePondStore((s) => s.mode === "remove");
  const setMode = usePondStore((s) => s.setMode);
  const max = pondConfig.fish.maxCount;
  // Leaving fish still hold a slot until their dive animation finishes.
  const full = total >= max;

  const add = (variety?: KoiVariety) => addFish(variety);

  return (
    <section aria-labelledby="fish-heading" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 id="fish-heading" className="text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">
          Koi
        </h2>
        <span className="font-mono text-xs text-white/70" aria-live="polite">
          {count} / {max}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        <button
          type="button"
          onClick={() => add()}
          disabled={full}
          className="flex h-14 flex-col items-center justify-center gap-1 rounded-lg border border-white/15 bg-white/10 text-[10px] text-white/90 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          title="Add a random koi"
        >
          <span className="text-lg leading-none">＋</span>
          Random
        </button>
        {KOI_VARIETIES.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => add(v)}
            disabled={full}
            title={`Add a ${VARIETIES[v].label} koi`}
            className="flex h-14 flex-col items-center justify-center gap-1 rounded-lg border border-white/10 bg-black/20 text-[10px] text-white/85 transition hover:border-white/30 hover:bg-black/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span
              aria-hidden
              className="h-4 w-7 rounded-full shadow-inner ring-1 ring-white/20"
              style={{ background: VARIETIES[v].swatch }}
            />
            {VARIETIES[v].label}
          </button>
        ))}
      </div>
      {full && <p className="text-[11px] text-amber-200/80">The pond is full ({max} koi keeps it smooth).</p>}

      <div className="grid grid-cols-3 gap-1.5">
        <Button
          tone={picking ? "active" : "default"}
          aria-pressed={picking}
          onClick={() => setMode(picking ? "ripple" : "remove")}
          disabled={count === 0 && !picking}
          title="Click a koi in the pond to remove it"
        >
          {picking ? "Picking..." : "Pick koi"}
        </Button>
        <Button onClick={removeLast} disabled={count === 0}>
          Remove last
        </Button>
        <Button onClick={clearFish} disabled={count === 0} tone="danger">
          Clear
        </Button>
      </div>
    </section>
  );
}
