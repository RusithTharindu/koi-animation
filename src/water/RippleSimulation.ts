import {
  ClampToEdgeWrapping,
  Color,
  HalfFloatType,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  type Texture,
  type WebGLRenderer,
} from "three";
import { pondConfig } from "@/config/pond.config";
import { lerp } from "@/lib/math";
import { fullscreenVertex } from "@/shaders/common";
import { rippleDropFragment, rippleUpdateFragment } from "@/shaders/ripple";

const MAX_DROPS = pondConfig.water.maxDropsPerFrame;

/**
 * Ping-pong wave-equation simulation on the GPU.
 * The simulation texture always spans the whole viewport, so world -> UV is
 * `world / worldSize + 0.5`.
 */
export class RippleSimulation {
  private targets: [WebGLRenderTarget, WebGLRenderTarget];
  private current = 0;
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad: Mesh;
  private readonly geometry = new PlaneGeometry(2, 2);
  private readonly dropMaterial: ShaderMaterial;
  private readonly updateMaterial: ShaderMaterial;
  private readonly drops = new Float32Array(MAX_DROPS * 4);
  private dropCount = 0;
  private accumulator = 0;

  readonly worldSize = new Vector2(1, 1);
  readonly texel = new Vector2(1, 1);
  /** Texels along the shorter side, used to keep the wave speed resolution-independent. */
  private shortResolution = 256;

  constructor(private readonly renderer: WebGLRenderer) {
    this.targets = [this.createTarget(1, 1), this.createTarget(1, 1)];

    this.dropMaterial = new ShaderMaterial({
      vertexShader: fullscreenVertex,
      fragmentShader: rippleDropFragment,
      defines: { MAX_DROPS },
      uniforms: {
        uState: { value: null },
        uDrops: { value: this.drops },
        uDropCount: { value: 0 },
        uWorldSize: { value: this.worldSize },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.updateMaterial = new ShaderMaterial({
      vertexShader: fullscreenVertex,
      fragmentShader: rippleUpdateFragment,
      uniforms: {
        uState: { value: null },
        uTexel: { value: this.texel },
        uTexelWorld: { value: new Vector2(1, 1) },
        uDamping: { value: 0.99 },
        uDecay: { value: pondConfig.water.heightDecay },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.quad = new Mesh(this.geometry, this.updateMaterial);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  get texture(): Texture {
    return this.targets[this.current].texture;
  }

  /** Resizes the field to cover `worldW x worldH`, with `shortRes` texels along the shorter side. Clears all ripples. */
  resize(worldW: number, worldH: number, shortRes: number) {
    const aspect = worldW / worldH;
    const w = Math.max(2, Math.round(aspect >= 1 ? shortRes * aspect : shortRes));
    const h = Math.max(2, Math.round(aspect >= 1 ? shortRes : shortRes / aspect));
    this.worldSize.set(worldW, worldH);
    this.shortResolution = shortRes;

    const [a, b] = this.targets;
    if (a.width !== w || a.height !== h) {
      a.dispose();
      b.dispose();
      this.targets = [this.createTarget(w, h), this.createTarget(w, h)];
      this.clear();
    }
    this.texel.set(1 / w, 1 / h);
    (this.updateMaterial.uniforms.uTexelWorld.value as Vector2).set(worldW / w, worldH / h);
  }

  /** Queues a raised-cosine disturbance. Positive strength lifts water, negative pushes it down. */
  addDrop(x: number, y: number, radius: number, strength: number) {
    if (this.dropCount >= MAX_DROPS || strength === 0) return;
    const i = this.dropCount * 4;
    this.drops[i] = x;
    this.drops[i + 1] = y;
    this.drops[i + 2] = radius;
    this.drops[i + 3] = strength;
    this.dropCount++;
  }

  /** Discards queued drops (e.g. while paused). */
  discardDrops() {
    this.dropCount = 0;
  }

  /**
   * Advances the simulation by `dt` seconds using a fixed timestep.
   * @param damping 0..1 slider value, higher fades faster.
   */
  step(dt: number, damping: number) {
    const cfg = pondConfig.water;
    const resScale = this.shortResolution / 256;
    const stepsPerSecond = cfg.stepsPerSecondAt256 * resScale;
    // Damping is defined per step at 256 texels; rescale so decay per second is resolution-independent.
    const perStep = Math.pow(lerp(cfg.dampingMin, cfg.dampingMax, damping), 1 / resScale);
    this.updateMaterial.uniforms.uDamping.value = perStep;

    const prevTarget = this.renderer.getRenderTarget();

    if (this.dropCount > 0) {
      this.dropMaterial.uniforms.uDropCount.value = this.dropCount;
      this.runPass(this.dropMaterial);
      this.dropCount = 0;
    }

    this.accumulator = Math.min(this.accumulator + dt * stepsPerSecond, cfg.maxStepsPerFrame);
    while (this.accumulator >= 1) {
      this.runPass(this.updateMaterial);
      this.accumulator -= 1;
    }

    this.renderer.setRenderTarget(prevTarget);
  }

  clear() {
    const prevTarget = this.renderer.getRenderTarget();
    const prevAlpha = this.renderer.getClearAlpha();
    const prevColor = this.renderer.getClearColor(new Color());
    this.renderer.setClearColor(0x000000, 0);
    for (const t of this.targets) {
      this.renderer.setRenderTarget(t);
      this.renderer.clear(true, false, false);
    }
    this.renderer.setClearColor(prevColor, prevAlpha);
    this.renderer.setRenderTarget(prevTarget);
  }

  dispose() {
    this.targets.forEach((t) => t.dispose());
    this.dropMaterial.dispose();
    this.updateMaterial.dispose();
    this.geometry.dispose();
  }

  private runPass(material: ShaderMaterial) {
    const src = this.targets[this.current];
    const dst = this.targets[1 - this.current];
    material.uniforms.uState.value = src.texture;
    this.quad.material = material;
    this.renderer.setRenderTarget(dst);
    this.renderer.render(this.scene, this.camera);
    this.current = 1 - this.current;
  }

  private createTarget(w: number, h: number) {
    return new WebGLRenderTarget(w, h, {
      type: HalfFloatType,
      format: RGBAFormat,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      wrapS: ClampToEdgeWrapping,
      wrapT: ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
    });
  }
}
