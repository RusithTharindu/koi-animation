/* Shared GLSL snippets. Kept as strings so they can be composed into materials. */

export const glslNoise = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
    mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

float fbm3(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 3; i++) {
    v += a * vnoise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

/* Voronoi: returns (F1, F2, cell hash); rel is the vector from p to the nearest cell centre. */
vec3 voronoi(vec2 p, out vec2 rel) {
  vec2 n = floor(p);
  vec2 f = fract(p);
  float f1 = 8.0;
  float f2 = 8.0;
  float id = 0.0;
  rel = vec2(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash22(n + g);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        id = hash12(n + g);
        rel = r;
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  return vec3(sqrt(f1), sqrt(f2), id);
}
`;

/*
 * Animated caustic network: distance to the edges of a Voronoi diagram whose
 * points orbit over time, so cells morph instead of sliding. Requires glslNoise.
 */
export const glslCaustics = /* glsl */ `
float causticEdges(vec2 p, float t) {
  vec2 n = floor(p);
  vec2 f = fract(p);
  float f1 = 8.0;
  float f2 = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 h = hash22(n + g);
      vec2 o = 0.5 + 0.38 * sin(t * (0.6 + 0.6 * h) + 6.2831 * h);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
    }
  }
  return sqrt(f2) - sqrt(f1);
}

/* 0..~1.5 brightness of the light net at p (world units). */
float caustics(vec2 p, float t, float scale) {
  vec2 q = p * scale;
  q += 0.35 * vec2(vnoise(q * 0.5 + t * 0.1), vnoise(q * 0.5 - t * 0.1 + 7.0));
  float a = 1.0 - smoothstep(0.0, 0.13, causticEdges(q, t));
  float b = 1.0 - smoothstep(0.0, 0.13, causticEdges(q * 1.37 + 4.1, t * 1.3));
  float net = pow(a, 2.5) * 0.7 + pow(b, 2.5) * 0.45 + pow(a * b, 1.2) * 0.9;
  // Brightness drifts in broad patches, as the surface focuses light unevenly.
  float patches = smoothstep(0.25, 0.75, vnoise(p * 0.18 + t * 0.05));
  return net * mix(0.35, 1.0, patches);
}
`;

/* Reads the ripple simulation: r = height, g = velocity, ba = height gradient per world unit. */
export const glslWater = /* glsl */ `
uniform sampler2D uSim;
uniform vec2 uSimTexel;
uniform float uNormalStrength;

vec3 waterNormal(vec2 simUv) {
  vec2 slope = -texture2D(uSim, simUv).ba * uNormalStrength;
  // Cap the tilt (~31 degrees) so stacked taps cannot turn the surface into an extreme lens.
  float len = length(slope);
  slope *= min(1.0, 0.6 / max(len, 1e-5));
  return normalize(vec3(slope, 1.0));
}

float waterHeight(vec2 simUv) {
  return texture2D(uSim, simUv).r;
}

/* Laplacian of the height per world unit²: negative under crests, which focus sunlight. Needs uWorldSize. */
float waterFocus(vec2 simUv) {
  vec2 dx = vec2(uSimTexel.x, 0.0);
  vec2 dy = vec2(0.0, uSimTexel.y);
  float h = texture2D(uSim, simUv).r;
  float lap = texture2D(uSim, simUv + dx).r + texture2D(uSim, simUv - dx).r
    + texture2D(uSim, simUv + dy).r + texture2D(uSim, simUv - dy).r - 4.0 * h;
  vec2 texelWorld = uSimTexel * uWorldSize;
  return lap / (texelWorld.x * texelWorld.y);
}
`;

export const glslLighting = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uAmbient;
uniform vec3 uSkyColor;
uniform vec3 uWaterTint;
uniform float uTime;
uniform vec2 uWorldSize;
`;

/** Vertex shader for full-screen passes using a 2x2 plane. */
export const fullscreenVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/** Vertex shader for meshes placed in world space; exposes world position and the matching simulation UV. */
export const worldVertex = /* glsl */ `
uniform vec2 uWorldSize;
varying vec2 vWorld;
varying vec2 vSimUv;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xy;
  vSimUv = wp.xy / uWorldSize + 0.5;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
