import { Scene } from "three";
import { pondConfig } from "@/config/pond.config";
import { clamp } from "@/lib/math";
import type { SharedUniforms } from "@/scene/sharedUniforms";
import { createKoiGeometry } from "./KoiGeometry";
import { Koi } from "./Koi";

/** Runs koi behaviour and keeps their meshes in the underwater scene. */
export class FishSystem {
  readonly fish: Koi[] = [];
  private readonly geometry = createKoiGeometry();
  private halfW = 5;
  private halfH = 5;

  constructor(
    private readonly scene: Scene,
    private readonly shared: SharedUniforms,
  ) {
    const koi = new Koi({ id: "koi-0", variety: "kohaku", seed: 0.37, x: 0, y: 0, heading: 0.4 }, this.geometry, shared);
    koi.behaviour.appear = 1;
    this.add(koi);
  }

  setBounds(worldW: number, worldH: number) {
    this.halfW = worldW / 2;
    this.halfH = worldH / 2;
  }

  update(dt: number) {
    for (const koi of this.fish) this.steer(koi, dt);
  }

  syncUniforms() {
    const sun = this.shared.uSunDir.value;
    const daylight = this.shared.uDaylight.value;
    for (const koi of this.fish) koi.updateUniforms(sun.x, sun.y, sun.z, daylight, 0);
  }

  dispose() {
    for (const koi of this.fish) {
      this.scene.remove(koi.mesh, koi.shadow);
      koi.dispose();
    }
    this.fish.length = 0;
    this.geometry.dispose();
  }

  private add(koi: Koi) {
    this.fish.push(koi);
    this.scene.add(koi.shadow, koi.mesh);
  }

  private steer(koi: Koi, dt: number) {
    const cfg = pondConfig.fish;
    const length = koi.length;

    // Wander: a slowly drifting offset from the current heading.
    koi.wander = clamp(koi.wander + (koi.rng() - 0.5) * cfg.wander.jitter * dt * 4, -1, 1);
    let dx = Math.cos(koi.heading + koi.wander * cfg.wander.strength);
    let dy = Math.sin(koi.heading + koi.wander * cfg.wander.strength);

    // Edge avoidance using a look-ahead point.
    const ax = koi.x + Math.cos(koi.heading) * length * 1.2;
    const ay = koi.y + Math.sin(koi.heading) * length * 1.2;
    const m = cfg.edgeMargin;
    const push = (dist: number) => (dist < m ? Math.pow((m - dist) / m, 2) * cfg.edgeForce : 0);
    dx += push(ax + this.halfW) - push(this.halfW - ax);
    dy += push(ay + this.halfH) - push(this.halfH - ay);

    // Occasional idle drift and depth changes.
    if (koi.idleTimer > 0) {
      koi.idleTimer -= dt;
      koi.behaviour.speedMul = Math.max(koi.behaviour.speedMul - dt * 0.6, cfg.idleSpeed / cfg.cruiseSpeed);
    } else {
      koi.behaviour.speedMul = Math.min(koi.behaviour.speedMul + dt * 0.4, 1);
      if (koi.rng() < cfg.idle.chancePerSecond * dt) {
        koi.idleTimer = cfg.idle.durationMin + koi.rng() * (cfg.idle.durationMax - cfg.idle.durationMin);
      }
    }
    if (koi.rng() < cfg.depth.changeChancePerSecond * dt) {
      koi.targetDepth = cfg.depth.min + koi.rng() * (cfg.depth.max - cfg.depth.min);
    }

    const speed = cfg.cruiseSpeed * length * koi.temperament * koi.behaviour.speedMul;
    koi.integrate(dt, Math.atan2(dy, dx), speed, 1);
  }
}
