import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { create } from 'zustand';
import { Toon, Ink, getGradient } from '../materials';
import { PineTree, SakuraTree, MapleTree } from './Props';
import { Rock } from './Rock';
import { TerraceBox, StepBlock } from './districtParts';
import { useGrassTexture } from './Ground';
import { StaticMerge } from '../StaticMerge';
import { useSpot, useIconTexture } from '../systems/training';
import { useGameStore } from '../../store/gameStore';
import { emit } from '../../systems/events';
import { playerPosition, playerMotion, abilityState, now } from '../systems/playerState';
import { spawnParticles } from '../systems/particles';
import { combatWorld, hurtPlayer, refillHearts, useHearts } from '../systems/hearts';
import { useZone } from '../systems/zone';
import { isActive } from '../../systems/combat';
import { press as pressOrder, brokenRule } from '../../systems/orderPuzzle';
import {
  WILD_ORIGIN, WILD, WILD_RIVER, WILD_WALLS, WILD_STONES, WILD_STONE_R, ROPE_BRIDGE, BRIDGE_REPAIR, WILD_TRAILS, WILD_PINES,
  WILD_CHERRIES, WILD_MAPLES, BENTO_TREE, HERB_SPOTS, CRYSTALS, TRAPS, TRAP, CAMPFIRE, KIT_BUSH, BENTO_GUARD_CLEAR,
  CANYON, CANYON_PASSED_Z, CAVE, OUTPOST, LOOKOUT, WIND_ZONE, SUN_PUZZLE, SUN_STONES, SUN_GATE, WILD_CODE_ACTIONS,
  TRAIL_GATE, WILD_GATE, w, toLocal, type WildWall,
} from '../../data/wild';

/**
 * As Terras Selvagens (Etapa 7 da expansão), drawn and made solid from data/wild.ts: ground, river and
 * waterfall, the rope bridge and the stepping stones, cliffs and the outpost's palisade, the camp, the forest,
 * the cave, the ruins and the windy lookout. Also everything you can do there that is not a creature (those are
 * in Enemies.tsx): pick herbs, rest by the fire, tie the bridge, see crystals with the Faro, step on (or
 * disarm) snares, the ruins' four stones, Bento's tree and the kit in the thorn bush.
 *
 * Colliders stay mounted far from the village (x around 500); the meshes draw only while the cat is there.
 */

const [OX, OZ] = WILD_ORIGIN;
const toast = (icon: string, text: string) => emit({ type: 'toast', icon, text });
const run = (a: string) => useGameStore.getState().runActions(a);
const flag = (f: string) => !!useGameStore.getState().progress.flags[f];
const stepDone = (m: string, s: string) => !!useGameStore.getState().progress.missions[m]?.steps.includes(s);
const inZone = () => useZone.getState().zone === 'selvagem';
const local = () => toLocal(playerPosition.x, playerPosition.z);

/** Per-visit state: herbs picked and snares sprung this visit (they grow back / are set again next time). */
const useVisit = create<{ herbs: number[]; sprung: number[]; reset: () => void }>((set) => ({
  herbs: [], sprung: [], reset: () => set({ herbs: [], sprung: [] }),
}));

// ── Ground, trails, water ─────────────────────────────────────────────────────

function WildGround() {
  const grass = useGrassTexture();
  const mat = useMemo(() => {
    const t = grass.clone();
    t.needsUpdate = true;
    t.repeat.set(26, 22);
    return new THREE.MeshToonMaterial({ map: t, gradientMap: getGradient(), color: '#E8F2D8' });
  }, [grass]);
  const w0 = WILD.maxX - WILD.minX + 24;
  const d0 = WILD.maxZ - WILD.minZ + 24;
  const cx = (WILD.minX + WILD.maxX) / 2;
  const cz = (WILD.minZ + WILD.maxZ) / 2;
  return (
    <RigidBody type="fixed" colliders={false} name="wild-ground">
      <CuboidCollider args={[w0 / 2, 1.5, d0 / 2]} position={[cx, -1.5, cz]} />
      {/* the region's edges: the trees outside are not a way out */}
      <CuboidCollider args={[0.4, 4, d0 / 2]} position={[WILD.minX - 0.6, 3, cz]} />
      <CuboidCollider args={[0.4, 4, d0 / 2]} position={[WILD.maxX + 0.6, 3, cz]} />
      <CuboidCollider args={[w0 / 2, 4, 0.4]} position={[cx, 3, WILD.maxZ + 0.6]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0, cz]} receiveShadow material={mat}>
        <planeGeometry args={[w0, d0]} />
      </mesh>
    </RigidBody>
  );
}

function Trails() {
  const segs = useMemo(() => {
    const out: { x: number; z: number; len: number; rot: number }[] = [];
    for (const line of WILD_TRAILS) {
      for (let i = 0; i < line.length - 1; i++) {
        const [ax, az] = line[i];
        const [bx, bz] = line[i + 1];
        out.push({ x: (ax + bx) / 2, z: (az + bz) / 2, len: Math.hypot(bx - ax, bz - az), rot: Math.atan2(bx - ax, bz - az) });
      }
    }
    return out;
  }, []);
  const joints = useMemo(() => WILD_TRAILS.flat(), []);
  return (
    <group>
      {segs.map((s, i) => (
        <group key={i} position={[s.x, 0.012, s.z]} rotation={[0, s.rot, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[1.7, s.len]} />
            <Toon color="#B49C7C" />
          </mesh>
        </group>
      ))}
      {joints.map(([x, z], i) => (
        <mesh key={`j${i}`} position={[x, 0.013, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[0.85, 16]} />
          <Toon color="#B49C7C" />
        </mesh>
      ))}
    </group>
  );
}

function River() {
  const { x0, x1, z0, z1 } = WILD_RIVER;
  const banks = useMemo(() => {
    const out: [number, number, number][] = [];
    for (let z = z0 + 2; z < z1; z += 2.6) {
      if (Math.abs(z - ROPE_BRIDGE.z) < 1.4 || Math.abs(z - WILD_STONES[0][1]) < 1.2) continue;
      out.push([x0 - 0.25, z, (z * 7) % 3], [x1 + 0.25, z + 1.3, (z * 5) % 3]);
    }
    return out;
  }, [x0, x1, z0, z1]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, 0.03, (z0 + z1) / 2]}>
        <planeGeometry args={[x1 - x0, z1 - z0]} />
        <Toon color="#4E9CC0" emissive="#1E5A78" emissiveIntensity={0.25} />
      </mesh>
      {banks.map(([x, z, v], i) => (
        <Rock key={i} variant={Math.floor(v)} kind="pebble" position={[x, 0.08, z]} scale={[0.5, 0.3, 0.6]} color="#8E877C" contact={false} />
      ))}
      {/* stepping stones: a hop from one to the next */}
      <RigidBody type="fixed" colliders={false} userData={STONE_DATA}>
        {WILD_STONES.map(([x, z]) => (
          <group key={x}>
            <CylinderCollider args={[0.14, WILD_STONE_R]} position={[x, 0.14, z]} />
            <mesh position={[x, 0.14, z]} castShadow receiveShadow>
              <cylinderGeometry args={[WILD_STONE_R, WILD_STONE_R + 0.08, 0.32, 9]} />
              <Toon color="#9A9286" tex="stone" />
              <Ink thickness={0.015} />
            </mesh>
          </group>
        ))}
      </RigidBody>
    </group>
  );
}
const STONE_DATA = { surface: 'stone' };
const WOOD_DATA = { surface: 'wood' };

/** The waterfall at the north end: a scrolling sheet of water over the cliff, foam and spray at its foot. */
function Waterfall() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 256;
    const g = c.getContext('2d')!;
    g.fillStyle = '#8FD0EC';
    g.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.5})`;
      g.fillRect(Math.random() * 64, Math.random() * 256, 1 + Math.random() * 3, 12 + Math.random() * 40);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 1);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useFrame((_s, d) => {
    tex.offset.y += d * 0.9;
  });
  const foam = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (foam.current) foam.current.children.forEach((m, i) => m.scale.setScalar(0.8 + 0.25 * Math.sin(clock.elapsedTime * 3 + i * 1.7)));
  });
  return (
    <group>
      <mesh position={[6.5, 4, -38.5]}>
        <planeGeometry args={[5.8, 8]} />
        <meshBasicMaterial map={tex} transparent opacity={0.88} />
      </mesh>
      <group ref={foam}>
        {[3.9, 5.2, 6.5, 7.8, 9.1].map((x) => (
          <mesh key={x} position={[x, 0.15, -37.9]}>
            <sphereGeometry args={[0.55, 10, 8]} />
            <meshBasicMaterial color="#F4FBFF" transparent opacity={0.75} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** The rope bridge: two end landings, and the middle only once the Corda Ninja ties it. */
function RopeBridge() {
  const fixed = useGameStore((s) => !!s.progress.flags.ponte_consertada);
  const { z, x0, x1, half, h } = ROPE_BRIDGE;
  const planks = useMemo(() => {
    const out: number[] = [];
    for (let x = x0 + 0.2; x < x1; x += 0.36) out.push(x);
    return out;
  }, [x0, x1]);
  const gap = (x: number) => x > WILD_RIVER.x0 + 0.3 && x < WILD_RIVER.x1 - 0.3;
  return (
    <group>
      <RigidBody key={fixed ? 'whole' : 'broken'} type="fixed" colliders={false} userData={WOOD_DATA}>
        {fixed ? (
          <CuboidCollider args={[(x1 - x0) / 2, h / 2, half]} position={[(x0 + x1) / 2, h / 2, z]} />
        ) : (
          <>
            <CuboidCollider args={[(WILD_RIVER.x0 + 0.3 - x0) / 2, h / 2, half]} position={[(x0 + WILD_RIVER.x0 + 0.3) / 2, h / 2, z]} />
            <CuboidCollider args={[(x1 - WILD_RIVER.x1 + 0.3) / 2, h / 2, half]} position={[(x1 + WILD_RIVER.x1 - 0.3) / 2, h / 2, z]} />
          </>
        )}
      </RigidBody>
      {planks.map((x, i) =>
        fixed || !gap(x) ? (
          <mesh key={x} position={[x, h - 0.04, z]} castShadow receiveShadow>
            <boxGeometry args={[0.3, 0.08, half * 2]} />
            <Toon color={i % 3 ? '#A0764E' : '#8C6440'} tex="wood" />
          </mesh>
        ) : i % 4 === 0 ? (
          // a few loose planks dangling from the broken ropes
          <mesh key={x} position={[x, h - 0.5, z + half - 0.1]} rotation={[1.2, 0, 0.3]}>
            <boxGeometry args={[0.3, 0.06, 0.8]} />
            <Toon color="#8C6440" tex="wood" />
          </mesh>
        ) : null,
      )}
      {[x0, x1].flatMap((x) => [-1, 1].map((s) => (
        <mesh key={`${x}${s}`} position={[x, 0.7, z + s * (half + 0.05)]} castShadow>
          <cylinderGeometry args={[0.08, 0.1, 1.4, 7]} />
          <Toon color="#6E4E36" tex="wood" />
        </mesh>
      )))}
      {[-1, 1].map((s) => (
        <mesh key={`rope${s}`} position={[(x0 + x1) / 2, fixed ? 1.15 : 0.95, z + s * (half + 0.05)]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.025, 0.025, fixed ? x1 - x0 : 1.6, 5]} />
          <Toon color="#C9B48C" />
        </mesh>
      ))}
    </group>
  );
}

// ── Rock walls, cliffs and the palisade ───────────────────────────────────────

function Wall({ wl }: { wl: WildWall }) {
  const w0 = wl.x1 - wl.x0;
  const d0 = wl.z1 - wl.z0;
  const cx = (wl.x0 + wl.x1) / 2;
  const cz = (wl.z0 + wl.z1) / 2;
  const boulders = useMemo(() => {
    if (wl.kind !== 'cliff') return [];
    const out: [number, number, number, number][] = [];
    const along = w0 > d0;
    const n = Math.floor((along ? w0 : d0) / 4.5);
    for (let i = 0; i <= n; i++) {
      const t = n === 0 ? 0.5 : i / n;
      const s = 0.9 + ((i * 37) % 7) / 10;
      // on the top edge, and half sunk in the foot of both faces (natural rock, not a built wall)
      if (along) {
        out.push([wl.x0 + t * w0, wl.h * 0.9, cz, s], [wl.x0 + t * w0 + 1.6, 0.5, wl.z0 + 0.15, s * 0.8], [wl.x0 + t * w0 - 1.2, 0.5, wl.z1 - 0.15, s * 0.8]);
      } else out.push([cx, wl.h * 0.9, wl.z0 + t * d0, s], [wl.x0 + 0.15, 0.5, wl.z0 + t * d0 + 1.4, s * 0.8], [wl.x1 - 0.15, 0.5, wl.z0 + t * d0 - 1.1, s * 0.8]);
    }
    return out;
  }, [wl, w0, d0, cx, cz]);
  if (wl.kind === 'palisade') {
    const logs: number[] = [];
    for (let z = wl.z0 + 0.25; z < wl.z1; z += 0.5) logs.push(z);
    return (
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[w0 / 2, wl.h / 2, d0 / 2]} position={[cx, wl.h / 2, cz]} />
        {logs.map((z, i) => (
          <group key={z} position={[cx, 0, z]}>
            <mesh position={[0, (wl.h - (i % 2) * 0.3) / 2, 0]} castShadow>
              <cylinderGeometry args={[0.24, 0.26, wl.h - (i % 2) * 0.3, 7]} />
              <Toon color="#7A5A3E" tex="bark" />
            </mesh>
            <mesh position={[0, wl.h - (i % 2) * 0.3 + 0.2, 0]}>
              <coneGeometry args={[0.24, 0.4, 7]} />
              <Toon color="#8C6A4A" />
            </mesh>
          </group>
        ))}
      </RigidBody>
    );
  }
  return (
    <RigidBody type="fixed" colliders={false} userData={STONE_DATA}>
      <CuboidCollider args={[w0 / 2, wl.h / 2, d0 / 2]} position={[cx, wl.h / 2, cz]} />
      <mesh position={[cx, wl.h / 2, cz]} castShadow receiveShadow>
        <boxGeometry args={[w0, wl.h, d0]} />
        {/* plain rock (the "stone" texture reads as masonry: right for the ruins, wrong for a cliff) */}
        <Toon color="#857C70" />
        <Ink thickness={0.03} />
      </mesh>
      <mesh position={[cx, wl.h + 0.04, cz]} receiveShadow>
        <boxGeometry args={[w0 - 0.1, 0.08, d0 - 0.1]} />
        <Toon color="#6E9A52" />
      </mesh>
      {boulders.map(([x, y, z, s], i) => (
        <Rock key={i} variant={i % 4} position={[x, y, z]} scale={[s * 1.6, s * 1.1, s * 1.4]} color="#8A8276" contact={false} />
      ))}
    </RigidBody>
  );
}

// ── Places ────────────────────────────────────────────────────────────────────

function Tent({ x, z, rot = 0, color = '#C9A56A', torn = false }: { x: number; z: number; rot?: number; color?: string; torn?: boolean }) {
  return (
    <RigidBody type="fixed" colliders={false} position={[x, 0, z]} rotation={[0, rot, 0]}>
      <CuboidCollider args={[1.1, 0.8, 1.2]} position={[0, 0.8, 0]} />
      {/* a canvas prism: three sides around the ridge pole, one edge up */}
      <mesh position={[0, 0.62, 0]} rotation={[-Math.PI / 2, 0, torn ? 0.5 : 0]} scale={[1, 1, torn ? 0.8 : 1]} castShadow>
        <cylinderGeometry args={[1.25, 1.25, 2.4, 3, 1]} />
        <Toon color={color} />
        <Ink thickness={0.015} />
      </mesh>
      {/* the dark doorway at the front */}
      <mesh position={[0, 0.3, 1.21]} rotation={[0, 0, Math.PI / 2]}>
        <circleGeometry args={[0.42, 3]} />
        <Toon color="#3A2E2A" />
      </mesh>
      <mesh position={[0, 1.88, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 2.7, 6]} />
        <Toon color="#6E4E36" />
      </mesh>
    </RigidBody>
  );
}

function Crate({ x, z, s = 0.7, rot = 0 }: { x: number; z: number; s?: number; rot?: number }) {
  return (
    <RigidBody type="fixed" colliders={false} position={[x, 0, z]} rotation={[0, rot, 0]}>
      <CuboidCollider args={[s / 2, s / 2, s / 2]} position={[0, s / 2, 0]} />
      <mesh position={[0, s / 2, 0]} castShadow>
        <boxGeometry args={[s, s, s]} />
        <Toon color="#B08456" tex="planks" />
        <Ink thickness={0.012} />
      </mesh>
    </RigidBody>
  );
}

function Banner({ x, z, icon, cloth, rot = 0 }: { x: number; z: number; icon: string; cloth: string; rot?: number }) {
  const tex = useIconTexture(icon, cloth, '#FFFFFF');
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 1.4, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 2.8, 6]} />
        <Toon color="#5A4032" />
      </mesh>
      <mesh position={[0.32, 2.1, 0]}>
        <planeGeometry args={[0.6, 1.0]} />
        <meshToonMaterial color={cloth} side={THREE.DoubleSide} gradientMap={getGradient()} />
      </mesh>
      <mesh position={[0.32, 2.2, 0.01]}>
        <planeGeometry args={[0.46, 0.46]} />
        <meshBasicMaterial map={tex} transparent />
      </mesh>
    </group>
  );
}

/** Logs ringed with stones; `lit` adds the flickering flame. */
function FireRing({ x, z, lit }: { x: number; z: number; lit: boolean }) {
  const flame = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const f = flame.current;
    if (!f) return;
    const t = clock.elapsedTime;
    f.scale.set(1 + 0.12 * Math.sin(t * 9), 1 + 0.2 * Math.sin(t * 7.3 + 1), 1 + 0.12 * Math.cos(t * 8));
  });
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.15, 0.55]} position={[0, 0.15, 0]} />
      </RigidBody>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return <Rock key={i} variant={i % 4} kind="pebble" position={[Math.cos(a) * 0.65, 0.08, Math.sin(a) * 0.65]} scale={0.22} color="#7E776C" contact={false} />;
      })}
      {[0, 1.2].map((r) => (
        <mesh key={r} position={[0, 0.12, 0]} rotation={[0, r, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.07, 0.9, 6]} />
          <Toon color="#5A3E2A" tex="bark" />
        </mesh>
      ))}
      {lit && (
        <mesh ref={flame} position={[0, 0.45, 0]} userData={{ dynamic: true }}>
          <coneGeometry args={[0.28, 0.75, 8]} />
          <meshBasicMaterial color="#FFB347" transparent opacity={0.9} />
        </mesh>
      )}
    </group>
  );
}

function Camp() {
  const vila = useIconTexture('🏯', '#F3E2B8', '#2A1E16');
  const [gx, , gz] = WILD_GATE.at;
  return (
    <group>
      <Tent x={30} z={27.5} rot={0.3} color="#C9A56A" />
      <Tent x={39} z={28.5} rot={-0.2} color="#9EB7C9" />
      <Tent x={28.4} z={15.2} rot={1.2} color="#C98A6A" />
      <Crate x={41.5} z={25} />
      <Crate x={42.2} z={25.6} s={0.55} rot={0.4} />
      <Crate x={27.4} z={21} s={0.6} />
      <Banner x={36} z={29.6} icon="🐾" cloth="#3E6E8C" />
      {/* the cauldron on its tripod */}
      <group position={[40.4, 0, 17.6]}>
        <RigidBody type="fixed" colliders={false}>
          <CylinderCollider args={[0.35, 0.5]} position={[0, 0.35, 0]} />
        </RigidBody>
        <mesh position={[0, 0.45, 0]} castShadow>
          <sphereGeometry args={[0.45, 14, 10, 0, Math.PI * 2, Math.PI * 0.25, Math.PI * 0.75]} />
          <Toon color="#2E2A2E" />
          <Ink thickness={0.015} />
        </mesh>
        <mesh position={[0, 0.78, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.33, 14]} />
          <Toon color="#7FD36A" emissive="#4FA03A" emissiveIntensity={0.4} />
        </mesh>
        {[0, 2.1, 4.2].map((a) => (
          <mesh key={a} position={[Math.cos(a) * 0.45, 0.6, Math.sin(a) * 0.45]} rotation={[Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35]}>
            <cylinderGeometry args={[0.03, 0.03, 1.3, 5]} />
            <Toon color="#5A4032" />
          </mesh>
        ))}
      </group>
      {/* the way back to the village */}
      <group position={[gx - OX, 0, gz - OZ]} rotation={[0, Math.PI / 2, 0]}>
        {[-1.3, 1.3].map((x) => (
          <mesh key={x} position={[x, 1.3, 0]} castShadow>
            <cylinderGeometry args={[0.14, 0.17, 2.6, 8]} />
            <Toon color="#7A5236" tex="bark" />
          </mesh>
        ))}
        <mesh position={[0, 2.55, 0]}>
          <boxGeometry args={[3.2, 0.22, 0.24]} />
          <Toon color="#6E4A30" tex="wood" />
        </mesh>
        <mesh position={[0, 2.0, 0.13]}>
          <planeGeometry args={[0.6, 0.6]} />
          <meshBasicMaterial map={vila} transparent />
        </mesh>
      </group>
    </group>
  );
}

/** The trail gate in the village (Bambuzal's west fence), drawn with the village. */
export function TrailGateVillage() {
  const tex = useIconTexture('🏕️', '#F3E2B8', '#2A1E16');
  const [x, , z] = TRAIL_GATE.at;
  return (
    <group position={[x - 0.9, 0, z]} rotation={[0, Math.PI / 2, 0]}>
      {[-1.4, 1.4].map((px) => (
        <mesh key={px} position={[px, 1.4, 0]} castShadow>
          <cylinderGeometry args={[0.15, 0.18, 2.8, 8]} />
          <Toon color="#7A5236" tex="bark" />
          <Ink thickness={0.02} />
        </mesh>
      ))}
      <mesh position={[0, 2.75, 0]}>
        <boxGeometry args={[3.5, 0.24, 0.26]} />
        <Toon color="#6E4A30" tex="wood" />
      </mesh>
      {/* the sign faces the village (east) */}
      <mesh position={[0, 2.15, 0.14]}>
        <planeGeometry args={[0.66, 0.66]} />
        <meshBasicMaterial map={tex} transparent />
      </mesh>
      {/* the rope across, until the expedition opens the way */}
      <mesh position={[0, 1.0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 2.8, 5]} />
        <Toon color="#C9B48C" />
      </mesh>
    </group>
  );
}

function Forest() {
  return (
    <group>
      {WILD_PINES.map(([x, z], i) => <PineTree key={`p${i}`} position={[x, 0, z]} scale={1.05 + ((i * 13) % 7) / 14} />)}
      {WILD_CHERRIES.map(([x, z], i) => <SakuraTree key={`c${i}`} position={[x, 0, z]} scale={1.1 + ((i * 11) % 5) / 12} seed={i + 3} />)}
      {WILD_MAPLES.map(([x, z], i) => <MapleTree key={`m${i}`} position={[x, 0, z]} scale={1.1} seed={i + 5} green={i % 3 !== 0} />)}
      <SakuraTree position={[BENTO_TREE.x, 0, BENTO_TREE.z]} scale={1.9} seed={9} />
      {/* Bento's branch */}
      <mesh position={[BENTO_TREE.x + 0.85, 2.33, BENTO_TREE.z + 0.2]} rotation={[0, 0, Math.PI / 2 - 0.15]} castShadow>
        <cylinderGeometry args={[0.1, 0.16, 1.5, 7]} />
        <Toon color="#6E4A3A" tex="bark" />
      </mesh>
      {/* the trees around the edge: the region ends where the forest gets too thick */}
      {BORDER.map(([x, z], i) => <PineTree key={`b${i}`} position={[x, 0, z]} scale={1.4 + (i % 4) * 0.15} />)}
    </group>
  );
}
const BORDER: [number, number][] = (() => {
  const out: [number, number][] = [];
  for (let x = WILD.minX - 2; x <= WILD.maxX + 2; x += 3.4) out.push([x, WILD.maxZ + 2.5 + (Math.abs(x * 7) % 2)]);
  for (let z = WILD.minZ + 4; z <= WILD.maxZ; z += 3.4) out.push([WILD.minX - 2.5 - (Math.abs(z * 5) % 2), z], [WILD.maxX + 2.5 + (Math.abs(z * 3) % 2), z]);
  return out;
})();

function Clearing() {
  return (
    <group>
      {[[-19, -6], [-10, -8], [-14, -18]].map(([x, z], i) => (
        <RigidBody key={i} type="fixed" colliders={false} position={[x, 0, z]}>
          <CylinderCollider args={[0.25, 0.45]} position={[0, 0.25, 0]} />
          <mesh position={[0, 0.25, 0]} castShadow>
            <cylinderGeometry args={[0.42, 0.5, 0.5, 9]} />
            <Toon color="#8C6A4A" tex="bark" />
          </mesh>
        </RigidBody>
      ))}
      <Banner x={-22} z={-9} icon="🐾" cloth="#8C2E2E" />
      <Banner x={-9} z={-13} icon="🐾" cloth="#8C2E2E" rot={Math.PI} />
      <Rock variant={2} position={[-24, 0.5, -16]} scale={[1.3, 0.9, 1.1]} color="#8E877C" contact={false} />
    </group>
  );
}

function Outpost() {
  return (
    <group>
      <Tent x={-44.5} z={-28.6} rot={0.2} color="#7A3E3E" />
      <Tent x={-31} z={-29} rot={-0.4} color="#6E4A4A" />
      <FireRing x={-37} z={-33} lit />
      <Crate x={-29} z={-37} />
      <Crate x={-29.8} z={-37.4} s={0.55} rot={0.5} />
      <Banner x={-40} z={-37.6} icon="🐾" cloth="#8C2E2E" />
      <Banner x={-34} z={-37.6} icon="🐾" cloth="#8C2E2E" />
      {/* the table with Hissui's orders */}
      <RigidBody type="fixed" colliders={false} position={[-43, 0, -34.7]}>
        <CuboidCollider args={[0.7, 0.35, 0.4]} position={[0, 0.35, 0]} />
        <mesh position={[0, 0.66, 0]} castShadow>
          <boxGeometry args={[1.4, 0.08, 0.8]} />
          <Toon color="#7A5236" tex="wood" />
        </mesh>
        {[[-0.6, -0.32], [0.6, -0.32], [-0.6, 0.32], [0.6, 0.32]].map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, 0.31, z]}>
            <boxGeometry args={[0.08, 0.62, 0.08]} />
            <Toon color="#5A3E2A" />
          </mesh>
        ))}
      </RigidBody>
      {/* a lookout tower by the palisade (for show: the guards are on the ground) */}
      <RigidBody type="fixed" colliders={false} position={[-29, 0, -26.8]}>
        <CuboidCollider args={[0.8, 2.2, 0.8]} position={[0, 2.2, 0]} />
        {[[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]].map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, 2, z]} castShadow>
            <cylinderGeometry args={[0.1, 0.12, 4, 6]} />
            <Toon color="#6E4E36" tex="bark" />
          </mesh>
        ))}
        <mesh position={[0, 4.1, 0]} castShadow>
          <boxGeometry args={[1.8, 0.16, 1.8]} />
          <Toon color="#7A5A3E" tex="planks" />
        </mesh>
        <mesh position={[0, 4.75, 0]}>
          <coneGeometry args={[1.4, 0.9, 4]} />
          <Toon color="#5A3A2E" />
        </mesh>
      </RigidBody>
    </group>
  );
}

function AbandonedCamp() {
  return (
    <group>
      <Tent x={-23.5} z={34.6} rot={0.9} color="#8C8A7A" torn />
      <FireRing x={-20.5} z={31.2} lit={false} />
      <mesh position={[-21, 0.18, 33.4]} rotation={[0, 0.4, Math.PI / 2]}>
        <cylinderGeometry args={[0.18, 0.18, 1.2, 7]} />
        <Toon color="#6E4E36" tex="bark" />
      </mesh>
      <mesh position={[-21, 0.4, 33.4]} rotation={[-Math.PI / 2, 0, 0.3]}>
        <boxGeometry args={[0.3, 0.22, 0.04]} />
        <Toon color="#B5492E" />
      </mesh>
    </group>
  );
}

function Cave() {
  const { x0, x1, z0, z1 } = CAVE;
  const spikes = useMemo(() => [[19.5, -25.5, 1.0], [33, -26, 1.3], [26, -37.5, 1.6], [24, -33, 0.8], [29.5, -29.5, 0.9], [32.6, -33, 1.1]], []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, 0.02, (z0 + z1) / 2]} receiveShadow>
        <planeGeometry args={[x1 - x0, z1 - z0]} />
        <Toon color="#4A4E58" tex="stone" />
      </mesh>
      {spikes.map(([x, z, h], i) => (
        <RigidBody key={i} type="fixed" colliders={false} position={[x, 0, z]}>
          <CylinderCollider args={[h / 2, 0.32]} position={[0, h / 2, 0]} />
          <mesh position={[0, h / 2, 0]} castShadow>
            <coneGeometry args={[0.38, h, 7]} />
            <Toon color="#6E6A78" tex="stone" />
          </mesh>
        </RigidBody>
      ))}
    </group>
  );
}

/** Mist in the cave, drifting slowly. */
function CaveMist() {
  const g = useRef<THREE.Group>(null);
  const puffs = useMemo(() => Array.from({ length: 14 }, (_, i) => [CAVE.x0 + 1 + ((i * 53) % 140) / 10, CAVE.z0 + 1.5 + ((i * 37) % 120) / 10, 0.9 + (i % 3) * 0.4]), []);
  useFrame(({ clock }) => {
    g.current?.children.forEach((m, i) => {
      m.position.x = puffs[i][0] + Math.sin(clock.elapsedTime * 0.2 + i) * 0.8;
      m.position.y = 0.4 + Math.sin(clock.elapsedTime * 0.35 + i * 2) * 0.15;
    });
  });
  return (
    <group ref={g}>
      {puffs.map(([x, z, r], i) => (
        <mesh key={i} position={[x, 0.4, z]} scale={[r * 1.8, r * 0.5, r * 1.4]} userData={{ dynamic: true }}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshBasicMaterial color="#DCE6F2" transparent opacity={0.18} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function Ruins() {
  return (
    <group>
      {[[24.5, -4, 2.2], [37.5, -3.5, 1.4], [25, -12.5, 3.0], [38.5, -11, 2.6], [34, -2.5, 0.9]].map(([x, z, h], i) => (
        <RigidBody key={i} type="fixed" colliders={false} position={[x, 0, z]} userData={STONE_DATA}>
          <CylinderCollider args={[h / 2, 0.5]} position={[0, h / 2, 0]} />
          <mesh position={[0, h / 2, 0]} rotation={[0, 0, i % 2 ? 0.06 : -0.04]} castShadow receiveShadow>
            <cylinderGeometry args={[0.45, 0.55, h, 9]} />
            <Toon color="#C9B99A" tex="stone" />
            <Ink thickness={0.02} />
          </mesh>
        </RigidBody>
      ))}
      {/* low broken walls on each side of the gate */}
      {[[26.2, 4.4], [35.8, 4.4]].map(([x, len]) => (
        <RigidBody key={x} type="fixed" colliders={false} userData={STONE_DATA}>
          <CuboidCollider args={[len / 2, 0.8, 0.35]} position={[x, 0.8, SUN_GATE.z]} />
          <mesh position={[x, 0.8, SUN_GATE.z]} castShadow receiveShadow>
            <boxGeometry args={[len, 1.6, 0.7]} />
            <Toon color="#BFAE8E" tex="stone" />
            <Ink thickness={0.02} />
          </mesh>
        </RigidBody>
      ))}
      {/* the inscription stone */}
      <mesh position={[31, 0.7, -11.2]} castShadow>
        <boxGeometry args={[1.0, 1.4, 0.3]} />
        <Toon color="#B8A88A" tex="stone" />
        <Ink thickness={0.02} />
      </mesh>
      {/* the pedestal behind the gate */}
      <mesh position={[31, 0.45, -17.2]} castShadow>
        <cylinderGeometry args={[0.4, 0.5, 0.9, 10]} />
        <Toon color="#C9B99A" tex="stone" />
      </mesh>
    </group>
  );
}

function Lookout() {
  const steps = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ z: LOOKOUT.z1 + 5.75 - i * 0.5, h: (i + 1) * 0.25 })), []);
  return (
    <group>
      <TerraceBox x0={LOOKOUT.x0} x1={LOOKOUT.x1} z0={LOOKOUT.z0} z1={LOOKOUT.z1} h={LOOKOUT.h} />
      {steps.map((s, i) => <StepBlock key={i} x={43.5} z={s.z} h={s.h} w={3} d={0.5} />)}
      <Banner x={46.8} z={-36.6} icon="🌬️" cloth="#4F7A8C" />
      {/* the scouts' spyglass on its stand */}
      <group position={[45.6, LOOKOUT.h, -36.4]}>
        <mesh position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.04, 0.05, 1.1, 6]} />
          <Toon color="#5A4032" />
        </mesh>
        <mesh position={[0, 1.15, 0.1]} rotation={[Math.PI / 2 - 0.3, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.09, 0.6, 10]} />
          <Toon color="#C9A227" />
        </mesh>
      </group>
    </group>
  );
}

// ── Interactive things (per visit or saved) ──────────────────────────────────

function Herbs() {
  const picked = useVisit((s) => s.herbs);
  const last = useRef(0);
  useFrame(() => {
    if (!inZone() || useGameStore.getState().phase !== 'playing') return;
    const t = now();
    if (t - last.current < 0.1) return;
    last.current = t;
    const l = local();
    HERB_SPOTS.forEach(([x, z], i) => {
      if (useVisit.getState().herbs.includes(i) || Math.hypot(l.x - x, l.z - z) > 1.0 || playerPosition.y > 1.6) return;
      useVisit.setState((s) => ({ herbs: [...s.herbs, i] }));
      run(WILD_CODE_ACTIONS.erva);
      emit({ type: 'sfx', name: 'item' });
      spawnParticles('sparkle', [playerPosition.x, playerPosition.y, playerPosition.z], 8, '#B6F27A');
    });
  });
  return (
    <group>
      {HERB_SPOTS.map(([x, z], i) =>
        picked.includes(i) ? null : (
          <group key={i} position={[x, 0, z]}>
            {[0, 1.3, 2.6, 3.9].map((a) => (
              <mesh key={a} position={[Math.cos(a) * 0.12, 0.18, Math.sin(a) * 0.12]} rotation={[Math.cos(a) * 0.6, a, Math.sin(a) * 0.6]}>
                <sphereGeometry args={[0.1, 6, 5]} />
                <Toon color="#9BE37A" emissive="#B6F27A" emissiveIntensity={0.6} />
              </mesh>
            ))}
          </group>
        ),
      )}
    </group>
  );
}

function Campfire() {
  const [x, , z] = CAMPFIRE.at;
  useSpot('fogueira_acampamento', CAMPFIRE.at, CAMPFIRE.reach, () => (inZone() ? 'Descansar na fogueira' : null), () => {
    const h = useHearts.getState();
    refillHearts();
    emit({ type: 'sfx', name: 'purr' });
    toast('🔥', h.hearts < h.max ? 'Shinichi se aquece perto do fogo... corações cheios!' : 'Quentinho. Os corações já estão cheios.');
  }, 1.4);
  return <FireRing x={x - OX} z={z - OZ} lit />;
}

function BridgeRepair() {
  useSpot('ponte_corda', BRIDGE_REPAIR, 1.6, () => {
    if (!inZone() || flag('ponte_consertada')) return null;
    return (useGameStore.getState().progress.inventory.corda_ninja ?? 0) > 0 ? 'Amarrar a ponte com a Corda Ninja' : 'Olhar a ponte quebrada';
  }, () => {
    if ((useGameStore.getState().progress.inventory.corda_ninja ?? 0) > 0) {
      run(WILD_CODE_ACTIONS.ponte);
      toast('🪢', 'Nó de marinheiro, nó de ninja... a ponte está firme de novo!');
    } else {
      emit({ type: 'sfx', name: 'denied' });
      toast('🌉', 'Faltam tábuas no meio. Com uma Corda Ninja dá para amarrar (o Armazém do Boku vende). Por enquanto, as pedras do rio, mais ao norte.');
    }
  });
  return null;
}

function Crystals() {
  const taken = useGameStore((s) => CRYSTALS.map((_, i) => !!s.progress.flags[`cristal_${i}`]).join(''));
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const on = abilityState.faroUntil > now();
    group.current?.children.forEach((c, i) => {
      c.visible = on;
      c.rotation.y = clock.elapsedTime * 0.6 + i;
    });
  });
  return (
    <group ref={group}>
      {CRYSTALS.map(([x, z], i) => (taken[i] === 't' ? <group key={i} /> : <Crystal key={i} i={i} x={x} z={z} />))}
    </group>
  );
}

function Crystal({ i, x, z }: { i: number; x: number; z: number }) {
  useSpot(`cristal_${i}`, w(x, z), 1.5, () => (inZone() && abilityState.faroUntil > now() ? 'Colher o Cristal da Névoa' : null), () => {
    run(`FLAG:cristal_${i};${WILD_CODE_ACTIONS.cristal}`);
    emit({ type: 'sfx', name: 'gem' });
    spawnParticles('sparkle', [OX + x, 0.6, OZ + z], 14, '#9FE8FF');
  });
  return (
    <group position={[x, 0, z]} userData={{ dynamic: true }}>
      {[[0, 0.5, 0, 0.9], [0.22, 0.32, 0.1, 0.55], [-0.2, 0.28, -0.08, 0.5]].map(([px, py, pz, h], k) => (
        <mesh key={k} position={[px, py, pz]} rotation={[0.2 * k, 0, 0.25 * (k - 1)]}>
          <octahedronGeometry args={[h * 0.35, 0]} />
          <meshToonMaterial color="#9FE8FF" emissive="#5FC8F0" emissiveIntensity={0.9} gradientMap={getGradient()} />
        </mesh>
      ))}
    </group>
  );
}

/** Hissui's snares: hidden in the leaves (glowing red with the Faro). Saved once disarmed. */
function Traps() {
  const disarmed = useGameStore((s) => TRAPS.map((_, i) => !!s.progress.flags[`armadilha_${i}`]).join(','));
  const sprung = useVisit((s) => s.sprung);
  const glow = useRef<THREE.Group>(null);
  useFrame(() => {
    const on = abilityState.faroUntil > now();
    glow.current?.children.forEach((c) => (c.visible = on));
    if (!inZone() || useGameStore.getState().phase !== 'playing') return;
    const l = local();
    TRAPS.forEach(([x, z], i) => {
      if (useGameStore.getState().progress.flags[`armadilha_${i}`] || useVisit.getState().sprung.includes(i)) return;
      if (Math.hypot(l.x - x, l.z - z) > TRAP.trigger || playerPosition.y > 1.2) return;
      useVisit.setState((s) => ({ sprung: [...s.sprung, i] }));
      abilityState.stuckUntil = now() + TRAP.stuck;
      hurtPlayer(1, OX + x + 0.01, OZ + z);
      toast('🪤', 'SNAP! Uma armadilha do Hissui prendeu a pata. Com o Faro, elas brilham; agachado, dá para desarmar.');
    });
  });
  const off = disarmed.split(',');
  return (
    <group>
      {TRAPS.map(([x, z], i) => (off[i] === 'true' ? null : <Trap key={i} i={i} x={x} z={z} sprung={sprung.includes(i)} />))}
      <group ref={glow}>
        {TRAPS.map(([x, z], i) =>
          off[i] === 'true' || sprung.includes(i) ? null : (
            <mesh key={i} position={[x, 0.05, z]} rotation={[-Math.PI / 2, 0, 0]} userData={{ dynamic: true }}>
              <ringGeometry args={[0.45, 0.62, 20]} />
              <meshBasicMaterial color="#FF5A4A" transparent opacity={0.85} />
            </mesh>
          ),
        )}
      </group>
    </group>
  );
}

function Trap({ i, x, z, sprung }: { i: number; x: number; z: number; sprung: boolean }) {
  useSpot(`armadilha_${i}`, w(x, z), TRAP.disarm, () => {
    if (!inZone()) return null;
    return playerMotion.crouch ? 'Desarmar a armadilha' : 'Armadilha! Agache (C) para desarmar';
  }, () => {
    if (!playerMotion.crouch) {
      toast('🪤', 'Devagar... agachado (C) dá para soltar a corda sem disparar.');
      return;
    }
    run(`FLAG:armadilha_${i};${WILD_CODE_ACTIONS.armadilha}`);
    toast('🪤', 'Armadilha desarmada. O Hissui vai ficar sem jantar de coelho.');
  });
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[sprung ? 0.25 : 0.42, 0.025, 5, 16]} />
        <Toon color="#B5A07A" />
      </mesh>
      {[0, 2.1, 4.2].map((a) => (
        <mesh key={a} position={[Math.cos(a) * 0.5, 0.12, Math.sin(a) * 0.5]}>
          <cylinderGeometry args={[0.025, 0.03, 0.24, 5]} />
          <Toon color="#6E4E36" />
        </mesh>
      ))}
      {[0, 1, 2, 3].map((k) => (
        <mesh key={k} position={[Math.cos(k * 1.7) * 0.25, 0.04, Math.sin(k * 1.7) * 0.25]} rotation={[-Math.PI / 2, 0, k]}>
          <circleGeometry args={[0.13, 5]} />
          <Toon color={k % 2 ? '#8C6A3A' : '#A07A3E'} />
        </mesh>
      ))}
    </group>
  );
}

// the ruins' four stones (systems/orderPuzzle.ts)
const useSun = create<{ pulled: string[]; set: (p: string[]) => void }>((set) => ({ pulled: [], set: (pulled) => set({ pulled }) }));

function SunStone({ piece }: { piece: string }) {
  const def = SUN_STONES[piece];
  const tex = useIconTexture(def.icon, '#E9DCC0', '#3A2E22');
  const down = useSun((s) => s.pulled.includes(piece));
  const open = useGameStore((s) => !!s.progress.flags.portao_sol_aberto);
  const [x, z] = def.at;
  useSpot(`pedra_${piece}`, w(x, z), 1.3, () => (inZone() && !open && !useSun.getState().pulled.includes(piece) ? `Tocar a pedra ${def.of}` : null), () => {
    const p = useGameStore.getState().progress;
    if (!p.missions.ruinas?.steps.includes('inscricao')) {
      toast('🌞', p.missions.ruinas ? 'Quatro pedras com desenhos... leia a inscrição do portão antes.' : 'Pedras antigas com desenhos de céu. O Bento, no acampamento, ia adorar ver isto.');
      return;
    }
    const r = pressOrder(SUN_PUZZLE, useSun.getState().pulled, piece);
    if (r.result === 'repeat') return;
    if (r.result === 'progress') {
      emit({ type: 'sfx', name: 'mechanism' });
      useSun.getState().set(r.pulled);
      return;
    }
    if (r.result === 'wrong') {
      const broke = brokenRule(SUN_PUZZLE, r.attempt);
      emit({ type: 'sfx', name: 'challenge_wrong' });
      useGameStore.getState().recordPractice('logica', false);
      useSun.getState().set([]);
      toast('🌞', `As pedras voltaram a subir. Esta parte da inscrição não bateu: "${broke?.text ?? ''}"`);
      return;
    }
    useSun.getState().set(r.pulled);
    run(WILD_CODE_ACTIONS.sol);
    toast('🌞', 'Um estrondo de pedra: o Portão do Sol está abrindo!');
  }, 1.6);
  const sunk = down || open;
  return (
    <group position={[x, sunk ? -0.18 : 0, z]}>
      <RigidBody type="fixed" colliders={false} userData={STONE_DATA}>
        <CuboidCollider args={[0.42, 0.55, 0.2]} position={[0, 0.55, 0]} />
      </RigidBody>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.85, 1.1, 0.4]} />
        <Toon color={sunk ? '#E2C97A' : '#BFAE8E'} tex="stone" emissive={sunk ? '#E2B84E' : undefined} emissiveIntensity={sunk ? 0.3 : 0} />
        <Ink thickness={0.015} />
      </mesh>
      <mesh position={[0, 0.7, 0.21]}>
        <planeGeometry args={[0.66, 0.66]} />
        <meshBasicMaterial map={tex} transparent />
      </mesh>
    </group>
  );
}

function SunGate() {
  const open = useGameStore((s) => !!s.progress.flags.portao_sol_aberto);
  const door = useRef<THREE.Mesh>(null);
  useFrame((_s, d) => {
    if (door.current) door.current.position.y += ((open ? -1.6 : 1.7) - door.current.position.y) * Math.min(1, d * 1.5);
  });
  return (
    <group position={[SUN_GATE.x, 0, SUN_GATE.z]}>
      {[-2, 2].map((x) => (
        <RigidBody key={x} type="fixed" colliders={false} userData={STONE_DATA}>
          <CylinderCollider args={[2, 0.55]} position={[x, 2, 0]} />
          <mesh position={[x, 2, 0]} castShadow>
            <cylinderGeometry args={[0.5, 0.6, 4, 10]} />
            <Toon color="#C9B99A" tex="stone" />
            <Ink thickness={0.02} />
          </mesh>
        </RigidBody>
      ))}
      <mesh position={[0, 4.15, 0]} castShadow>
        <boxGeometry args={[5.4, 0.5, 0.8]} />
        <Toon color="#B8A88A" tex="stone" />
        <Ink thickness={0.02} />
      </mesh>
      <mesh position={[0, 4.15, 0.41]}>
        <circleGeometry args={[0.32, 16]} />
        <Toon color="#E2B84E" emissive="#E2B84E" emissiveIntensity={open ? 0.6 : 0.1} />
      </mesh>
      <RigidBody key={open ? 'open' : 'closed'} type="fixed" colliders={false}>
        {!open && <CuboidCollider args={[1.45, 1.7, 0.2]} position={[0, 1.7, 0]} />}
      </RigidBody>
      <mesh ref={door} position={[0, 1.7, 0]} castShadow userData={{ dynamic: true }}>
        <boxGeometry args={[2.9, 3.4, 0.35]} />
        <Toon color="#A8987A" tex="stone" />
        <Ink thickness={0.02} />
      </mesh>
    </group>
  );
}

/** The kit in the thorn bush (mission "O Filhote nos Espinhos"). */
function KitBush() {
  const freed = useGameStore((s) => !!s.progress.missions.filhote?.steps.includes('soltar'));
  const [hop, setHop] = useState(0);
  const kit = useRef<THREE.Group>(null);
  useFrame((_s, d) => {
    if (!kit.current || !hop) return;
    kit.current.position.x -= d * 2.2;
    kit.current.position.y = Math.abs(Math.sin(now() * 9)) * 0.35;
    if (kit.current.position.x < -6) kit.current.visible = false;
  });
  const hedgehogNear = () => combatWorld.enemies.some((e) => e.kind === 'ourico' && isActive(e) && Math.hypot(e.x - (OX + KIT_BUSH.at[0]), e.z - (OZ + KIT_BUSH.at[1])) < KIT_BUSH.clear);
  useSpot('arbusto_filhote', w(KIT_BUSH.at[0] + 0.9, KIT_BUSH.at[1]), 1.5, () => {
    if (!inZone() || freed) return null;
    const active = useGameStore.getState().progress.missions.filhote?.status === 'active';
    if (!active) return 'Olhar o arbusto de espinhos';
    return hedgehogNear() ? 'Soltar o filhote (ouriços perto demais!)' : 'Soltar o filhote dos espinhos';
  }, () => {
    const active = useGameStore.getState().progress.missions.filhote?.status === 'active';
    if (!active) {
      toast('🐇', 'Um filhote de coelho preso nos espinhos, tremendo. A Doutora Momo, no acampamento, saberia o que fazer.');
      return;
    }
    if (hedgehogNear()) {
      emit({ type: 'sfx', name: 'denied' });
      toast('🦔', 'Com os ouriços tão perto, o filhote não para de tremer. Afaste-os: barulho longe (shuriken nas pedras), paciência ou a patada.');
      return;
    }
    run(WILD_CODE_ACTIONS.filhote);
    setHop(1);
    toast('🐇', 'Galho por galho, com cuidado... livre! O filhote sai saltitando para a toca.');
  });
  const [bx, bz] = KIT_BUSH.at;
  return (
    <group position={[bx, 0, bz]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.5, 0.6]} position={[0, 0.5, 0]} />
      </RigidBody>
      {[[0, 0.5, 0, 0.7], [0.4, 0.4, 0.3, 0.5], [-0.35, 0.38, 0.25, 0.5], [0.1, 0.8, -0.2, 0.45]].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <sphereGeometry args={[r, 9, 7]} />
          <Toon color={i % 2 ? '#3E6A3A' : '#4A7A42'} />
        </mesh>
      ))}
      {Array.from({ length: 10 }, (_, i) => {
        const a = i * 0.63;
        return (
          <mesh key={`t${i}`} position={[Math.cos(a) * 0.68, 0.45 + (i % 3) * 0.15, Math.sin(a) * 0.68]} rotation={[0, -a, Math.PI / 2]}>
            <coneGeometry args={[0.03, 0.16, 4]} />
            <Toon color="#D9C9A0" />
          </mesh>
        );
      })}
      {!freed || hop ? (
        <group ref={kit} position={[0.62, 0, 0.1]}>
          <mesh position={[0, 0.16, 0]}>
            <sphereGeometry args={[0.15, 10, 8]} />
            <Toon color="#E9E3DA" />
          </mesh>
          <mesh position={[0.12, 0.26, 0]}>
            <sphereGeometry args={[0.09, 9, 7]} />
            <Toon color="#E9E3DA" />
          </mesh>
          {[-0.04, 0.04].map((z) => (
            <mesh key={z} position={[0.12, 0.4, z]} rotation={[z * 4, 0, -0.2]}>
              <capsuleGeometry args={[0.025, 0.12, 3, 6]} />
              <Toon color="#F2D9D9" />
            </mesh>
          ))}
        </group>
      ) : null}
    </group>
  );
}

/** Bento up the cherry tree: shake the trunk once his guard has gone. */
function BentoTree() {
  const at = w(BENTO_TREE.x - 1.0, BENTO_TREE.z);
  const guardNear = () => combatWorld.enemies.some((e) => e.id === 'ourico_bento' && isActive(e) && Math.hypot(e.x - (OX + BENTO_TREE.x), e.z - (OZ + BENTO_TREE.z)) < BENTO_GUARD_CLEAR);
  useSpot('tronco_bento', at, 1.5, () => {
    if (!inZone() || !stepDone('explorador', 'achar') || stepDone('explorador', 'descer')) return null;
    return guardNear() ? 'Sacudir o tronco (o ouriço está de guarda!)' : 'Sacudir o tronco para o Bento descer';
  }, () => {
    if (guardNear()) {
      emit({ type: 'sfx', name: 'denied' });
      toast('🦔', '"Nem pensar! Esse ouriço está bem aí embaixo!" Afaste-o primeiro: barulho longe, paciência ou a patada (espere ele ficar tonto).');
      return;
    }
    run(WILD_CODE_ACTIONS.bento);
    spawnParticles('leaf', [OX + BENTO_TREE.x + 0.9, 2.4, OZ + BENTO_TREE.z], 18);
    toast('🍃', 'O Bento escorrega pelo tronco... e cai sentado num monte de folhas. "Planejado!", ele diz. Ele volta correndo para o acampamento.');
  });
  return null;
}

/** The gusts on the lookout steps: without the Capa Corta-Vento they push the cat back down. */
function Wind() {
  const told = useRef(0);
  const streaks = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    streaks.current?.children.forEach((m, i) => {
      m.position.x = WIND_ZONE.x0 + ((clock.elapsedTime * 7 + i * 1.9) % (WIND_ZONE.x1 - WIND_ZONE.x0));
    });
    if (!inZone() || useGameStore.getState().phase !== 'playing') return;
    const l = local();
    if (l.x < WIND_ZONE.x0 || l.x > WIND_ZONE.x1 || l.z < WIND_ZONE.z0 || l.z > WIND_ZONE.z1) return;
    const hasCape = (useGameStore.getState().progress.inventory.capa_vento ?? 0) > 0;
    const t = now();
    if (!hasCape) {
      abilityState.knock.set(0, 0, 7);
      abilityState.knockUntil = t + 0.12;
    }
    if (t - told.current > 6) {
      told.current = t;
      toast('🌬️', hasCape
        ? 'Uma rajada! A Capa Corta-Vento segura firme. Pode subir.'
        : 'Uma rajada empurra o Shinichi escada abaixo! Só com a Capa Corta-Vento (o Armazém do Boku vende).');
    }
  });
  return (
    <group ref={streaks}>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[WIND_ZONE.x0, 0.8 + (i % 4) * 0.7, WIND_ZONE.z0 + 0.6 + i * 0.75]} rotation={[0, 0, Math.PI / 2]} userData={{ dynamic: true }}>
          <cylinderGeometry args={[0.015, 0.015, 1.4, 4]} />
          <meshBasicMaterial color="#FFFFFF" transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/** Checks done every few frames: past the boar, and the first-time tips for a few places. */
function Watch() {
  const said = useRef(new Set<string>());
  const last = useRef(0);
  useFrame(() => {
    if (!inZone() || useGameStore.getState().phase !== 'playing') return;
    const t = now();
    if (t - last.current < 0.25) return;
    last.current = t;
    const l = local();
    const p = useGameStore.getState().progress;
    if (p.missions.posto?.status === 'active' && p.missions.posto.steps.includes('ouvir') && !p.missions.posto.steps.includes('desfiladeiro')
      && l.z < CANYON_PASSED_Z && l.x > OUTPOST.x0 && l.x < OUTPOST.x1) {
      run(WILD_CODE_ACTIONS.desfiladeiro);
      toast('🥷', 'Do outro lado do desfiladeiro! Agora, as ordens na mesa do posto.');
    }
    const tip = (id: string, cond: boolean, icon: string, text: string) => {
      if (!cond || said.current.has(id)) return;
      said.current.add(id);
      toast(icon, text);
    };
    tip('caverna', l.x > CAVE.x0 && l.x < CAVE.x1 && l.z < CAVE.z1 - 1 && l.z > CAVE.z0, '🌫️', 'Névoa grossa... dizem que só o Faro (Q) enxerga o que tem aqui dentro.');
    tip('desfiladeiro', l.x > CANYON.x0 && l.x < CANYON.x1 && l.z < CANYON.z1 - 1 && l.z > CANYON.z1 - 4, '🐗', 'Um ronco que faz tremer as pedras... Agachado (C), passos de ninja.');
  });
  useEffect(() => useZone.subscribe((s, prev) => {
    if (s.zone !== prev.zone) said.current.clear();
  }), []);
  return null;
}

export function WildRegion() {
  const active = useZone((s) => s.zone === 'selvagem');
  // a new visit: the herbs grow back and the snares are set again
  useEffect(() => useZone.subscribe((s, prev) => {
    if (s.zone === 'selvagem' && prev.zone !== 'selvagem') {
      useVisit.getState().reset();
      useSun.getState().set([]);
    }
  }), []);
  return (
    <>
      <group position={[OX, 0, OZ]} visible={active}>
        <StaticMerge>
          <Trails />
          <Forest />
          {WILD_WALLS.map((wl, i) => <Wall key={i} wl={wl} />)}
          <Camp />
          <Clearing />
          <Outpost />
          <AbandonedCamp />
          <Cave />
          <Ruins />
          <Lookout />
        </StaticMerge>
        <WildGround />
        <River />
        <Waterfall />
        <RopeBridge />
        <Herbs />
        <Crystals />
        <CaveMist />
        <Traps />
        {Object.keys(SUN_STONES).map((p) => <SunStone key={p} piece={p} />)}
        <SunGate />
        <KitBush />
        <Wind />
        <Campfire />
      </group>
      <BridgeRepair />
      <BentoTree />
      <Watch />
    </>
  );
}
