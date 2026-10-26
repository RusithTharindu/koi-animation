import { create } from "zustand";
import {
  KOI_VARIETIES,
  pondConfig,
  type InteractionMode,
  type KoiVariety,
} from "@/config/pond.config";

export interface FishMeta {
  id: string;
  variety: KoiVariety;
  /** 0..1, drives size, temperament and pattern. */
  seed: number;
  /** Set while the despawn animation plays; the fish is removed afterwards. */
  leaving: boolean;
}

export interface PondParams {
  /** 0..1 multiplier applied to every disturbance. */
  rippleStrength: number;
  /** 0..1, higher fades ripples faster. */
  rippleDamping: number;
  /** Multiplier on cruise speed. */
  swimSpeed: number;
  /** 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset. */
  timeOfDay: number;
}

export interface PondState {
  fish: FishMeta[];
  mode: InteractionMode;
  params: PondParams;
  paused: boolean;
  qualityLevel: number;
  reducedMotion: boolean;

  addFish: (variety?: KoiVariety) => boolean;
  removeFish: (id: string) => void;
  removeLast: () => void;
  clearFish: () => void;
  /** Called by the fish system once a despawn animation has finished. */
  finalizeRemoval: (id: string) => void;
  resetScene: () => void;

  setMode: (mode: InteractionMode) => void;
  setParam: <K extends keyof PondParams>(key: K, value: PondParams[K]) => void;
  setPaused: (paused: boolean) => void;
  setQualityLevel: (level: number) => void;
  setReducedMotion: (reduced: boolean) => void;
}

let nextId = 0;
const createFish = (variety: KoiVariety): FishMeta => ({
  id: `koi-${nextId++}`,
  variety,
  seed: Math.random(),
  leaving: false,
});

const randomVariety = (): KoiVariety =>
  KOI_VARIETIES[Math.floor(Math.random() * KOI_VARIETIES.length)];

const defaultFish = () => pondConfig.fish.defaultVarieties.map(createFish);

const defaultParams = (): PondParams => ({
  rippleStrength: pondConfig.defaults.rippleStrength,
  rippleDamping: pondConfig.defaults.rippleDamping,
  swimSpeed: pondConfig.defaults.swimSpeed,
  timeOfDay: pondConfig.lighting.defaultTimeOfDay,
});

/** Number of fish that are in the pond and not on their way out. */
export const selectActiveCount = (s: PondState) => s.fish.reduce((n, f) => n + (f.leaving ? 0 : 1), 0);

export const usePondStore = create<PondState>()((set, get) => ({
  fish: defaultFish(),
  mode: "ripple",
  params: defaultParams(),
  paused: false,
  qualityLevel: pondConfig.quality.desktopStartLevel,
  reducedMotion: false,

  addFish: (variety) => {
    // Leaving fish still occupy GPU resources until their animation ends.
    if (get().fish.length >= pondConfig.fish.maxCount) return false;
    set((s) => ({ fish: [...s.fish, createFish(variety ?? randomVariety())] }));
    return true;
  },
  removeFish: (id) =>
    set((s) => ({ fish: s.fish.map((f) => (f.id === id ? { ...f, leaving: true } : f)) })),
  removeLast: () => {
    const last = get().fish.findLast((f) => !f.leaving);
    if (last) get().removeFish(last.id);
  },
  clearFish: () => set((s) => ({ fish: s.fish.map((f) => (f.leaving ? f : { ...f, leaving: true })) })),
  finalizeRemoval: (id) => set((s) => ({ fish: s.fish.filter((f) => f.id !== id) })),
  resetScene: () =>
    set({ fish: defaultFish(), params: defaultParams(), mode: "ripple", paused: false }),

  setMode: (mode) => set({ mode }),
  setParam: (key, value) => set((s) => ({ params: { ...s.params, [key]: value } })),
  setPaused: (paused) => set({ paused }),
  setQualityLevel: (qualityLevel) => set({ qualityLevel }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
}));
