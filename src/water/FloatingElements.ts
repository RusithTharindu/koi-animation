import {
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Sphere,
  Vector2,
  Vector3,
} from "three";
import { pondConfig } from "@/config/pond.config";
import { clamp, randRange, TAU } from "@/lib/math";
import { floaterFragment, floaterVertex } from "@/shaders/floater";
import type { SharedUniforms } from "@/scene/sharedUniforms";

const Kind = { Pad: 0, Petal: 1, Blossom: 2 } as const;
type Kind = (typeof Kind)[keyof typeof Kind];

interface Floater {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  /** Collision radius (world units). */
  radius: number;
  /** Drawn size across (world units). */
  size: number;
  seed: number;
  /** Blossoms ride on a pad. */
  host?: Floater;
  hostDx?: number;
  hostDy?: number;
}

/**
 * Lily pads, blossoms and cherry petals floating on the surface. One
 * instanced draw call for the floaters and one for their floor shadows.
 * Bobbing and tilting come from the ripple texture in the vertex shader;
 * drift and shoves from disturbances are integrated on the CPU.
 */
export class FloatingElements {
  readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>;
  readonly shadow: Mesh<InstancedBufferGeometry, ShaderMaterial>;
  private readonly floaters: Floater[] = [];
  private readonly inst: InstancedBufferAttribute;
  private readonly base = new PlaneGeometry(1, 1);
  private halfW = 5;
  private halfH = 5;
  private seeded = false;
  private time = 0;

  constructor(shared: SharedUniforms) {
    const cfg = pondConfig.floaters;
    const capacity = cfg.lilyPads * 2 + cfg.petals;
    const geometry = new InstancedBufferGeometry();
    geometry.index = this.base.index;
    geometry.setAttribute("position", this.base.getAttribute("position"));
    this.inst = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    geometry.setAttribute("aInst", this.inst);
    geometry.setAttribute("aKind", new InstancedBufferAttribute(new Float32Array(capacity * 2), 2));
    geometry.instanceCount = 0;
    geometry.boundingSphere = new Sphere(new Vector3(), 1e5);

    const make = (shadow: boolean) =>
      new ShaderMaterial({
        vertexShader: floaterVertex,
        fragmentShader: floaterFragment,
        uniforms: {
          ...shared,
          uRippleBob: { value: cfg.rippleBob },
          uShadowOffset: { value: new Vector2() },
          uShadowStrength: { value: 0.35 },
        },
        defines: shadow ? { SHADOW: 1 } : {},
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });

    this.mesh = new Mesh(geometry, make(false));
    this.shadow = new Mesh(geometry, make(true));
    for (const m of [this.mesh, this.shadow]) m.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.shadow.renderOrder = 2;
  }

  setBounds(worldW: number, worldH: number) {
    this.halfW = worldW / 2;
    this.halfH = worldH / 2;
    if (!this.seeded) {
      this.seeded = true;
      this.seed();
    }
    for (const f of this.floaters) {
      f.x = clamp(f.x, -this.halfW + f.radius, this.halfW - f.radius);
      f.y = clamp(f.y, -this.halfH + f.radius, this.halfH - f.radius);
    }
  }

  /** Pushes nearby floaters away from a disturbance. */
  shove(x: number, y: number, radius: number, strength: number) {
    const k = Math.abs(strength) * pondConfig.floaters.rippleShove;
    for (const f of this.floaters) {
      if (f.host) continue;
      const reach = radius * 3 + f.radius;
      const dx = f.x - x;
      const dy = f.y - y;
      const d = Math.hypot(dx, dy);
      if (d > reach || d < 1e-4) continue;
      // Light petals fly further than heavy pads.
      const mass = f.kind === Kind.Petal ? 1 : 3.5 * f.radius;
      const push = (k * (1 - d / reach)) / mass;
      f.vx += (dx / d) * push;
      f.vy += (dy / d) * push;
      f.spin += (Math.random() - 0.5) * push * 2;
    }
  }

  update(dt: number, sunX: number, sunY: number, sunZ: number, daylight: number, motionScale: number) {
    const cfg = pondConfig.floaters;
    this.time += dt;
    const drag = Math.exp(-0.7 * dt);
    const spinDrag = Math.exp(-1.2 * dt);

    for (const f of this.floaters) {
      if (f.host) continue;
      // A lazy, slowly turning surface current.
      const current = cfg.drift * motionScale;
      f.vx += Math.cos(this.time * 0.05 + f.seed * TAU) * current * dt;
      f.vy += Math.sin(this.time * 0.04 + f.seed * 9) * current * dt;
      f.vx *= drag;
      f.vy *= drag;
      f.spin *= spinDrag;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += (f.spin + Math.sin(this.time * 0.1 + f.seed * 20) * 0.02 * motionScale) * dt;

      // Soft walls.
      const minX = -this.halfW + f.radius;
      const maxX = this.halfW - f.radius;
      const minY = -this.halfH + f.radius;
      const maxY = this.halfH - f.radius;
      if (f.x < minX) { f.x = minX; f.vx = Math.abs(f.vx) * 0.4; }
      if (f.x > maxX) { f.x = maxX; f.vx = -Math.abs(f.vx) * 0.4; }
      if (f.y < minY) { f.y = minY; f.vy = Math.abs(f.vy) * 0.4; }
      if (f.y > maxY) { f.y = maxY; f.vy = -Math.abs(f.vy) * 0.4; }
    }

    // Pads bump into each other instead of overlapping.
    for (let i = 0; i < this.floaters.length; i++) {
      const a = this.floaters[i];
      if (a.kind !== Kind.Pad) continue;
      for (let j = i + 1; j < this.floaters.length; j++) {
        const b = this.floaters[j];
        if (b.kind !== Kind.Pad) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1e-4;
        const overlap = a.radius + b.radius - d;
        if (overlap > 0) {
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;
        }
      }
    }

    // Blossoms ride their pads.
    for (const f of this.floaters) {
      if (!f.host) continue;
      f.x = f.host.x + (f.hostDx ?? 0);
      f.y = f.host.y + (f.hostDy ?? 0);
      f.rot = f.host.rot * 0.5 + f.seed * TAU;
    }

    this.writeInstances();

    // Floor shadows: offset along the sun, fainter at night.
    const sz = Math.max(sunZ, 0.5);
    const height = 1.25;
    (this.shadow.material.uniforms.uShadowOffset.value as Vector2).set((-sunX / sz) * height, (-sunY / sz) * height);
    this.shadow.material.uniforms.uShadowStrength.value = 0.38 * (0.25 + 0.75 * daylight);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.base.dispose();
    this.mesh.material.dispose();
    this.shadow.material.dispose();
  }

  private seed() {
    const cfg = pondConfig.floaters;
    const pads: Floater[] = [];
    for (let i = 0; i < cfg.lilyPads; i++) {
      const radius = randRange(cfg.lilyRadiusMin, cfg.lilyRadiusMax);
      // Lily pads cluster near the banks, leaving open water in the middle.
      const side = Math.random() < 0.5 ? -1 : 1;
      const pad: Floater = {
        kind: Kind.Pad,
        x: side * randRange(this.halfW * 0.45, this.halfW - radius),
        y: randRange(-this.halfH + radius, this.halfH - radius),
        vx: 0,
        vy: 0,
        rot: Math.random() * TAU,
        spin: 0,
        radius,
        size: radius * 2,
        seed: Math.random(),
      };
      pads.push(pad);
    }
    this.floaters.push(...pads);

    // A blossom on some pads, drawn after the pads.
    for (const pad of pads) {
      if (Math.random() < 0.45) {
        const a = Math.random() * TAU;
        this.floaters.push({
          kind: Kind.Blossom,
          x: pad.x,
          y: pad.y,
          vx: 0,
          vy: 0,
          rot: 0,
          spin: 0,
          radius: 0.3,
          size: pad.radius * 0.95,
          seed: Math.random(),
          host: pad,
          hostDx: Math.cos(a) * pad.radius * 0.3,
          hostDy: Math.sin(a) * pad.radius * 0.3,
        });
      }
    }

    for (let i = 0; i < cfg.petals; i++) {
      this.floaters.push({
        kind: Kind.Petal,
        x: randRange(-this.halfW + 0.3, this.halfW - 0.3),
        y: randRange(-this.halfH + 0.3, this.halfH - 0.3),
        vx: 0,
        vy: 0,
        rot: Math.random() * TAU,
        spin: (Math.random() - 0.5) * 0.2,
        radius: cfg.petalSize,
        size: cfg.petalSize * 2 * randRange(0.8, 1.2),
        seed: Math.random(),
      });
    }

    const kinds = this.mesh.geometry.getAttribute("aKind") as InstancedBufferAttribute;
    this.floaters.forEach((f, i) => {
      kinds.setXY(i, f.kind, f.seed);
    });
    kinds.needsUpdate = true;
    this.mesh.geometry.instanceCount = this.floaters.length;
  }

  private writeInstances() {
    const arr = this.inst.array as Float32Array;
    this.floaters.forEach((f, i) => {
      arr[i * 4] = f.x;
      arr[i * 4 + 1] = f.y;
      arr[i * 4 + 2] = f.rot;
      arr[i * 4 + 3] = f.size;
    });
    this.inst.needsUpdate = true;
  }
}
