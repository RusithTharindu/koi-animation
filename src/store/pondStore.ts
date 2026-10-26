import { create } from "zustand";
import { pondConfig, type InteractionMode } from "@/config/pond.config";

export interface PondParams {
  /** 0..1 multiplier applied to every disturbance. */
  rippleStrength: number;
  /** 0..1, higher fades ripples faster. */
  rippleDamping: number;
}

export interface PondState {
  mode: InteractionMode;
  params: PondParams;
  paused: boolean;
  qualityLevel: number;
  reducedMotion: boolean;

  setMode: (mode: InteractionMode) => void;
  setParam: <K extends keyof PondParams>(key: K, value: PondParams[K]) => void;
  setPaused: (paused: boolean) => void;
  setQualityLevel: (level: number) => void;
  setReducedMotion: (reduced: boolean) => void;
}

const defaultParams = (): PondParams => ({
  rippleStrength: pondConfig.defaults.rippleStrength,
  rippleDamping: pondConfig.defaults.rippleDamping,
});

export const usePondStore = create<PondState>()((set) => ({
  mode: "ripple",
  params: defaultParams(),
  paused: false,
  qualityLevel: pondConfig.quality.desktopStartLevel,
  reducedMotion: false,

  setMode: (mode) => set({ mode }),
  setParam: (key, value) => set((s) => ({ params: { ...s.params, [key]: value } })),
  setPaused: (paused) => set({ paused }),
  setQualityLevel: (qualityLevel) => set({ qualityLevel }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
}));
