import type { InteractionMode } from "@/config/pond.config";

export interface ModeInfo {
  label: string;
  hint: string;
  /** Keyboard shortcut. */
  key: string;
}

export const MODE_INFO: Record<InteractionMode, ModeInfo> = {
  ripple: { label: "Ripple", hint: "Tap the water to make ripples. Use several fingers at once.", key: "1" },
  trail: { label: "Trail", hint: "Drag to draw a continuous wake through the water.", key: "2" },
  feed: { label: "Feed", hint: "Tap to drop pellets. Koi swim over to eat them.", key: "3" },
  attract: { label: "Attract", hint: "Koi gently follow your cursor or finger.", key: "4" },
  scatter: { label: "Scatter", hint: "Koi dart away from sudden movement, then calm down.", key: "5" },
  hand: { label: "Hand", hint: "Drag a finger through the pond to push water and nudge koi.", key: "6" },
  remove: { label: "Remove", hint: "Tap a koi to remove it. Press Esc to stop.", key: "" },
};
