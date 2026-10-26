import gsap from "gsap";
import { BufferAttribute, BufferGeometry, Points, ShaderMaterial, Sphere, Vector3 } from "three";
import { pondConfig } from "@/config/pond.config";
import { clamp, randRange } from "@/lib/math";
import { TweenGroup } from "@/lib/TweenGroup";
import { foodFragment, foodVertex } from "@/shaders/food";
import type { SharedUniforms } from "@/scene/sharedUniforms";
import type { SteerAccumulator } from "./FishSystem";
import type { Koi } from "./Koi";

interface Pellet {
  x: number;
  y: number;
  /** 0 = floating, 1 = resting on the floor. */
  sink: number;
  alpha: number;
  eaten: boolean;
}

const MAX = pondConfig.food.maxPellets;

/**
 * Food pellets: GSAP drives sinking and fading, koi steer towards the nearest
 * pellet and eat it on contact (with a gulp ripple near the surface).
 */
export class FoodSystem {
  readonly points: Points<BufferGeometry, ShaderMaterial>;
  private readonly pellets: Pellet[] = [];
  private readonly tweens = new TweenGroup();
  private readonly positions = new Float32Array(MAX * 3);
  private readonly sinks = new Float32Array(MAX);
  private readonly alphas = new Float32Array(MAX);

  constructor(
    shared: SharedUniforms,
    private readonly onGulp: (x: number, y: number) => void,
  ) {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(this.positions, 3));
    geometry.setAttribute("aSink", new BufferAttribute(this.sinks, 1));
    geometry.setAttribute("aAlpha", new BufferAttribute(this.alphas, 1));
    geometry.boundingSphere = new Sphere(new Vector3(), 1e5);
    geometry.setDrawRange(0, 0);

    this.points = new Points(
      geometry,
      new ShaderMaterial({
        vertexShader: foodVertex,
        fragmentShader: foodFragment,
        uniforms: {
          ...shared,
          uPixelsPerUnit: { value: 50 },
          uSize: { value: pondConfig.food.pelletSize * 2 },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.points.frustumCulled = false;
    // Between deep and shallow koi.
    this.points.renderOrder = 60;
  }

  get count() {
    return this.pellets.length;
  }

  setPixelsPerUnit(ppu: number) {
    this.points.material.uniforms.uPixelsPerUnit.value = ppu;
  }

  setPaused(paused: boolean) {
    this.tweens.setPaused(paused);
  }

  /** Scatters a handful of pellets around (x, y). */
  drop(x: number, y: number, halfW: number, halfH: number) {
    const cfg = pondConfig.food;
    for (let i = 0; i < cfg.perClick; i++) {
      if (this.pellets.length >= MAX) this.remove(this.pellets[0]);
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * cfg.spread;
      const pellet: Pellet = {
        x: clamp(x + Math.cos(a) * r, -halfW + 0.2, halfW - 0.2),
        y: clamp(y + Math.sin(a) * r, -halfH + 0.2, halfH - 0.2),
        sink: 0,
        alpha: 0,
        eaten: false,
      };
      this.pellets.push(pellet);
      const sinkTime = cfg.sinkDuration * randRange(0.8, 1.2);
      this.tweens.add(() =>
        gsap
          .timeline({ onComplete: () => this.remove(pellet) })
          .to(pellet, { alpha: 1, duration: 0.25, ease: "power1.out" })
          .to(pellet, { sink: 1, duration: sinkTime, ease: "sine.in" }, 0)
          .to(pellet, { alpha: 0, duration: 1.5, ease: "power1.in" }, sinkTime + cfg.restDuration),
      );
    }
  }

  /** Steering influence: hungry koi swim to the nearest pellet and rise or dive to meet it. */
  readonly influence = (koi: Koi, out: SteerAccumulator) => {
    if (this.pellets.length === 0 || koi.leaving) return;
    const cfg = pondConfig.food;
    let best: Pellet | null = null;
    let bestD: number = cfg.senseRadius;
    for (const p of this.pellets) {
      if (p.eaten) continue;
      const d = Math.hypot(p.x - koi.x, p.y - koi.y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (!best) return;

    const pull = cfg.seekStrength * (0.4 + 0.6 * (1 - bestD / cfg.senseRadius));
    out.fx += ((best.x - koi.x) / Math.max(bestD, 1e-3)) * pull;
    out.fy += ((best.y - koi.y) / Math.max(bestD, 1e-3)) * pull;
    // Hurry over, then slow down to take the pellet.
    out.speedMul *= clamp(bestD / (koi.length * 0.8), 0.45, 1.5);
    out.depth = clamp(best.sink * 0.85, pondConfig.fish.depth.min, pondConfig.fish.depth.max);

    if (bestD < cfg.eatRadius + koi.length * 0.05 && Math.abs(koi.visualDepth - best.sink * 0.85) < 0.4) {
      this.eat(best);
    }
  };

  update() {
    const n = this.pellets.length;
    for (let i = 0; i < n; i++) {
      const p = this.pellets[i];
      this.positions[i * 3] = p.x;
      this.positions[i * 3 + 1] = p.y;
      this.sinks[i] = p.sink;
      this.alphas[i] = p.alpha;
    }
    const g = this.points.geometry;
    g.setDrawRange(0, n);
    g.attributes.position.needsUpdate = true;
    g.attributes.aSink.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
  }

  clear() {
    for (const p of [...this.pellets]) this.remove(p);
  }

  dispose() {
    this.tweens.kill();
    this.pellets.length = 0;
    this.points.geometry.dispose();
    this.points.material.dispose();
  }

  private eat(p: Pellet) {
    p.eaten = true;
    gsap.killTweensOf(p);
    if (p.sink < 0.3) this.onGulp(p.x, p.y);
    this.tweens.add(() =>
      gsap.to(p, { alpha: 0, duration: 0.15, ease: "power2.in", onComplete: () => this.remove(p) }),
    );
  }

  private remove(p: Pellet) {
    gsap.killTweensOf(p);
    const i = this.pellets.indexOf(p);
    if (i >= 0) this.pellets.splice(i, 1);
  }
}
