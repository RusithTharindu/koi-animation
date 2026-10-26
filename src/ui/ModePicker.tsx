"use client";

import { INTERACTION_MODES } from "@/config/pond.config";
import { MODE_INFO } from "@/interaction/modes";
import { usePondStore } from "@/store/pondStore";
import { ModeIcon } from "./ModeIcon";

export function ModePicker() {
  const mode = usePondStore((s) => s.mode);
  const setMode = usePondStore((s) => s.setMode);

  return (
    <section aria-labelledby="mode-heading" className="space-y-3">
      <h2 id="mode-heading" className="text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">
        Cursor
      </h2>
      <div role="radiogroup" aria-labelledby="mode-heading" className="grid grid-cols-3 gap-1.5">
        {INTERACTION_MODES.map((m) => {
          const active = m === mode;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setMode(m)}
              title={`${MODE_INFO[m].label} (${MODE_INFO[m].key})`}
              className={`flex h-14 flex-col items-center justify-center gap-1 rounded-lg border text-[11px] transition ${
                active
                  ? "border-teal-200/60 bg-teal-300/25 text-white"
                  : "border-white/10 bg-black/20 text-white/75 hover:border-white/30 hover:bg-black/30"
              }`}
            >
              <ModeIcon mode={m} size={20} />
              {MODE_INFO[m].label}
            </button>
          );
        })}
      </div>
      <p className="min-h-8 text-[11px] leading-snug text-white/60" aria-live="polite">
        {MODE_INFO[mode].hint}
      </p>
    </section>
  );
}
