import gsap from "gsap";
import {
  HalfFloatType,
  LinearFilter,
  OrthographicCamera,
  Scene,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";
import { pondConfig } from "@/config/pond.config";
import { FishSystem } from "@/fish/FishSystem";
import { FoodSystem } from "@/fish/FoodSystem";
import { InputController } from "@/interaction/InputController";
import { ModeController } from "@/interaction/ModeController";
import { usePondStore } from "@/store/pondStore";
import { FloatingElements } from "@/water/FloatingElements";
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
 * Frame order: input effects -> fish & food -> ripple step -> underwater pass -> water composite.
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
  private readonly food: FoodSystem;
  private readonly floaters: FloatingElements;
  private readonly input: InputController;
  private readonly modes: ModeController;
  private readonly lighting = createLightingState();
  /** Smoothed time of day; tweened towards the slider value. */
  private readonly timeOfDay: { value: number } = { value: pondConfig.lighting.defaultTimeOfDay };
  private readonly unsubscribe: () => void;

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

    this.fish = new FishSystem(this.underwaterScene, this.shared);
    this.food = new FoodSystem(this.shared, (x, y) =>
      this.ripple(x, y, pondConfig.water.clickRadius * 0.45, pondConfig.water.clickStrength * 0.35),
    );
    this.fish.influences.push(this.food.influence);
    this.fish.onWake = (x, y, radius, strength) => {
      const { reducedMotion } = usePondStore.getState();
      const scale = reducedMotion ? pondConfig.reducedMotion.wakeScale : 1;
      if (scale > 0) this.sim.addDrop(x, y, radius, strength * scale);
    };

    this.floaters = new FloatingElements(this.shared);
    this.underwaterScene.add(this.floor.mesh, this.floaters.shadow, this.food.points);
    this.mainScene.add(this.water.mesh, this.floaters.mesh);
    this.camera.position.z = 5;

    this.modes = new ModeController({
      ripple: (x, y, radius, strength) => this.ripple(x, y, radius, strength),
      fish: this.fish,
      food: this.food,
      pointers: () => this.input.pointers,
      bounds: () => ({ halfW: this.worldW / 2, halfH: this.worldH / 2 }),
    });
    this.input = new InputController(
      renderer.domElement,
      (cx, cy, out) => this.clientToWorld(cx, cy, out),
      this.modes,
    );

    const initial = usePondStore.getState();
    this.timeOfDay.value = initial.params.timeOfDay;
    this.applyMotionPreference(initial.reducedMotion);
    this.unsubscribe = usePondStore.subscribe((state, prev) => {
      if (state.mode !== prev.mode) this.modes.reset();
      if (state.reducedMotion !== prev.reducedMotion) this.applyMotionPreference(state.reducedMotion);
      if (state.paused !== prev.paused) this.food.setPaused(state.paused);
      if (state.params.timeOfDay !== prev.params.timeOfDay) {
        gsap.to(this.timeOfDay, {
          value: state.params.timeOfDay,
          duration: state.reducedMotion ? 0 : pondConfig.lighting.transitionDuration,
          ease: "sine.inOut",
          overwrite: true,
        });
      }
      if (state.sceneVersion !== prev.sceneVersion) {
        this.food.clear();
        this.sim.clear();
      }
    });
  }

  /** Applies the user's ripple strength (and reduced-motion scaling) to a disturbance. */
  ripple(x: number, y: number, radius: number, strength: number) {
    const { params, reducedMotion } = usePondStore.getState();
    const scale = (0.25 + 1.5 * params.rippleStrength) * (reducedMotion ? pondConfig.reducedMotion.rippleScale : 1);
    this.sim.addDrop(x, y, radius, strength * scale);
    this.floaters.shove(x, y, radius, strength * scale);
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
    this.floaters.setBounds(this.worldW, this.worldH);

    const scale = level.underwaterScale * dpr;
    const h = Math.max(1, Math.round(cssH * scale));
    this.underwaterTarget.setSize(Math.max(1, Math.round(cssW * scale)), h);
    this.food.setPixelsPerUnit(h / this.worldH);
  }

  frame(delta: number, elapsed: number) {
    const dt = Math.min(delta, 1 / 20);
    const state = usePondStore.getState();

    this.shared.uTime.value = elapsed;
    computeLighting(this.timeOfDay.value, this.lighting);
    this.applyLighting();

    this.input.decay(dt);
    if (state.paused) {
      this.sim.discardDrops();
    } else {
      this.modes.tick(dt);
      this.fish.update(dt);
      this.sim.step(dt, state.params.rippleDamping);
      const sun = this.lighting.sunDir;
      const motion = state.reducedMotion ? pondConfig.reducedMotion.swimScale : 1;
      this.floaters.update(dt, sun.x, sun.y, sun.z, this.lighting.daylight, motion);
    }
    this.fish.syncUniforms();
    this.food.update();
    this.shared.uSim.value = this.sim.texture;

    const r = this.renderer;
    r.setRenderTarget(this.underwaterTarget);
    r.render(this.underwaterScene, this.camera);
    r.setRenderTarget(null);
    r.render(this.mainScene, this.camera);
  }

  dispose() {
    this.unsubscribe();
    gsap.killTweensOf(this.timeOfDay);
    this.input.dispose();
    this.sim.dispose();
    this.floor.dispose();
    this.fish.dispose();
    this.food.dispose();
    this.floaters.dispose();
    this.water.dispose();
    this.underwaterTarget.dispose();
    this.mainScene.clear();
    this.underwaterScene.clear();
  }

  private applyMotionPreference(reduced: boolean) {
    this.floor.setCausticSpeed(pondConfig.floor.causticSpeed * (reduced ? 0.3 : 1));
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
