import { Color, DoubleSide, Mesh, NormalBlending, ShaderMaterial, Vector2, type BufferGeometry } from "three";
import { pondConfig, type KoiVariety } from "@/config/pond.config";
import { clamp, createRng, damp, lerp, TAU } from "@/lib/math";
import { koiFragment, koiVertex } from "@/shaders/koi";
import type { SharedUniforms } from "@/scene/sharedUniforms";
import { applyUndulation, solveChain } from "./spine";
import { VARIETIES, type VarietyDef } from "./varieties";

const N = pondConfig.fish.spineSegments;

export interface KoiInit {
  id: string;
  variety: KoiVariety;
  seed: number;
  x: number;
  y: number;
  heading: number;
}

/** Values tweened by GSAP; the frame loop only reads them. */
export interface KoiBehaviour {
  /** Multiplies cruise speed; tweened down for idle drifting. */
  speedMul: number;
  /** 0..1 startle level; adds speed and fleeing. */
  panic: number;
  /** 0..1 opacity during spawn / despawn. */
  appear: number;
  /** Extra depth pushed on while diving away. */
  dive: number;
}

/**
 * One koi: kinematic state, spine and its two meshes (body + floor shadow).
 * Steering decisions come from FishSystem; this class integrates them.
 */
export class Koi {
  readonly id: string;
  readonly variety: KoiVariety;
  readonly def: VarietyDef;
  readonly seed: number;
  readonly rng: () => number;
  /** Body length at the surface, world units. */
  readonly baseLength: number;
  /** Individual cruise speed multiplier. */
  readonly temperament: number;

  x: number;
  y: number;
  heading: number;
  speed = 0;
  turnRate = 0;
  depth: number;
  targetDepth: number;
  phase: number;
  wander = 0;
  idleTimer = 0;
  scatterCooldown = 0;
  /** Direction to bolt in while panicking. */
  fleeAngle = 0;
  leaving = false;
  readonly behaviour: KoiBehaviour = { speedMul: 1, panic: 0, appear: 0, dive: 0 };

  readonly joints = new Float32Array(N * 2);
  readonly spine = new Float32Array(N * 2);
  readonly mesh: Mesh<BufferGeometry, ShaderMaterial>;
  readonly shadow: Mesh<BufferGeometry, ShaderMaterial>;

  constructor(init: KoiInit, geometry: BufferGeometry, shared: SharedUniforms) {
    const cfg = pondConfig.fish;
    this.id = init.id;
    this.variety = init.variety;
    this.def = VARIETIES[init.variety];
    this.seed = init.seed;
    this.rng = createRng(Math.floor(init.seed * 1e9));
    this.baseLength = lerp(cfg.lengthMin, cfg.lengthMax, this.rng());
    this.temperament = 1 + (this.rng() - 0.5) * 2 * cfg.speedJitter;
    this.x = init.x;
    this.y = init.y;
    this.heading = init.heading;
    this.depth = lerp(cfg.depth.min, cfg.depth.max, this.rng());
    this.targetDepth = this.depth;
    this.phase = this.rng() * TAU;

    // Lay the spine out straight behind the head.
    const seg = this.baseLength / (N - 1);
    for (let i = 0; i < N; i++) {
      this.joints[i * 2] = this.x - Math.cos(this.heading) * seg * i;
      this.joints[i * 2 + 1] = this.y - Math.sin(this.heading) * seg * i;
    }
    this.spine.set(this.joints);

    const d = this.def;
    const uniforms = {
      ...shared,
      uSpine: { value: this.spine },
      uLength: { value: this.baseLength },
      uHalfWidth: { value: this.baseLength * cfg.widthRatio },
      uPad: { value: 0.03 },
      uSoft: { value: 0.02 },
      uTailBend: { value: 0 },
      uTailLen: { value: d.tailLength },
      uFinLen: { value: d.finLength },
      uFinL: { value: 0.8 },
      uFinR: { value: 0.8 },
      uPelvic: { value: 0.6 },
      uDorsal: { value: d.dorsal },
      uPhase: { value: 0 },
      uOffset: { value: new Vector2() },
      uBase: { value: new Color(...d.base) },
      uPatch: { value: new Color(...d.patch) },
      uPatch2: { value: new Color(...d.patch2) },
      uFin: { value: new Color(...d.fin) },
      uPattern: { value: d.pattern },
      uSeed: { value: init.seed },
      uMetallic: { value: d.metallic },
      uDepth: { value: this.depth },
      uAttenuation: { value: cfg.depth.attenuation },
      uAlpha: { value: 0 },
      uHighlight: { value: 0 },
      uShadowStrength: { value: cfg.shadow.strength },
    };

    const makeMaterial = (shadow: boolean) =>
      new ShaderMaterial({
        vertexShader: koiVertex,
        fragmentShader: koiFragment,
        // Each material gets its own per-fish uniform objects but shares the global ones.
        uniforms: shadow ? { ...uniforms, uPad: { value: 0.1 }, uSoft: { value: 0.1 }, uOffset: { value: new Vector2() } } : uniforms,
        defines: shadow ? { SPINE_N: N, SHADOW: 1 } : { SPINE_N: N },
        // Fin fans can mirror their winding while bending.
        side: DoubleSide,
        transparent: true,
        blending: NormalBlending,
        depthTest: false,
        depthWrite: false,
      });

    this.mesh = new Mesh(geometry, makeMaterial(false));
    this.shadow = new Mesh(geometry, makeMaterial(true));
    this.mesh.frustumCulled = false;
    this.shadow.frustumCulled = false;
    this.shadow.renderOrder = 1;
  }

  /** Effective depth including dive-away animation. */
  get visualDepth() {
    return clamp(this.depth + this.behaviour.dive, 0, 1);
  }

  get length() {
    const scale = lerp(1, pondConfig.fish.depth.scaleAtDeepest, this.visualDepth);
    return this.baseLength * scale;
  }

  /**
   * Turns towards `desiredAngle`, moves forward and rebuilds the spine.
   * @param targetSpeed world units / second
   */
  integrate(dt: number, desiredAngle: number, targetSpeed: number, turnScale: number) {
    const cfg = pondConfig.fish;
    let diff = desiredAngle - this.heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    // Turning needs forward motion: a drifting koi turns slowly instead of spinning on the spot.
    const swimFactor = clamp(this.speed / Math.max(cfg.cruiseSpeed * this.length, 1e-3), 0.25, 1.1);
    const maxTurn = cfg.maxTurnRate * turnScale * swimFactor;
    const wantTurn = clamp(diff * 2.4, -maxTurn, maxTurn);
    this.turnRate = damp(this.turnRate, wantTurn, 5, dt);
    this.heading += this.turnRate * dt;

    this.speed = damp(this.speed, targetSpeed, targetSpeed > this.speed ? 2.2 : 1.1, dt);
    this.x += Math.cos(this.heading) * this.speed * dt;
    this.y += Math.sin(this.heading) * this.speed * dt;
    this.depth = damp(this.depth, this.targetDepth, 0.35, dt);

    const length = this.length;
    const bodyLengthsPerSec = this.speed / Math.max(length, 1e-3);
    const beatHz = cfg.beatBaseHz + cfg.beatPerSpeed * bodyLengthsPerSec;
    this.phase += TAU * beatHz * dt;

    solveChain(this.joints, N, this.x, this.y, this.heading, length / (N - 1), cfg.maxJointBend);
    const thrust = clamp(0.3 + bodyLengthsPerSec * 1.4, 0.3, 1.5);
    applyUndulation(this.joints, this.spine, N, this.phase, cfg.beatAmplitude * length * thrust);
  }

  /** Pushes the current state into shader uniforms. */
  updateUniforms(sunX: number, sunY: number, sunZ: number, daylight: number, highlight: number) {
    const cfg = pondConfig.fish;
    const u = this.mesh.material.uniforms;
    const su = this.shadow.material.uniforms;
    const length = this.length;
    const depth = this.visualDepth;
    const speedNorm = clamp(this.speed / (length * cfg.cruiseSpeed), 0, 2);

    u.uLength.value = length;
    u.uHalfWidth.value = length * cfg.widthRatio;
    u.uDepth.value = depth;
    u.uPhase.value = this.phase;
    const soft = lerp(0.012, cfg.depth.blurAtDeepest, depth);
    u.uSoft.value = soft;
    u.uPad.value = soft * 1.5 + 0.01;
    u.uAlpha.value = this.behaviour.appear;
    u.uHighlight.value = highlight;

    // The tail fin lags the body wave and swings outward on turns.
    const thrust = clamp(0.3 + speedNorm * 0.6, 0.3, 1.4);
    u.uTailBend.value = Math.cos(this.phase - Math.PI * 1.7) * 0.55 * thrust - this.turnRate * 0.18;

    // Pectoral fins: spread and row when slow, tuck in when fast; the inner fin brakes on turns.
    const slow = 1 - clamp(speedNorm, 0, 1);
    const spread = lerp(0.35, 1.15, slow);
    const row = Math.sin(this.phase * 0.5) * 0.22 * slow;
    const turn = clamp(this.turnRate * 0.25, -0.4, 0.4);
    u.uFinL.value = spread + row + turn;
    u.uFinR.value = spread - row - turn;
    u.uPelvic.value = lerp(0.3, 0.75, slow);

    // Shadow: shallower fish cast offset, softer, fainter shadows.
    const height = 1 - depth;
    // Cap the throw of low-sun shadows so they stay readable.
    const sz = Math.max(sunZ, 0.5);
    const offset = cfg.shadow.maxOffset * height;
    (su.uOffset.value as Vector2).set((-sunX / sz) * offset, (-sunY / sz) * offset);
    const shadowSoft = lerp(cfg.shadow.softnessMin, cfg.shadow.softnessMax, height);
    su.uSoft.value = shadowSoft;
    su.uPad.value = shadowSoft * 1.6;
    su.uShadowStrength.value = cfg.shadow.strength * lerp(1, 0.55, height) * (0.3 + 0.7 * daylight);

    this.mesh.renderOrder = 10 + Math.round((1 - depth) * 100);
  }

  dispose() {
    this.mesh.material.dispose();
    this.shadow.material.dispose();
  }
}
