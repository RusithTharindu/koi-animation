import { Color, Vector2, Vector3, type IUniform, type Texture } from "three";
import { pondConfig } from "@/config/pond.config";

/**
 * Uniform objects shared by reference between every pond material, so
 * lighting, time and the ripple texture are updated once per frame.
 */
export interface SharedUniforms {
  [name: string]: IUniform;
  uTime: IUniform<number>;
  uWorldSize: IUniform<Vector2>;
  uSim: IUniform<Texture | null>;
  uSimTexel: IUniform<Vector2>;
  uNormalStrength: IUniform<number>;
  uSunDir: IUniform<Vector3>;
  uSunColor: IUniform<Color>;
  uAmbient: IUniform<Color>;
  uSkyColor: IUniform<Color>;
  uWaterTint: IUniform<Color>;
  uDaylight: IUniform<number>;
}

export const createSharedUniforms = (): SharedUniforms => ({
  uTime: { value: 0 },
  uWorldSize: { value: new Vector2(1, 1) },
  uSim: { value: null },
  uSimTexel: { value: new Vector2(1, 1) },
  uNormalStrength: { value: pondConfig.water.normalStrength },
  uSunDir: { value: new Vector3(0, 0, 1) },
  uSunColor: { value: new Color(1, 1, 1) },
  uAmbient: { value: new Color(0.5, 0.5, 0.5) },
  uSkyColor: { value: new Color(0.6, 0.75, 0.85) },
  uWaterTint: { value: new Color(0.1, 0.27, 0.25) },
  uDaylight: { value: 1 },
});
