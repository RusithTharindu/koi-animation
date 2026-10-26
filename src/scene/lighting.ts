import { Color, Vector3 } from "three";
import { clamp, smoothstep, TAU } from "@/lib/math";

export interface LightingState {
  sunDir: Vector3;
  sunColor: Color;
  ambient: Color;
  sky: Color;
  waterTint: Color;
  /** 0 at night, 1 at full day; scales caustics. */
  daylight: number;
}

const DAY_SUN = new Color(1.0, 0.96, 0.88);
const LOW_SUN = new Color(1.0, 0.62, 0.32);
const MOON = new Color(0.32, 0.42, 0.68);

const DAY_AMBIENT = new Color(0.56, 0.62, 0.6);
const DUSK_AMBIENT = new Color(0.66, 0.52, 0.5);
const NIGHT_AMBIENT = new Color(0.07, 0.1, 0.17);

const DAY_SKY = new Color(0.62, 0.78, 0.86);
const DUSK_SKY = new Color(0.95, 0.62, 0.45);
const NIGHT_SKY = new Color(0.06, 0.09, 0.18);

const DAY_TINT = new Color(0.1, 0.27, 0.25);
const DUSK_TINT = new Color(0.24, 0.22, 0.19);
const NIGHT_TINT = new Color(0.01, 0.04, 0.07);

/**
 * Maps a time of day (0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset)
 * to light directions and colours. Writes into `out` to avoid allocations.
 */
export function computeLighting(t: number, out: LightingState): LightingState {
  const a = (t - 0.25) * TAU; // 0 at sunrise, PI/2 at noon
  const elevation = Math.sin(a);
  const day = smoothstep(-0.12, 0.25, elevation);
  const golden = 1 - smoothstep(0.05, 0.55, Math.abs(elevation));
  const isNight = elevation < 0;

  // Sun travels east -> west; the moon takes over at night.
  const dirX = Math.cos(a) * 0.85;
  const dirZ = isNight ? Math.max(-elevation, 0.35) : Math.max(elevation, 0.12);
  out.sunDir.set(isNight ? -dirX : dirX, 0.35, dirZ).normalize();

  if (isNight) {
    out.sunColor.copy(MOON).multiplyScalar(0.45 + 0.4 * clamp(-elevation, 0, 1));
  } else {
    out.sunColor.copy(DAY_SUN).lerp(LOW_SUN, golden).multiplyScalar(0.55 + 0.6 * day);
  }

  out.ambient.copy(NIGHT_AMBIENT).lerp(DUSK_AMBIENT, day).lerp(DAY_AMBIENT, day * (1 - golden));
  out.sky.copy(NIGHT_SKY).lerp(DUSK_SKY, day).lerp(DAY_SKY, day * (1 - golden));
  out.waterTint.copy(NIGHT_TINT).lerp(DUSK_TINT, day).lerp(DAY_TINT, day * (1 - golden));
  out.daylight = day;
  return out;
}

export const createLightingState = (): LightingState => ({
  sunDir: new Vector3(0, 0, 1),
  sunColor: new Color(),
  ambient: new Color(),
  sky: new Color(),
  waterTint: new Color(),
  daylight: 1,
});
