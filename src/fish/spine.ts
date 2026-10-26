import { angleDelta, clamp } from "@/lib/math";

/**
 * Follow-the-leader chain: joint 0 is the head, each following joint is
 * dragged behind the previous one at a fixed segment length, with the bend
 * between neighbouring segments limited so the body never kinks.
 */
export function solveChain(
  joints: Float32Array,
  count: number,
  headX: number,
  headY: number,
  heading: number,
  segment: number,
  maxBend: number,
) {
  joints[0] = headX;
  joints[1] = headY;
  // Direction pointing backwards from the previous joint.
  let refAngle = heading + Math.PI;
  for (let i = 1; i < count; i++) {
    const px = joints[(i - 1) * 2];
    const py = joints[(i - 1) * 2 + 1];
    let dx = joints[i * 2] - px;
    let dy = joints[i * 2 + 1] - py;
    if (dx * dx + dy * dy < 1e-10) {
      dx = Math.cos(refAngle);
      dy = Math.sin(refAngle);
    }
    let ang = Math.atan2(dy, dx);
    const bend = angleDelta(refAngle, ang);
    ang = refAngle + clamp(bend, -maxBend, maxBend);
    joints[i * 2] = px + Math.cos(ang) * segment;
    joints[i * 2 + 1] = py + Math.sin(ang) * segment;
    refAngle = ang;
  }
}

/**
 * Writes the rendered spine: chain positions plus a travelling lateral wave
 * whose amplitude grows towards the tail (carangiform swimming).
 */
export function applyUndulation(
  joints: Float32Array,
  out: Float32Array,
  count: number,
  phase: number,
  amplitude: number,
) {
  const waveNumber = Math.PI * 2 * 0.85;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const i0 = Math.max(i - 1, 0);
    const i1 = Math.min(i + 1, count - 1);
    let tx = joints[i1 * 2] - joints[i0 * 2];
    let ty = joints[i1 * 2 + 1] - joints[i0 * 2 + 1];
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    const envelope = 0.06 + 0.94 * Math.pow(t, 1.7);
    const offset = amplitude * envelope * Math.sin(phase - t * waveNumber);
    out[i * 2] = joints[i * 2] - ty * offset;
    out[i * 2 + 1] = joints[i * 2 + 1] + tx * offset;
  }
}
