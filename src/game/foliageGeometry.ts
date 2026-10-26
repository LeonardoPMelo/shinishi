import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Anime-style foliage clump: a core sphere plus several smaller puffs on its surface,
 * merged into one geometry. Normals are bent toward the clump center so the toon
 * shading reads as one soft cloud while the silhouette stays bumpy.
 * Radius is about 1; scale it like a unit sphere.
 */

const cache = new Map<string, THREE.BufferGeometry>();

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

/**
 * `detail`: 'high' for the trees seen up close (smooth bands), 'low' for instanced bushes and distant
 * hills (about a third of the triangles). Both carry the baked occlusion colors.
 */
/**
 * detail: 'high' ~1.4k triangles (close-up hero trees), 'low' ~1k (the default for trees since Etapa 1),
 * 'tiny' ~430 (small bushes and shrubs: 30–50 cm on screen, where the extra lumps were never visible).
 */
export function getPuffGeometry(variant = 0, detail: 'high' | 'low' | 'tiny' = 'high'): THREE.BufferGeometry {
  const v4 = variant % 4;
  const key = `${v4}-${detail}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const hi = detail === 'high';
  const tiny = detail === 'tiny';

  const rand = seeded(101 + v4 * 37);
  const parts: THREE.BufferGeometry[] = [];
  // enough segments that the toon bands curve smoothly instead of showing facets
  const core = new THREE.SphereGeometry(0.74, hi ? 14 : tiny ? 8 : 11, hi ? 10 : tiny ? 6 : 8);
  parts.push(core);
  const count = tiny ? 6 : 8;
  for (let i = 0; i < count; i++) {
    // spread around, biased toward the top so the clump looks like a cloud
    const a = (i / count) * Math.PI * 2 + rand() * 0.6;
    const y = -0.15 + rand() * 0.75;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const r = 0.36 + rand() * 0.16;
    const p = new THREE.SphereGeometry(r, hi ? 10 : tiny ? 6 : 8, hi ? 7 : tiny ? 4 : 6);
    p.translate(Math.cos(a) * ring * 0.62, y * 0.62, Math.sin(a) * ring * 0.62);
    parts.push(p);
  }
  const top = new THREE.SphereGeometry(0.42, hi ? 10 : tiny ? 6 : 8, hi ? 7 : tiny ? 4 : 6);
  top.translate(0.05, 0.55, -0.04);
  parts.push(top);

  const geo = mergeGeometries(parts.map((g) => g.toNonIndexed()), false)!;
  parts.forEach((g) => g.dispose());

  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const nor = geo.getAttribute('normal') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const radial = new THREE.Vector3();
  // Baked occlusion as vertex color (multiplies the material color): the creases between puffs and
  // the underside go darker, the crown catches the light. It gives the cloud volume without a costly
  // ambient-occlusion pass.
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i);
    radial.set(v.x, v.y + 0.15, v.z).normalize();
    n.lerp(radial, 0.72).normalize();
    nor.setXYZ(i, n.x, n.y, n.z);
    const height = THREE.MathUtils.smoothstep(v.y, -0.75, 0.85); // 0 underneath → 1 on top
    const crease = THREE.MathUtils.smoothstep(v.length(), 0.55, 0.92); // 0 deep between puffs → 1 outside
    const k = (0.6 + 0.4 * height) * (0.72 + 0.28 * crease) * 1.12;
    col[i * 3] = k * 1.02;
    col[i * 3 + 1] = k;
    col[i * 3 + 2] = k * (0.96 + 0.08 * (1 - height)); // shade leans slightly cool, light slightly warm
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  // weld the copies made by toNonIndexed() back into shared, indexed vertices (same look, a fraction of
  // the vertex work; the puffs are the most drawn shape in the game)
  const welded = mergeVertices(geo);
  geo.dispose();
  welded.computeBoundingSphere();
  cache.set(key, welded);
  return welded;
}
