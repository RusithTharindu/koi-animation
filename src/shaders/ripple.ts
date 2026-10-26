/*
 * GPU height-field wave simulation.
 * State texture: r = height, g = vertical velocity, ba = height gradient (per world unit).
 */

export const rippleDropFragment = /* glsl */ `
#define PI 3.141592653589793
uniform sampler2D uState;
uniform vec4 uDrops[MAX_DROPS]; // xy = world position, z = radius, w = strength
uniform int uDropCount;
uniform vec2 uWorldSize;
varying vec2 vUv;

void main() {
  vec4 s = texture2D(uState, vUv);
  vec2 p = (vUv - 0.5) * uWorldSize;
  for (int i = 0; i < MAX_DROPS; i++) {
    if (i >= uDropCount) break;
    vec4 d = uDrops[i];
    float r = length(p - d.xy) / d.z;
    if (r < 1.0) {
      s.r += (0.5 + 0.5 * cos(r * PI)) * d.w;
    }
  }
  gl_FragColor = s;
}
`;

export const rippleUpdateFragment = /* glsl */ `
uniform sampler2D uState;
uniform vec2 uTexel;      // 1 / texture size
uniform vec2 uTexelWorld; // world size of one texel
uniform float uDamping;
uniform float uDecay;
varying vec2 vUv;

void main() {
  vec4 s = texture2D(uState, vUv);
  float l = texture2D(uState, vUv - vec2(uTexel.x, 0.0)).r;
  float r = texture2D(uState, vUv + vec2(uTexel.x, 0.0)).r;
  float d = texture2D(uState, vUv - vec2(0.0, uTexel.y)).r;
  float u = texture2D(uState, vUv + vec2(0.0, uTexel.y)).r;

  float avg = (l + r + d + u) * 0.25;
  s.g += (avg - s.r) * 2.0;
  s.g *= uDamping;
  s.r += s.g;
  s.r *= uDecay;

  // Pond walls soak up a little energy so reflections do not ring forever.
  vec2 edge = min(vUv, 1.0 - vUv) / uTexel;
  float wall = clamp(min(edge.x, edge.y) / 6.0, 0.0, 1.0);
  s.rg *= mix(0.96, 1.0, wall);

  s.ba = vec2(r - l, u - d) / (2.0 * uTexelWorld);
  gl_FragColor = s;
}
`;
