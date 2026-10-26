import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { Toon, Ink, windTime } from '../materials';
import { getPuffGeometry } from '../foliageGeometry';
import { House, PaperLantern } from './Buildings';
import { SakuraTree, PineTree, Bamboo, MapleTree, StoneLantern } from './Props';
import { usePondMaterial } from './EastDistrict';
import { FenceLine, DistrictGate, Bench, TerraceBox, StepBlock } from './districtParts';
import { DistanceCull } from '../DistanceCull';
import { useGameStore } from '../../store/gameStore';
import { RIVER } from '../../data/world';
import {
  WEST_FENCE, WEST_GATE, CLEARING, HILL, JIZO_X, JIZO_Z, JIZO_PEBBLES, JIZO_NEXT, ONSEN, BOARDWALK, PIER,
  WEST_HOUSES, WEST_TREES, bambooClumps,
} from '../../data/west';
import { Rock } from './Rock';

/**
 * Bambuzal das Águas Quentes (art audit §26). Static scenery goes through StaticMerge; the moving parts
 * (water, steam, boat, heron, dragonflies, the fifth pebble pile) mark themselves dynamic.
 */

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const STONE = '#A8A196';
const STONE_DARK = '#8E877C';
const WOOD = '#6A4630';
const PLANK = '#9B7048';

// ── Jizō hill ───────────────────────────────────────────────────────────────

/** Jizō body: a monk's robe silhouette (lathe): wide hem, round shoulders, a short neck. */
let jizoBody: THREE.LatheGeometry | null = null;
function getJizoBody() {
  if (jizoBody) return jizoBody;
  const prof: [number, number][] = [[0.0, 0.0], [0.21, 0.0], [0.23, 0.04], [0.22, 0.2], [0.2, 0.36], [0.17, 0.46], [0.11, 0.53], [0.07, 0.56], [0.0, 0.57]];
  jizoBody = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 18);
  return jizoBody;
}

function Jizo({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation={[0, Math.PI / 2, 0]} scale={1.45}>
      {/* a rough stone plinth */}
      <mesh position={[0, 0.07, 0]} rotation={[0, 0.3, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.27, 0.31, 0.14, 7]} />
        <Toon color={STONE_DARK} />
      </mesh>
      <mesh position={[0, 0.14, 0]} geometry={getJizoBody()} castShadow dispose={null}>
        <Toon color="#ADA699" />
        <Ink thickness={0.012} />
      </mesh>
      {/* round, bald head with long earlobes */}
      <mesh position={[0, 0.82, 0]} scale={[1, 1.06, 0.98]} castShadow>
        <sphereGeometry args={[0.135, 14, 12]} />
        <Toon color="#B4AD9F" />
        <Ink thickness={0.012} />
      </mesh>
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * 0.13, 0.78, 0]} scale={[0.35, 1, 0.5]}>
          <sphereGeometry args={[0.05, 8, 6]} />
          <Toon color="#ADA699" />
        </mesh>
      ))}
      {/* hands together in front of the chest */}
      <mesh position={[0, 0.5, 0.16]} scale={[0.8, 1.2, 0.7]}>
        <sphereGeometry args={[0.05, 8, 6]} />
        <Toon color="#B4AD9F" />
      </mesh>
      {/* red cloth bib and a knitted red cap */}
      <mesh position={[0, 0.62, 0.07]} rotation={[0.28, 0, 0]}>
        <coneGeometry args={[0.18, 0.2, 14, 1, true, -Math.PI * 0.45, Math.PI * 0.9]} />
        <Toon color="#D2402F" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.88, 0]} rotation={[-0.15, 0, 0]}>
        <sphereGeometry args={[0.14, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <Toon color="#C8382C" />
      </mesh>
      {/* closed, smiling eyes and a calm mouth */}
      {[-0.045, 0.045].map((x) => (
        <mesh key={x} position={[x, 0.83, 0.125]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.018, 0.005, 4, 8, Math.PI]} />
          <Toon color="#4A4440" />
        </mesh>
      ))}
      <mesh position={[0, 0.775, 0.128]} rotation={[0, 0, -Math.PI / 2]}>
        <torusGeometry args={[0.02, 0.004, 4, 8, Math.PI]} />
        <Toon color="#4A4440" />
      </mesh>
    </group>
  );
}

/** A little cairn of n pebbles: a spiral that stacks as it grows, so the count stays easy to read. */
function PebblePile({ position, n }: { position: [number, number, number]; n: number }) {
  const stones = useMemo(() => {
    const out: [number, number, number][] = [];
    let row = 0;
    let inRow = 0;
    let cap = 1;
    // rows of 1, 2, 3, 4, 5 laid out flat in a triangle, so a child can count them row by row
    for (let i = 0; i < n; i++) {
      out.push([(inRow - (cap - 1) / 2) * 0.13, 0.05, row * 0.12]);
      inRow++;
      if (inRow === cap) { row++; cap++; inRow = 0; }
    }
    return out;
  }, [n]);
  return (
    <group position={position} rotation={[0, Math.PI / 2, 0]}>
      {stones.map((p, i) => (
        <Rock key={i} variant={i % 4} kind="pebble" contact={false} position={p} scale={[0.055, 0.05, 0.055]} color={i % 2 ? '#C8C1B3' : '#9C9488'} castShadow />
      ))}
    </group>
  );
}

function FifthPile() {
  const done = useGameStore((s) => !!s.progress.flags.jizo_completo);
  if (!done) return null;
  return (
    <group userData={{ dynamic: true }}>
      <PebblePile position={[JIZO_X + 0.75, HILL.levels[2].h, JIZO_Z[4]]} n={JIZO_NEXT} />
    </group>
  );
}

function JizoHill() {
  const { x0, z0, z1, levels, stepZ } = HILL;
  const top = levels[levels.length - 1].h;
  return (
    <group>
      {levels.map((lv, i) => (
        <group key={i}>
          <TerraceBox x0={x0} x1={lv.x1} z0={z0} z1={z1} h={lv.h} />
          {/* the step in front of each rise, on the trail side (east) */}
          <StepBlock x={lv.x1 + 0.24} z={stepZ} h={lv.h - 0.25} w={0.48} d={1.1} />
        </group>
      ))}
      {JIZO_Z.map((z, i) => (
        <group key={i}>
          <Jizo position={[JIZO_X, top, z]} />
          {i < JIZO_PEBBLES.length && <PebblePile position={[JIZO_X + 0.75, top, z]} n={JIZO_PEBBLES[i]} />}
        </group>
      ))}
      <StoneLantern position={[levels[2].x1 - 0.5, top, z0 + 0.8]} />
      <StoneLantern position={[levels[2].x1 - 0.5, top, z1 - 0.8]} />
      <HillDressing />
    </group>
  );
}

/**
 * Softens the terraces: azalea and box shrubs along the ends and the front lip of each level, boulders at
 * the corners, so the hill reads as a garden slope and not a flight of stairs.
 */
function HillDressing() {
  const items = useMemo(() => {
    const r = seeded(4343);
    const shrubs: { p: [number, number, number]; s: number; c: string }[] = [];
    const rocks: { p: [number, number, number]; s: number; rot: number }[] = [];
    const { x0, z0, z1, levels, stepZ } = HILL;
    levels.forEach((lv, i) => {
      // along both ends of the visible strip of this level (the next level covers the rest)
      const xa = i === levels.length - 1 ? x0 + 0.4 : levels[i + 1].x1 + 0.4;
      const xb = lv.x1 - 0.35;
      for (const zEdge of [z0 + 0.45, z1 - 0.45]) {
        for (let x = xa; x <= xb; x += 0.75) {
          const c = r() > 0.55 ? (r() > 0.5 ? '#F49AB8' : '#E8A0D8') : r() > 0.5 ? '#4F8A44' : '#5E9A4A';
          shrubs.push({ p: [x, lv.h, zEdge + (r() - 0.5) * 0.2], s: 0.3 + r() * 0.12, c });
        }
      }
      // a few shrubs along the front lip, leaving the steps clear
      for (let z = z0 + 1.2; z < z1 - 1.0; z += 1.6) {
        if (Math.abs(z - stepZ) < 1.1) continue;
        shrubs.push({ p: [lv.x1 - 0.3, lv.h, z + (r() - 0.5) * 0.4], s: 0.24 + r() * 0.1, c: r() > 0.6 ? '#F49AB8' : '#5E9A4A' });
      }
      // corner boulders at the foot of each rise
      for (const zc of [z0 + 0.15, z1 - 0.15]) {
        rocks.push({ p: [lv.x1 - 0.1, (i ? levels[i - 1].h : 0) + 0.18, zc], s: 0.32 + r() * 0.15, rot: r() * 6 });
      }
    });
    return { shrubs, rocks };
  }, []);
  return (
    <>
      {items.shrubs.map((b, i) => (
        <mesh key={i} position={[b.p[0], b.p[1] + b.s * 0.5, b.p[2]]} scale={[b.s * 1.2, b.s, b.s * 1.2]} rotation={[0, i * 1.3, 0]} geometry={getPuffGeometry(i, 'tiny')} dispose={null}>
          <Toon color={b.c} vertexColors />
        </mesh>
      ))}
      {items.rocks.map((b, i) => (
        <Rock key={i} variant={i % 6} moss={i % 3 === 0} position={b.p} rotation={[0.15, b.rot, 0.1]} scale={[b.s * 1.3, b.s, b.s * 1.1]} color={i % 2 ? '#8E8E84' : '#7A7B72'} castShadow />
      ))}
    </>
  );
}

// ── Hot spring ──────────────────────────────────────────────────────────────

/** Soft round puff texture for the steam sprites (painted once). */
let steamTex: THREE.CanvasTexture | null = null;
function getSteamTexture() {
  if (steamTex) return steamTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, 'rgba(255,255,255,0.85)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  steamTex = new THREE.CanvasTexture(c);
  return steamTex;
}

function Steam() {
  const group = useRef<THREE.Group>(null);
  const puffs = useMemo(() => {
    const r = seeded(321);
    return Array.from({ length: 9 }).map(() => ({ x: (r() - 0.5) * ONSEN.rx * 1.4, z: (r() - 0.5) * ONSEN.rz * 1.4, phase: r(), speed: 0.12 + r() * 0.08, s: 0.8 + r() * 0.7 }));
  }, []);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.children.forEach((m, i) => {
      const p = puffs[i];
      const t = (windTime.value * p.speed + p.phase) % 1;
      m.position.set(ONSEN.x + p.x + Math.sin(t * 6 + i) * 0.15, 0.2 + t * 2.0, ONSEN.z + p.z);
      const k = p.s * (0.9 + t * 1.3);
      m.scale.set(k, k, k);
      ((m as THREE.Sprite).material as THREE.SpriteMaterial).opacity = Math.sin(t * Math.PI) * 0.6;
    });
  });
  const mats = useMemo(() => puffs.map(() => new THREE.SpriteMaterial({ map: getSteamTexture(), transparent: true, depthWrite: false, opacity: 0.3 })), [puffs]);
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  return (
    <group ref={group} userData={{ dynamic: true }}>
      {puffs.map((_, i) => (
        <sprite key={i} material={mats[i]} />
      ))}
    </group>
  );
}

function Onsen() {
  const water = usePondMaterial('#D2F2EA', '#6FB7C2');
  const rim = useMemo(() => {
    const r = seeded(91);
    return Array.from({ length: 26 }).map((_, i) => {
      const a = (i / 26) * Math.PI * 2 + r() * 0.1;
      const k = 1.03 + r() * 0.06;
      return { p: [ONSEN.x + Math.cos(a) * ONSEN.rx * k, 0.12, ONSEN.z + Math.sin(a) * ONSEN.rz * k] as [number, number, number], s: 0.3 + r() * 0.2, rot: r() * 6 };
    });
  }, []);
  return (
    <group>
      <mesh position={[ONSEN.x, 0.05, ONSEN.z]} rotation={[-Math.PI / 2, 0, 0]} scale={[ONSEN.rx, ONSEN.rz, 1]} userData={{ dynamic: true }}>
        <circleGeometry args={[1, 40]} />
        <primitive object={water} attach="material" />
      </mesh>
      {rim.map((s, i) => (
        <Rock key={i} variant={i % 5} kind="flat" position={s.p} rotation={[0, s.rot, 0]} scale={[s.s * 1.3, s.s, s.s]} color={i % 3 ? '#8E877C' : '#77706A'} castShadow receiveShadow />
      ))}
      {/* bamboo spout pouring into the pool, and the falling stream */}
      <group position={[ONSEN.x + 0.6, 0, ONSEN.z - ONSEN.rz - 0.35]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 1.1, 8]} />
          <Toon color="#86BC4E" />
        </mesh>
        <mesh position={[0, 1.08, 0.25]} rotation={[Math.PI / 2 - 0.25, 0, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.6, 8]} />
          <Toon color="#9CCB5E" />
        </mesh>
        <mesh position={[0, 0.65, 0.52]}>
          <cylinderGeometry args={[0.02, 0.03, 0.85, 6]} />
          <meshBasicMaterial color="#DDF6FF" transparent opacity={0.7} />
        </mesh>
      </group>
      {/* buckets (red: hot, blue: cold) and a stool by the pool */}
      {[[0, '#C8463A'], [0.34, '#C8463A'], [0.17, '#3E7CC4']].map(([dx, c], i) => (
        <mesh key={i} position={[ONSEN.x + ONSEN.rx + 0.9 + (dx as number), i === 2 ? 0.48 : 0.15, ONSEN.z - 1.0]} castShadow>
          <cylinderGeometry args={[0.15, 0.12, 0.3, 10]} />
          <Toon color={c as string} />
          <Ink thickness={0.01} />
        </mesh>
      ))}
      <mesh position={[ONSEN.x + ONSEN.rx + 1.1, 0.4, ONSEN.z - 1.0]}>
        <boxGeometry args={[0.6, 0.05, 0.35]} />
        <Toon color={PLANK} tex="planks" />
      </mesh>
      {/* bamboo screen behind the pool */}
      <RigidBody type="fixed" colliders={false} position={[ONSEN.x, 0, ONSEN.z - ONSEN.rz - 1.0]}>
        <CuboidCollider args={[ONSEN.rx * 0.8, 0.8, 0.06]} position={[-0.6, 0.8, 0]} />
        {Array.from({ length: 22 }).map((_, i) => (
          <mesh key={i} position={[-0.6 - ONSEN.rx * 0.8 + i * ((ONSEN.rx * 1.6) / 21), 0.8, 0]} castShadow>
            <cylinderGeometry args={[0.045, 0.05, 1.6, 6]} />
            <Toon color={i % 3 ? '#9CBF5A' : '#86A84C'} />
          </mesh>
        ))}
        {[0.4, 1.3].map((y) => (
          <mesh key={y} position={[-0.6, y, 0.06]}>
            <boxGeometry args={[ONSEN.rx * 1.65, 0.05, 0.04]} />
            <Toon color={WOOD} />
          </mesh>
        ))}
      </RigidBody>
      <DistanceCull center={[ONSEN.x, 0, ONSEN.z]} far={28}>
        <Steam />
      </DistanceCull>
    </group>
  );
}

// ── Riverbank ───────────────────────────────────────────────────────────────

function Boardwalk() {
  const b = BOARDWALK;
  const p = PIER;
  const w = b.x1 - b.x0;
  const d = b.z1 - b.z0;
  const posts: [number, number][] = [];
  for (let x = b.x0 + 0.3; x <= b.x1 - 0.2; x += 2.0) posts.push([x, b.z1 - 0.1]);
  return (
    <group>
      <RigidBody type="fixed" colliders={false} userData={{ surface: 'wood' }}>
        <CuboidCollider args={[w / 2, b.h / 2, d / 2]} position={[(b.x0 + b.x1) / 2, b.h / 2, b.z0 + d / 2]} />
        <CuboidCollider args={[(p.x1 - p.x0) / 2, p.h / 2 + 0.2, (p.z1 - p.z0) / 2]} position={[(p.x0 + p.x1) / 2, p.h / 2 - 0.2, p.z0 + (p.z1 - p.z0) / 2]} />
      </RigidBody>
      <mesh position={[(b.x0 + b.x1) / 2, b.h - 0.04, b.z0 + d / 2]} castShadow receiveShadow>
        <boxGeometry args={[w, 0.08, d]} />
        <Toon color={PLANK} tex="planks" />
        <Ink thickness={0.015} />
      </mesh>
      <mesh position={[(p.x0 + p.x1) / 2, p.h - 0.04, p.z0 + (p.z1 - p.z0) / 2]} castShadow receiveShadow>
        <boxGeometry args={[p.x1 - p.x0, 0.08, p.z1 - p.z0]} />
        <Toon color={PLANK} tex="planks" />
        <Ink thickness={0.015} />
      </mesh>
      {/* stilts under the pier, standing in the water */}
      {[p.x0 + 0.1, p.x1 - 0.1].map((x) => [p.z0 + 1, p.z0 + 2, p.z1 - 0.1].map((z) => (
        <mesh key={`${x}${z}`} position={[x, p.h / 2 - 0.15, z]}>
          <cylinderGeometry args={[0.07, 0.07, p.h + 0.3, 6]} />
          <Toon color={WOOD} />
        </mesh>
      )))}
      {/* lantern posts along the river edge, skipping the pier mouth */}
      {posts.filter(([x]) => x < p.x0 - 0.4 || x > p.x1 + 0.4).map(([x, z], i) => (
        <group key={i}>
          <mesh position={[x, b.h + 0.45, z]} castShadow>
            <boxGeometry args={[0.1, 0.9, 0.1]} />
            <Toon color={WOOD} />
          </mesh>
          {i % 2 === 0 && <PaperLantern position={[x, b.h + 1.0, z]} color="#E0483A" />}
        </group>
      ))}
      {/* a fishing rod and a bucket at the end of the pier */}
      <mesh position={[p.x1 - 0.25, p.h + 0.45, p.z1 - 0.3]} rotation={[0.9, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.02, 1.6, 5]} />
        <Toon color="#5A4032" />
      </mesh>
      <mesh position={[p.x0 + 0.35, p.h + 0.15, p.z1 - 0.4]} castShadow>
        <cylinderGeometry args={[0.15, 0.12, 0.28, 10]} />
        <Toon color="#3E7CC4" />
        <Ink thickness={0.01} />
      </mesh>
    </group>
  );
}

/** Rowboat hull: an extruded boat outline (pointed bow, square stern) with a darker inside and two seats. */
function boatHull() {
  const sh = new THREE.Shape();
  sh.moveTo(-1.15, -0.32);
  sh.lineTo(0.55, -0.4);
  sh.quadraticCurveTo(1.15, -0.25, 1.35, 0);
  sh.quadraticCurveTo(1.15, 0.25, 0.55, 0.4);
  sh.lineTo(-1.15, 0.32);
  sh.lineTo(-1.15, -0.32);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.32, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 });
  g.rotateX(-Math.PI / 2); // extrude upward
  return g;
}

function Boat() {
  const ref = useRef<THREE.Group>(null);
  const hull = useMemo(() => boatHull(), []);
  useEffect(() => () => hull.dispose(), [hull]);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.rotation.x = Math.sin(windTime.value * 1.1) * 0.035;
    ref.current.position.y = -0.08 + Math.sin(windTime.value * 1.3) * 0.02;
  });
  return (
    <group position={[PIER.x1 + 1.3, 0, RIVER.z + 0.6]} rotation={[0, Math.PI / 2 + 0.12, 0]}>
      <group ref={ref} userData={{ dynamic: true }}>
        <mesh geometry={hull} castShadow>
          <Toon color="#8C5A3E" />
          <Ink thickness={0.015} />
        </mesh>
        <mesh position={[0.05, 0.33, 0]} scale={[1, 1, 0.82]}>
          <boxGeometry args={[2.0, 0.04, 0.6]} />
          <Toon color="#5E3E2A" />
        </mesh>
        {[-0.5, 0.35].map((x) => (
          <mesh key={x} position={[x, 0.36, 0]}>
            <boxGeometry args={[0.16, 0.05, 0.7]} />
            <Toon color={PLANK} tex="planks" />
          </mesh>
        ))}
        {/* an oar resting across the boat */}
        <mesh position={[-0.1, 0.42, 0.15]} rotation={[0, 0.4, Math.PI / 2]}>
          <cylinderGeometry args={[0.02, 0.02, 1.6, 5]} />
          <Toon color={WOOD} />
        </mesh>
      </group>
      {/* mooring rope to the pier */}
      <mesh position={[0.2, 0.3, -0.75]} rotation={[0.9, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 1.0, 4]} />
        <Toon color="#D9C9A8" />
      </mesh>
    </group>
  );
}

function Heron() {
  const head = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!head.current) return;
    // still, then a quick peck at the water every few seconds
    const t = windTime.value % 6;
    head.current.rotation.z = t > 5.2 ? Math.sin((t - 5.2) * Math.PI * 1.25) * 0.9 : 0;
  });
  return (
    <group position={[-35.6, 0.02, RIVER.z - 0.6]} rotation={[0, -0.6, 0]} userData={{ dynamic: true }}>
      {[-0.06, 0.06].map((z) => (
        <mesh key={z} position={[0, 0.3, z]}>
          <cylinderGeometry args={[0.012, 0.012, 0.6, 4]} />
          <Toon color="#3A3430" />
        </mesh>
      ))}
      <mesh position={[0, 0.72, 0]} scale={[1.5, 0.75, 0.75]} castShadow>
        <sphereGeometry args={[0.18, 12, 8]} />
        <Toon color="#F2F0EA" />
      </mesh>
      <group ref={head} position={[0.22, 0.8, 0]}>
        <mesh position={[0.06, 0.2, 0]} rotation={[0, 0, -0.3]}>
          <cylinderGeometry args={[0.025, 0.035, 0.42, 6]} />
          <Toon color="#F2F0EA" />
        </mesh>
        <mesh position={[0.14, 0.42, 0]}>
          <sphereGeometry args={[0.055, 10, 8]} />
          <Toon color="#F2F0EA" />
        </mesh>
        <mesh position={[0.28, 0.41, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.018, 0.22, 6]} />
          <Toon color="#E8B33A" />
        </mesh>
      </group>
    </group>
  );
}

/** Cattail and reed clumps along the bank (static). */
function Reeds() {
  const clumps = useMemo(() => {
    const r = seeded(515);
    const out: { x: number; z: number; n: number }[] = [];
    for (let x = WEST_FENCE.minX + 1; x < -20.4; x += 1.1 + r() * 1.4) {
      if (x > PIER.x0 - 0.8 && x < PIER.x1 + 3.2) continue; // the pier and the boat
      out.push({ x, z: RIVER.z - RIVER.halfWidth - 0.05 + r() * 0.35, n: 4 + Math.floor(r() * 4) });
    }
    return out;
  }, []);
  return (
    <>
      {clumps.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]}>
          {Array.from({ length: c.n }).map((_, k) => {
            const a = k * 2.3 + i;
            const h = 0.7 + ((k * 37 + i * 11) % 10) / 20;
            return (
              <group key={k} position={[Math.cos(a) * 0.18, 0, Math.sin(a) * 0.14]} rotation={[Math.sin(a) * 0.12, 0, Math.cos(a) * 0.12]}>
                <mesh position={[0, h / 2, 0]}>
                  <cylinderGeometry args={[0.012, 0.018, h, 4]} />
                  <Toon color={k % 2 ? '#6E9A44' : '#5A8A3C'} />
                </mesh>
                {k % 3 === 0 && (
                  <mesh position={[0, h - 0.05, 0]}>
                    <capsuleGeometry args={[0.03, 0.12, 2, 6]} />
                    <Toon color="#6E4A30" />
                  </mesh>
                )}
              </group>
            );
          })}
        </group>
      ))}
    </>
  );
}

/** Dragonflies darting over the hot spring and the river. */
function Dragonflies() {
  const group = useRef<THREE.Group>(null);
  const flies = useMemo(() => {
    const r = seeded(808);
    return Array.from({ length: 7 }).map((_, i) => ({
      cx: i < 3 ? ONSEN.x : -38 + r() * 14, cz: i < 3 ? ONSEN.z : RIVER.z - 1.2 + r() * 1.6,
      rx: 1 + r() * 1.5, rz: 0.6 + r() * 0.8, speed: 0.5 + r() * 0.5, phase: r() * 6, y: 0.6 + r() * 0.6,
      c: ['#3FA0E0', '#E8643A', '#7FC24A'][i % 3],
    }));
  }, []);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.children.forEach((d, i) => {
      const f = flies[i];
      // a figure-eight with little stops: dragonflies hover, then dart
      const t = windTime.value * f.speed + f.phase;
      const tt = t + Math.sin(t * 3) * 0.3;
      d.position.set(f.cx + Math.sin(tt) * f.rx, f.y + Math.sin(t * 2.1) * 0.12, f.cz + Math.sin(tt * 2) * f.rz);
      d.rotation.y = Math.atan2(Math.cos(tt) * f.rx, Math.cos(tt * 2) * f.rz * 2);
      const wing = d.children[1];
      if (wing) wing.rotation.z = Math.sin(windTime.value * 60 + i) * 0.5;
    });
  });
  return (
    <group ref={group} userData={{ dynamic: true }}>
      {flies.map((f, i) => (
        <group key={i}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.012, 0.008, 0.16, 4]} />
            <Toon color={f.c} />
          </mesh>
          <mesh position={[0, 0.01, 0.03]}>
            <boxGeometry args={[0.2, 0.004, 0.04]} />
            <meshBasicMaterial color="#E8F6FF" transparent opacity={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── Clearing, houses, trees, bamboo ─────────────────────────────────────────

function Clearing() {
  return (
    <group>
      {/* tsukubai: a stone water basin with a bamboo dipper */}
      <RigidBody type="fixed" colliders={false} position={[CLEARING.x - 1.2, 0, CLEARING.z - 1.9]}>
        <CylinderCollider args={[0.25, 0.42]} position={[0, 0.25, 0]} />
        <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.42, 0.46, 0.5, 10]} />
          <Toon color={STONE} />
          <Ink thickness={0.015} />
        </mesh>
        <mesh position={[0, 0.49, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.3, 16]} />
          <Toon color="#6FB7C2" emissive="#3E8C9E" emissiveIntensity={0.2} />
        </mesh>
        <mesh position={[0.15, 0.56, 0]} rotation={[0, 0, 0.2]}>
          <cylinderGeometry args={[0.015, 0.015, 0.5, 5]} />
          <Toon color="#9CCB5E" />
        </mesh>
      </RigidBody>
      <Bench position={[CLEARING.x + 0.4, 0, CLEARING.z + CLEARING.r + 0.6]} rotY={0} />
      <StoneLantern position={[-20.8, 0, 7.8]} />
    </group>
  );
}

function Trees() {
  const clumps = useMemo(() => bambooClumps().filter(([x, , z]) => WEST_TREES.every((t) => Math.hypot(t.pos[0] - x, t.pos[2] - z) > 2.4)), []);
  return (
    <>
      {clumps.map((p, i) => <Bamboo key={`b${i}`} position={p} seed={60 + i} />)}
      {WEST_TREES.map((t, i) => {
        const p = t.pos;
        switch (t.kind) {
          case 'sakura': return <SakuraTree key={i} position={p} scale={t.scale} seed={t.seed} detail="low" />;
          case 'maple': return <MapleTree key={i} position={p} scale={t.scale} seed={t.seed} />;
          case 'maple_green': return <MapleTree key={i} position={p} scale={t.scale} seed={t.seed} green />;
          case 'pine': return <PineTree key={i} position={p} scale={t.scale} detail="low" />;
          case 'bamboo': return <Bamboo key={i} position={p} seed={t.seed} />;
        }
        return null;
      })}
    </>
  );
}

/** Ferns and low shrubs at the foot of the bamboo, so the grove floor is not bare lawn. */
function GroveUndergrowth() {
  const shrubs = useMemo(() => {
    const r = seeded(919);
    return bambooClumps().map(([x, , z], i) => ({ x: x + (r() - 0.5) * 1.4, z: z + (r() - 0.5) * 1.4, s: 0.28 + r() * 0.18, c: i % 3 ? '#4F8A44' : '#5E9A4A' }));
  }, []);
  return (
    <>
      {shrubs.map((s, i) => (
        <mesh key={i} position={[s.x, s.s * 0.5, s.z]} scale={[s.s * 1.3, s.s, s.s * 1.3]} rotation={[0, i, 0]} geometry={getPuffGeometry(i, 'tiny')} dispose={null}>
          <Toon color={s.c} vertexColors />
        </mesh>
      ))}
    </>
  );
}

/** The far side of the river (out of reach): a line of trees and reeds, so the bank doesn't end in bare lawn. */
function FarBank() {
  const z = RIVER.z + RIVER.halfWidth;
  // two staggered rows, sizes and kinds mixed, so the bank doesn't read as a planted line
  const trees: { kind: 'pine' | 'maple' | 'sakura' | 'green'; x: number; dz: number; s: number }[] = [
    { kind: 'pine', x: -39.4, dz: 3.4, s: 1.15 }, { kind: 'maple', x: -36.0, dz: 1.8, s: 0.8 }, { kind: 'green', x: -33.2, dz: 4.6, s: 1.05 },
    { kind: 'sakura', x: -30.6, dz: 2.2, s: 0.85 }, { kind: 'pine', x: -27.6, dz: 5.2, s: 1.25 }, { kind: 'maple', x: -24.8, dz: 2.6, s: 0.95 },
    { kind: 'green', x: -21.8, dz: 4.2, s: 0.8 }, { kind: 'pine', x: -35.0, dz: 6.4, s: 1.0 }, { kind: 'sakura', x: -23.0, dz: 6.8, s: 1.0 },
  ];
  const { clumps, shrubs } = useMemo(() => {
    const r = seeded(2727);
    return {
      clumps: Array.from({ length: 14 }).map((_, i) => ({ x: -40.4 + i * 1.45 + r() * 0.6, z: z + 0.15 + r() * 0.25, n: 3 + Math.floor(r() * 4) })),
      shrubs: Array.from({ length: 12 }).map((_, i) => ({ x: -40 + i * 1.7 + r() * 0.8, z: z + 0.9 + r() * 1.6, s: 0.3 + r() * 0.25 })),
    };
  }, [z]);
  return (
    <>
      {trees.map((t, i) => {
        const p: [number, number, number] = [t.x, 0, z + t.dz];
        if (t.kind === 'pine') return <PineTree key={i} position={p} scale={t.s} detail="low" />;
        if (t.kind === 'sakura') return <SakuraTree key={i} position={p} scale={t.s} seed={50 + i} detail="low" />;
        return <MapleTree key={i} position={p} scale={t.s} seed={30 + i} green={t.kind === 'green'} />;
      })}
      {shrubs.map((b, i) => (
        <mesh key={i} position={[b.x, b.s * 0.5, b.z]} scale={[b.s * 1.4, b.s, b.s * 1.2]} rotation={[0, i, 0]} geometry={getPuffGeometry(i, 'tiny')} dispose={null}>
          <Toon color={i % 3 ? '#5E9A4A' : '#4F8A44'} vertexColors />
        </mesh>
      ))}
      {clumps.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]}>
          {Array.from({ length: c.n }).map((_, k) => {
            const a = k * 2.3 + i;
            const h = 0.6 + ((k * 37 + i * 11) % 10) / 22;
            return (
              <mesh key={k} position={[Math.cos(a) * 0.16, h / 2, Math.sin(a) * 0.12]} rotation={[Math.sin(a) * 0.15, 0, Math.cos(a) * 0.15]}>
                <cylinderGeometry args={[0.012, 0.018, h, 4]} />
                <Toon color={k % 2 ? '#6E9A44' : '#5A8A3C'} />
              </mesh>
            );
          })}
        </group>
      ))}
    </>
  );
}

export function WestDistrict() {
  return (
    <group>
      <FenceLine a={[WEST_GATE.x, WEST_FENCE.minZ]} b={[WEST_FENCE.minX, WEST_FENCE.minZ]} />
      <FenceLine a={[WEST_FENCE.minX, WEST_FENCE.minZ]} b={[WEST_FENCE.minX, WEST_FENCE.maxZ]} />
      <DistrictGate x={WEST_GATE.x} z={WEST_GATE.z} halfWidth={WEST_GATE.halfWidth} roof="#4F7A8C" lantern="#E0483A" />
      <Clearing />
      <JizoHill />
      <FifthPile />
      <Onsen />
      {WEST_HOUSES.map((h, i) => (
        <House key={i} position={h.pos} rotY={h.rotY} size={h.size} wall={h.wall} roof={h.roof} noren={h.noren} flower={h.flower} lanterns={i === 0} />
      ))}
      <Boardwalk />
      <DistanceCull center={[-30, 0, RIVER.z]} far={30}>
        <Boat />
        <Heron />
        <Dragonflies />
      </DistanceCull>
      <Reeds />
      <Trees />
      <GroveUndergrowth />
      <FarBank />
    </group>
  );
}
