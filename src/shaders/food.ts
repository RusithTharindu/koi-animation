import { glslLighting } from "./common";

export const foodVertex = /* glsl */ `
uniform float uPixelsPerUnit;
uniform float uSize;
attribute float aSink;
attribute float aAlpha;
varying float vSink;
varying float vAlpha;
void main() {
  vSink = aSink;
  vAlpha = aAlpha;
  // Pellets shrink slightly as they sink, like the koi.
  gl_PointSize = uSize * uPixelsPerUnit * mix(1.0, 0.75, aSink) * (0.6 + 0.4 * aAlpha);
  gl_Position = projectionMatrix * viewMatrix * vec4(position.xy, 0.0, 1.0);
}
`;

export const foodFragment = /* glsl */ `
${glslLighting}
varying float vSink;
varying float vAlpha;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  // Rounded pellet with a top-light highlight.
  vec3 base = vec3(0.62, 0.36, 0.14);
  float shade = 0.75 + 0.35 * (1.0 - r * r) + 0.25 * smoothstep(0.6, 0.0, length(p - vec2(-0.35, 0.35)));
  vec3 col = base * shade * (uAmbient + uSunColor * 0.6);
  col = mix(col, uWaterTint * 1.1, vSink * 0.55);
  float alpha = smoothstep(1.0, 0.75, r) * vAlpha;
  gl_FragColor = vec4(col, alpha);
}
`;
