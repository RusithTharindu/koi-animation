import { glslLighting, glslNoise, glslWater } from "./common";

export const floorFragment = /* glsl */ `
${glslLighting}
${glslNoise}
${glslWater}
uniform float uPebbleScale;
varying vec2 vWorld;
varying vec2 vSimUv;

vec3 pebbleColor(float id) {
  vec3 c = vec3(0.46, 0.44, 0.40);
  c = mix(c, vec3(0.34, 0.27, 0.21), step(0.25, id));
  c = mix(c, vec3(0.58, 0.54, 0.48), step(0.45, id));
  c = mix(c, vec3(0.24, 0.26, 0.27), step(0.62, id));
  c = mix(c, vec3(0.52, 0.37, 0.26), step(0.80, id));
  c = mix(c, vec3(0.40, 0.40, 0.36), step(0.92, id));
  return c;
}

/*
 * One layer of non-overlapping elliptical stones. Cell jitter is limited so a
 * stone never crosses into its neighbour's cell.
 * Returns (mask, contact shadow, colour id, unused); nrm receives the dome normal.
 */
vec4 stoneLayer(vec2 p, float sparsity, out vec3 nrm) {
  vec2 n = floor(p);
  vec2 f = fract(p);
  float best = 8.0;
  vec2 rel = vec2(0.0);
  float id = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 r = g + 0.3 + 0.4 * hash22(n + g) - f;
      float d = dot(r, r);
      if (d < best) { best = d; rel = r; id = hash12(n + g); }
    }
  }
  float present = step(sparsity, fract(id * 7.13));
  float ang = id * 6.2831;
  mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
  vec2 q = rot * rel;
  q.x *= 1.0 + 0.45 * fract(id * 3.7);
  float radius = 0.17 + 0.09 * fract(id * 11.3);
  float d = length(q) / radius;
  float mask = smoothstep(1.0, 0.86, d) * present;
  float contact = smoothstep(1.45, 1.0, d) * present * (1.0 - mask);
  nrm = normalize(vec3(-rel / radius * 0.55, 1.0));
  return vec4(mask, contact, id, 0.0);
}

void main() {
  vec2 p = vWorld;

  // Silty sand base.
  float n = fbm(p * 1.1);
  vec3 col = mix(vec3(0.36, 0.33, 0.26), vec3(0.52, 0.47, 0.37), n);
  col *= 0.86 + 0.28 * vnoise(p * 16.0);
  vec3 nrm = vec3(0.0, 0.0, 1.0);

  // Rounded river stones resting in silt: a sparse large layer and a denser pebble layer.
  float coverage = smoothstep(0.25, 0.7, fbm3(p * 0.22 + 3.7));
  vec3 sn;
  vec4 big = stoneLayer(p * uPebbleScale * 0.55, 0.45 - 0.25 * coverage, sn);
  col *= 1.0 - 0.4 * big.y;
  col = mix(col, pebbleColor(big.z) * (0.85 + 0.3 * vnoise(p * 9.0 + big.z * 40.0)), big.x);
  nrm = normalize(mix(nrm, sn, big.x));

  vec3 sn2;
  vec4 small = stoneLayer(p * uPebbleScale * 1.6 + 23.0, 0.75 - 0.45 * coverage, sn2);
  small.x *= 1.0 - big.x;
  col *= 1.0 - 0.3 * small.y * (1.0 - big.x);
  col = mix(col, pebbleColor(small.z) * (0.85 + 0.3 * vnoise(p * 20.0 + small.z * 40.0)), small.x);
  nrm = normalize(mix(nrm, sn2, small.x));
  float stone = max(big.x, small.x);

  // Fine grit.
  float grit = vnoise(p * 38.0);
  col *= 0.92 + 0.16 * grit * (1.0 - stone);

  // Algae film, strongest in crevices.
  float algae = smoothstep(0.42, 0.78, fbm(p * 0.45 + 17.0)) * 0.85;
  col = mix(col, vec3(0.16, 0.24, 0.1), algae * (0.75 - 0.4 * stone));

  // Lighting.
  float lambert = max(dot(nrm, normalize(uSunDir)), 0.0);
  vec3 lit = col * (uAmbient + uSunColor * lambert * 0.85);

  // Water column absorption.
  lit = mix(lit, uWaterTint, 0.42);
  gl_FragColor = vec4(lit, 1.0);
}
`;
