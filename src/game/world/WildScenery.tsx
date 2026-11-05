import { useEffect, useMemo, useState } from 'react';
import { useRapier } from '@react-three/rapier';
import * as THREE from 'three';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Toon, getGradient, enhanceToon } from '../materials';
import { Rock } from './Rock';
import { PineTree, MapleTree, SakuraTree } from './Props';
import { useEffectiveQuality } from '../../store/uiSettings';
import { useGrassTexture, DIRT_GLSL, DIRT_MIX_GLSL, pebbleSwitch, valueNoise } from './Ground';
import { tuftGeometry, tallTuftGeometry, flowerGeometry, swayMaterial, lushness } from './Foliage';
import { getPuffGeometry } from '../foliageGeometry';
import { addDistanceFade, chunkInstanced } from '../vegetation';
import { WILD, WILD_RIVER, WILD_WALLS, CAVE, OUTPOST, CANYON, WILD_TRAILS, WILD_ORIGIN, distToTrail, inWall, keepOpen, scatter, type WildWall } from '../../data/wild';
import { ESPINHO_CAMP, CAMP_PATHS } from '../../data/wild2';

/**
 * As Terras Selvagens' landscape (after Etapa 10), in local coordinates (the region's group places it):
 *  - the ground: one mesh coloured by biome (forest floor, meadow, cherry grove, trampled camps, river sand,
 *    the cave's rock) and rising into hills past the walkable edge, so the region ends in slopes, not a line;
 *  - the mountains all around, far off, with snow on the tops;
 *  - the cliffs: stacked, weathered rock instead of plain boxes (same colliders);
 *  - the undergrowth: ferns, bushes, flowers, mushrooms and grass, instanced (one draw each);
 *  - fallen logs, stumps and the old trees, and a thicker forest along the edges.
 * Every scatter is seeded: the same each visit, and the tests can read it.
 */

const rnd = (seed: number) => {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
};
/** Smooth value noise, cheap and good enough for colours and hills. */
function noise2(x: number, z: number) {
  return (Math.sin(x * 0.21 + Math.sin(z * 0.13) * 2) + Math.sin(z * 0.17 + Math.sin(x * 0.11) * 2.3) + Math.sin((x + z) * 0.37) * 0.5) / 2.5;
}
const inR = (x: number, z: number, r: [number, number, number, number]) => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3];
const smooth = (a: number, b: number, t: number) => {
  const k = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

// ── Ground ─────────────────────────────────────────────────────────────────────

const C = (h: string) => new THREE.Color(h);
const BIOME = {
  meadow: C('#86B55A'),
  // moss green (the darker one read as a flat, muddy floor under the trees)
  forest: C('#6A9A4C'),
  litter: C('#8C7A4E'),
  cherry: C('#8AB46C'),
  campina: C('#97C463'),
  trampled: C('#A49A70'),
  dirt: C('#A3895F'),
  campDirt: C('#8A7458'),
  sand: C('#CDBD92'),
  rock: C('#8A8478'),
  cave: C('#4C4854'),
  ruins: C('#8E9C6C'),
  hill: C('#5F8C49'),
  hillRock: C('#8C877C'),
};

/** The ground's colour at a local point (inside the walkable area). */
export function biomeColor(x: number, z: number, out: THREE.Color) {
  if (inR(x, z, [CAVE.x0, CAVE.z0 - 2, CAVE.x1, CAVE.z1])) return out.copy(BIOME.cave);
  if (x > WILD_RIVER.x0 - 1.4 && x < WILD_RIVER.x1 + 1.4) return out.copy(BIOME.sand);
  if (inR(x, z, [OUTPOST.x0, OUTPOST.z0 - 2, OUTPOST.x1, OUTPOST.z1])) return out.copy(BIOME.dirt);
  if (inR(x, z, [CANYON.x0, CANYON.z0, CANYON.x1, CANYON.z1])) return out.copy(BIOME.rock);
  // (the camp's own detail, paths and ash, is the overlay in WildCamps.tsx: CampGround)
  if (Math.hypot(x - ESPINHO_CAMP.x, z - ESPINHO_CAMP.z) < ESPINHO_CAMP.r) return out.copy(BIOME.campDirt).lerp(BIOME.forest, smooth(ESPINHO_CAMP.r - 3, ESPINHO_CAMP.r, Math.hypot(x - ESPINHO_CAMP.x, z - ESPINHO_CAMP.z)));
  if (inR(x, z, [27, 12, 48, 34])) return out.copy(BIOME.trampled).lerp(BIOME.meadow, 0.45);
  if (inR(x, z, [22, -18, 40, -1])) return out.copy(BIOME.ruins);
  if (inR(x, z, [39, -40, 48, -24.5])) return out.copy(BIOME.rock).lerp(BIOME.meadow, 0.35);
  if (inR(x, z, [-48, 8, -28, 38])) return out.copy(BIOME.cherry);
  // the forest floor: moss with patches of fallen leaves
  if (inR(x, z, [-28, -2, 3, 38]) || inR(x, z, [-26, -38, 2, -22])) return out.copy(BIOME.forest).lerp(BIOME.litter, smooth(0.2, 0.9, noise2(x * 1.9 + 7, z * 1.9 - 3) * 0.5 + 0.5) * 0.55);
  if (inR(x, z, [10, -1, 27, 38])) return out.copy(BIOME.campina);
  return out.copy(BIOME.meadow);
}

// ── The ground's paths and grass, as in the village ────────────────────────────

/** How much of the ground is grass (1) or bare (0: sand along the river, the canyon's and the lookout's rock, the cave). */
export function grassAmount(x: number, z: number) {
  if (inR(x, z, [CAVE.x0, CAVE.z0 - 2, CAVE.x1, CAVE.z1])) return 0;
  if (x > WILD_RIVER.x0 - 1.4 && x < WILD_RIVER.x1 + 1.4 && z > WILD.minZ - 1 && z < WILD.maxZ + 1) return 0;
  if (inR(x, z, [CANYON.x0, CANYON.z0, CANYON.x1, CANYON.z1])) return 0;
  if (inR(x, z, [39, -40, 48, -24.5])) return 0.45;
  return 1;
}

const segDistL = (x: number, z: number, [ax, az]: [number, number], [bx, bz]: [number, number]) => {
  const vx = bx - ax, vz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
  return Math.hypot(x - ax - vx * t, z - az - vz * t);
};

/** The trail and camp-path segments (a, b, and how much narrower the path is), built once. */
const DIRT_SEGS: [number, number, number, number, number][] = [
  ...WILD_TRAILS.flatMap((l) => l.slice(0, -1).map((p, i) => [p[0], p[1], l[i + 1][0], l[i + 1][1], 0] as [number, number, number, number, number])),
  ...CAMP_PATHS.flatMap((l) => l.slice(0, -1).map((p, i) => [p[0], p[1], l[i + 1][0], l[i + 1][1], 0.15] as [number, number, number, number, number])),
];

/** The mask from the distance to the nearest path, plus the camps' trodden middles and the outpost's yard. */
function dirtFrom(d: number, x: number, z: number, edgeNoise: number) {
  const edge = (0.62 + (edgeNoise - 0.5) * 0.35) * 1.2;
  let dirt = 1 - Math.min(1, Math.max(0, (d - edge * 0.7) / (edge * 0.6)));
  const er = Math.hypot(x - ESPINHO_CAMP.x, z - ESPINHO_CAMP.z);
  dirt = Math.max(dirt, 1 - smooth(ESPINHO_CAMP.r - 4 + edgeNoise * 1.5, ESPINHO_CAMP.r - 1 + edgeNoise * 1.5, er));
  const cr = Math.hypot(x - 34, z - 22);
  dirt = Math.max(dirt, (1 - smooth(2.3 + edgeNoise * 1.0, 4.0 + edgeNoise * 0.8, cr)) * 0.95);
  if (inR(x, z, [OUTPOST.x0 + 1, OUTPOST.z0 + 1, OUTPOST.x1 - 1, OUTPOST.z1 - 1])) dirt = Math.max(dirt, 0.55 + 0.3 * edgeNoise);
  return Math.max(0, Math.min(1, dirt));
}

/**
 * The path mask the dirt shader reads (0 grass … 1 trodden earth), as the village's: the trails a little wider
 * than its lanes, the camps' worn middles and the outpost's yard. Noise breaks the edges up.
 */
export function dirtMask(x: number, z: number, edgeNoise: number) {
  let d = 99;
  for (const [ax, az, bx, bz, k] of DIRT_SEGS) d = Math.min(d, segDistL(x, z, [ax, az], [bx, bz]) + k);
  return dirtFrom(d, x, z, edgeNoise);
}

/** The terrain plane's extent (local): the walkable region and the hills around it. */
const TERRAIN_M = 34;
const TERRAIN = { x0: WILD.minX - TERRAIN_M, z0: WILD.minZ - TERRAIN_M, x1: WILD.maxX + TERRAIN_M, z1: WILD.maxZ + TERRAIN_M };

/**
 * The macro texture over the terrain, as the village's (r: brightness patches, g: warm patches, b: path mask, at the
 * village's noise scales), and a: grass amount. A data texture: a canvas would premultiply the alpha and wipe the
 * other channels wherever there is no grass. The path distance is rasterised segment by segment, only near each
 * segment, so building it takes a fraction of a second instead of seconds.
 */
export function buildWildMacro() {
  const PPU = 5;
  const W = Math.round((TERRAIN.x1 - TERRAIN.x0) * PPU);
  const H = Math.round((TERRAIN.z1 - TERRAIN.z0) * PPU);
  const dist = new Float32Array(W * H).fill(99);
  const R = 2.4;
  for (const [ax, az, bx, bz, k] of DIRT_SEGS) {
    const px0 = Math.max(0, Math.floor((Math.min(ax, bx) - R - TERRAIN.x0) * PPU));
    const px1 = Math.min(W - 1, Math.ceil((Math.max(ax, bx) + R - TERRAIN.x0) * PPU));
    const py0 = Math.max(0, Math.floor((Math.min(az, bz) - R - TERRAIN.z0) * PPU));
    const py1 = Math.min(H - 1, Math.ceil((Math.max(az, bz) + R - TERRAIN.z0) * PPU));
    const vx = bx - ax, vz = bz - az, ll = vx * vx + vz * vz || 1;
    for (let py = py0; py <= py1; py++) {
      const z = TERRAIN.z0 + (py + 0.5) / PPU;
      for (let px = px0; px <= px1; px++) {
        const x = TERRAIN.x0 + (px + 0.5) / PPU;
        const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / ll));
        const d = Math.hypot(x - ax - vx * t, z - az - vz * t) + k;
        const i = py * W + px;
        if (d < dist[i]) dist[i] = d;
      }
    }
  }
  const n1 = valueNoise(3);
  const n2 = valueNoise(9);
  const data = new Uint8Array(W * H * 4);
  for (let py = 0; py < H; py++) {
    const z = TERRAIN.z0 + (py + 0.5) / PPU;
    for (let px = 0; px < W; px++) {
      const x = TERRAIN.x0 + (px + 0.5) / PPU;
      const i = py * W + px;
      const k = i * 4;
      const inside = outside(x, z) <= 0;
      data[k] = Math.round((n1(x * 0.12, z * 0.12) * 0.7 + n1(x * 0.4 + 17, z * 0.4) * 0.3) * 255);
      data[k + 1] = Math.round(n2(x * 0.08, z * 0.08) * 255);
      data[k + 2] = inside ? Math.round(dirtFrom(dist[i], x, z, n2(x * 1.3, z * 1.3)) * 255) : 0;
      data[k + 3] = Math.round((inside ? grassAmount(x, z) : 1) * 255);
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

function useWildMacro() {
  return useMemo(buildWildMacro, []);
}

/**
 * The village's ground shader on the wild terrain: the grass texture at the village's scale under a light tint of
 * each biome's colour (bare ground, a = 0, takes the biome colour itself), the same brightness and warm patches,
 * and the same dirt on the paths (DIRT_MIX_GLSL: ragged edges, damp border, tones, grit, pebbles).
 */
function wildGroundMaterial(grass: THREE.Texture, macro: THREE.Texture) {
  const m = new THREE.MeshToonMaterial({ map: grass, vertexColors: true, gradientMap: getGradient(), color: '#FFFFFF' });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uMacro = { value: macro };
    shader.uniforms.uPebbles = pebbleSwitch;
    shader.uniforms.uRect = { value: new THREE.Vector4(TERRAIN.x0 + WILD_ORIGIN[0], TERRAIN.z0 + WILD_ORIGIN[1], TERRAIN.x1 - TERRAIN.x0, TERRAIN.z1 - TERRAIN.z0) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWorldXZ;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D uMacro;
uniform float uPebbles;
uniform vec4 uRect;
varying vec2 vWorldXZ;
${DIRT_GLSL}`)
      .replace(
        '#include <color_fragment>',
        `vec2 w = vWorldXZ;
         vec4 mac4 = texture2D(uMacro, (w - uRect.xy) / uRect.zw);
         vec3 mac = mac4.rgb;
         #if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
           // grass: the texture, lightly tinted by the biome; bare ground: the biome's own colour
           vec3 grassCol = diffuseColor.rgb * mix(vec3(1.0), vColor.rgb * 1.3, 0.35);
           diffuseColor.rgb = mix(vColor.rgb, grassCol, mac4.a);
         #endif
         diffuseColor.rgb *= 0.86 + mac.r * 0.28;
         diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 1.05, 0.78), smoothstep(0.55, 0.8, mac.g) * 0.6);
         ${DIRT_MIX_GLSL}`
      );
  };
  m.customProgramCacheKey = () => 'wild-ground-1';
  return m;
}

/**
 * The village's grass in the wild lands: the same tufts, tall grass at the verges and in the lush patches, and the
 * same flowers, swaying in the same wind, fading out with distance (vegetation.ts). Not on paths, walls, the river,
 * the cave, the camps' middles or bare rock.
 */
export function WildGrass() {
  const quality = useEffectiveQuality();
  const density = quality === 'alta' ? 1 : quality === 'media' ? 0.6 : 0.3;
  const { world, rapier } = useRapier();
  // as in the village: wait for every fixed collider, then keep the grass out of whatever stands on the ground
  // (tents, crates, tables, trunks, rocks), probing straight down from above
  const [blocked, setBlocked] = useState<((x: number, z: number) => boolean) | null>(null);
  useEffect(() => {
    const id = setTimeout(() => {
      const ray = new rapier.Ray({ x: 0, y: 8, z: 0 }, { x: 0, y: -1, z: 0 });
      const flags = rapier.QueryFilterFlags.ONLY_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS;
      setBlocked(() => (x: number, z: number) => {
        ray.origin = { x: x + WILD_ORIGIN[0], y: 8, z: z + WILD_ORIGIN[1] };
        const hit = world.castRay(ray, 8, true, flags);
        return !!hit && hit.timeOfImpact < 7.85;
      });
    }, 600);
    return () => clearTimeout(id);
  }, [world, rapier]);
  const meshes = useMemo(() => {
    if (!blocked) return null;
    const r = rnd(4243);
    const short: { x: number; z: number; r: number; lush: number }[] = [];
    const tall: { x: number; z: number; r: number }[] = [];
    const flowers: { x: number; z: number; r: number }[] = [];
    // about the village's density (≈4 samples per m² before the patches thin them), scaled by the quality setting
    const N = Math.round(30000 * density);
    for (let i = 0; i < N; i++) {
      const x = WILD.minX + r() * (WILD.maxX - WILD.minX);
      const z = WILD.minZ + r() * (WILD.maxZ - WILD.minZ);
      const k = r();
      if (grassAmount(x, z) < 0.9 || grassBare(x, z)) continue;
      if (dirtMask(x, z, 0.5) > 0.3 || blocked(x, z)) continue;
      const lush = lushness(x, z);
      if (r() > 0.32 + 0.68 * THREE.MathUtils.smoothstep(lush, 0.25, 0.65)) continue;
      const pd = distToTrail(x, z);
      if ((pd > 1.15 && pd < 1.9 && k < 0.45) || lush > 0.7) tall.push({ x, z, r: k });
      else short.push({ x, z, r: k, lush });
      if (i % 11 === 0) flowers.push({ x, z, r: k });
    }
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const c = new THREE.Color();
    const grass = new THREE.InstancedMesh(tuftGeometry(), swayMaterial({ side: THREE.DoubleSide, strength: 0.45 }), short.length);
    short.forEach((p, i) => {
      q.setFromAxisAngle(up, p.r * Math.PI * 2);
      const kk = (0.8 + ((p.r * 7.3) % 1) * 0.7) * (0.78 + 0.32 * p.lush);
      s.set(kk, kk * (0.85 + ((p.r * 13.1) % 1) * 0.5), kk);
      grass.setMatrixAt(i, m.compose(new THREE.Vector3(p.x, 0, p.z), q, s));
      const patch = 1 - THREE.MathUtils.smoothstep(p.lush, 0.2, 0.7);
      const j = ((p.r * 31.7) % 1) - 0.5;
      grass.setColorAt(i, c.setRGB(0.92 + 0.14 * patch + j * 0.08, 0.95 + 0.06 * patch + j * 0.06, 0.88 - 0.1 * patch + j * 0.05));
    });
    const tallMesh = new THREE.InstancedMesh(tallTuftGeometry(), swayMaterial({ side: THREE.DoubleSide, strength: 0.7 }), tall.length);
    tall.forEach((p, i) => {
      q.setFromAxisAngle(up, p.r * Math.PI * 2);
      const kk = 0.85 + ((p.r * 5.9) % 1) * 0.5;
      s.set(kk, kk * (0.8 + ((p.r * 11.3) % 1) * 0.6), kk);
      tallMesh.setMatrixAt(i, m.compose(new THREE.Vector3(p.x, 0, p.z), q, s));
      const j = ((p.r * 29.3) % 1) - 0.5;
      tallMesh.setColorAt(i, c.setRGB(0.95 + j * 0.08, 0.97 + j * 0.05, 0.86 + j * 0.06));
    });
    const FLOWERS = ['#FFFFFF', '#FFD1E3', '#F7A8C8', '#FFE58A', '#BFD8FF', '#D9B8FF', '#FF9F80'];
    const flowerMesh = new THREE.InstancedMesh(flowerGeometry(), swayMaterial({ strength: 0.25 }), flowers.length);
    flowers.forEach((p, i) => {
      q.setFromEuler(new THREE.Euler((p.r - 0.5) * 0.4, p.r * 20, (((p.r * 3) % 1) - 0.5) * 0.4));
      const kk = 0.9 + ((p.r * 5.7) % 1) * 0.7;
      flowerMesh.setMatrixAt(i, m.compose(new THREE.Vector3(p.x + 0.05, 0.16 + ((p.r * 9.1) % 1) * 0.1, p.z), q, new THREE.Vector3(kk, kk, kk)));
      const patch = Math.floor((Math.sin(p.x * 0.35) + Math.cos(p.z * 0.3) + 2) * 1.6) % FLOWERS.length;
      flowerMesh.setColorAt(i, c.set(FLOWERS[(patch + (p.r > 0.8 ? 1 : 0)) % FLOWERS.length]));
    });
    for (const mesh of [grass, tallMesh, flowerMesh]) {
      mesh.receiveShadow = true;
      mesh.userData.dynamic = true;
    }
    // big cells: three draw calls per cell, and the distance cull still drops the far ones
    return { groups: [chunkInstanced(grass, 32), chunkInstanced(tallMesh, 32), chunkInstanced(flowerMesh, 48)], raw: [grass, tallMesh, flowerMesh] };
  }, [density, blocked]);
  useEffect(() => () => {
    for (const m of meshes?.raw ?? []) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
  }, [meshes]);
  return (
    <group userData={{ dynamic: true }}>
      {meshes?.groups.map((g, i) => <primitive key={i} object={g} />)}
    </group>
  );
}

/** How far a local point is outside the walkable area (0 inside). */
const outside = (x: number, z: number) => Math.hypot(Math.max(WILD.minX - x, 0, x - WILD.maxX), Math.max(WILD.minZ - z, 0, z - WILD.maxZ));

export function WildTerrain() {
  const grass = useGrassTexture();
  const macro = useWildMacro();
  const { geometry, material } = useMemo(() => {
    const M = 34;
    const x0 = WILD.minX - M, x1 = WILD.maxX + M, z0 = WILD.minZ - M, z1 = WILD.maxZ + M;
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 130, 112);
    g.rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const d = outside(x, z);
      // the walkable floor stays level (the physics floor is flat); past the edge, hills rise
      const h = d <= 0 ? 0 : smooth(0.5, 22, d) * (5 + 4 * noise2(x * 1.3, z * 1.3)) + smooth(14, 34, d) * 6;
      pos.setY(i, h - (d > 0 ? 0 : 0.0));
      if (d <= 0) biomeColor(x, z, c);
      else c.copy(BIOME.hill).lerp(BIOME.hillRock, smooth(4, 12, h) * 0.7);
      // a soft mottle so no patch is a flat colour
      const m = 0.9 + 0.2 * (noise2(x * 2.7 + 31, z * 2.7 - 17) * 0.5 + 0.5);
      colors[i * 3] = c.r * m;
      colors[i * 3 + 1] = c.g * m;
      colors[i * 3 + 2] = c.b * m;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    const t = grass.clone();
    t.needsUpdate = true;
    // the village's grass scale (its tile is ~8 × 6.6 m; here it was 4 m and read as a different, busier lawn)
    t.repeat.set((x1 - x0) / 8, (z1 - z0) / 6.6);
    return { geometry: g, material: wildGroundMaterial(t, macro) };
  }, [grass, macro]);
  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);
  return <mesh geometry={geometry} material={material} receiveShadow userData={{ dynamic: true }} />;
}

/** The mountains around the region: far off, green below, grey rock above, snow on the highest. */
export function Mountains() {
  const geometry = useMemo(() => {
    const r = rnd(5151);
    const parts: THREE.BufferGeometry[] = [];
    const green = C('#5E8A4E');
    const rock = C('#8C8A92');
    const snow = C('#F4F6FA');
    const c = new THREE.Color();
    const n = 15;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + r() * 0.25;
      const dist = 92 + r() * 30;
      const cx = Math.cos(a) * dist;
      const cz = -1 + Math.sin(a) * dist * 0.85;
      const radius = 22 + r() * 18;
      const height = 26 + r() * 26;
      const g = new THREE.IcosahedronGeometry(1, 4);
      const pos = g.attributes.position as THREE.BufferAttribute;
      const colors = new Float32Array(pos.count * 3);
      const ox = r() * 100;
      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i);
        let y = pos.getY(i);
        let z = pos.getZ(i);
        if (y < 0) y *= 0.05; // flat base, sunk under the hills
        const bump = 1 + 0.18 * noise2(x * 9 + ox, z * 9 - ox) + 0.08 * Math.sin(y * 14 + ox);
        x *= radius * bump;
        z *= radius * bump;
        // a peak: narrower toward the top
        const top = Math.max(0, y);
        y = top ** 1.4 * height * bump;
        const t = y / height;
        if (t > 0.72 && height > 38) c.copy(snow);
        else c.copy(green).lerp(rock, smooth(0.2, 0.6, t));
        pos.setXYZ(i, x + cx, y - 2, z + cz);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      g.deleteAttribute('uv');
      g.computeVertexNormals();
      parts.push(g);
    }
    return mergeGeometries(parts)!;
  }, []);
  const material = useMemo(() => new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: getGradient() }), []);
  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);
  return <mesh geometry={geometry} material={material} userData={{ dynamic: true }} />;
}

// ── Cliffs ─────────────────────────────────────────────────────────────────────

/**
 * A cliff drawn as weathered rock: a dark core (the collider's box, a little inside) and big boulders stacked
 * along it in three tiers, mossy on top. The collider is unchanged (it wraps the top tier, so the camera never
 * ends up behind a rock with nothing around it).
 */
export function CliffRock({ wl }: { wl: WildWall }) {
  const w0 = wl.x1 - wl.x0;
  const d0 = wl.z1 - wl.z0;
  const along = w0 >= d0;
  const len = along ? w0 : d0;
  const thick = along ? d0 : w0;
  const cx = (wl.x0 + wl.x1) / 2;
  const cz = (wl.z0 + wl.z1) / 2;
  const rocks = useMemo(() => {
    const r = rnd(Math.round(wl.x0 * 31 + wl.z0 * 17 + 991));
    const n = Math.max(1, Math.round(len / 2.4));
    const seg = len / n;
    const out: { p: [number, number, number]; s: [number, number, number]; rot: number; v: number; moss: boolean }[] = [];
    for (let i = 0; i < n; i++) {
      const u = -len / 2 + (i + 0.5) * seg;
      // the rocks are wider than the core in every direction and a mossy cap closes the top: the core's flat
      // faces showed between them, a big brown slab from the camp and from above
      const tiers = [
        { y: wl.h * 0.26, sx: seg * 0.82, sy: wl.h * 0.36, sz: thick * 0.95 },
        { y: wl.h * 0.6, sx: seg * 0.74, sy: wl.h * 0.3, sz: thick * 0.85 },
        { y: wl.h * 0.86, sx: seg * 0.66, sy: wl.h * 0.2, sz: thick * 0.75 },
        { y: wl.h * 0.98, sx: seg * 0.6, sy: wl.h * 0.1, sz: thick * 0.62 },
      ];
      // two staggered rocks a tier (the second half a segment along), so no gap shows the core
      tiers.flatMap((t) => [{ ...t, off: 0 }, { ...t, off: 0.5, sx: t.sx * 0.8, sz: t.sz * 0.92, y: t.y + wl.h * 0.06 }]).forEach((t, k) => {
        const jitter = (r() - 0.5) * seg * 0.3 + (t.off && i < n - 1 ? seg * t.off : t.off ? -seg * t.off : 0);
        const at: [number, number] = along ? [cx + u + jitter, cz + (r() - 0.5) * thick * 0.15] : [cx + (r() - 0.5) * thick * 0.15, cz + u + jitter];
        const sx = along ? t.sx : t.sz;
        const sz = along ? t.sz : t.sx;
        out.push({ p: [at[0], t.y, at[1]], s: [sx * (0.9 + r() * 0.25), t.sy * (0.85 + r() * 0.3), sz * (0.9 + r() * 0.2)], rot: r() * 0.6 - 0.3, v: Math.floor(r() * 6), moss: k >= 4 });
      });
    }
    return out;
  }, [wl, len, thick, cx, cz]);
  const ch = wl.h + 1.4;
  return (
    <RigidBody type="fixed" colliders={false} userData={{ surface: 'stone' }}>
      <CuboidCollider args={[w0 / 2, ch / 2, d0 / 2]} position={[cx, ch / 2, cz]} />
      {/* the core behind the boulders: one long chiseled rock with the natural rock surface, thin across the
          wall so the boulders cover it (a box read as a flat slab, and the stone texture as a brick wall) */}
      <Rock variant={Math.abs(Math.round(wl.x0 + wl.z0)) % 6} kind="boulder" position={[cx, wl.h * 0.42, cz]}
        scale={[w0 * (along ? 0.46 : 0.26), wl.h * 0.5, d0 * (along ? 0.26 : 0.46)]} color="#857E72" receiveShadow contact={false} />
      {rocks.map((k, i) => (
        <Rock key={i} variant={k.v} kind={k.moss ? 'flat' : 'boulder'} moss={k.moss} position={k.p} rotation={[0, k.rot, 0]} scale={k.s} color={i % 3 === 0 ? '#7E776C' : i % 3 === 1 ? '#8E877C' : '#857E72'} castShadow receiveShadow contact={false} />
      ))}
    </RigidBody>
  );
}

// ── Undergrowth ───────────────────────────────────────────────────────────────

/** Where nothing grows: trails, walls, the river, inside the cave, the camps' busy middles. */
/** Where the village-style grass may not grow: as bare(), but the camps' yards are left to the dirt mask and the colliders. */
function grassBare(x: number, z: number) {
  if (distToTrail(x, z) < 1.05 || inWall(x, z, 0.4)) return true;
  if (x > WILD_RIVER.x0 - 0.6 && x < WILD_RIVER.x1 + 0.6) return true;
  if (inR(x, z, [CAVE.x0, CAVE.z0, CAVE.x1, CAVE.z1]) || inR(x, z, [OUTPOST.x0, OUTPOST.z0, OUTPOST.x1, OUTPOST.z1])) return true;
  return x < WILD.minX + 0.4 || x > WILD.maxX - 0.4 || z < WILD.minZ + 0.4 || z > WILD.maxZ - 0.4;
}

function bare(x: number, z: number, trailPad = 1.3) {
  if (distToTrail(x, z) < trailPad) return true;
  if (inWall(x, z, 0.4)) return true;
  if (x > WILD_RIVER.x0 - 0.6 && x < WILD_RIVER.x1 + 0.6) return true;
  if (inR(x, z, [CAVE.x0, CAVE.z0, CAVE.x1, CAVE.z1])) return true;
  if (inR(x, z, [29, 14, 46, 32])) return true; // the expedition camp's middle
  if (Math.hypot(x - ESPINHO_CAMP.x, z - ESPINHO_CAMP.z) < ESPINHO_CAMP.r - 2) return true;
  if (inR(x, z, [OUTPOST.x0, OUTPOST.z0, OUTPOST.x1, OUTPOST.z1])) return true;
  return x < WILD.minX + 0.4 || x > WILD.maxX - 0.4 || z < WILD.minZ + 0.4 || z > WILD.maxZ - 0.4;
}

function scatterIn(seed: number, n: number, rects: [number, number, number, number][], ok: (x: number, z: number) => boolean) {
  const r = rnd(seed);
  const out: { x: number; z: number; s: number; rot: number; tone: number }[] = [];
  for (let tries = 0; out.length < n && tries < n * 30; tries++) {
    const R = rects[Math.floor(r() * rects.length)];
    const x = R[0] + r() * (R[2] - R[0]);
    const z = R[1] + r() * (R[3] - R[1]);
    if (!ok(x, z)) continue;
    out.push({ x, z, s: 0.7 + r() * 0.6, rot: r() * Math.PI * 2, tone: r() });
  }
  return out;
}

const FOREST: [number, number, number, number][] = [[-28, -2, 3, 38], [-26, -38, 2, -22], [-48, -24, -41, 8]];
const CHERRY: [number, number, number, number][] = [[-48, 8, -28, 38]];
const MEADOWS: [number, number, number, number][] = [[10, -1, 27, 38], [11, -20, 22, -1], [40, -2, 48, 12]];

/**
 * One instanced mesh of a small plant: its shape, its colours, where it grows. `fade`: split into cells that
 * shrink away and stop drawing past ~30–40 m (vegetation.ts); as one mesh over the whole region, every fern
 * and flower was drawn on every frame, behind the camera too.
 */
function Instanced({ geometry, items, colors, y = 0, scale = 1, wind = false, fade = false }: {
  geometry: THREE.BufferGeometry; items: { x: number; z: number; s: number; rot: number; tone: number }[]; colors: string[]; y?: number; scale?: number; wind?: boolean; fade?: boolean;
}) {
  const mesh = useMemo(() => {
    const mat = new THREE.MeshToonMaterial({ gradientMap: getGradient() });
    enhanceToon(mat, wind);
    if (fade) addDistanceFade(mat);
    const m = new THREE.InstancedMesh(geometry, mat, items.length);
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    items.forEach((it, i) => {
      o.position.set(it.x, y, it.z);
      o.rotation.set(0, it.rot, 0);
      o.scale.setScalar(it.s * scale);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c.set(colors[Math.floor(it.tone * colors.length) % colors.length]));
    });
    m.instanceMatrix.needsUpdate = true;
    m.castShadow = false;
    m.receiveShadow = true;
    m.userData.dynamic = true;
    return m;
  }, [geometry, items, colors, y, scale, wind, fade]);
  const object = useMemo(() => (fade ? chunkInstanced(mesh, 24) : mesh), [mesh, fade]);
  useEffect(() => () => {
    (mesh.material as THREE.Material).dispose();
  }, [mesh]);
  return <primitive object={object} />;
}

/** A fern: a ring of long, drooping fronds. */
function fernGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 7; k++) {
    const g = new THREE.SphereGeometry(0.42, 6, 3);
    g.scale(1, 0.1, 0.28);
    g.translate(0.36, 0.22, 0);
    g.rotateZ(-0.45 - (k % 2) * 0.2);
    g.rotateY((k / 7) * Math.PI * 2);
    parts.push(g);
  }
  const m = mergeGeometries(parts)!;
  m.deleteAttribute('uv');
  return m;
}
function bushGeometry() {
  const a = getPuffGeometry(1, 'low').clone();
  a.scale(0.55, 0.42, 0.55);
  a.translate(0, 0.3, 0);
  return a;
}
function mushroomGeometry() {
  const stem = new THREE.CylinderGeometry(0.04, 0.05, 0.16, 6);
  stem.translate(0, 0.08, 0);
  const cap = new THREE.SphereGeometry(0.11, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  cap.scale(1, 0.7, 1);
  cap.translate(0, 0.15, 0);
  return mergeGeometries([stem.toNonIndexed(), cap.toNonIndexed()].map((x) => {
    x.deleteAttribute('uv');
    return x;
  }))!;
}

export function Undergrowth() {
  const shapes = useMemo(() => ({ fern: fernGeometry(), bush: bushGeometry(), mushroom: mushroomGeometry() }), []);
  const sets = useMemo(() => {
    const free = (pad: number) => (x: number, z: number) => !bare(x, z, pad);
    return {
      ferns: scatterIn(311, 420, [...FOREST, ...CHERRY], free(1.2)),
      bushes: scatterIn(313, 140, [...FOREST, ...CHERRY, ...MEADOWS], free(1.6)),
      mushrooms: scatterIn(331, 90, FOREST, free(1.0)),
    };
  }, []);
  useEffect(() => () => Object.values(shapes).forEach((g) => g.dispose()), [shapes]);
  return (
    <group>
      <Instanced geometry={shapes.fern} items={sets.ferns} colors={['#4E8A3E', '#5E9A46', '#3F7A36']} scale={1.1} wind fade />
      <Instanced geometry={shapes.bush} items={sets.bushes} colors={['#4F7F3C', '#5E8F48', '#6A9A4E', '#4A7238']} scale={1.3} wind />
      <Instanced geometry={shapes.mushroom} items={sets.mushrooms} colors={['#D9483A', '#E8C27A', '#B07A4A', '#F2E6D8']} fade />
      {/* grass, tall grass and flowers as in the village */}
      <WildGrass />
    </group>
  );
}

// ── Logs, stumps, old trees, the forest along the edges ───────────────────────

/** Fallen logs (solid: a hop to cross) and stumps, in the forests. */
export const WILD_LOGS: { x: number; z: number; len: number; rot: number }[] = scatter(4401, 9, [-27, -1, 1, 37], 6, (x, z) => keepOpen(x, z) || distToTrail(x, z) < 3.2)
  .map(([x, z], i) => ({ x, z, len: 2.4 + (i % 3) * 0.6, rot: (i * 1.7) % Math.PI }))
  .concat(scatter(4403, 4, [-47, 9, -29, 37], 6, (x, z) => keepOpen(x, z) || distToTrail(x, z) < 3.2).map(([x, z], i) => ({ x, z, len: 2.2 + i * 0.3, rot: i * 0.9 })));
export const WILD_STUMPS: [number, number][] = scatter(4407, 14, [-27, -1, 1, 37], 3, (x, z) => keepOpen(x, z) || distToTrail(x, z) < 2.2);
/** Old trees: each one a landmark (the hollow giant in the forest, the twin maples by the meadow). */
export const OLD_TREES: { x: number; z: number; kind: 'maple' | 'cherry' | 'pine'; s: number }[] = [
  { x: -18.2, z: 15.6, kind: 'maple', s: 2.3 },
  { x: 19.6, z: 36.0, kind: 'maple', s: 1.9 },
  { x: -44.6, z: 15.6, kind: 'cherry', s: 2.1 },
  { x: -1.6, z: -27.4, kind: 'pine', s: 2.0 },
];
/** The thick forest along the region's edges (west and south), where the land starts to climb. */
export const EDGE_TREES: [number, number][] = (() => {
  const out: [number, number][] = [];
  const r = rnd(5353);
  for (let z = -22; z <= WILD.maxZ - 1; z += 2.6) {
    const x = WILD.minX + 0.9 + r() * 1.2;
    if (!bare(x, z, 2.4) && !inWall(x, z, 1.4)) out.push([x, z]);
  }
  for (let x = WILD.minX + 2; x <= WILD.maxX - 6; x += 2.8) {
    const z = WILD.maxZ - 0.9 - r() * 1.2;
    if (!bare(x, z, 2.4) && Math.abs(x - 45.6) > 4) out.push([x, z]);
  }
  return out;
})();

export function WoodsDetail() {
  return (
    <group>
      {WILD_LOGS.map((l, i) => (
        <RigidBody key={`l${i}`} type="fixed" colliders={false} position={[l.x, 0, l.z]} rotation={[0, l.rot, 0]} userData={{ surface: 'wood' }}>
          <CuboidCollider args={[l.len / 2, 0.24, 0.26]} position={[0, 0.24, 0]} />
          <mesh position={[0, 0.26, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
            <cylinderGeometry args={[0.26, 0.3, l.len, 9]} />
            <Toon color="#7C6E5E" tex="bark" />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[(s * l.len) / 2, 0.26, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.24, 0.24, 0.02, 9]} />
              <Toon color="#C9A97A" />
            </mesh>
          ))}
          <mesh position={[l.len * 0.15, 0.48, 0.05]} scale={[0.5, 0.18, 0.4]}>
            <sphereGeometry args={[0.4, 7, 5]} />
            <Toon color="#5E8A44" />
          </mesh>
        </RigidBody>
      ))}
      {WILD_STUMPS.map(([x, z], i) => (
        <RigidBody key={`s${i}`} type="fixed" colliders={false} position={[x, 0, z]} userData={{ surface: 'wood' }}>
          <CylinderCollider args={[0.22, 0.34]} position={[0, 0.22, 0]} />
          <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.3, 0.38, 0.44, 9]} />
            <Toon color="#7A5A44" tex="bark" />
          </mesh>
          <mesh position={[0, 0.445, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.29, 12]} />
            <Toon color="#C9A97A" />
          </mesh>
        </RigidBody>
      ))}
      {/* (the old giant pine is drawn with the instanced forest: WildForest.tsx) */}
      {OLD_TREES.filter((t) => t.kind !== 'pine').map((t, i) =>
        t.kind === 'maple' ? <MapleTree key={`o${i}`} position={[t.x, 0, t.z]} scale={t.s} seed={i + 40} green={i % 2 === 0} />
          : t.kind === 'cherry' ? <SakuraTree key={`o${i}`} position={[t.x, 0, t.z]} scale={t.s} seed={i + 40} />
            : <PineTree key={`o${i}`} position={[t.x, 0, t.z]} scale={t.s} />,
      )}
    </group>
  );
}

/** Reeds and pebbles along the river banks, and white water where rocks break the current. */
export function RiverBanks() {
  const reeds = useMemo(() => {
    const r = rnd(6161);
    const out: { x: number; z: number; s: number; rot: number; tone: number }[] = [];
    for (let z = WILD_RIVER.z0 + 2; z < WILD_RIVER.z1 - 1; z += 0.9) {
      for (const side of [-1, 1]) {
        if (r() < 0.45) continue;
        const x = side < 0 ? WILD_RIVER.x0 - 0.3 - r() * 0.8 : WILD_RIVER.x1 + 0.3 + r() * 0.8;
        if (distToTrail(x, z) < 1.4) continue;
        out.push({ x, z, s: 0.8 + r() * 0.6, rot: r() * 6, tone: r() });
      }
    }
    return out;
  }, []);
  const reed = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 4; k++) {
      const g = new THREE.CylinderGeometry(0.015, 0.02, 0.9, 4);
      g.translate(0, 0.45, 0);
      g.rotateZ((k - 1.5) * 0.12);
      g.rotateY(k * 1.6);
      const tip = new THREE.CylinderGeometry(0.035, 0.035, 0.16, 5);
      tip.translate(0, 0.85, 0);
      tip.rotateZ((k - 1.5) * 0.12);
      tip.rotateY(k * 1.6);
      parts.push(g, tip);
    }
    return mergeGeometries(parts.map((x) => {
      x.deleteAttribute('uv');
      return x;
    }))!;
  }, []);
  const midRocks = useMemo(() => {
    const r = rnd(6163);
    return Array.from({ length: 9 }, () => ({ x: WILD_RIVER.x0 + 0.8 + r() * (WILD_RIVER.x1 - WILD_RIVER.x0 - 1.6), z: -30 + r() * 64 }))
      .filter((p) => Math.abs(p.z - 24) > 2 && Math.abs(p.z + 6) > 2);
  }, []);
  return (
    <group>
      <Instanced geometry={reed} items={reeds} colors={['#7FA24E', '#8FB25A', '#6E9244']} wind fade />
      {midRocks.map((p, i) => (
        <group key={i}>
          <Rock variant={i % 5} kind="flat" position={[p.x, 0.05, p.z]} scale={[0.55, 0.16, 0.5]} color="#7E776C" contact={false} />
          {/* a thin ring of white water around it, trailing downstream */}
          <mesh position={[p.x, 0.04, p.z + 0.25]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1.5, 1]} userData={{ dynamic: true }}>
            <ringGeometry args={[0.46, 0.6, 16]} />
            <meshBasicMaterial color="#F2FAFF" transparent opacity={0.2} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** For the tests: every wall a cliff is drawn as rock. */
export const CLIFFS = WILD_WALLS.filter((wl) => wl.kind === 'cliff');
