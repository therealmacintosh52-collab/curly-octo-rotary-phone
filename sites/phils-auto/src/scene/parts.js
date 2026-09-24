import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/**
 * Geometry helpers for the engine.
 *
 * The rule that matters here: nothing gets a hard 90° edge. Real cast and
 * machined parts have a chamfer or a radius on every edge, and that edge is
 * what catches the light — it is the single difference between something that
 * reads as a manufactured object and something that reads as a toy brick.
 */

/** A box with an actual radius on its edges. */
export function roundedBox(w, h, d, radius = 0.05, segments = 3) {
  return new RoundedBoxGeometry(w, h, d, segments, Math.min(radius, Math.min(w, h, d) / 2.05));
}

/**
 * A lathe profile — for anything turned on a machine: pulleys with their
 * V-grooves, bell housings with their taper and flange.
 */
export function lathe(points, segments = 48) {
  const g = new THREE.LatheGeometry(
    points.map(([x, y]) => new THREE.Vector2(Math.max(x, 0.0001), y)),
    segments
  );
  g.rotateZ(Math.PI / 2); // lathes build around Y; the engine's axis is X
  return g;
}

/** A pipe that actually bends, instead of a straight cylinder. */
export function tube(points, radius, tubular = 24, radial = 12) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, tubular, radius, radial, false);
}

/**
 * A ring of bolt heads as one geometry. Bolts are the detail that says
 * "this was assembled" louder than any amount of polygon count.
 */
export function boltRow(count, from, to, head = 0.034, axis = "y") {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const g = new THREE.CylinderGeometry(head, head * 1.06, head * 0.9, 6);
    if (axis === "z") g.rotateX(Math.PI / 2);
    if (axis === "x") g.rotateZ(Math.PI / 2);
    g.translate(
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t,
      from[2] + (to[2] - from[2]) * t
    );
    parts.push(g);
  }
  return mergeAll(parts);
}

/** Cooling ribs down the side of the block. */
export function ribs(count, length, height, thickness, spacing, offset) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const g = roundedBox(length, height, thickness, thickness * 0.4, 2);
    g.translate(offset[0], offset[1], offset[2] + (i - (count - 1) / 2) * spacing);
    parts.push(g);
  }
  return mergeAll(parts);
}

/** Minimal BufferGeometry merge — avoids pulling in BufferGeometryUtils. */
export function mergeAll(geometries) {
  const withNormals = geometries.map((g) => (g.attributes.normal ? g : g.computeVertexNormals() ?? g));
  let posCount = 0;
  for (const g of withNormals) posCount += g.attributes.position.count;

  const position = new Float32Array(posCount * 3);
  const normal = new Float32Array(posCount * 3);
  const uv = new Float32Array(posCount * 2);
  const index = [];

  let vOffset = 0;
  for (const g of withNormals) {
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const t = g.attributes.uv;
    position.set(p.array.subarray(0, p.count * 3), vOffset * 3);
    if (n) normal.set(n.array.subarray(0, n.count * 3), vOffset * 3);
    if (t) uv.set(t.array.subarray(0, t.count * 2), vOffset * 2);
    if (g.index) for (const i of g.index.array) index.push(i + vOffset);
    else for (let i = 0; i < p.count; i++) index.push(i + vOffset);
    vOffset += p.count;
    g.dispose();
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(position, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  out.setIndex(index);
  return out;
}

/* ------------------------------------------------------------------ *
 * Generated surface maps.
 *
 * These are the difference between "a 3D shape" and "a thing made of
 * metal", and their absence is the single biggest reason code-built
 * geometry looks synthetic. A real asset pipeline ships authored albedo,
 * normal, roughness and AO maps at 2K each; there is no artist and no
 * download budget here, so the height field is generated and the normal
 * map derived from it with a Sobel pass at load time.
 * ------------------------------------------------------------------ */

/** Shared value-noise height field: casting grain + machining lines. */
function heightField(size, opts) {
  const { lines = 0, lineFreq = 90, grain = 1 } = opts ?? {};
  const rand = (x, y, s) => {
    const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const smooth = (x, y, freq, seed) => {
    const fx = (x / size) * freq, fy = (y / size) * freq;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = fx - ix, ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = rand(ix, iy, seed), b = rand(ix + 1, iy, seed);
    const c = rand(ix, iy + 1, seed), d = rand(ix + 1, iy + 1, seed);
    const top = a + (b - a) * sx;
    return top + ((c + (d - c) * sx) - top) * sy;
  };

  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v =
        smooth(x, y, 96, 1) * 0.3 +
        smooth(x, y, 26, 2) * 0.42 +
        smooth(x, y, 7, 3) * 0.28;
      v *= grain;
      // Fine concentric machining marks, the giveaway that a face was cut.
      if (lines) v += Math.sin((x / size) * lineFreq * Math.PI * 2) * 0.5 * lines;
      h[y * size + x] = v;
    }
  }
  return h;
}

function toTexture(canvas, repeat) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 4;
  return tex;
}

/**
 * Normal map, derived from the height field with a Sobel operator.
 *
 * Without this every face between two chamfers is geometrically perfect and
 * reflects the environment as one clean sheet, which is exactly what reads as
 * "computer graphics" rather than "cast aluminium".
 */
let normalTexture = null;
export function castNormal() {
  if (normalTexture) return normalTexture;
  const size = 256, strength = 2.6;
  const h = heightField(size, { lines: 0.06, lineFreq: 60 });
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];

  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx =
        (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1)) -
        (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1));
      const dy =
        (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1)) -
        (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1));
      let nx = dx * strength, ny = dy * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  normalTexture = toTexture(c, 9);
  return normalTexture;
}

/**
 * Grime: oil film, heat staining and worn paint, as a multiply over the base
 * colour. A spotless casting is a render; a shop engine has a history.
 */
let grimeTexture = null;
export function grime() {
  if (grimeTexture) return grimeTexture;
  const size = 256;
  const h = heightField(size, { grain: 1 });
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = h[i];
    // Blotchy darkening, weighted to the low end so most of the surface is
    // clean and the dirt reads as deposits rather than as a dirty texture.
    const dark = Math.pow(Math.max(0, 1 - v * 1.25), 2.2);
    const g = Math.round(255 * (1 - dark * 0.55));
    const j = i * 4;
    img.data[j] = g;
    img.data[j + 1] = Math.round(g * 0.985);
    img.data[j + 2] = Math.round(g * 0.95);   // deposits go warm, not grey
    img.data[j + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  grimeTexture = toTexture(c, 2);
  grimeTexture.colorSpace = THREE.SRGBColorSpace;
  return grimeTexture;
}

/**
 * Cast-surface roughness, generated rather than downloaded.
 *
 * A single roughness value across a whole part is what makes CG metal look
 * like plastic: real castings are microscopically uneven, so their highlights
 * break up instead of sitting as one clean sheen.
 */
let roughnessTexture = null;
export function castRoughness() {
  if (roughnessTexture) return roughnessTexture;
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(size, size);

  // Value noise at three octaves — grain, then blotches, then broad variation.
  const rand = (x, y, s) => {
    const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const sample = (x, y, freq, seed) => {
    const fx = (x / size) * freq;
    const fy = (y / size) * freq;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = fx - ix, ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = rand(ix, iy, seed), b = rand(ix + 1, iy, seed);
    const cc = rand(ix, iy + 1, seed), d = rand(ix + 1, iy + 1, seed);
    return (a + (b - a) * sx) + ((cc + (d - cc) * sx) - (a + (b - a) * sx)) * sy;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v =
        sample(x, y, 64, 1) * 0.35 +
        sample(x, y, 16, 2) * 0.4 +
        sample(x, y, 5, 3) * 0.25;
      const g = Math.round(150 + v * 105); // 150–255: rough, never mirror-smooth
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = g;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  roughnessTexture = new THREE.CanvasTexture(c);
  roughnessTexture.wrapS = roughnessTexture.wrapT = THREE.RepeatWrapping;
  roughnessTexture.repeat.set(3, 3);
  return roughnessTexture;
}
