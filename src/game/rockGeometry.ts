import * as THREE from 'three';
import { mergeVertices, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Natural rocks (Etapa 2). The village's rocks were all the same dodecahedron, which read as plastic.
 * Each variant here is a lumpy sphere chiseled by a few random planes, so it gets broad flat faces with
 * crisp edges between them (crease-angle normals) like a split stone, plus vertex colors baked in:
 * darker toward the ground (it "sits" in the earth), lighter on the faces turned to the sky, a little
 * tone noise, and optionally moss on top. The material color multiplies these, so callers keep tinting.
 *
 * The result is centered near the origin with a radius of about 1, like the dodecahedron it replaces.
 */
export type RockKind = 'boulder' | 'flat' | 'slab' | 'pebble';

export interface RockOptions {
  moss?: boolean;
}

function seeded(seed: number) {
  let s = Math.floor(seed) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Smooth 3D value noise on an integer lattice, hashed from the seed (0..1). */
function noise3(seed: number) {
  const hash = (x: number, y: number, z: number) => {
    let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 144269) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  return (x: number, y: number, z: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const f = (t: number) => t * t * (3 - 2 * t);
    const u = f(x - xi), v = f(y - yi), w = f(z - zi);
    const l = (a: number, b: number, t: number) => a + (b - a) * t;
    const c = (dx: number, dy: number, dz: number) => hash(xi + dx, yi + dy, zi + dz);
    return l(
      l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
      l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v),
      w
    );
  };
}

function facetHash(x: number, y: number, z: number, seed: number) {
  let h = (x * 73856093) ^ (y * 19349663) ^ (z * 83492791) ^ seed;
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967295;
}

const SHAPE: Record<RockKind, { detail: number; scale: [number, number, number]; cuts: number; lump: number; top?: number }> = {
  // chunky field boulder
  boulder: { detail: 2, scale: [1, 0.8, 0.92], cuts: 6, lump: 0.32 },
  // river / pond rim stone: low and wide
  flat: { detail: 2, scale: [1, 0.5, 0.86], cuts: 5, lump: 0.3, top: 0.7 },
  // stepping stone: a flat walkable top, beveled sides
  slab: { detail: 2, scale: [1, 0.34, 0.82], cuts: 4, lump: 0.18, top: 0.62 },
  // small loose stone
  pebble: { detail: 2, scale: [1, 0.66, 0.84], cuts: 4, lump: 0.34 },
};

const cache = new Map<string, THREE.BufferGeometry>();

export function rockGeometry(variant = 0, kind: RockKind = 'boulder', opts: RockOptions = {}): THREE.BufferGeometry {
  const key = `${kind}|${variant}|${opts.moss ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const shape = SHAPE[kind];
  const seed = 9173 + variant * 7919 + kind.length * 104729;
  const rand = seeded(seed);
  const lumps = noise3(seed);
  const tone = noise3(seed + 17);
  const mossNoise = noise3(seed + 31);

  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, shape.detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const p = new THREE.Vector3();

  // 1. lumpy, squashed sphere
  const ox = rand() * 50, oy = rand() * 50, oz = rand() * 50;
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const r = 1 + (lumps(p.x * 1.6 + ox, p.y * 1.6 + oy, p.z * 1.6 + oz) - 0.5) * shape.lump * 2;
    p.multiplyScalar(r);
    p.set(p.x * shape.scale[0], p.y * shape.scale[1], p.z * shape.scale[2]);
    pos.setXYZ(i, p.x, p.y, p.z);
  }

  // 2. chisel: each plane shaves off what sticks out past a fraction of the rock's reach in that direction
  const cut = (n: THREE.Vector3, keep: number) => {
    let reach = -Infinity;
    for (let i = 0; i < pos.count; i++) reach = Math.max(reach, p.fromBufferAttribute(pos, i).dot(n));
    const o = reach * keep;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      const d = p.dot(n) - o;
      if (d > 0) {
        p.addScaledVector(n, -d);
        pos.setXYZ(i, p.x, p.y, p.z);
      }
    }
  };
  if (shape.top !== undefined) cut(new THREE.Vector3((rand() - 0.5) * 0.16, 1, (rand() - 0.5) * 0.16).normalize(), shape.top);
  for (let k = 0; k < shape.cuts; k++) {
    const a = rand() * Math.PI * 2;
    const up = kind === 'boulder' ? rand() * 1.1 - 0.15 : rand() * 0.5 - 0.1;
    cut(new THREE.Vector3(Math.cos(a), up, Math.sin(a)).normalize(), 0.66 + rand() * 0.2);
  }
  // flat underside, so it rests on the ground instead of balancing on a point
  cut(new THREE.Vector3(0, -1, 0), 0.7);

  // 3. faceted where the planes meet, smooth across each face
  g = toCreasedNormals(g, THREE.MathUtils.degToRad(32));
  const P = g.attributes.position as THREE.BufferAttribute;
  const N = g.attributes.normal as THREE.BufferAttribute;
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < P.count; i++) {
    minY = Math.min(minY, P.getY(i));
    maxY = Math.max(maxY, P.getY(i));
  }

  // 4. baked color: ground contact, sky light, tone noise, moss
  const col = new Float32Array(P.count * 3);
  const base = 0.92 + rand() * 0.14;
  // each variant leans a little warm (iron) or cool (slate), so a group of rocks is not one flat color
  const hue = (rand() - 0.4) * 0.14;
  for (let i = 0; i < P.count; i++) {
    p.fromBufferAttribute(P, i);
    const ny = N.getY(i);
    const h = (p.y - minY) / Math.max(1e-6, maxY - minY);
    const ao = 0.5 + 0.5 * THREE.MathUtils.smoothstep(h, 0, 0.45);
    const sky = 1 + 0.2 * Math.max(0, ny);
    const t = 0.88 + tone(p.x * 3.1 + 5, p.y * 3.1, p.z * 3.1) * 0.24;
    // each chiseled face a slightly different shade (keyed on its quantized normal), like split stone
    const facet = 0.93 + 0.14 * facetHash(Math.round(N.getX(i) * 3), Math.round(ny * 3), Math.round(N.getZ(i) * 3), seed);
    let r = base * ao * sky * t * facet;
    let gg = r;
    let b = r * 0.97;
    if (opts.moss && ny > 0.35) {
      const m = THREE.MathUtils.smoothstep(ny, 0.35, 0.75) * THREE.MathUtils.smoothstep(mossNoise(p.x * 2.2, p.y * 2.2, p.z * 2.2), 0.35, 0.6);
      // the material is a grey stone: these factors turn it moss green (vertex colors may exceed 1)
      r *= 1 - m * 0.3;
      gg *= 1 + m * 0.3;
      b *= 1 - m * 0.55;
    }
    col[i * 3] = r * (1 + hue);
    col[i * 3 + 1] = gg;
    col[i * 3 + 2] = b * (1 - hue);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  cache.set(key, g);
  return g;
}
