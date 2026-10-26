import { glslLighting, glslNoise } from "./common";

const glslKoiCommon = /* glsl */ `
vec2 perp2(vec2 d) { return vec2(-d.y, d.x); }

vec2 rot2(vec2 v, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

/* Top-view half-width of the body along its length (0 = nose, 1 = tail root). */
float bodyProfile(float u) {
  float front = sqrt(max(1.0 - pow(1.0 - min(u / 0.32, 1.0), 2.2), 0.0));
  float k = clamp((u - 0.32) / 0.68, 0.0, 1.0);
  float back = 1.0 - 0.8 * pow(k, 1.35);
  return u < 0.32 ? front : back;
}
`;

export const koiVertex = /* glsl */ `
#define N SPINE_N
uniform vec2 uSpine[N];
uniform float uLength;
uniform float uHalfWidth;
uniform float uPad;
uniform float uTailBend;
uniform float uTailLen;
uniform float uFinLen;
uniform float uFinL;
uniform float uFinR;
uniform float uPelvic;
uniform float uDorsal;
uniform float uPhase;
uniform vec2 uOffset;

attribute vec3 aFish;
varying vec3 vFish;
varying vec2 vLocal;
varying vec2 vPerp;
varying vec2 vWorld;

${glslKoiCommon}

vec2 joint(int i) { return uSpine[clamp(i, 0, N - 1)]; }

/* Catmull-Rom position along the spine; fwd receives the head-ward direction. */
vec2 spineAt(float u, out vec2 fwd) {
  float f = clamp(u, 0.0, 1.0) * float(N - 1);
  int i = int(min(floor(f), float(N - 2)));
  float t = f - float(i);
  vec2 p1 = joint(i);
  vec2 p2 = joint(i + 1);
  vec2 p0 = i == 0 ? 2.0 * p1 - p2 : joint(i - 1);
  vec2 p3 = i + 2 > N - 1 ? 2.0 * p2 - p1 : joint(i + 2);
  float t2 = t * t;
  float t3 = t2 * t;
  vec2 pos = 0.5 * ((2.0 * p1) + (-p0 + p2) * t + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2 + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3);
  vec2 tng = 0.5 * ((-p0 + p2) + 2.0 * (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t + 3.0 * (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t2);
  fwd = normalize(-tng + vec2(1e-6));
  return pos;
}

void main() {
  float part = aFish.z;
  float a = aFish.x;
  float b = aFish.y;
  vec2 fwd;
  vec2 pos;
  vLocal = vec2(0.0);

  if (part < 0.5) {
    // Body: lateral offset from the spine, padded for soft edges.
    vec2 c = spineAt(a, fwd);
    float hw = bodyProfile(a) * uHalfWidth;
    float lat = b * (hw + uPad);
    pos = c + perp2(fwd) * lat + fwd * uPad * (1.0 - smoothstep(0.0, 0.05, a));
    vLocal = vec2(hw, lat);
  } else if (part < 1.5) {
    // Tail: a fan that curls with the tail beat.
    vec2 base = spineAt(1.0, fwd);
    float len = uTailLen * uLength;
    vec2 dir = rot2(-fwd, b * 0.62 + uTailBend * a);
    pos = base - fwd * uLength * 0.015 + dir * a * len;
  } else if (part < 3.5) {
    // Pectoral fins.
    float side = part < 2.5 ? 1.0 : -1.0;
    float ang = part < 2.5 ? uFinL : uFinR;
    vec2 c = spineAt(0.2, fwd);
    vec2 anchor = c + perp2(fwd) * side * bodyProfile(0.2) * uHalfWidth * 0.72;
    vec2 axis = rot2(-fwd, -side * ang);
    pos = anchor + rot2(axis, b * 0.55) * a * uFinLen * uLength;
  } else if (part < 5.5) {
    // Pelvic fins.
    float side = part < 4.5 ? 1.0 : -1.0;
    vec2 c = spineAt(0.52, fwd);
    vec2 anchor = c + perp2(fwd) * side * bodyProfile(0.52) * uHalfWidth * 0.55;
    vec2 axis = rot2(-fwd, -side * uPelvic);
    pos = anchor + rot2(axis, b * 0.35) * a * uFinLen * 0.5 * uLength;
  } else {
    // Dorsal fin, seen nearly edge-on from above; long-finned koi trail it.
    float u = mix(0.3, 0.78, a);
    vec2 c = spineAt(u, fwd);
    float w = uHalfWidth * mix(0.06, 0.32, uDorsal) * sin(a * 3.14159);
    float sway = uHalfWidth * 0.3 * uDorsal * a * sin(a * 5.0 - uPhase);
    pos = c + perp2(fwd) * (b * w + sway);
  }

  pos += uOffset;
  vFish = aFish;
  vPerp = perp2(fwd);
  vWorld = pos;
  gl_Position = projectionMatrix * viewMatrix * vec4(pos, 0.0, 1.0);
}
`;

export const koiFragment = /* glsl */ `
${glslLighting}
${glslNoise}
${glslKoiCommon}
#define PI 3.141592653589793
uniform vec3 uBase;
uniform vec3 uPatch;
uniform vec3 uPatch2;
uniform vec3 uFin;
uniform float uPattern;
uniform float uSeed;
uniform float uMetallic;
uniform float uDepth;
uniform float uAttenuation;
uniform float uAlpha;
uniform float uSoft;
uniform float uHalfWidth;
uniform float uHighlight;
uniform float uDorsal;
uniform float uPhase;
uniform float uShadowStrength;
uniform float uGaze;
uniform float uBreath;
uniform vec3 uIris;

varying vec3 vFish;
varying vec2 vLocal;
varying vec2 vPerp;
varying vec2 vWorld;

vec3 koiPattern(vec2 bp, float u, float s) {
  float seed = uSeed * 37.0;
  float back = 1.0 - s * s;
  vec3 col = uBase;
  if (uPattern < 1.5) {
    // Kohaku / Sanke: red hi plates along the back, clean nose and tail root.
    float hi = fbm(bp * 0.42 + seed) + 0.22 * back
      - 0.12 * smoothstep(0.8, 0.95, u)
      - 0.3 * (1.0 - smoothstep(0.02, 0.1, u));
    col = mix(col, uPatch, smoothstep(0.56, 0.6, hi));
    if (uPattern > 0.5) {
      float sumi = fbm(bp * 1.05 + seed * 2.3 + 5.0) + 0.1 * back;
      float m = smoothstep(0.64, 0.68, sumi) * smoothstep(0.2, 0.28, u) * smoothstep(0.95, 0.7, abs(s));
      col = mix(col, uPatch2, m);
    }
  } else if (uPattern < 2.5) {
    // Showa: black base wrapping the body, red and white over it, sumi on the head.
    float hi = fbm(bp * 0.45 + seed) + 0.18 * back;
    col = mix(col, uPatch, smoothstep(0.5, 0.55, hi));
    float sumi = fbm(bp * vec2(0.5, 0.85) + seed * 1.7 + 9.0)
      + 0.12 * (1.0 - smoothstep(0.0, 0.25, u))
      + 0.08 * (1.0 - back);
    col = mix(col, uPatch2, smoothstep(0.53, 0.58, sumi));
  } else if (uPattern < 3.5) {
    // Ogon: single metallic colour with a soft sheen.
    float sheen = fbm(bp * 0.6 + seed);
    col = mix(uPatch2, uPatch, clamp(sheen * 0.8 + 0.3 * back, 0.0, 1.0));
  } else if (uPattern < 4.5) {
    // Asagi: blue-grey net back, pale head, red-orange cheeks and flanks.
    float headM = 1.0 - smoothstep(0.13, 0.22, u);
    float sides = smoothstep(0.55, 0.85, abs(s)) * smoothstep(0.08, 0.2, u);
    float cheeks = headM * smoothstep(0.35, 0.7, abs(s));
    col = mix(uBase * (0.85 + 0.25 * back), uPatch2, headM);
    col = mix(col, uPatch, max(sides, cheeks));
  } else if (uPattern < 5.5) {
    // Tancho: a single red crown on the head.
    vec2 d = bp - vec2(1.15, 0.0);
    float r = 0.42 + 0.03 * sin(atan(d.y, d.x) * 3.0 + seed);
    col = mix(col, uPatch, smoothstep(r + 0.04, r - 0.04, length(d)));
  } else {
    // Butterfly: platinum with orange and yellow patches.
    float hi = fbm(bp * 0.38 + seed) + 0.2 * back;
    col = mix(col, uPatch2, smoothstep(0.44, 0.5, hi));
    col = mix(col, uPatch, smoothstep(0.57, 0.62, hi));
  }
  return col;
}

/* Eye centre and radius in body-pattern space (x = 8 units per length, y = half-widths). */
const vec2 EYE_C = vec2(0.72, 0.53);
const float EYE_R = 0.125;

/*
 * A koi eye seen from above: a glossy dome on the side of the head whose
 * axis points outward and slightly up, so the iris and pupil appear as
 * offset ellipses. fwdW / outW are the head-ward and outward directions in
 * world space. Returns the shaded colour; coverage goes to cover.
 */
vec3 koiEye(vec2 bp, vec3 skin, vec2 fwdW, vec2 outW, vec3 L, out float cover) {
  // Eye-local coordinates: x towards the nose, y outward, unit radius.
  vec2 q = vec2(EYE_C.x - bp.x, abs(bp.y) - EYE_C.y) / EYE_R;
  float r = length(q);
  float aa = max(fwidth(r), 1e-3) * 1.2;
  cover = smoothstep(1.0 + aa, 1.0 - aa, r);

  // Soft socket shadow around the bulge.
  float socket = smoothstep(1.55, 1.0, r) * (1.0 - cover);
  vec3 col = skin * (1.0 - 0.3 * socket);
  if (cover <= 0.0) return col;

  vec3 P = vec3(q, sqrt(max(1.0 - r * r, 0.0)));
  // Eye axis: mostly outward, tilted up, rolled forward/back by the gaze.
  vec3 axis = normalize(vec3(uGaze * 0.45 + 0.08, 0.78, 0.6));
  float c = dot(P, axis);
  float caa = max(fwidth(c), 1e-3);
  float iris = smoothstep(0.32 - caa, 0.32 + caa, c);
  float pupil = smoothstep(0.8 - caa, 0.8 + caa, c);

  // Iris: radial fibres, darker towards the pupil, a bright gold rim.
  vec3 side = normalize(cross(axis, vec3(0.0, 0.0, 1.0)));
  vec3 up = cross(side, axis);
  float fibreAngle = atan(dot(P, up), dot(P, side));
  float fibres = 0.8 + 0.3 * vnoise(vec2(fibreAngle * 5.0 + uSeed * 40.0, c * 6.0));
  float ring = smoothstep(0.32, 0.8, c);
  vec3 irisCol = uIris * fibres * mix(1.35, 0.6, ring);
  // Gold rim where the iris meets the pupil.
  irisCol += uIris * 0.6 * smoothstep(0.66, 0.78, c) * (1.0 - pupil);
  // Eyeball outside the iris: dark, slightly translucent tissue.
  vec3 ball = mix(skin * 0.35, vec3(0.08, 0.07, 0.06), 0.6);
  vec3 eyeCol = mix(ball, irisCol, iris);
  eyeCol = mix(eyeCol, vec3(0.015, 0.016, 0.02), pupil);

  // Glossy cornea: sun glint, a broad sky reflection and a darker rim.
  vec3 n = normalize(vec3(fwdW * P.x + outW * P.y, P.z));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float glint = pow(max(dot(n, H), 0.0), 160.0);
  float sky = smoothstep(0.55, 0.95, dot(n, normalize(vec3(-outW * 0.3, 1.0)))) * 0.12;
  float rim = smoothstep(0.3, 0.0, P.z);
  eyeCol *= (uAmbient * 1.1 + uSunColor * max(dot(n, L), 0.0) * 0.6) * (1.0 - 0.35 * rim);
  eyeCol += uSunColor * (glint * 1.6 + sky);
  return mix(col, eyeCol, cover);
}

/* Overlapping scale arcs; returns ~1 on scale edges. */
float scaleEdges(vec2 bp) {
  vec2 g = bp * 2.7;
  g.y += 0.5 * mod(floor(g.x), 2.0);
  vec2 f = fract(g) - vec2(0.25, 0.5);
  return smoothstep(0.3, 0.5, length(f * vec2(1.25, 1.0)));
}

void main() {
  float part = vFish.z;
  float a = vFish.x;
  float b = vFish.y;
  float alpha;
  vec3 col;
  vec3 L = normalize(uSunDir);

  if (part < 0.5) {
    float hw = vLocal.x;
    float lat = vLocal.y;
    alpha = smoothstep(-uSoft, uSoft * 0.5, hw - abs(lat));
#ifndef SHADOW
    float s = clamp(lat / max(hw, 1e-4), -1.0, 1.0);
    vec2 bp = vec2(a * 8.0, lat / uHalfWidth);
    col = koiPattern(bp, a, s);
    // The head is smooth skin; scales start behind the gill covers.
    float scaled = smoothstep(1.45, 2.0, bp.x);
    float edges = scaleEdges(bp) * scaled;
    col *= 1.0 - edges * (uPattern > 3.5 && uPattern < 4.5 ? 0.2 : 0.045);

    // Gill cover edge: a curved crease that flexes as the koi breathes.
    float gillX = 1.55 + 0.45 * s * s + 0.035 * uBreath;
    float gill = smoothstep(0.07, 0.0, abs(bp.x - gillX)) * smoothstep(0.3, 0.6, abs(s));
    float cheek = smoothstep(gillX, gillX - 0.5, bp.x) * smoothstep(0.25, 0.8, abs(s));
    col *= 1.0 - 0.16 * gill - 0.05 * cheek * (0.6 + 0.4 * uBreath);
    // Nostrils ahead of the eyes.
    col *= 1.0 - 0.25 * smoothstep(0.035, 0.012, length(vec2(bp.x - 0.36, abs(bp.y) - 0.28)));

    // Cylindrical body normal for lighting.
    vec3 n = normalize(vec3(vPerp * s * 0.85, sqrt(max(1.0 - s * s * 0.75, 0.05))));
    float lam = max(dot(n, L), 0.0);
    vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
    float shine = mix(32.0, 14.0, uMetallic);
    float spec = pow(max(dot(n, H), 0.0), shine) * mix(0.16, 0.85, uMetallic);
    vec3 specCol = mix(vec3(1.0), col * 1.4, uMetallic * 0.6);
    // Rounded flanks fall off into shade.
    col *= 0.72 + 0.28 * sqrt(max(1.0 - s * s, 0.0));
    col = col * (uAmbient * 0.95 + uSunColor * lam * 0.7) + uSunColor * specCol * spec;
    // Shimmer on metallic scales.
    col += uMetallic * 0.12 * uSunColor * (1.0 - edges) * vnoise(bp * 6.0 + uPhase * 0.3);

    // Eyes go on last: they carry their own lighting.
    vec2 fwdW = vec2(vPerp.y, -vPerp.x);
    vec2 outW = vPerp * (lat < 0.0 ? -1.0 : 1.0);
    float eyeCover;
    col = koiEye(bp, col, fwdW, outW, L, eyeCover);
#endif
  } else if (part < 1.5) {
    float wave = 0.06 * sin(b * 6.0 + uPhase * 1.3) * step(0.3, uDorsal);
    float trailing = 1.0 - 0.36 * pow(1.0 - abs(b), 1.5) + wave;
    alpha = smoothstep(trailing, trailing - 0.14, a) * smoothstep(1.0, 0.82, abs(b)) * 0.85;
#ifndef SHADOW
    float rays = 0.9 + 0.1 * sin(b * 40.0);
    col = uFin * rays * (uAmbient + uSunColor * 0.6);
    alpha *= (0.72 + 0.28 * (1.0 - a)) * (0.88 + 0.12 * sin(b * 40.0));
#endif
  } else if (part < 5.5) {
    float wave = 0.08 * sin(b * 5.0 + uPhase) * step(0.3, uDorsal);
    alpha = smoothstep(1.0 + wave, 0.78, a) * smoothstep(1.0, 0.7, abs(b)) * smoothstep(0.0, 0.06, a);
    alpha *= part < 3.5 ? 0.82 : 0.6;
#ifndef SHADOW
    float rays = 0.9 + 0.1 * sin(b * 26.0);
    col = uFin * rays * (uAmbient + uSunColor * 0.6);
    alpha *= 0.7 + 0.3 * (1.0 - a);
#endif
  } else {
    alpha = sin(a * PI) * smoothstep(1.0, 0.2, abs(b)) * (0.25 + 0.5 * uDorsal);
#ifndef SHADOW
    col = uFin * 0.75 * (uAmbient + uSunColor * 0.5);
#endif
  }

#ifdef SHADOW
  float finFactor = part < 0.5 ? 1.0 : 0.45;
  gl_FragColor = vec4(0.0, 0.02, 0.02, alpha * finFactor * uShadowStrength * uAlpha);
#else
  col = mix(col, vec3(1.0, 0.55, 0.4), uHighlight * 0.35);
  // Depth: deep fish fade into the water colour.
  col = mix(col, uWaterTint * 1.15, uDepth * uAttenuation);
  gl_FragColor = vec4(col, alpha * uAlpha);
#endif
}
`;
