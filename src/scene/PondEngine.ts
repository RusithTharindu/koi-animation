import {
  HalfFloatType,
  LinearFilter,
  OrthographicCamera,
  Scene,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";
import { pondConfig } from "@/config/pond.config";
import { usePondStore } from "@/store/pondStore";
import { FishSystem } from "@/fish/FishSystem";
import { InputController } from "@/interaction/InputController";
import { ModeController } from "@/interaction/ModeController";
import { PondFloor } from "@/water/PondFloor";
import { RippleSimulation } from "@/water/RippleSimulation";
import { WaterSurface } from "@/water/WaterSurface";
import { computeLighting, createLightingState } from "./lighting";
import { createSharedUniforms } from "./sharedUniforms";

/**
 * Owns every GPU resource and per-frame system of the pond.
 * React only mounts it; all simulation and rendering happens here so the
 * frame loop never triggers React renders.
 *
 * Frame order: input effects -> simulation step -> underwater pass -> water composite.
 */
export class PondEngine {
  readonly shared = createSharedUniforms();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, -10, 10);
  private readonly mainScene = new Scene();
  private readonly underwaterScene = new Scene();
  private readonly underwaterTarget: WebGLRenderTarget;
  private readonly sim: RippleSimulation;
  private readonly floor: PondFloor;
  private readonly water: WaterSurface;
  private readonly fish: FishSystem;
  private readonly input: InputController;
  private readonly modes: ModeController;
  private readonly lighting = createLightingState();

  private worldW = 1;
  private worldH = 1;
  private cssW = 0;
  private cssH = 0;
  private dpr = 0;
  private simResolution = 0;

  constructor(private readonly renderer: WebGLRenderer) {
    this.sim = new RippleSimulation(renderer);
    this.floor = new PondFloor(this.shared);
    this.water = new WaterSurface(this.shared);
    this.underwaterTarget = new WebGLRenderTarget(1, 1, {
      type: HalfFloatType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: false,
    });
    this.water.setUnderwater(this.underwaterTarget.texture);

    this.underwaterScene.add(this.floor.mesh);
    this.fish = new FishSystem(this.underwaterScene, this.shared);
    this.mainScene.add(this.water.mesh);
    this.camera.position.z = 5;

    this.modes = new ModeController({
      ripple: (x, y, radius, strength) => this.ripple(x, y, radius, strength),
    });
    this.input = new InputController(
      renderer.domElement,
      (cx, cy, out) => this.clientToWorld(cx, cy, out),
      this.modes,
    );
  }

  /** Applies the user's ripple strength (and reduced-motion scaling) to a disturbance. */
  ripple(x: number, y: number, radius: number, strength: number) {
    const { params, reducedMotion } = usePondStore.getState();
    const scale = (0.25 + 1.5 * params.rippleStrength) * (reducedMotion ? pondConfig.reducedMotion.rippleScale : 1);
    this.sim.addDrop(x, y, radius, strength * scale);
  }

  /** Called every frame with the CSS canvas size; reallocates targets only when something changed. */
  syncSize(cssW: number, cssH: number, dpr: number) {
    const { qualityLevel } = usePondStore.getState();
    const level = pondConfig.quality.levels[qualityLevel];
    if (cssW === this.cssW && cssH === this.cssH && dpr === this.dpr && level.simResolution === this.simResolution) {
      return;
    }
    this.cssW = cssW;
    this.cssH = cssH;
    this.dpr = dpr;
    this.simResolution = level.simResolution;

    const short = pondConfig.world.shortSide;
    const aspect = cssW / Math.max(cssH, 1);
    this.worldW = aspect >= 1 ? short * aspect : short;
    this.worldH = aspect >= 1 ? short : short / aspect;

    this.camera.left = -this.worldW / 2;
    this.camera.right = this.worldW / 2;
    this.camera.top = this.worldH / 2;
    this.camera.bottom = -this.worldH / 2;
    this.camera.updateProjectionMatrix();

    this.shared.uWorldSize.value.set(this.worldW, this.worldH);
    this.sim.resize(this.worldW, this.worldH, level.simResolution);
    this.shared.uSimTexel.value.copy(this.sim.texel);
    this.floor.resize(this.worldW, this.worldH);
    this.water.resize(this.worldW, this.worldH);
    this.fish.setBounds(this.worldW, this.worldH);

    const scale = level.underwaterScale * dpr;
    this.underwaterTarget.setSize(Math.max(1, Math.round(cssW * scale)), Math.max(1, Math.round(cssH * scale)));
  }

  frame(delta: number, elapsed: number) {
    const dt = Math.min(delta, 1 / 20);
    const state = usePondStore.getState();

    this.shared.uTime.value = elapsed;
    computeLighting(pondConfig.lighting.defaultTimeOfDay, this.lighting);
    this.applyLighting();

    if (state.paused) {
      this.sim.discardDrops();
    } else {
      this.fish.update(dt);
      this.sim.step(dt, state.params.rippleDamping);
    }
    this.fish.syncUniforms();
    this.shared.uSim.value = this.sim.texture;

    const r = this.renderer;
    r.setRenderTarget(this.underwaterTarget);
    r.render(this.underwaterScene, this.camera);
    r.setRenderTarget(null);
    r.render(this.mainScene, this.camera);
  }

  dispose() {
    this.input.dispose();
    this.sim.dispose();
    this.floor.dispose();
    this.fish.dispose();
    this.water.dispose();
    this.underwaterTarget.dispose();
    this.mainScene.clear();
    this.underwaterScene.clear();
  }

  private applyLighting() {
    const l = this.lighting;
    const s = this.shared;
    s.uSunDir.value.copy(l.sunDir);
    s.uSunColor.value.copy(l.sunColor);
    s.uAmbient.value.copy(l.ambient);
    s.uSkyColor.value.copy(l.sky);
    s.uWaterTint.value.copy(l.waterTint);
    s.uDaylight.value = l.daylight;
  }

  private clientToWorld(cx: number, cy: number, out: { x: number; y: number }) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    out.x = ((cx - rect.left) / rect.width - 0.5) * this.worldW;
    out.y = (0.5 - (cy - rect.top) / rect.height) * this.worldH;
  }
}
