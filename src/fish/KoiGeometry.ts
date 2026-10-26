import { BufferAttribute, BufferGeometry, Sphere, Vector3 } from "three";

/** Part ids; must match the koi shader. */
export const KOI_PART = {
  body: 0,
  tail: 1,
  pectoralL: 2,
  pectoralR: 3,
  pelvicL: 4,
  pelvicR: 5,
  dorsal: 6,
} as const;

/**
 * A single geometry holding every part of a koi as parametric grids.
 * Each vertex carries `aFish = (u, v, part)`; the vertex shader bends it
 * along the animated spine. There is no depth testing, so draw order is
 * index order: fins first so the body sits on top, dorsal fin last.
 */
export function createKoiGeometry(): BufferGeometry {
  const data: number[] = [];
  const index: number[] = [];

  const grid = (cols: number, rows: number, part: number, uMap: (t: number) => number = (t) => t) => {
    const start = data.length / 3;
    for (let r = 0; r <= rows; r++) {
      const v = (r / rows) * 2 - 1;
      for (let c = 0; c <= cols; c++) {
        data.push(uMap(c / cols), v, part);
      }
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = start + r * (cols + 1) + c;
        const b = a + 1;
        const d = a + cols + 1;
        const e = d + 1;
        index.push(a, d, b, b, d, e);
      }
    }
  };

  grid(5, 4, KOI_PART.pelvicL);
  grid(5, 4, KOI_PART.pelvicR);
  grid(8, 6, KOI_PART.pectoralL);
  grid(8, 6, KOI_PART.pectoralR);
  grid(12, 10, KOI_PART.tail);
  // Denser columns near the nose where the outline curves fastest.
  grid(34, 8, KOI_PART.body, (t) => Math.pow(t, 1.35));
  grid(20, 2, KOI_PART.dorsal);

  const geometry = new BufferGeometry();
  const attr = new BufferAttribute(new Float32Array(data), 3);
  geometry.setAttribute("aFish", attr);
  // three requires a position attribute; the shader ignores it.
  geometry.setAttribute("position", attr);
  geometry.setIndex(index);
  // Geometry is placed in the vertex shader, so bounds are meaningless; disable culling on meshes.
  geometry.boundingSphere = new Sphere(new Vector3(), 1e5);
  return geometry;
}
