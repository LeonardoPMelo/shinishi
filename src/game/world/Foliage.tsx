import { useEffect, useMemo, useState } from 'react';
import { useRapier } from '@react-three/rapier';
import * as THREE from 'three';
import { getGradient, windTime, enhanceToon, enhanceRock } from '../materials';
import { setFlowers } from '../fauna/habitat';
import { getPuffGeometry } from '../foliageGeometry';
import { RIVER } from '../../data/world';
import { HORTA } from '../../data/chapter3';
import { pathDistance } from './Ground';
import { EAST, EAST_PLAZA, POND, TEA } from '../../data/east';
import { WEST, CLEARING, ONSEN } from '../../data/west';
import { SOUTH, STREAM } from '../../data/south';

type Spot = { x: number; z: number; r: number; tall?: boolean; lush?: number };
import { useEffectiveQuality } from '../../store/uiSettings';
import { rockGeometry } from '../rockGeometry';
import { addGroundContact } from '../groundContact';

/**
 * Instanced grass tufts and wild flowers that sway in the wind.
 * Placement asks the physics world: a downward ray that hits anything above the
 * ground (houses, decks, rocks, trees) rejects the spot, so the grass never grows
 * through floors. The plaza, river and dirt paths are excluded by shape.
 */

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

/** Smooth value noise (0..1) on a lattice hashed from the seed. */
function noise2(x: number, z: number, seed: number) {
  const h = (i: number, j: number) => {
    let n = (i * 374761393 + j * 668265263 + seed * 144269) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const xi = Math.floor(x), zi = Math.floor(z);
  const u = x - xi, v = z - zi;
  const fu = u * u * (3 - 2 * u), fv = v * v * (3 - 2 * v);
  return (h(xi, zi) * (1 - fu) + h(xi + 1, zi) * fu) * (1 - fv) + (h(xi, zi + 1) * (1 - fu) + h(xi + 1, zi + 1) * fu) * fv;
}

/**
 * How lush the ground is here (0 trodden and sparse ... 1 thick meadow), Etapa 6: two octaves of noise at
 * the scale of a few meters, so the lawn breaks into patches instead of the same even carpet everywhere.
 */
export function lushness(x: number, z: number) {
  return noise2(x * 0.13, z * 0.13, 11) * 0.7 + noise2(x * 0.41 + 7, z * 0.41, 23) * 0.3;
}

const AREA = { minX: -18.8, maxX: 18.8, minZ: -18.8, maxZ: 39.4 };
/** Flat ground pieces without colliders: tatami mats, koi pond, goal mouth. */
const CLEAR_SPOTS: [number, number, number][] = [
  [-4, 30.6, 1.35], [-2, 32.4, 1.35], [-14.2, -17.2, 1.5], [6, 38.6, 1.6],
];

/**
 * The districts outside the fence get their own share of samples, by area. The forest floor gets half
 * the village density (ferns and moss carry it there).
 */
const EXTRA_AREAS = [
  { minX: EAST.minX + 0.4, maxX: EAST.maxX, minZ: EAST.minZ, maxZ: EAST.maxZ, density: 1 },
  { minX: WEST.minX, maxX: WEST.maxX - 0.4, minZ: WEST.minZ, maxZ: 20.6, density: 1 },
  { minX: SOUTH.minX, maxX: SOUTH.maxX, minZ: 40.4, maxZ: SOUTH.maxZ, density: 0.5 },
];

function freeOfShapes(x: number, z: number) {
  if (Math.hypot(x, z) < 5.3) return false;
  if (Math.hypot(x - EAST_PLAZA.x, z - EAST_PLAZA.z) < EAST_PLAZA.r + 0.5) return false;
  const px = (x - POND.x) / (POND.rx + 0.45);
  const pz = (z - POND.z) / (POND.rz + 0.45);
  if (px * px + pz * pz < 1) return false;
  if (Math.hypot(x - CLEARING.x, z - CLEARING.z) < CLEARING.r * 0.8) return false;
  const ox = (x - ONSEN.x) / (ONSEN.rx + 0.45);
  const oz = (z - ONSEN.z) / (ONSEN.rz + 0.45);
  if (ox * ox + oz * oz < 1) return false;
  if (z > 40 && Math.abs(z - STREAM.z) < STREAM.halfWidth + 0.35) return false;
  // the step stones in front of each tea terrace
  if (x > TEA.x0 && x < TEA.x0 + 1.4 && TEA.levels.some((lv) => z > lv.z0 - 0.6 && z < lv.z0)) return false;
  for (const [cx, cz, r] of CLEAR_SPOTS) if (Math.hypot(x - cx, z - cz) < r) return false;
  if (Math.abs(z - RIVER.z) < RIVER.halfWidth + 0.55) return false;
  if (pathDistance(x, z) < 0.85) return false;
  // Vovó Mochi's garden bed: bare soil, no grass poking through
  if (Math.abs(x - HORTA.x) < HORTA.w / 2 + 0.3 && Math.abs(z - HORTA.z) < HORTA.d / 2 + 0.3) return false;
  return true;
}

/**
 * A clump of five curved, tapering blades (2 segments each): dark at the root, fresh green in the
 * middle, sunlit at the tip. Blades fan out and arc over, so a field reads as soft grass rather than
 * rows of upright spikes. 3 triangles per blade; normals point up so every blade lights evenly.
 */
function tuftGeometry() {
  const pos: number[] = [];
  const col: number[] = [];
  // the root matches the ground green so a tuft grows out of the lawn instead of sitting on it as a dark star
  const base = new THREE.Color('#548F3C');
  const mid = new THREE.Color('#7DB84E');
  const tip = new THREE.Color('#D2EC8C');
  const blades = [
    { a: 0.0, h: 0.34, lean: 0.12, w: 0.042 },
    { a: 1.3, h: 0.27, lean: 0.16, w: 0.038 },
    { a: 2.5, h: 0.31, lean: 0.1, w: 0.04 },
    { a: 3.8, h: 0.22, lean: 0.18, w: 0.036 },
    { a: 5.0, h: 0.26, lean: 0.14, w: 0.038 },
  ];
  const SEG = 2;
  for (const b of blades) {
    const dx = Math.cos(b.a);
    const dz = Math.sin(b.a);
    const sx = -dz;
    const sz = dx;
    const rows: number[][][] = [];
    for (let k = 0; k <= SEG; k++) {
      const t = k / SEG;
      // arc: the lean grows with the square of the height, so the blade curls over at the top
      const off = b.lean * t * t;
      const y = b.h * (t - 0.18 * t * t);
      const w = b.w * (1 - t) * (k === SEG ? 0 : 1) + (k === SEG ? 0 : 0.004);
      const cx = dx * off;
      const cz = dz * off;
      rows.push([[cx + sx * w, y, cz + sz * w], [cx - sx * w, y, cz - sz * w]]);
    }
    const shade = (t: number) => (t < 0.5 ? base.clone().lerp(mid, t * 2) : mid.clone().lerp(tip, (t - 0.5) * 2));
    for (let k = 0; k < SEG; k++) {
      const [L0, R0] = rows[k];
      const [L1, R1] = rows[k + 1];
      const c0 = shade(k / SEG);
      const c1 = shade((k + 1) / SEG);
      const tri = (p: number[][], c: THREE.Color[]) => {
        p.forEach((v) => pos.push(...v));
        c.forEach((cc) => col.push(cc.r, cc.g, cc.b));
      };
      if (k === SEG - 1) {
        tri([L0, R0, L1], [c0, c0, c1]); // last segment closes to a point
      } else {
        tri([L0, R0, R1], [c0, c0, c1]);
        tri([L0, R1, L1], [c0, c1, c1]);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  // Grass looks best lit from above regardless of blade orientation.
  const n = g.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}

/**
 * Tall grass clump (Etapa 6): seven long, thin blades (3 segments) that arch further out, a darker base and
 * pale, straw-colored tips, three of them carrying a small seed head. ~0.5–0.65 m: the wild edges of the
 * lawn, against fences and walls and along the paths.
 */
function tallTuftGeometry() {
  const pos: number[] = [];
  const col: number[] = [];
  const base = new THREE.Color('#4A8236');
  const mid = new THREE.Color('#79AE48');
  const tip = new THREE.Color('#E2E09A');
  const seed = new THREE.Color('#D8C58A');
  const SEG = 3;
  for (let b = 0; b < 7; b++) {
    const a = (b / 7) * Math.PI * 2 + (b % 2) * 0.4;
    const h = 0.46 + ((b * 37) % 7) / 7 * 0.2;
    const lean = 0.16 + ((b * 13) % 5) / 5 * 0.14;
    const w = 0.03;
    const dx = Math.cos(a), dz = Math.sin(a);
    const sx = -dz, sz = dx;
    const at = (t: number) => {
      const off = lean * t * t;
      return [dx * off, h * (t - 0.22 * t * t), dz * off];
    };
    const shade = (t: number) => (t < 0.5 ? base.clone().lerp(mid, t * 2) : mid.clone().lerp(tip, (t - 0.5) * 2));
    for (let k = 0; k < SEG; k++) {
      const t0 = k / SEG, t1 = (k + 1) / SEG;
      const [x0, y0, z0] = at(t0);
      const [x1, y1, z1] = at(t1);
      const w0 = w * (1 - t0), w1 = w * (1 - t1);
      const L0 = [x0 + sx * w0, y0, z0 + sz * w0], R0 = [x0 - sx * w0, y0, z0 - sz * w0];
      const L1 = [x1 + sx * w1, y1, z1 + sz * w1], R1 = [x1 - sx * w1, y1, z1 - sz * w1];
      const c0 = shade(t0), c1 = shade(t1);
      const tri = (p: number[][], c: THREE.Color[]) => {
        p.forEach((v) => pos.push(...v));
        c.forEach((cc) => col.push(cc.r, cc.g, cc.b));
      };
      if (k === SEG - 1) tri([L0, R0, L1], [c0, c0, c1]);
      else {
        tri([L0, R0, R1], [c0, c0, c1]);
        tri([L0, R1, L1], [c0, c1, c1]);
      }
    }
    // a seed head on every other blade: a small diamond at the tip
    if (b % 2 === 0) {
      const [x, y, z] = at(1);
      const r = 0.022;
      const top = [x + dx * 0.03, y + 0.05, z + dz * 0.03];
      const l = [x + sx * r, y, z + sz * r], rr = [x - sx * r, y, z - sz * r], bot = [x, y - 0.03, z];
      for (const tri of [[top, l, rr], [bot, rr, l]]) {
        tri.forEach((v) => pos.push(...v));
        for (let i = 0; i < 3; i++) col.push(seed.r, seed.g, seed.b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const nrm = new Float32Array(pos.length);
  for (let i = 0; i < nrm.length; i += 3) nrm[i + 1] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  return g;
}

/** Five round petals and a center, flat, facing up. Center is vertex-colored gold. */
function flowerGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const p = new THREE.CircleGeometry(0.05, 7);
    p.translate(Math.cos(a) * 0.055, Math.sin(a) * 0.055, 0);
    parts.push(p);
  }
  const center = new THREE.CircleGeometry(0.035, 8);
  center.translate(0, 0, 0.004);
  parts.push(center);
  const pos: number[] = [];
  const col: number[] = [];
  parts.forEach((p, k) => {
    const g = p.toNonIndexed();
    const arr = g.getAttribute('position').array;
    for (let i = 0; i < arr.length; i += 3) {
      pos.push(arr[i], arr[i + 1], arr[i + 2]);
      // white petals take the instance color; the center stays warm yellow-ish
      if (k === 5) col.push(4, 3.2, 0.6);
      else col.push(1, 1, 1);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

function swayMaterial(opts: { side?: THREE.Side; strength: number }) {
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: getGradient(), side: opts.side ?? THREE.FrontSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWindTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         #ifdef USE_INSTANCING
           vec2 rootXZ = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
         #else
           vec2 rootXZ = vec2(0.0);
         #endif
         float bend = transformed.y * ${opts.strength.toFixed(3)};
         float gust = sin(uWindTime * 1.8 + rootXZ.x * 0.45 + rootXZ.y * 0.3) * 0.7 + sin(uWindTime * 3.1 + rootXZ.x * 1.3) * 0.3;
         transformed.x += gust * bend;
         transformed.z += cos(uWindTime * 1.4 + rootXZ.y * 0.4) * bend * 0.5;`
      );
  };
  m.customProgramCacheKey = () => `sway-${opts.strength}`;
  return m;
}

/**
 * Splits one big InstancedMesh into spatial cells (same geometry and material), each with its own
 * bounding sphere and frustum culling on (Etapa 1). As a single mesh the whole field was drawn every
 * frame, including everything behind the camera: ~3.5 ms of an integrated GPU in the plaza.
 */
function chunkInstanced(src: THREE.InstancedMesh, cell = 30): THREE.Group {
  const group = new THREE.Group();
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const c = new THREE.Color();
  const cells = new Map<string, number[]>();
  for (let i = 0; i < src.count; i++) {
    src.getMatrixAt(i, m);
    p.setFromMatrixPosition(m);
    const key = `${Math.floor(p.x / cell)},${Math.floor(p.z / cell)}`;
    const list = cells.get(key) ?? [];
    list.push(i);
    cells.set(key, list);
  }
  for (const list of cells.values()) {
    const part = new THREE.InstancedMesh(src.geometry, src.material, list.length);
    list.forEach((idx, k) => {
      src.getMatrixAt(idx, m);
      part.setMatrixAt(k, m);
      if (src.instanceColor) {
        src.getColorAt(idx, c);
        part.setColorAt(k, c);
      }
    });
    part.computeBoundingSphere();
    // room for the wind sway and the blade tips
    if (part.boundingSphere) part.boundingSphere.radius += 1;
    part.castShadow = src.castShadow;
    part.receiveShadow = src.receiveShadow;
    part.userData.dynamic = true;
    group.add(part);
  }
  group.userData.dynamic = true;
  return group;
}

const FLOWER_COLORS = ['#FFFFFF', '#FFD1E3', '#F7A8C8', '#FFE58A', '#BFD8FF', '#D9B8FF', '#FF9F80'];

export function Foliage() {
  const quality = useEffectiveQuality();
  const { world, rapier } = useRapier();
  const [spots, setSpots] = useState<{ grass: Spot[]; bushes: Spot[]; rocks: Spot[] } | null>(null);

  // Wait a moment so every fixed collider has been created, then probe placements.
  useEffect(() => {
    const id = setTimeout(() => {
      const rand = seeded(4242);
      const list: Spot[] = [];
      const bushes: Spot[] = [];
      const rocks: Spot[] = [];
      const ray = new rapier.Ray({ x: 0, y: 8, z: 0 }, { x: 0, y: -1, z: 0 });
      const flags = rapier.QueryFilterFlags.ONLY_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS;
      // Ground surface is at y = 0, i.e. time-of-impact 8. Anything sooner is an obstacle.
      const blocked = (x: number, z: number) => {
        ray.origin = { x, y: 8, z };
        const hit = world.castRay(ray, 8, true, flags);
        return !!hit && hit.timeOfImpact < 7.9;
      };
      // a few more samples than before: the density field below thins them out in the trodden patches
      const perM2 = 10500 / ((AREA.maxX - AREA.minX) * (AREA.maxZ - AREA.minZ));
      const areas = [{ ...AREA, n: 10500 }, ...EXTRA_AREAS.map((a) => ({ ...a, n: Math.round(perM2 * a.density * (a.maxX - a.minX) * (a.maxZ - a.minZ)) }))];
      const owner: typeof areas[number][] = [];
      for (const a of areas) for (let k = 0; k < a.n; k++) owner.push(a);
      for (let i = 0; i < owner.length; i++) {
        const A = owner[i];
        const x = A.minX + rand() * (A.maxX - A.minX);
        const z = A.minZ + rand() * (A.maxZ - A.minZ);
        const r = rand();
        if (!freeOfShapes(x, z)) continue;
        // patches: trodden lawn keeps a third of its tufts, the lush meadow all of them
        const lush = lushness(x, z);
        if (rand() > 0.32 + 0.68 * THREE.MathUtils.smoothstep(lush, 0.25, 0.65)) continue;
        if (blocked(x, z)) continue;
        // tall grass where nobody walks or mows: path verges, fence lines, wall feet, the lushest patches
        const pd = pathDistance(x, z);
        const fence = x > AREA.minX && x < AREA.maxX && z > AREA.minZ && z < AREA.maxZ && (Math.abs(x) > 17.6 || z < -17.6 || z > 38.2);
        let tall = (pd > 0.85 && pd < 1.6 && r < 0.55) || (fence && r < 0.7) || lush > 0.68;
        // Bushes grow at the foot of walls, fences and decks: free here, blocked close by.
        if (i % 5 === 0) {
          const d = 0.85;
          const atWall = blocked(x + d, z) || blocked(x - d, z) || blocked(x, z + d) || blocked(x, z - d);
          if (atWall && bushes.length < 300) bushes.push({ x, z, r });
          if (atWall) tall = true;
        }
        list.push({ x, z, r, tall, lush });
        // A few rocks along the path edges.
        if (r < 0.05 && rocks.length < 120) {
          const pd = pathDistance(x, z);
          if (pd > 0.9 && pd < 1.5) rocks.push({ x, z, r: rand() });
        }
      }
      setSpots({ grass: list, bushes, rocks });
    }, 400);
    return () => clearTimeout(id);
  }, [world, rapier]);

  const density = quality === 'alta' ? 1 : quality === 'media' ? 0.6 : 0.3;

  const grass = useMemo(() => {
    if (!spots) return null;
    const used = spots.grass.filter((p, i) => !p.tall && (i % 100) / 100 < density);
    const mesh = new THREE.InstancedMesh(tuftGeometry(), swayMaterial({ side: THREE.DoubleSide, strength: 0.45 }), used.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const tint = new THREE.Color();
    used.forEach((p, i) => {
      q.setFromAxisAngle(up, p.r * Math.PI * 2);
      // trodden patches grow short; the lush ones fuller
      const lush = p.lush ?? 0.5;
      const k = (0.8 + ((p.r * 7.3) % 1) * 0.7) * (0.78 + 0.32 * lush);
      s.set(k, k * (0.85 + ((p.r * 13.1) % 1) * 0.5), k);
      m.compose(new THREE.Vector3(p.x, 0, p.z), q, s);
      mesh.setMatrixAt(i, m);
      // meadow variation: dry where it is sparse, deep green where it is lush, plus a little per-tuft jitter
      const patch = 1 - THREE.MathUtils.smoothstep(lush, 0.2, 0.7);
      const jitter = ((p.r * 31.7) % 1) - 0.5;
      tint.setRGB(0.92 + 0.14 * patch + jitter * 0.08, 0.95 + 0.06 * patch + jitter * 0.06, 0.88 - 0.1 * patch + jitter * 0.05);
      mesh.setColorAt(i, tint);
    });
    mesh.userData.dynamic = true;
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    return mesh;
  }, [spots, density]);

  // Tall grass (Etapa 6): taller, looser clumps with seed heads at the verges, fence lines, wall feet and
  // the lushest patches, so the ground has heights and edges instead of one even lawn.
  const tallGrass = useMemo(() => {
    if (!spots) return null;
    const used = spots.grass.filter((p, i) => p.tall && (i % 100) / 100 < density);
    if (!used.length) return null;
    const mesh = new THREE.InstancedMesh(tallTuftGeometry(), swayMaterial({ side: THREE.DoubleSide, strength: 0.7 }), used.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const tint = new THREE.Color();
    used.forEach((p, i) => {
      q.setFromAxisAngle(up, p.r * Math.PI * 2);
      const k = 0.85 + ((p.r * 5.9) % 1) * 0.5;
      s.set(k, k * (0.8 + ((p.r * 11.3) % 1) * 0.6), k);
      m.compose(new THREE.Vector3(p.x, 0, p.z), q, s);
      mesh.setMatrixAt(i, m);
      const jitter = ((p.r * 29.3) % 1) - 0.5;
      tint.setRGB(0.95 + jitter * 0.08, 0.97 + jitter * 0.05, 0.86 + jitter * 0.06);
      mesh.setColorAt(i, tint);
    });
    mesh.userData.dynamic = true;
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    return mesh;
  }, [spots, density]);

  const flowers = useMemo(() => {
    if (!spots) return null;
    const used = spots.grass.filter((_p, i) => i % 11 === 0 && (i % 100) / 100 < density + 0.1);
    const mesh = new THREE.InstancedMesh(flowerGeometry(), swayMaterial({ strength: 0.25 }), used.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    used.forEach((p, i) => {
      q.setFromEuler(new THREE.Euler((p.r - 0.5) * 0.4, p.r * 20, (p.r * 3 % 1 - 0.5) * 0.4));
      const k = 0.9 + (p.r * 5.7 % 1) * 0.7;
      m.compose(new THREE.Vector3(p.x + 0.05, 0.16 + (p.r * 9.1 % 1) * 0.1, p.z), q, new THREE.Vector3(k, k, k));
      mesh.setMatrixAt(i, m);
      // flowers cluster by color in patches, like real meadows
      const patch = Math.floor((Math.sin(p.x * 0.35) + Math.cos(p.z * 0.3) + 2) * 1.6) % FLOWER_COLORS.length;
      mesh.setColorAt(i, c.set(FLOWER_COLORS[(patch + (p.r > 0.8 ? 1 : 0)) % FLOWER_COLORS.length]));
    });
    // the butterflies visit these (the flower is a flat disc at the instance's height)
    setFlowers(used.map((p) => ({ x: p.x + 0.05, y: 0.16 + (p.r * 9.1 % 1) * 0.1, z: p.z })));
    mesh.userData.dynamic = true;
    mesh.frustumCulled = false;
    return mesh;
  }, [spots, density]);

  const bushes = useMemo(() => {
    if (!spots || !spots.bushes.length) return null;
    // vertexColors: the puff carries baked occlusion, multiplied with each bush's instance color
    const mat = new THREE.MeshToonMaterial({ gradientMap: getGradient(), vertexColors: true });
    enhanceToon(mat, false);
    const all = spots.bushes.filter((_, i) => (i % 10) / 10 < density);
    // 'tiny' puff: a bush is 30–50 cm on screen; the 'low' one cost 262k triangles for ~280 bushes (Etapa 1).
    // Three puff shapes (Etapa 6: every bush was the same one), one instanced mesh each.
    const group = new THREE.Group();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    const greens = ['#4F9A48', '#5DAA4A', '#3F8A4E', '#6DB85A'];
    for (let v = 0; v < 3; v++) {
      const list = all.filter((_, i) => i % 3 === v);
      if (!list.length) continue;
      const mesh = new THREE.InstancedMesh(getPuffGeometry(v, 'tiny'), mat, list.length);
      list.forEach((p, i) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.r * 40);
        const k = 0.32 + (p.r * 7.7 % 1) * 0.22;
        m.compose(new THREE.Vector3(p.x, k * 0.55, p.z), q, new THREE.Vector3(k * 1.15, k * 0.9, k * 1.15));
        mesh.setMatrixAt(i, m);
        c.set(greens[i % greens.length]);
        // a few flowering bushes (azaleas)
        if (p.r > 0.82) c.set(p.r > 0.91 ? '#F49AB8' : '#E8A0D8');
        mesh.setColorAt(i, c);
      });
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.userData.dynamic = true;
      mesh.frustumCulled = false;
      group.add(mesh);
    }
    return group;
  }, [spots, density]);

  const rocks = useMemo(() => {
    if (!spots || !spots.rocks.length) return null;
    const mat = new THREE.MeshToonMaterial({ gradientMap: getGradient(), vertexColors: true });
    enhanceRock(mat);
    // a chiseled stone (Etapa 2) instead of the plain dodecahedron; its baked ground shading multiplies the
    // instance color. Shared from the rock cache, so it is not disposed with the mesh.
    const mesh = new THREE.InstancedMesh(rockGeometry(2, 'pebble'), mat, spots.rocks.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    spots.rocks.forEach((p, i) => {
      // mostly upright: the flat underside rests on the ground
      q.setFromEuler(new THREE.Euler((p.r - 0.5) * 0.4, p.r * 11, (p.r * 7 % 1 - 0.5) * 0.4));
      const k = 0.12 + p.r * 0.2;
      m.compose(new THREE.Vector3(p.x, k * 0.25, p.z), q, new THREE.Vector3(k * 1.3, k * 0.7, k));
      mesh.setMatrixAt(i, m);
      addGroundContact(p.x, p.z, k * 1.1, 0.45);
      mesh.setColorAt(i, c.set(i % 3 ? '#B9B1A3' : '#A39C90'));
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.dynamic = true;
    mesh.frustumCulled = false;
    return mesh;
  }, [spots]);

  useEffect(() => () => {
    // the three bush meshes share one material
    ((bushes?.children[0] as THREE.Mesh | undefined)?.material as THREE.Material | undefined)?.dispose();
    (rocks?.material as THREE.Material | undefined)?.dispose();
  }, [bushes, rocks]);

  useEffect(() => () => {
    tallGrass?.geometry.dispose();
    (tallGrass?.material as THREE.Material | undefined)?.dispose();
  }, [tallGrass]);

  useEffect(() => () => {
    grass?.geometry.dispose();
    (grass?.material as THREE.Material | undefined)?.dispose();
    flowers?.geometry.dispose();
    (flowers?.material as THREE.Material | undefined)?.dispose();
  }, [grass, flowers]);

  const cells = useMemo(() => {
    const meshes: THREE.InstancedMesh[] = [];
    for (const m of [grass, tallGrass, flowers, rocks]) if (m) meshes.push(m);
    bushes?.children.forEach((b) => meshes.push(b as THREE.InstancedMesh));
    return meshes.map((mesh) => chunkInstanced(mesh));
  }, [grass, tallGrass, flowers, bushes, rocks]);

  return (
    <group userData={{ dynamic: true }}>
      {cells.map((g, i) => g && <primitive key={i} object={g} />)}
    </group>
  );
}
