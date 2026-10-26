import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getGradient, enhanceToon } from '../materials';
import { getPuffGeometry } from '../foliageGeometry';
import { WALK_RECTS } from '../../data/regions';

/**
 * The middle distance (Etapa 6): a band of forest between the districts' fences and the foot of the hills.
 * The ground there was bare, so a raised camera saw the flat edge of the world plane; now three planes
 * read in every view: the village up close, a wall of trees in the middle, hills and mountains behind.
 * Two instanced meshes (conifers and round trees): two draw calls for ~320 trees; the fog does the depth.
 */

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const GROUND = { minX: -55, maxX: 55, minZ: -39, maxZ: 71 };

/** Distance from (x, z) to the nearest walkable rectangle (0 inside). */
export function distanceToWalkable(x: number, z: number) {
  let best = Infinity;
  for (const r of WALK_RECTS) {
    const dx = Math.max(r.minX - x, 0, x - r.maxX);
    const dz = Math.max(r.minZ - z, 0, z - r.maxZ);
    best = Math.min(best, Math.hypot(dx, dz));
  }
  return best;
}

/** Spots for the band: on the ground plane, at least 4 m outside anywhere the cat can go. */
export function treeLineSpots(count = 320, seed = 5151) {
  const r = seeded(seed);
  const out: { x: number; z: number; s: number; kind: 0 | 1; tone: number }[] = [];
  for (let tries = 0; out.length < count && tries < count * 40; tries++) {
    const x = GROUND.minX + r() * (GROUND.maxX - GROUND.minX);
    const z = GROUND.minZ + r() * (GROUND.maxZ - GROUND.minZ);
    const d = distanceToWalkable(x, z);
    if (d < 4) continue;
    // denser near the walkable edge (the visible wall), thinning out toward the plane's border
    if (r() > 1.2 - d / 18) continue;
    if (out.some((o) => Math.hypot(o.x - x, o.z - z) < 1.8)) continue;
    out.push({ x, z, s: 0.85 + r() * 0.7, kind: r() < 0.55 ? 0 : 1, tone: r() });
  }
  return out;
}

function paint(g: THREE.BufferGeometry, rgb: [number, number, number]) {
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set(rgb, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.deleteAttribute('uv');
  return g.index ? g.toNonIndexed() : g;
}

function conifer() {
  const trunk = paint(new THREE.CylinderGeometry(0.16, 0.22, 1.2, 6).translate(0, 0.6, 0), [0.55, 0.42, 0.32]);
  const low = paint(new THREE.ConeGeometry(1.25, 2.6, 7).translate(0, 2.2, 0), [0.92, 0.95, 0.92]);
  const mid = paint(new THREE.ConeGeometry(0.95, 2.1, 7).translate(0, 3.4, 0), [1, 1, 1]);
  const top = paint(new THREE.ConeGeometry(0.6, 1.5, 7).translate(0, 4.4, 0), [1.08, 1.06, 1.02]);
  return mergeGeometries([trunk, low, mid, top], false)!;
}

function roundTree() {
  const trunk = paint(new THREE.CylinderGeometry(0.18, 0.26, 1.8, 6).translate(0, 0.9, 0), [0.55, 0.42, 0.32]);
  const crown = getPuffGeometry(2, 'tiny').clone();
  if (!crown.attributes.color) paint(crown, [1, 1, 1]);
  crown.deleteAttribute('uv');
  crown.scale(1.7, 1.5, 1.7).translate(0, 2.7, 0);
  const g = crown.index ? crown.toNonIndexed() : crown;
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(name)) g.deleteAttribute(name);
  for (const name of Object.keys(trunk.attributes)) if (!['position', 'normal', 'color'].includes(name)) trunk.deleteAttribute(name);
  return mergeGeometries([trunk, g], false)!;
}

const PINES = ['#2F6B47', '#3A7A4E', '#2A5F45', '#447F52'];
const LEAVES = ['#4F8F45', '#5E9E4C', '#6BA35A', '#7FA84E'];

export function TreeLine() {
  const meshes = useMemo(() => {
    const spots = treeLineSpots();
    const mat = new THREE.MeshToonMaterial({ gradientMap: getGradient(), vertexColors: true });
    enhanceToon(mat, false);
    const make = (geo: THREE.BufferGeometry, list: typeof spots, palette: string[]) => {
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const c = new THREE.Color();
      list.forEach((t, i) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.tone * 20);
        m.compose(new THREE.Vector3(t.x, 0, t.z), q, new THREE.Vector3(t.s, t.s * (0.9 + t.tone * 0.3), t.s));
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, c.set(palette[Math.floor(t.tone * palette.length) % palette.length]));
      });
      // static, far away and always around: one draw each, never merged or culled piece by piece
      mesh.frustumCulled = false;
      mesh.userData.dynamic = true;
      mesh.userData.keepVisible = true;
      return mesh;
    };
    return [make(conifer(), spots.filter((t) => t.kind === 0), PINES), make(roundTree(), spots.filter((t) => t.kind === 1), LEAVES)];
  }, []);
  useEffect(() => () => {
    meshes.forEach((m) => m.geometry.dispose());
    (meshes[0].material as THREE.Material).dispose();
  }, [meshes]);
  return (
    <group userData={{ dynamic: true }}>
      {meshes.map((m, i) => <primitive key={i} object={m} />)}
    </group>
  );
}
