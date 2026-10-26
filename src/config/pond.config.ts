/**
 * Every tunable constant for the pond lives here.
 *
 * World units: the shorter side of the viewport is always `world.shortSide`
 * units long, so fish sizes and speeds feel the same on phones and desktops.
 */

export const KOI_VARIETIES = [
  "kohaku",
  "sanke",
  "showa",
  "ogon",
  "asagi",
  "tancho",
  "butterfly",
] as const;

export type KoiVariety = (typeof KOI_VARIETIES)[number];

export const INTERACTION_MODES = [
  "ripple",
  "trail",
  "feed",
  "attract",
  "scatter",
  "hand",
] as const;

/** `remove` is a transient tool mode toggled from the fish section of the panel. */
export type InteractionMode = (typeof INTERACTION_MODES)[number] | "remove";

export interface QualityLevel {
  /** Upper bound for device pixel ratio. */
  dpr: number;
  /** Ripple simulation texels along the shorter viewport side. */
  simResolution: number;
  /** Underwater render target scale relative to the drawing buffer. */
  underwaterScale: number;
}

export const pondConfig = {
  world: {
    shortSide: 10,
  },

  quality: {
    /** Ordered from cheapest to most expensive. */
    levels: [
      { dpr: 1, simResolution: 128, underwaterScale: 0.75 },
      { dpr: 1.25, simResolution: 160, underwaterScale: 1 },
      { dpr: 1.5, simResolution: 224, underwaterScale: 1 },
      { dpr: 2, simResolution: 256, underwaterScale: 1 },
    ] satisfies QualityLevel[],
    desktopStartLevel: 3,
    mobileStartLevel: 1,
    /** drei PerformanceMonitor bounds (fps). */
    lowerFps: 45,
    upperFps: 58,
    /** Stop adapting after this many up/down swings to avoid flicker. */
    maxFlipflops: 4,
  },

  water: {
    /** Simulation steps per second at a 256-texel resolution; scaled linearly with resolution so waves keep a constant world speed. */
    stepsPerSecondAt256: 110,
    maxStepsPerFrame: 5,
    /** Per-step velocity damping at 256 texels; the slider maps between these. */
    dampingMin: 0.9975,
    dampingMax: 0.978,
    /** Slow drift of the resting height back to zero. */
    heightDecay: 0.9995,
    maxDropsPerFrame: 48,
    /** Ripple from a click / tap. */
    clickRadius: 0.38,
    clickStrength: 0.9,
    /** Continuous trail while dragging in trail mode. */
    trailRadius: 0.22,
    trailStrength: 0.22,
    trailSpacing: 0.14,
    /** Hand-in-water drag. */
    handRadius: 0.45,
    handStrength: 0.35,
    handSpacing: 0.16,
    /** Normal steepness used by every shader that reads the height field. */
    normalStrength: 0.22,
    /** Apparent depth of the water column used for refraction offsets (world units). */
    refractionDepth: 0.9,
    /** Virtual eye position for the localised sun glint. */
    eye: [0, -3, 14] as const,
    specularPower: 1400,
    specularStrength: 1.1,
    fresnelStrength: 0.35,
  },

  floor: {
    causticStrength: 0.85,
    causticScale: 1.15,
    causticSpeed: 0.35,
    /** How strongly ripples focus light into caustics. */
    rippleCausticGain: 14,
    pebbleScale: 1.5,
  },

  fish: {
    maxCount: 30,
    defaultVarieties: [
      "kohaku",
      "sanke",
      "showa",
      "ogon",
      "asagi",
      "tancho",
      "butterfly",
      "kohaku",
    ] satisfies KoiVariety[],
    spineSegments: 14,
    lengthMin: 1.7,
    lengthMax: 2.5,
    /** Half-width of the body relative to its length. */
    widthRatio: 0.125,
    /** Swim speed in body lengths / second. */
    cruiseSpeed: 0.42,
    speedJitter: 0.25,
    idleSpeed: 0.07,
    panicSpeed: 2.4,
    maxTurnRate: 2.2,
    /** Tail beat: base frequency (Hz) plus extra per body-length/sec. */
    beatBaseHz: 0.7,
    beatPerSpeed: 2.6,
    beatAmplitude: 0.11,
    /** Max bend between neighbouring spine joints (radians). */
    maxJointBend: 0.24,
    /** Edge avoidance. */
    edgeMargin: 1.6,
    edgeForce: 3.2,
    boids: {
      neighbourRadius: 3.2,
      separationRadius: 1.5,
      separation: 2.4,
      alignment: 0.45,
      cohesion: 0.22,
    },
    wander: {
      jitter: 1.6,
      strength: 0.9,
    },
    idle: {
      /** Chance per second to enter an idle drift. */
      chancePerSecond: 0.035,
      durationMin: 2.5,
      durationMax: 6,
    },
    depth: {
      min: 0.05,
      max: 0.9,
      changeChancePerSecond: 0.08,
      /** Visual scale at max depth. */
      scaleAtDeepest: 0.72,
      /** How much deep fish fade into the water colour. */
      attenuation: 0.62,
      blurAtDeepest: 0.09,
    },
    shadow: {
      strength: 0.55,
      /** Shadow offset in world units for a fish touching the surface. */
      maxOffset: 0.9,
      softnessMin: 0.06,
      softnessMax: 0.32,
    },
    wake: {
      radius: 0.2,
      strength: 0.012,
    },
    /** Tween durations (seconds). */
    spawnDuration: 1.6,
    despawnDuration: 1.2,
    scatterCalmDuration: 2.6,
    hitPadding: 0.12,
  },

  interaction: {
    attractRadius: 6,
    attractStrength: 1.6,
    scatterRadius: 2.8,
    scatterCooldown: 0.6,
    handRadius: 1.1,
    handPush: 2.2,
  },

  food: {
    maxPellets: 60,
    perClick: 4,
    spread: 0.35,
    sinkDuration: 9,
    restDuration: 6,
    senseRadius: 4.5,
    eatRadius: 0.32,
    pelletSize: 0.075,
    seekStrength: 2.4,
  },

  floaters: {
    lilyPads: 5,
    petals: 14,
    lilyRadiusMin: 0.55,
    lilyRadiusMax: 0.95,
    petalSize: 0.14,
    drift: 0.05,
    rippleBob: 0.55,
    /** How far drops push floaters (world units / strength). */
    rippleShove: 0.9,
  },

  lighting: {
    /** Default time of day, 0 = midnight, 0.5 = noon. */
    defaultTimeOfDay: 0.42,
    transitionDuration: 1.2,
  },

  defaults: {
    rippleStrength: 0.6,
    rippleDamping: 0.35,
    swimSpeed: 1,
  },

  reducedMotion: {
    rippleScale: 0.4,
    swimScale: 0.55,
    wakeScale: 0,
  },
} as const;

export type PondConfig = typeof pondConfig;
