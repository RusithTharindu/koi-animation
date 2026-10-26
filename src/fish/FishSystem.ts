import gsap from "gsap";
import { Scene } from "three";
import { pondConfig } from "@/config/pond.config";
import { clamp, distToSegmentSq, randRange } from "@/lib/math";
import { TweenGroup } from "@/lib/TweenGroup";
import type { SharedUniforms } from "@/scene/sharedUniforms";
import { usePondStore, type FishMeta } from "@/store/pondStore";
import { createKoiGeometry } from "./KoiGeometry";
import { Koi } from "./Koi";

/** Extra steering contributed by interaction modes or food. */
export interface SteerAccumulator {
  fx: number;
  fy: number;
  /** Multiplies the target speed. */
  speedMul: number;
  /** Desired depth override (-1 = none). */
  depth: number;
}

export type SteeringInfluence = (koi: Koi, out: SteerAccumulator) => void;

/**
 * Runs koi behaviour (wander, boids schooling, edge avoidance, idling) and
 * keeps their meshes in sync with the store. Discrete behaviour changes are
 * GSAP tweens on `koi.behaviour`; continuous steering happens per frame.
 */
export class FishSystem {
  readonly fish: Koi[] = [];
  readonly influences: SteeringInfluence[] = [];
  /** Fish under the cursor in remove mode. */
  hoveredId: string | null = null;
  /** Receives surface disturbances from koi swimming near the top. */
  onWake: ((x: number, y: number, radius: number, strength: number) => void) | null = null;

  private readonly geometry = createKoiGeometry();
  private readonly byId = new Map<string, Koi>();
  private readonly tweens = new TweenGroup();
  /** Despawns finish even while the pond is paused, so removing a koi always gives feedback. */
  private readonly exitTweens = new TweenGroup();
  private readonly unsubscribe: () => void;
  private readonly acc: SteerAccumulator = { fx: 0, fy: 0, speedMul: 1, depth: -1 };
  private halfW = 5;
  private halfH = 5;
  private hasBounds = false;

  constructor(
    private readonly scene: Scene,
    private readonly shared: SharedUniforms,
  ) {
    this.unsubscribe = usePondStore.subscribe((state, prev) => {
      if (state.fish !== prev.fish) this.reconcile(state.fish);
      if (state.paused !== prev.paused) this.tweens.setPaused(state.paused);
    });
  }

  setBounds(worldW: number, worldH: number) {
    this.halfW = worldW / 2;
    this.halfH = worldH / 2;
    if (!this.hasBounds) {
      // Spawn the initial school once we know where the walls are.
      this.hasBounds = true;
      this.reconcile(usePondStore.getState().fish, true);
    }
    // Keep fish inside after a resize.
    for (const koi of this.fish) {
      koi.x = clamp(koi.x, -this.halfW + 0.5, this.halfW - 0.5);
      koi.y = clamp(koi.y, -this.halfH + 0.5, this.halfH - 0.5);
    }
  }

  update(dt: number) {
    for (const koi of this.fish) {
      this.steer(koi, dt);
      this.wake(koi, dt);
    }
  }

  /** Shallow, moving koi push a faint bow wave into the surface. */
  private wake(koi: Koi, dt: number) {
    const cfg = pondConfig.fish.wake;
    const shallow = 1 - koi.visualDepth / 0.45;
    if (!this.onWake || shallow <= 0 || koi.behaviour.appear < 0.5) return;
    const lengthsPerSec = koi.speed / Math.max(koi.length, 1e-3);
    // Drops are applied once per frame, so scale by dt to stay frame-rate independent.
    const strength = cfg.strength * shallow * Math.min(lengthsPerSec, 2.5) * dt * 60;
    if (strength < 1e-4) return;
    const ahead = koi.length * 0.08;
    this.onWake(
      koi.x + Math.cos(koi.heading) * ahead,
      koi.y + Math.sin(koi.heading) * ahead,
      cfg.radius * (koi.length / pondConfig.fish.lengthMax) * 1.4,
      strength,
    );
  }

  syncUniforms() {
    const sun = this.shared.uSunDir.value;
    const daylight = this.shared.uDaylight.value;
    for (const koi of this.fish) {
      koi.updateUniforms(sun.x, sun.y, sun.z, daylight, koi.id === this.hoveredId ? 1 : 0);
    }
  }

  /** Returns the topmost koi whose body is under (x, y). */
  pick(x: number, y: number): Koi | null {
    let best: Koi | null = null;
    let bestDepth = Infinity;
    const N = pondConfig.fish.spineSegments;
    for (const koi of this.fish) {
      if (koi.leaving) continue;
      const r = koi.length * pondConfig.fish.widthRatio + pondConfig.fish.hitPadding;
      const s = koi.spine;
      for (let i = 0; i < N - 1; i++) {
        if (distToSegmentSq(x, y, s[i * 2], s[i * 2 + 1], s[i * 2 + 2], s[i * 2 + 3]) < r * r) {
          if (koi.visualDepth < bestDepth) {
            best = koi;
            bestDepth = koi.visualDepth;
          }
          break;
        }
      }
    }
    return best;
  }

  /** Makes a koi bolt away from (x, y), then calm down over a few seconds. */
  startle(koi: Koi, fromX: number, fromY: number, intensity = 1) {
    if (koi.scatterCooldown > 0 || koi.leaving) return;
    koi.scatterCooldown = pondConfig.interaction.scatterCooldown;
    koi.fleeAngle = Math.atan2(koi.y - fromY, koi.x - fromX);
    koi.targetDepth = clamp(koi.targetDepth + 0.25, 0, pondConfig.fish.depth.max);
    this.tween(() =>
      gsap
        .timeline()
        .to(koi.behaviour, { panic: clamp(intensity, 0, 1), duration: 0.12, ease: "power2.out" })
        .to(koi.behaviour, { panic: 0, duration: pondConfig.fish.scatterCalmDuration, ease: "power2.inOut" }),
    );
  }

  dispose() {
    this.unsubscribe();
    this.tweens.kill();
    this.exitTweens.kill();
    for (const koi of this.fish) {
      this.scene.remove(koi.mesh, koi.shadow);
      koi.dispose();
    }
    this.fish.length = 0;
    this.byId.clear();
    this.geometry.dispose();
  }

  private reconcile(metas: FishMeta[], initial = false) {
    if (!this.hasBounds) return;
    const ids = new Set(metas.map((m) => m.id));

    // Removed outright (e.g. scene reset).
    for (const koi of [...this.fish]) {
      if (!ids.has(koi.id)) this.destroy(koi);
    }

    for (const meta of metas) {
      const koi = this.byId.get(meta.id);
      if (!koi) {
        if (!meta.leaving) this.spawn(meta, initial);
      } else if (meta.leaving && !koi.leaving) {
        this.despawn(koi);
      }
    }
  }

  private spawn(meta: FishMeta, initial: boolean) {
    const m = pondConfig.fish.edgeMargin;
    const koi = new Koi(
      {
        id: meta.id,
        variety: meta.variety,
        seed: meta.seed,
        x: randRange(-this.halfW + m, this.halfW - m),
        y: randRange(-this.halfH + m, this.halfH - m),
        heading: Math.random() * Math.PI * 2,
      },
      this.geometry,
      this.shared,
    );
    this.fish.push(koi);
    this.byId.set(koi.id, koi);
    this.scene.add(koi.shadow, koi.mesh);

    // Rise up from the depths.
    koi.behaviour.dive = 0.6;
    const duration = pondConfig.fish.spawnDuration * (initial ? 1.6 : 1);
    this.tween(() =>
      gsap.to(koi.behaviour, {
        appear: 1,
        dive: 0,
        duration,
        delay: initial ? Math.random() * 0.8 : 0,
        ease: "power2.out",
      }),
    );
  }

  private despawn(koi: Koi) {
    koi.leaving = true;
    if (this.hoveredId === koi.id) this.hoveredId = null;
    gsap.killTweensOf(koi.behaviour);
    this.exitTweens.add(() =>
      gsap.to(koi.behaviour, {
        appear: 0,
        dive: 0.7,
        speedMul: 1.6,
        duration: pondConfig.fish.despawnDuration,
        ease: "power2.in",
        onComplete: () => usePondStore.getState().finalizeRemoval(koi.id),
      }),
    );
  }

  private destroy(koi: Koi) {
    gsap.killTweensOf(koi.behaviour);
    this.scene.remove(koi.mesh, koi.shadow);
    koi.dispose();
    this.byId.delete(koi.id);
    const i = this.fish.indexOf(koi);
    if (i >= 0) this.fish.splice(i, 1);
  }

  /** Starts a koi animation inside the system's tween group (paused with the pond, killed on dispose). */
  private tween(create: () => gsap.core.Animation) {
    this.tweens.add(create);
  }

  private steer(koi: Koi, dt: number) {
    const cfg = pondConfig.fish;
    const { params, reducedMotion } = usePondStore.getState();
    const length = koi.length;
    const b = koi.behaviour;
    koi.scatterCooldown = Math.max(0, koi.scatterCooldown - dt);

    // Wander: a slowly drifting offset from the current heading.
    koi.wander = clamp(koi.wander + (koi.rng() - 0.5) * cfg.wander.jitter * dt * 4, -1, 1);
    let dx = Math.cos(koi.heading + koi.wander * cfg.wander.strength);
    let dy = Math.sin(koi.heading + koi.wander * cfg.wander.strength);

    // Boids: separation, alignment, cohesion with nearby fish at similar depth.
    const bc = cfg.boids;
    let sx = 0;
    let sy = 0;
    let axs = 0;
    let ays = 0;
    let cx = 0;
    let cy = 0;
    let count = 0;
    const sepR = bc.separationRadius * (length / cfg.lengthMax);
    for (const other of this.fish) {
      if (other === koi || other.leaving) continue;
      const ox = other.x - koi.x;
      const oy = other.y - koi.y;
      const d2 = ox * ox + oy * oy;
      if (d2 > bc.neighbourRadius * bc.neighbourRadius || d2 < 1e-8) continue;
      const d = Math.sqrt(d2);
      // Fish at different depths can pass over each other.
      const layer = 1 - clamp(Math.abs(other.visualDepth - koi.visualDepth) * 1.6, 0, 0.85);
      if (d < sepR) {
        const f = ((sepR - d) / sepR) * layer;
        sx -= (ox / d) * f;
        sy -= (oy / d) * f;
      }
      axs += Math.cos(other.heading);
      ays += Math.sin(other.heading);
      cx += other.x;
      cy += other.y;
      count++;
    }
    if (count > 0) {
      dx += sx * bc.separation;
      dy += sy * bc.separation;
      dx += (axs / count) * bc.alignment;
      dy += (ays / count) * bc.alignment;
      const tx = cx / count - koi.x;
      const ty = cy / count - koi.y;
      const tl = Math.hypot(tx, ty) || 1;
      dx += (tx / tl) * bc.cohesion;
      dy += (ty / tl) * bc.cohesion;
    }

    // Mode / food influences.
    const acc = this.acc;
    acc.fx = 0;
    acc.fy = 0;
    acc.speedMul = 1;
    acc.depth = -1;
    for (const influence of this.influences) influence(koi, acc);
    dx += acc.fx;
    dy += acc.fy;

    // Panic: bolt along the flee direction.
    if (b.panic > 0.01) {
      dx += Math.cos(koi.fleeAngle) * b.panic * 4;
      dy += Math.sin(koi.fleeAngle) * b.panic * 4;
    }

    // Edge avoidance using a look-ahead point; strongest of all forces.
    const look = length * (1 + koi.speed / Math.max(length, 0.1));
    const ax = koi.x + Math.cos(koi.heading) * look;
    const ay = koi.y + Math.sin(koi.heading) * look;
    const m = cfg.edgeMargin;
    const push = (dist: number) => (dist < m ? Math.pow((m - Math.max(dist, -m)) / m, 2) * cfg.edgeForce : 0);
    dx += push(ax + this.halfW) - push(this.halfW - ax);
    dy += push(ay + this.halfH) - push(this.halfH - ay);

    // Idle drifts and depth changes, tweened for smooth transitions.
    if (!koi.leaving && b.panic < 0.05 && koi.idleTimer <= 0 && koi.rng() < cfg.idle.chancePerSecond * dt) {
      const hold = randRange(cfg.idle.durationMin, cfg.idle.durationMax, koi.rng);
      koi.idleTimer = hold + 3;
      this.tween(() =>
        gsap
          .timeline()
          .to(b, { speedMul: cfg.idleSpeed / cfg.cruiseSpeed, duration: 1.8, ease: "sine.inOut" })
          .to(b, { speedMul: 1, duration: 1.4, ease: "sine.inOut" }, `+=${hold}`),
      );
    }
    koi.idleTimer -= dt;
    if (koi.rng() < cfg.depth.changeChancePerSecond * dt) {
      koi.targetDepth = randRange(cfg.depth.min, cfg.depth.max, koi.rng);
    }
    if (acc.depth >= 0) koi.targetDepth = acc.depth;

    const motion = reducedMotion ? pondConfig.reducedMotion.swimScale : 1;
    const cruise = cfg.cruiseSpeed * length * koi.temperament * b.speedMul * params.swimSpeed * motion * acc.speedMul;
    const speed = cruise + b.panic * cfg.panicSpeed * length * motion;
    // Chasing food or a hand keeps koi stroking rather than coasting.
    const urgency = Math.max(b.panic, acc.speedMul > 1.05 ? 1 : 0);
    koi.integrate(dt, Math.atan2(dy, dx), speed, 1 + b.panic * 2.2, urgency);
  }
}
