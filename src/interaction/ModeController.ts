import { pondConfig, type InteractionMode } from "@/config/pond.config";
import type { FishSystem, SteerAccumulator } from "@/fish/FishSystem";
import type { FoodSystem } from "@/fish/FoodSystem";
import type { Koi } from "@/fish/Koi";
import { clamp } from "@/lib/math";
import { usePondStore } from "@/store/pondStore";
import type { PointerHandlers, PointerSample } from "./InputController";

export interface ModeServices {
  /** Adds a ripple; strength is scaled by the user's ripple strength. */
  ripple: (x: number, y: number, radius: number, strength: number) => void;
  fish: FishSystem;
  food: FoodSystem;
  pointers: () => ReadonlyMap<number, PointerSample>;
  bounds: () => { halfW: number; halfH: number };
}

interface StrokeState {
  /** Where the last drop of a continuous stroke was placed. */
  lastX: number;
  lastY: number;
}

/**
 * Turns pointer input into pond effects for the active cursor mode, and
 * contributes steering forces (attract, scatter, hand) to every koi.
 */
export class ModeController implements PointerHandlers {
  private readonly strokes = new Map<number, StrokeState>();
  private handClock = 0;

  constructor(private readonly services: ModeServices) {
    services.fish.influences.push(this.influence);
  }

  private get mode(): InteractionMode {
    return usePondStore.getState().mode;
  }

  onDown = (p: PointerSample) => {
    // Picking a koi to remove still works while paused; nothing else does.
    if (usePondStore.getState().paused && this.mode !== "remove") return;
    const { ripple, fish, food, bounds } = this.services;
    const w = pondConfig.water;
    this.strokes.set(p.id, { lastX: p.x, lastY: p.y });

    switch (this.mode) {
      case "ripple":
        ripple(p.x, p.y, w.clickRadius, -w.clickStrength);
        break;
      case "trail":
        ripple(p.x, p.y, w.trailRadius, -w.trailStrength * 1.5);
        break;
      case "feed": {
        const { halfW, halfH } = bounds();
        food.drop(p.x, p.y, halfW, halfH);
        ripple(p.x, p.y, w.clickRadius * 0.5, -w.clickStrength * 0.25);
        break;
      }
      case "attract":
        ripple(p.x, p.y, w.clickRadius * 0.6, -w.clickStrength * 0.3);
        break;
      case "scatter":
        ripple(p.x, p.y, w.clickRadius, -w.clickStrength * 0.8);
        this.startleAround(p.x, p.y, pondConfig.interaction.scatterRadius * 1.4, 1);
        break;
      case "hand":
        ripple(p.x, p.y, w.handRadius, -w.handStrength * 1.4);
        this.startleAround(p.x, p.y, pondConfig.interaction.handRadius * 0.7, 0.6);
        break;
      case "remove": {
        const koi = fish.pick(p.x, p.y);
        if (koi) {
          usePondStore.getState().removeFish(koi.id);
          ripple(p.x, p.y, w.clickRadius * 0.7, -w.clickStrength * 0.5);
        }
        break;
      }
    }
  };

  onMove = (p: PointerSample) => {
    const mode = this.mode;
    if (usePondStore.getState().paused && mode !== "remove") return;
    const w = pondConfig.water;

    if (mode === "remove") {
      this.services.fish.hoveredId = this.services.fish.pick(p.x, p.y)?.id ?? null;
      return;
    }

    if (mode === "scatter") {
      // Fast movement over fish spooks them even without pressing.
      const speed = Math.hypot(p.vx, p.vy);
      if (p.down || speed > 3) {
        this.startleAround(p.x, p.y, pondConfig.interaction.scatterRadius, clamp(speed / 8, 0.4, 1));
      }
      return;
    }

    if (!p.down) return;
    if (mode === "trail") {
      this.stroke(p, w.trailSpacing, w.trailRadius, -w.trailStrength);
    } else if (mode === "hand") {
      const speed = Math.hypot(p.vx, p.vy);
      this.stroke(p, w.handSpacing, w.handRadius, -w.handStrength * clamp(0.35 + speed / 6, 0.35, 1.6));
    }
  };

  onUp = (p: PointerSample) => {
    this.strokes.delete(p.id);
  };

  /** Per-frame effects: a resting finger in the water keeps it gently disturbed. */
  tick(dt: number) {
    if (this.mode !== "hand") return;
    this.handClock += dt;
    if (this.handClock < 0.09) return;
    this.handClock = 0;
    const w = pondConfig.water;
    this.services.pointers().forEach((p) => {
      if (p.down && Math.hypot(p.vx, p.vy) < 0.5) {
        this.services.ripple(p.x, p.y, w.handRadius * 0.6, -w.handStrength * 0.18);
      }
    });
  }

  /** Clears transient state when the mode changes. */
  reset() {
    this.strokes.clear();
    this.services.fish.hoveredId = null;
  }

  /** Steering forces that depend on where pointers are. */
  private readonly influence = (koi: Koi, out: SteerAccumulator) => {
    const mode = this.mode;
    if (mode !== "attract" && mode !== "hand" && mode !== "scatter") return;
    const ic = pondConfig.interaction;

    this.services.pointers().forEach((p) => {
      // Touch pointers only exist while pressed; mouse pointers also hover.
      const dx = p.x - koi.x;
      const dy = p.y - koi.y;
      const d = Math.hypot(dx, dy) || 1e-3;

      if (mode === "attract" && d < ic.attractRadius) {
        const pull = ic.attractStrength * (0.5 + 0.5 * (1 - d / ic.attractRadius));
        out.fx += (dx / d) * pull;
        out.fy += (dy / d) * pull;
        // Arrive gently and come up to the surface, like koi begging for food.
        out.speedMul *= clamp(d / (koi.length * 1.5), 0.35, 1.3);
        out.depth = pondConfig.fish.depth.min + 0.05;
      } else if (mode === "scatter" && d < ic.scatterRadius) {
        const f = (1 - d / ic.scatterRadius) * 3;
        out.fx -= (dx / d) * f;
        out.fy -= (dy / d) * f;
      } else if (mode === "hand" && p.down && d < ic.handRadius + koi.length * 0.5) {
        // The hand pushes water: fish are nudged away and carried with its motion.
        const f = (1 - d / (ic.handRadius + koi.length * 0.5)) * ic.handPush;
        out.fx += -(dx / d) * f + p.vx * 0.25 * f;
        out.fy += -(dy / d) * f + p.vy * 0.25 * f;
        out.speedMul *= 1 + f * 0.4;
      }
    });
  };

  private startleAround(x: number, y: number, radius: number, intensity: number) {
    for (const koi of this.services.fish.fish) {
      const d = Math.hypot(koi.x - x, koi.y - y);
      if (d < radius) this.services.fish.startle(koi, x, y, intensity * (1 - (d / radius) * 0.5));
    }
  }

  /** Lays evenly spaced drops along the pointer's path so fast drags leave unbroken wakes. */
  private stroke(p: PointerSample, spacing: number, radius: number, strength: number) {
    const s = this.strokes.get(p.id);
    if (!s) return;
    let dx = p.x - s.lastX;
    let dy = p.y - s.lastY;
    let dist = Math.hypot(dx, dy);
    if (dist < spacing) return;
    dx /= dist;
    dy /= dist;
    // Cap the work for huge jumps (e.g. after a frame hitch).
    const maxSteps = 24;
    let steps = 0;
    while (dist >= spacing && steps < maxSteps) {
      s.lastX += dx * spacing;
      s.lastY += dy * spacing;
      this.services.ripple(s.lastX, s.lastY, radius, strength);
      dist -= spacing;
      steps++;
    }
    if (steps === maxSteps) {
      s.lastX = p.x;
      s.lastY = p.y;
    }
  }
}
