import { Mesh, PlaneGeometry, ShaderMaterial } from "three";
import { pondConfig } from "@/config/pond.config";
import { worldVertex } from "@/shaders/common";
import { floorFragment } from "@/shaders/floor";
import type { SharedUniforms } from "@/scene/sharedUniforms";

/** Procedural pebble / sand floor with caustics, drawn into the underwater pass. */
export class PondFloor {
  readonly mesh: Mesh<PlaneGeometry, ShaderMaterial>;

  constructor(shared: SharedUniforms) {
    const material = new ShaderMaterial({
      vertexShader: worldVertex,
      fragmentShader: floorFragment,
      uniforms: {
        ...shared,
        uPebbleScale: { value: pondConfig.floor.pebbleScale },
        uCausticStrength: { value: pondConfig.floor.causticStrength },
        uCausticScale: { value: pondConfig.floor.causticScale },
        uCausticSpeed: { value: pondConfig.floor.causticSpeed },
        uRippleCausticGain: { value: pondConfig.floor.rippleCausticGain },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new Mesh(new PlaneGeometry(1, 1), material);
    this.mesh.renderOrder = 0;
    this.mesh.frustumCulled = false;
  }

  /** Slows the caustic animation for reduced motion. */
  setCausticSpeed(speed: number) {
    this.mesh.material.uniforms.uCausticSpeed.value = speed;
  }

  resize(worldW: number, worldH: number) {
    this.mesh.scale.set(worldW, worldH, 1);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
