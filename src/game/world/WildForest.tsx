import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { RigidBody, CylinderCollider } from '@react-three/rapier';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getGradient, enhanceToon } from '../materials';
import { WILD, WILD_PINES, distToTrail, inWall, keepOpen, scatter } from '../../data/wild';
import { EDGE_TREES, OLD_TREES } from './WildScenery';

/**
 * The wild lands' forest, redrawn (after Etapa 10: "still ugly", said the player, and rightly: one stacked-plate
 * pine everywhere, crowns at head height hiding the cat, a dark flat floor). In local coordinates:
 *  - three kinds of tree, each instanced (one draw for all the trunks of a kind, one for the crowns): tall
 *    layered cedars, round oaks, slender white birches. Crowns start high, so the camera sees under them, and
 *    they turn see-through near the camera→cat line (the toon fade, here with the instance's position);
 *  - patches of sunlight on the forest floor and a few soft shafts of light between the trees.
 * Trunks are solid (one body, a collider per tree). Placement is seeded and keeps off trails and clearings.
 */

type Kind = 'cedro' | 'carvalho' | 'betula';
const rnd = (seed: number) => {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
};

function paint(g: THREE.BufferGeometry, fn: (y: number, x: number, z: number) => THREE.Color) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const c = fn(pos.getY(i), pos.getX(i), pos.getZ(i));
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const strip = (g: THREE.BufferGeometry) => {
  const n = g.index ? g.toNonIndexed() : g;
  n.deleteAttribute('uv');
  return n;
};

/** Trunk and crown of each kind (1 m-ish scale; instances scale them). */
function shapes() {
  const c = new THREE.Color();
  const lerp = (a: string, b: string, t: number) => c.set(a).lerp(new THREE.Color(b), Math.min(1, Math.max(0, t)));
  // cedar: a straight trunk and four stacked tiers, dark below, fresh green at the tips
  const cedarTrunk = paint(strip(new THREE.CylinderGeometry(0.16, 0.3, 5.0, 8).translate(0, 2.5, 0)), (y) => lerp('#5A4E44', '#7E705E', y / 5));
  const tiers: THREE.BufferGeometry[] = [];
  [[2.2, 1.7, 1.6], [3.3, 1.35, 1.4], [4.3, 1.0, 1.2], [5.2, 0.6, 1.0]].forEach(([y, r, h], i) => {
    const g = new THREE.ConeGeometry(r, h, 9, 2);
    g.rotateY(i * 0.7);
    g.translate(0, y, 0);
    tiers.push(strip(g));
  });
  const cedarCrown = paint(mergeGeometries(tiers)!, (y, x, z) => lerp('#2F5E3A', '#5E9A52', (y - 1.6) / 4.4 + 0.15 * Math.sin(x * 9 + z * 7)));
  // oak: a stout trunk forking into a round crown of puffs, warm green
  const oakTrunk = paint(strip(mergeGeometries([
    strip(new THREE.CylinderGeometry(0.22, 0.34, 3.0, 8).translate(0, 1.5, 0)),
    strip(new THREE.CylinderGeometry(0.1, 0.16, 1.4, 6).rotateZ(0.6).translate(0.38, 3.1, 0)),
    strip(new THREE.CylinderGeometry(0.1, 0.16, 1.4, 6).rotateZ(-0.6).translate(-0.38, 3.1, 0)),
  ])!), () => c.set('#6E6052'));
  const puffs: THREE.BufferGeometry[] = [];
  [[0, 4.2, 0, 1.5], [0.9, 3.7, 0.3, 1.1], [-0.9, 3.8, -0.2, 1.15], [0.2, 3.6, 0.95, 1.0], [-0.2, 3.7, -0.95, 1.0], [0.1, 4.9, 0.1, 0.9]].forEach(([x, y, z, r]) => {
    puffs.push(strip(new THREE.IcosahedronGeometry(r, 1).translate(x, y, z)));
  });
  const oakCrown = paint(mergeGeometries(puffs)!, (y, x, z) => lerp('#3E7A3A', '#7FBA56', (y - 2.8) / 2.8 + 0.12 * Math.sin(x * 5 + z * 4)));
  // birch: slim white trunk with dark marks, a light, airy crown
  const birchTrunk = paint(strip(new THREE.CylinderGeometry(0.1, 0.15, 4.4, 7, 8).translate(0, 2.2, 0)), (y, x) => (Math.sin(y * 9 + x * 20) > 0.75 ? c.set('#3A3632') : c.set('#EDE8DC')));
  const leaves: THREE.BufferGeometry[] = [];
  [[0, 4.4, 0, 0.9], [0.5, 3.8, 0.2, 0.7], [-0.45, 3.9, -0.15, 0.7], [0.1, 3.4, -0.5, 0.6], [-0.1, 3.5, 0.5, 0.6]].forEach(([x, y, z, r]) => {
    leaves.push(strip(new THREE.IcosahedronGeometry(r, 1).translate(x, y, z)));
  });
  const birchCrown = paint(mergeGeometries(leaves)!, (y) => lerp('#7FB04E', '#C8E07A', (y - 3) / 2));
  return {
    cedro: { trunk: cedarTrunk, crown: cedarCrown },
    carvalho: { trunk: oakTrunk, crown: oakCrown },
    betula: { trunk: birchTrunk, crown: birchCrown },
  };
}

/**
 * The crowns' material: toon, swaying, and see-through near the camera→cat line. The shared toon hook reads the
 * world position from modelMatrix alone; instanced, it needs the instance's matrix too.
 */
function crownMaterial() {
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: getGradient() });
  enhanceToon(m, true);
  const base = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    base.call(m, shader, renderer);
    shader.vertexShader = shader.vertexShader.replace('vec4 windWorld = modelMatrix * vec4(transformed, 1.0);', 'vec4 windWorld = modelMatrix * instanceMatrix * vec4(transformed, 1.0);');
  };
  m.customProgramCacheKey = () => 'toon-rim-wind-instanced';
  // always blended: the fade only lowers alpha right around the line, everything else stays solid
  m.transparent = true;
  m.depthWrite = true;
  return m;
}

export interface ForestTree { x: number; z: number; kind: Kind; s: number; rot: number; tint: number }

/** Every tree of the forest: the old pine spots (kept: the tests know them), the edges, and more to thicken it. */
export const FOREST_TREES: ForestTree[] = (() => {
  const r = rnd(9191);
  const extra = scatter(9193, 40, [-28, -2, 2, 37], 2.8, (x, z) => keepOpen(x, z) || WILD_PINES.some(([px, pz]) => Math.hypot(px - x, pz - z) < 2.6))
    .concat(scatter(9197, 14, [-47, -24, -41, 7], 3.0, (x, z) => keepOpen(x, z) || inWall(x, z, 1.4)));
  const pick = (x: number, z: number): Kind => {
    // by the trails, trees with high crowns (birch, oak): the camera sees the way; deeper in, the cedars
    const nearTrail = distToTrail(x, z) < 4.5;
    const v = r();
    if (nearTrail) return v < 0.45 ? 'betula' : 'carvalho';
    return v < 0.55 ? 'cedro' : v < 0.85 ? 'carvalho' : 'betula';
  };
  const out: ForestTree[] = [];
  for (const [x, z] of [...WILD_PINES, ...extra]) out.push({ x, z, kind: pick(x, z), s: 0.85 + r() * 0.45, rot: r() * Math.PI * 2, tint: r() });
  for (const [x, z] of EDGE_TREES) out.push({ x, z, kind: 'cedro', s: 1.15 + r() * 0.35, rot: r() * Math.PI * 2, tint: r() });
  // the ring just past the edges, where the forest gets too thick to walk
  for (let x = WILD.minX - 2; x <= WILD.maxX + 2; x += 3.4) out.push({ x, z: WILD.maxZ + 2.5 + (Math.abs(x * 7) % 2), kind: r() < 0.7 ? 'cedro' : 'carvalho', s: 1.3 + r() * 0.4, rot: r() * 6, tint: r() });
  for (let z = WILD.minZ + 4; z <= WILD.maxZ; z += 3.4) {
    out.push({ x: WILD.minX - 2.5 - (Math.abs(z * 5) % 2), z, kind: 'cedro', s: 1.3 + r() * 0.4, rot: r() * 6, tint: r() });
    out.push({ x: WILD.maxX + 2.5 + (Math.abs(z * 3) % 2), z, kind: r() < 0.6 ? 'cedro' : 'carvalho', s: 1.3 + r() * 0.4, rot: r() * 6, tint: r() });
  }
  // the old giant cedar by the cave trail (a landmark: OLD_TREES)
  for (const t of OLD_TREES.filter((o) => o.kind === 'pine')) out.push({ x: t.x, z: t.z, kind: 'cedro', s: t.s, rot: 0.4, tint: 0 });
  return out;
})();

function KindMesh({ kind, trees, geo }: { kind: Kind; trees: ForestTree[]; geo: { trunk: THREE.BufferGeometry; crown: THREE.BufferGeometry } }) {
  const { trunk, crown } = useMemo(() => {
    const trunkMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: getGradient() });
    enhanceToon(trunkMat, false);
    const t = new THREE.InstancedMesh(geo.trunk, trunkMat, trees.length);
    const c = new THREE.InstancedMesh(geo.crown, crownMaterial(), trees.length);
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    const tints = kind === 'betula' ? ['#FFFFFF', '#EAF8DA', '#F4FCE8'] : kind === 'carvalho' ? ['#FFFFFF', '#E4F4D8', '#D2EAC8', '#EEF8E0'] : ['#FFFFFF', '#DCEEE0', '#E8F2D8'];
    trees.forEach((tr, i) => {
      o.position.set(tr.x, 0, tr.z);
      o.rotation.set(0, tr.rot, 0);
      o.scale.setScalar(tr.s);
      o.updateMatrix();
      t.setMatrixAt(i, o.matrix);
      c.setMatrixAt(i, o.matrix);
      c.setColorAt(i, col.set(tints[Math.floor(tr.tint * tints.length) % tints.length]));
    });
    for (const m of [t, c]) {
      m.instanceMatrix.needsUpdate = true;
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.dynamic = true;
      m.computeBoundingSphere();
    }
    return { trunk: t, crown: c };
  }, [kind, trees, geo]);
  useEffect(() => () => {
    (trunk.material as THREE.Material).dispose();
    (crown.material as THREE.Material).dispose();
  }, [trunk, crown]);
  return (
    <>
      <primitive object={trunk} />
      <primitive object={crown} />
    </>
  );
}

let poolTex: THREE.CanvasTexture | null = null;
function softSpot() {
  if (poolTex) return poolTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  poolTex = new THREE.CanvasTexture(cv);
  return poolTex;
}

/** Sunlight through the canopy: soft warm patches on the floor and a few faint shafts. */
function Dapples() {
  const { spots, shafts } = useMemo(() => {
    const r = rnd(7171);
    const ok = (x: number, z: number) => !inWall(x, z, 0.5) && x > WILD.minX + 1 && z < WILD.maxZ - 1;
    const spots: { x: number; z: number; s: number }[] = [];
    for (let i = 0; spots.length < 70 && i < 400; i++) {
      const x = -28 + r() * 30;
      const z = -2 + r() * 39;
      if (ok(x, z)) spots.push({ x, z, s: 1.2 + r() * 2.2 });
    }
    const shafts: { x: number; z: number; rot: number }[] = [];
    for (let i = 0; shafts.length < 7 && i < 100; i++) {
      const x = -26 + r() * 26;
      const z = 0 + r() * 34;
      if (ok(x, z) && distToTrail(x, z) > 2) shafts.push({ x, z, rot: r() * Math.PI });
    }
    return { spots, shafts };
  }, []);
  const mesh = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({ map: softSpot(), color: '#FFF1B8', transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat, spots.length);
    const o = new THREE.Object3D();
    spots.forEach((s, i) => {
      o.position.set(s.x, 0.03, s.z);
      o.scale.set(s.s, 1, s.s * (0.7 + (i % 3) * 0.15));
      o.rotation.set(0, i * 1.3, 0);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.userData.dynamic = true;
    m.renderOrder = 1;
    return m;
  }, [spots]);
  const shaftMat = useMemo(() => {
    const cv = document.createElement('canvas');
    cv.width = 32;
    cv.height = 128;
    const g = cv.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, 'rgba(255,248,210,0.0)');
    grad.addColorStop(0.35, 'rgba(255,248,210,0.55)');
    grad.addColorStop(1, 'rgba(255,248,210,0.0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 128);
    const side = g.createLinearGradient(0, 0, 32, 0);
    side.addColorStop(0, 'rgba(0,0,0,1)');
    side.addColorStop(0.5, 'rgba(0,0,0,0)');
    side.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = side;
    g.fillRect(0, 0, 32, 128);
    const t = new THREE.CanvasTexture(cv);
    return new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  }, []);
  useEffect(() => () => {
    (mesh.material as THREE.Material).dispose();
    mesh.geometry.dispose();
    shaftMat.dispose();
  }, [mesh, shaftMat]);
  return (
    <group userData={{ dynamic: true }}>
      <primitive object={mesh} />
      {shafts.map((s, i) => (
        <mesh key={i} position={[s.x, 3.2, s.z]} rotation={[0.25, s.rot, 0.12]} material={shaftMat}>
          <planeGeometry args={[1.4, 7]} />
        </mesh>
      ))}
    </group>
  );
}

export function WildForest() {
  const geo = useMemo(shapes, []);
  const byKind = useMemo(() => ({
    cedro: FOREST_TREES.filter((t) => t.kind === 'cedro'),
    carvalho: FOREST_TREES.filter((t) => t.kind === 'carvalho'),
    betula: FOREST_TREES.filter((t) => t.kind === 'betula'),
  }), []);
  useEffect(() => () => Object.values(geo).forEach((k) => {
    k.trunk.dispose();
    k.crown.dispose();
  }), [geo]);
  return (
    <group>
      {/* one body for all the trunks */}
      <RigidBody type="fixed" colliders={false} userData={{ surface: 'wood' }}>
        {FOREST_TREES.map((t, i) => (
          <CylinderCollider key={i} args={[1.4, (t.kind === 'betula' ? 0.18 : 0.3) * t.s]} position={[t.x, 1.4, t.z]} />
        ))}
      </RigidBody>
      {(Object.keys(byKind) as Kind[]).map((k) => <KindMesh key={k} kind={k} trees={byKind[k]} geo={geo[k]} />)}
      <Dapples />
    </group>
  );
}
