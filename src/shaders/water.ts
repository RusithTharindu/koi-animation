import { glslLighting, glslWater } from "./common";

/**
 * Final composite: refracts the underwater render target through the ripple
 * normals, then adds sky reflection (Fresnel) and the sun glint.
 */
export const waterFragment = /* glsl */ `
${glslLighting}
${glslWater}
uniform sampler2D uUnder;
uniform float uRefractionDepth;
uniform float uSpecPower;
uniform float uSpecStrength;
uniform float uFresnel;
uniform vec3 uEye;
varying vec2 vWorld;
varying vec2 vSimUv;

void main() {
  vec3 n = waterNormal(vSimUv);
  float h = waterHeight(vSimUv);

  // Refraction: offset proportional to surface tilt and the depth of the water column.
  vec2 offset = n.xy * uRefractionDepth / uWorldSize;
  vec3 under = texture2D(uUnder, clamp(vSimUv - offset, 0.001, 0.999)).rgb;

  // Ripples act like tiny lenses: crests read slightly brighter.
  under *= 1.0 + clamp(h * 0.25, -0.12, 0.12);

  // Virtual perspective eye above the pond so the sun glint is localised.
  vec3 pos = vec3(vWorld, 0.0);
  vec3 V = normalize(uEye - pos);
  vec3 L = normalize(uSunDir);
  vec3 R = reflect(-V, n);

  float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
  vec3 sky = mix(uSkyColor * 0.6, uSkyColor, clamp(R.z, 0.0, 1.0));
  vec3 col = mix(under, sky, clamp(fresnel * uFresnel * 4.0, 0.0, 0.6));

  float spec = pow(max(dot(R, L), 0.0), uSpecPower) * uSpecStrength;
  // Broad sheen to keep the surface readable away from the glint.
  float sheen = pow(max(dot(R, L), 0.0), 60.0) * 0.05;
  col += uSunColor * (spec + sheen) * smoothstep(-0.05, 0.15, L.z);

  // Shaded pond walls.
  vec2 e = min(vSimUv, 1.0 - vSimUv) * uWorldSize;
  float wall = smoothstep(0.0, 1.4, min(e.x, e.y));
  col *= mix(0.55, 1.0, wall);

  gl_FragColor = vec4(col, 1.0);
}
`;
