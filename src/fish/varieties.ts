import type { KoiVariety } from "@/config/pond.config";

export interface VarietyDef {
  label: string;
  /** Pattern program in the koi shader. */
  pattern: number;
  base: [number, number, number];
  patch: [number, number, number];
  patch2: [number, number, number];
  fin: [number, number, number];
  /** Iris ring around the pupil. */
  iris: [number, number, number];
  /** 0 = matte, 1 = full metallic (Ogon / Butterfly sheen). */
  metallic: number;
  /** Pectoral fin length relative to body length. */
  finLength: number;
  /** Tail fin length relative to body length. */
  tailLength: number;
  /** Dorsal fin visibility from above (long-finned varieties trail it). */
  dorsal: number;
  /** Swatch for the UI. */
  swatch: string;
}

export const PATTERN = {
  kohaku: 0,
  sanke: 1,
  showa: 2,
  ogon: 3,
  asagi: 4,
  tancho: 5,
  butterfly: 6,
} as const;

const WHITE: [number, number, number] = [0.96, 0.94, 0.89];
const HI_RED: [number, number, number] = [0.86, 0.2, 0.08];
const SUMI: [number, number, number] = [0.06, 0.06, 0.07];
/** Most koi have a dark bronze iris with a gold rim; metallic varieties shine silver-gold. */
const IRIS_BRONZE: [number, number, number] = [0.52, 0.38, 0.2];
const IRIS_GOLD: [number, number, number] = [0.82, 0.66, 0.36];
const IRIS_SILVER: [number, number, number] = [0.72, 0.72, 0.68];

export const VARIETIES: Record<KoiVariety, VarietyDef> = {
  kohaku: {
    label: "Kohaku",
    pattern: PATTERN.kohaku,
    base: WHITE,
    patch: HI_RED,
    patch2: SUMI,
    fin: [0.97, 0.95, 0.92],
    iris: IRIS_BRONZE,
    metallic: 0.05,
    finLength: 0.2,
    tailLength: 0.3,
    dorsal: 0.25,
    swatch: "linear-gradient(135deg,#f4f0e6 45%,#d63a16 46%)",
  },
  sanke: {
    label: "Sanke",
    pattern: PATTERN.sanke,
    base: WHITE,
    patch: [0.88, 0.22, 0.09],
    patch2: SUMI,
    fin: [0.95, 0.94, 0.9],
    iris: IRIS_BRONZE,
    metallic: 0.05,
    finLength: 0.2,
    tailLength: 0.3,
    dorsal: 0.25,
    swatch: "linear-gradient(135deg,#f4f0e6 40%,#d63a16 41% 70%,#111 71%)",
  },
  showa: {
    label: "Showa",
    pattern: PATTERN.showa,
    base: WHITE,
    patch: [0.84, 0.18, 0.07],
    patch2: SUMI,
    fin: [0.32, 0.3, 0.3],
    iris: [0.4, 0.3, 0.18],
    metallic: 0.05,
    finLength: 0.21,
    tailLength: 0.3,
    dorsal: 0.3,
    swatch: "linear-gradient(135deg,#111 35%,#d63a16 36% 65%,#f4f0e6 66%)",
  },
  ogon: {
    label: "Ogon",
    pattern: PATTERN.ogon,
    base: [0.98, 0.74, 0.3],
    patch: [1.0, 0.86, 0.5],
    patch2: [0.8, 0.52, 0.16],
    fin: [1.0, 0.82, 0.45],
    iris: IRIS_GOLD,
    metallic: 1,
    finLength: 0.2,
    tailLength: 0.3,
    dorsal: 0.25,
    swatch: "linear-gradient(135deg,#ffe08a,#e8a434)",
  },
  asagi: {
    label: "Asagi",
    pattern: PATTERN.asagi,
    base: [0.5, 0.6, 0.7],
    patch: [0.9, 0.42, 0.16],
    patch2: [0.86, 0.88, 0.88],
    fin: [0.92, 0.55, 0.3],
    iris: [0.46, 0.42, 0.3],
    metallic: 0.1,
    finLength: 0.2,
    tailLength: 0.3,
    dorsal: 0.3,
    swatch: "linear-gradient(135deg,#7f98ad 55%,#e06a2a 56%)",
  },
  tancho: {
    label: "Tancho",
    pattern: PATTERN.tancho,
    base: [0.97, 0.96, 0.93],
    patch: [0.9, 0.12, 0.08],
    patch2: SUMI,
    fin: [0.98, 0.97, 0.95],
    iris: IRIS_BRONZE,
    metallic: 0.08,
    finLength: 0.2,
    tailLength: 0.3,
    dorsal: 0.25,
    swatch: "radial-gradient(circle at 35% 35%,#d91c12 22%,#f7f5ee 24%)",
  },
  butterfly: {
    label: "Butterfly",
    pattern: PATTERN.butterfly,
    base: [0.93, 0.93, 0.9],
    patch: [1.0, 0.56, 0.14],
    patch2: [0.98, 0.78, 0.36],
    fin: [1.0, 0.9, 0.78],
    iris: IRIS_SILVER,
    metallic: 0.75,
    finLength: 0.36,
    tailLength: 0.52,
    dorsal: 0.9,
    swatch: "linear-gradient(135deg,#f0efe9 40%,#ff9124 41%)",
  },
};
