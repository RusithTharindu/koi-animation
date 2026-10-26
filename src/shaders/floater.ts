import { glslLighting, glslNoise } from "./common";

export const floaterVertex = /* glsl */ `
uniform sampler2D uSim;
uniform vec2 uWorldSize;
uniform float uNormalStrength;
uniform float uRippleBob;
uniform vec2 uShadowOffset;
attribute vec4 aInst; // x, y, rotation, size (world units across)
attribute vec2 aKind; // type (0 pad, 1 petal, 2 blossom), seed
varying vec2 vLocal;
varying vec2 vKind;
varying vec3 vNormal;

void main() {
  vec2 centre = aInst.xy;
  vec4 s = texture2D(uSim, centre / uWorldSize + 0.5);
  // Riding a crest brings the floater closer to the eye; slopes slide it a touch downhill.
  float size = aInst.w * (1.0 + clamp(s.r * uRippleBob, -0.12, 0.18));
  float c = cos(aInst.z);
  float sn = sin(aInst.z);
  vec2 local = position.xy;
  vec2 p = vec2(c * local.x - sn * local.y, sn * local.x + c * local.y) * size;
  p += centre - s.ba * 0.02 * aInst.w + uShadowOffset;

  vLocal = local * 2.0;
  vKind = aKind;
  vNormal = normalize(vec3(-s.ba * uNormalStrength * 1.5, 1.0));
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 0.0, 1.0);
}
`;

export const floaterFragment = /* glsl */ `
${glslLighting}
${glslNoise}
#define PI 3.141592653589793
uniform float uShadowStrength;
varying vec2 vLocal;
varying vec2 vKind;
varying vec3 vNormal;

void main() {
  vec2 q = vLocal;
  float type = vKind.x;
  float seed = vKind.y;
  float r = length(q);
  float ang = atan(q.y, q.x);
  vec3 col;
  float alpha;
  float gloss;
  vec3 n = vNormal;

  if (type < 0.5) {
    // Lily pad: wavy rim, a notch cut to the centre, radial veins.
    float edge = 0.94 + 0.025 * sin(ang * 7.0 + seed * 10.0) + 0.015 * sin(ang * 17.0 + seed * 3.0);
    float notch = smoothstep(0.1, 0.17, abs(ang)) + smoothstep(0.12, 0.05, r);
    alpha = smoothstep(edge, edge - 0.035, r) * clamp(notch, 0.0, 1.0);
    vec3 dark = vec3(0.09, 0.2, 0.07);
    vec3 light = vec3(0.22, 0.36, 0.12);
    col = mix(dark, light, fbm(q * 2.5 + seed * 20.0));
    float veins = smoothstep(0.9, 1.0, abs(sin(ang * 12.0 + seed * 5.0))) * smoothstep(0.12, 0.35, r);
    col = mix(col, col * 1.25 + 0.02, veins * 0.35);
    // Darker, thicker centre where the stem attaches.
    col *= 0.8 + 0.2 * smoothstep(0.0, 0.3, r);
    // Reddish underside curling up at the rim; sun-bleached patches.
    col = mix(col, vec3(0.42, 0.2, 0.14), smoothstep(edge - 0.1, edge - 0.02, r) * 0.55);
    col = mix(col, vec3(0.52, 0.48, 0.22), smoothstep(0.62, 0.8, fbm(q * 1.8 + seed * 7.0)) * 0.45);
    // Slight dome so the pad catches light unevenly.
    n = normalize(n + vec3(q * 0.12, 0.0));
    gloss = 0.5;
  } else if (type < 1.5) {
    // Cherry blossom petal: teardrop with a notched tip and a centre crease.
    float x = q.x;
    float w = 0.48 * pow(max(1.0 - x * x, 0.0), 0.65) * (x < 0.0 ? 1.0 : 0.9);
    float tip = smoothstep(0.92, 0.75, x) + smoothstep(0.04, 0.12, abs(q.y));
    alpha = smoothstep(w, w - 0.07, abs(q.y)) * smoothstep(1.0, 0.92, abs(x)) * clamp(tip, 0.0, 1.0);
    col = mix(vec3(1.0, 0.9, 0.93), vec3(0.96, 0.6, 0.72), smoothstep(-0.9, 0.9, x));
    col *= 0.9 + 0.1 * smoothstep(0.0, 0.1, abs(q.y));
    alpha *= 0.92;
    gloss = 0.25;
  } else {
    // Water lily blossom: two rings of pointed petals around a golden centre.
    float petals = pow(abs(cos(ang * 4.0 + seed * 6.0)), 0.6);
    float inner = pow(abs(cos(ang * 4.0 + seed * 6.0 + PI / 8.0)), 0.6);
    float outerR = 0.6 + 0.38 * petals;
    float innerR = 0.38 + 0.26 * inner;
    alpha = smoothstep(outerR, outerR - 0.05, r);
    col = mix(vec3(0.98, 0.78, 0.86), vec3(1.0, 0.95, 0.97), smoothstep(outerR, 0.2, r));
    float innerMask = smoothstep(innerR, innerR - 0.04, r);
    col = mix(col * 0.82, vec3(1.0, 0.9, 0.95), innerMask);
    col = mix(col, vec3(1.0, 0.82, 0.25), smoothstep(0.17, 0.12, r));
    n = normalize(n + vec3(q * 0.3, 0.0));
    gloss = 0.3;
  }

#ifdef SHADOW
  gl_FragColor = vec4(0.0, 0.02, 0.02, alpha * uShadowStrength);
#else
  vec3 L = normalize(uSunDir);
  float lam = max(dot(n, L), 0.0);
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, H), 0.0), 60.0) * gloss;
  col = col * (uAmbient * 0.9 + uSunColor * lam * 0.75) + uSunColor * spec;
  gl_FragColor = vec4(col, alpha);
#endif
}
`;
