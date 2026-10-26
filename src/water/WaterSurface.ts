import { Mesh, PlaneGeometry, ShaderMaterial, Vector3, type Texture } from "three";
import { pondConfig } from "@/config/pond.config";
import { worldVertex } from "@/shaders/common";
import { waterFragment } from "@/shaders/water";
import type { SharedUniforms } from "@/scene/sharedUniforms";

/** Full-viewport water surface that composites the underwater pass. */
export class WaterSurface {
  readonly mesh: Mesh<PlaneGeometry, ShaderMaterial>;

  constructor(shared: SharedUniforms) {
    const cfg = pondConfig.water;
    const material = new ShaderMaterial({
      vertexShader: worldVertex,
      fragmentShader: waterFragment,
      uniforms: {
        ...shared,
        uUnder: { value: null },
        uRefractionDepth: { value: cfg.refractionDepth },
        uSpecPower: { value: cfg.specularPower },
        uSpecStrength: { value: cfg.specularStrength },
        uFresnel: { value: cfg.fresnelStrength },
        uEye: { value: new Vector3(...cfg.eye) },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new Mesh(new PlaneGeometry(1, 1), material);
    this.mesh.renderOrder = 0;
    this.mesh.frustumCulled = false;
  }

  setUnderwater(texture: Texture) {
    this.mesh.material.uniforms.uUnder.value = texture;
  }

  resize(worldW: number, worldH: number) {
    this.mesh.scale.set(worldW, worldH, 1);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
