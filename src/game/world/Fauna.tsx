import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useRapier } from '@react-three/rapier';
import * as THREE from 'three';
import { RIVER } from '../../data/world';
import { POND, EAST_PLAZA } from '../../data/east';
import { ONSEN, CLEARING } from '../../data/west';
import { STREAM, MEADOW } from '../../data/south';
import { clampToRegions } from '../../data/regions';
import { playerPosition, playerMotion } from '../systems/playerState';
import { fenceLayout, FENCE_POST_TOP } from './Ground';
import {
  makeRabbit, rabbitStep, makeBird, birdStep, makeButterfly, butterflyStep, canPet, petRabbit, canFeed, feedRabbit,
  type Env, type Cat, type Rabbit, type Bird, type Butterfly, type Spot, type Flower,
} from '../fauna/brains';
import { rabbitGeometry, birdGeometry, butterflyGeometry, faunaMaterial } from '../fauna/models';
import { habitat } from '../fauna/habitat';
import { useInteractable, type Interactable } from '../systems/interaction';
import { spawnParticles } from '../systems/particles';
import { emit } from '../../systems/events';
import { useGameStore } from '../../store/gameStore';

/**
 * The village's small animals (Etapa 4): rabbits, songbirds and butterflies. Behaviour lives in
 * fauna/brains.ts (unit-tested); this component feeds it the cat and the world, and draws each species
 * as one InstancedMesh posed in the vertex shader (fauna/models.ts): three draw calls in all.
 */

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const inEllipse = (x: number, z: number, e: { x: number; z: number; rx: number; rz: number }, pad: number) =>
  ((x - e.x) / (e.rx + pad)) ** 2 + ((z - e.z) / (e.rz + pad)) ** 2 < 1;

/** Water the animals must not stand in (the colliders don't cover it: the cat may wade, rabbits won't). */
export function inWater(x: number, z: number) {
  if (Math.abs(z - RIVER.z) < RIVER.halfWidth + 0.35 && Math.abs(x) < 19.5) return true;
  if (Math.abs(z - STREAM.z) < STREAM.halfWidth + 0.3 && Math.abs(x) < 19.5) return true;
  return inEllipse(x, z, { x: POND.x, z: POND.z, rx: POND.rx, rz: POND.rz }, 0.35) || inEllipse(x, z, ONSEN, 0.35);
}

/** Rabbit warrens: grassy corners away from the paths (each spawn point is still checked against the world). */
const WARRENS = [
  { x: MEADOW.x + 2.5, z: MEADOW.z - 4, r: 3.2, n: 3 },
  { x: -12.5, z: 3.5, r: 2.6, n: 2 },
  { x: 11.5, z: 26.5, r: 2.6, n: 2 },
  { x: CLEARING.x - 3, z: CLEARING.z + 4, r: 2.4, n: 1 },
];

/** Meadows the butterflies stay around (the old flower spots, plus the districts). */
const MEADOWS: [number, number][] = [[3.9, 3.9], [-5.3, 1.9], [-3.9, -3.9], [-15, -15.5], [-14, -13.5], [6, 10], [-8, 12], [-3, 30], [8, 28], [MEADOW.x, MEADOW.z], [24, 12], [-26, 2]];
const BUTTERFLY_COLORS = ['#FFD54A', '#F49AB8', '#7FD3FF', '#FFFFFF', '#C79BFF', '#FF9F5A'];
const FUR = ['#B79A7E', '#9C8A7A', '#E9E3DA', '#C9B091', '#7F7268'];
const FEATHERS = ['#8A6A4E', '#6E7FA0', '#9A7D5A', '#A4683F', '#77706A'];

const FLOCK = 5;

export function Fauna() {
  const { world, rapier } = useRapier();
  const [ready, setReady] = useState(false);

  // the world checks: ray casts against the fixed colliders, plus water and the walkable regions
  const env = useMemo<Env>(() => {
    const flags = rapier.QueryFilterFlags.ONLY_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS;
    const down = new rapier.Ray({ x: 0, y: 8, z: 0 }, { x: 0, y: -1, z: 0 });
    const side = new rapier.Ray({ x: 0, y: 0.12, z: 0 }, { x: 1, y: 0, z: 0 });
    return {
      ground(x, z) {
        if (clampToRegions(x, z) || inWater(x, z)) return false;
        down.origin = { x, y: 8, z };
        const hit = world.castRay(down, 8, true, flags);
        // the ground's top is at y = 0 (time of impact 8): anything hit sooner stands there
        return !hit || hit.timeOfImpact > 7.92;
      },
      free(ax, az, bx, bz) {
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 1e-4) return true;
        side.origin = { x: ax, y: 0.12, z: az };
        side.dir = { x: (bx - ax) / len, y: 0, z: (bz - az) / len };
        return !world.castRay(side, len + 0.12, true, flags);
      },
    };
  }, [world, rapier]);

  // wait for the fixed colliders to exist before placing anyone
  useEffect(() => {
    const id = setTimeout(() => setReady(true), 1800);
    return () => clearTimeout(id);
  }, []);

  const herd = useMemo(() => {
    if (!ready) return null;
    const rng = seeded(777);
    const rabbits: Rabbit[] = [];
    for (const w of WARRENS) {
      for (let k = 0, tries = 0; k < w.n && tries < 60; tries++) {
        const a = rng() * Math.PI * 2;
        const d = Math.sqrt(rng()) * w.r;
        const x = w.x + Math.cos(a) * d;
        const z = w.z + Math.sin(a) * d;
        if (!env.ground(x, z)) continue;
        rabbits.push(makeRabbit(x, z, { x: w.x, z: w.z, r: w.r }, rng));
        k++;
      }
    }
    // perches: every other fence post; ground: around the two plazas
    const spots: Spot[] = fenceLayout()
      .filter((_, i) => i % 2 === 0)
      .map((p) => ({ x: p.pos[0], y: FENCE_POST_TOP, z: p.pos[2], ground: false }));
    for (const [cx, cz, r0, n] of [[0, 0, 3.4, 9], [EAST_PLAZA.x, EAST_PLAZA.z, 2.2, 5]] as const) {
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + 0.3;
        const x = cx + Math.cos(a) * r0;
        const z = cz + Math.sin(a) * r0;
        if (env.ground(x, z)) spots.push({ x, y: 0, z, ground: true });
      }
    }
    const taken = new Set<number>();
    const birds: Bird[] = [];
    for (let i = 0; i < 9 && spots.length; i++) {
      const s = Math.floor(rng() * spots.length);
      if (taken.has(s)) continue;
      taken.add(s);
      birds.push(makeBird(s, spots, rng));
    }
    const flowers = habitat.flowers;
    const butterflies: Butterfly[] = [];
    const nearFlowers: Flower[][] = [];
    MEADOWS.forEach(([x, z], i) => {
      const home = { x, z, r: 5 };
      const near = flowers.filter((f) => Math.hypot(f.x - x, f.z - z) < home.r);
      for (let k = 0; k < (i < 9 ? 1 : 2); k++) {
        butterflies.push(makeButterfly(home, rng));
        nearFlowers.push(near);
      }
    });
    return { rng, rabbits, spots, taken, birds, butterflies, nearFlowers, flowersVersion: habitat.version };
  }, [ready, env]);

  const meshes = useMemo(() => {
    if (!herd) return null;
    const make = (geo: THREE.BufferGeometry, kind: 'rabbit' | 'bird' | 'butterfly', count: number, colors: string[]) => {
      const mesh = new THREE.InstancedMesh(geo, faunaMaterial(kind), Math.max(1, count));
      mesh.count = count;
      const anim = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, count) * 4), 4);
      anim.setUsage(THREE.DynamicDrawUsage);
      mesh.geometry = geo.clone();
      mesh.geometry.setAttribute('aAnim', anim);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const c = new THREE.Color();
      for (let i = 0; i < count; i++) mesh.setColorAt(i, c.set(colors[(i * 7 + 3) % colors.length]));
      // the animals move: never cull them by the (static) bounds, and keep StaticMerge away
      mesh.frustumCulled = false;
      mesh.userData.dynamic = true;
      mesh.userData.keepVisible = true;
      return { mesh, anim };
    };
    const rabbits = make(rabbitGeometry(), 'rabbit', herd.rabbits.length, FUR);
    rabbits.mesh.castShadow = true;
    const birds = make(birdGeometry(), 'bird', herd.birds.length + FLOCK, FEATHERS);
    const butterflies = make(butterflyGeometry(), 'butterfly', herd.butterflies.length, BUTTERFLY_COLORS);
    return { rabbits, birds, butterflies };
  }, [herd]);

  useEffect(() => () => {
    if (!meshes) return;
    for (const m of Object.values(meshes)) {
      m.mesh.geometry.dispose();
      (m.mesh.material as THREE.Material).dispose();
    }
  }, [meshes]);

  // Petting (Etapa 3): sneak up to a calm rabbit and press E. Feeding (Etapa 6): with a tuna treat in the bag,
  // no need to sneak, and the trust lasts a minute. One interaction target follows the nearest rabbit that can
  // be fed or petted; it has no label (no tag, no action) while there is none.
  const petTarget = useRef<Rabbit | null>(null);
  const feeding = useRef(false);
  const petItem = useMemo<Interactable>(() => ({
    id: 'fauna-pet-rabbit',
    position: new THREE.Vector3(0, -50, 0),
    radius: 2.3,
    tagHeight: 0.9,
    label: () => {
      if (!petTarget.current) return null;
      if (!feeding.current) return 'Fazer carinho no coelho';
      const n = useGameStore.getState().progress.inventory.petisco_atum ?? 0;
      return `Dar petisco ao coelho (🥫 ${n})`;
    },
    onInteract: () => {
      const r = petTarget.current;
      if (!r) return;
      if (feeding.current) {
        const store = useGameStore.getState();
        if ((store.progress.inventory.petisco_atum ?? 0) < 1) return;
        store.addItem('petisco_atum', -1);
        feedRabbit(r);
        petTarget.current = null;
        spawnParticles('sparkle', [r.x, 0.45, r.z], 16, '#FF8FB1');
        emit({ type: 'sfx', name: 'purr', position: [r.x, 0.3, r.z] });
        store.bumpCounter('coelhos_alimentados');
        emit({ type: 'toast', icon: '🐰', text: 'Nhac! O coelho comeu da sua pata e vai confiar em você por um minuto.' });
        return;
      }
      petRabbit(r);
      petTarget.current = null;
      spawnParticles('sparkle', [r.x, 0.45, r.z], 10, '#FF8FB1');
      emit({ type: 'sfx', name: 'purr', position: [r.x, 0.3, r.z] });
      const store = useGameStore.getState();
      if (!store.progress.counters.carinhos_coelho) {
        emit({ type: 'toast', icon: '🐰', text: 'O coelho ficou calminho e confia em você por um tempo. Agachado e devagar, os bichos deixam chegar perto!' });
      }
      store.bumpCounter('carinhos_coelho');
    },
  }), []);
  useInteractable(petItem);

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), e: new THREE.Euler(), cat: { x: 0, z: 0, crouch: false, speed: 0 } as Cat }), []);
  const clock = useRef(0);

  useFrame((_s, raw) => {
    if (!herd || !meshes) return;
    const dt = Math.min(raw, 0.05);
    clock.current += dt;
    const t = clock.current;
    const { m, q, p, s, e, cat } = tmp;
    cat.x = playerPosition.x;
    cat.z = playerPosition.z;
    cat.crouch = playerMotion.crouch;
    cat.speed = playerMotion.speed;
    cat.treat = (useGameStore.getState().progress.inventory.petisco_atum ?? 0) > 0;
    const { rng } = herd;

    // rabbits
    const ra = meshes.rabbits.anim.array as Float32Array;
    herd.rabbits.forEach((r, i) => {
      rabbitStep(r, dt, cat, env, rng);
      const hopT = r.hop ? Math.sin(r.hop.t * Math.PI) : 0;
      // a bit larger than life, so they read next to the stylized cat (and vary a little)
      const size = 1.1 + ((i * 37) % 10) * 0.024;
      p.set(r.x, r.y, r.z);
      q.setFromEuler(e.set(0, -r.heading, 0));
      // stretched in the air, a touch squashed on landing
      s.set(size * (1 + hopT * 0.14), size * (1 - hopT * 0.06), size);
      meshes.rabbits.mesh.setMatrixAt(i, m.compose(p, q, s));
      ra.set([r.ears, r.sit, r.sniff, r.groom], i * 4);
    });
    let pet: Rabbit | null = null;
    let petDist = Infinity;
    const hasTreat = !!cat.treat;
    for (const r of herd.rabbits) {
      const d = Math.hypot(r.x - cat.x, r.z - cat.z);
      if (d < petDist && ((hasTreat && canFeed(r, cat)) || canPet(r, cat))) {
        pet = r;
        petDist = d;
      }
    }
    petTarget.current = pet;
    feeding.current = !!pet && hasTreat && canFeed(pet, cat);
    if (pet) petItem.position.set(pet.x, 0, pet.z);
    else petItem.position.set(0, -50, 0);

    // birds on the ground and perches, then the flock wheeling high over the village
    const ba = meshes.birds.anim.array as Float32Array;
    herd.birds.forEach((b, i) => {
      birdStep(b, dt, cat, herd.spots, herd.taken, env, rng);
      p.set(b.x, b.y, b.z);
      q.setFromEuler(e.set(0, -b.heading, b.mode === 'fly' ? Math.sin(b.flap * 0.2) * 0.15 : 0));
      s.setScalar(1.6);
      meshes.birds.mesh.setMatrixAt(i, m.compose(p, q, s));
      ba.set([b.flap, b.wings, b.peck, b.look], i * 4);
    });
    for (let k = 0; k < FLOCK; k++) {
      const i = herd.birds.length + k;
      const a = t * 0.22 + k * 0.2;
      const r = 22 + (k % 3) * 1.4;
      p.set(Math.cos(a) * r, 17 + Math.sin(t * 0.7 + k) * 0.8 + (k % 3), 10 + Math.sin(a) * r);
      // tangent to the circle, banking into the turn; glides between bursts of flapping
      q.setFromEuler(e.set(0.35, -(a + Math.PI / 2), 0, 'YXZ'));
      s.setScalar(2.2);
      meshes.birds.mesh.setMatrixAt(i, m.compose(p, q, s));
      const burst = Math.sin(t * 0.9 + k * 1.7) > 0.2 ? 1 : 0;
      ba.set([t * 22 * burst + k, 1, 0, 0], i * 4);
    }

    // butterflies (the foliage may scatter its flowers after the animals are placed)
    if (herd.flowersVersion !== habitat.version) {
      herd.flowersVersion = habitat.version;
      herd.butterflies.forEach((b, i) => {
        herd.nearFlowers[i] = habitat.flowers.filter((f) => Math.hypot(f.x - b.home.x, f.z - b.home.z) < b.home.r);
      });
    }
    const fa = meshes.butterflies.anim.array as Float32Array;
    herd.butterflies.forEach((b, i) => {
      butterflyStep(b, dt, t, cat, herd.nearFlowers[i], rng);
      p.set(b.x, b.y, b.z);
      q.setFromEuler(e.set(0, -b.heading, 0));
      s.setScalar(1.7);
      meshes.butterflies.mesh.setMatrixAt(i, m.compose(p, q, s));
      fa.set([b.flap, b.mode === 'land' ? 0.55 : 1, 0, 0], i * 4);
    });

    for (const g of Object.values(meshes)) {
      g.mesh.instanceMatrix.needsUpdate = true;
      g.anim.needsUpdate = true;
    }
  });

  useEffect(() => {
    if (import.meta.env.DEV && herd) (window as unknown as Record<string, unknown>).__fauna = { herd, env };
  }, [herd, env]);

  if (!meshes) return null;
  return (
    <>
      <primitive object={meshes.rabbits.mesh} />
      <primitive object={meshes.birds.mesh} />
      <primitive object={meshes.butterflies.mesh} />
    </>
  );
}
