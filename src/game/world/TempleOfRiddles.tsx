import { useEffect, useMemo, useRef } from 'react';
import { DistanceCull } from '../DistanceCull';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { create } from 'zustand';
import { Toon, Ink, getGradient } from '../materials';
import { useGameStore } from '../../store/gameStore';
import { emit } from '../../systems/events';
import { useInteractable, type Interactable } from '../systems/interaction';
import { playerPosition, playerGround } from '../systems/playerState';
import { spawnParticles } from '../systems/particles';
import { OBJECTS_BY_ID } from '../../data/world';
import { JapaneseRoof, PaperLantern, Torii } from './Buildings';
import { StoneLantern, Bamboo, SakuraTree, PineTree } from './Props';
import {
  TEMPLE, GATE, SHRINE, MIRRORS, MIRROR_START, MIRROR_SOLUTION, MIRROR_GRID, BEAM_SOURCE, CRYSTAL_CELL, angleOf, cellToWorld, traceBeam,
  PLATES, FRACTION_ROUNDS, FRACTION_DOOR, PLATE_SPOTS, FRACTION_LEVER, litEighths, fractionSolved,
  GONG_ROUNDS, GONG_TABLET, gongSpot, strikeGong,
} from '../../systems/temple';
import { TEMPLE_SOLVE_ACTIONS } from '../../data/temple';

/**
 * Capítulo 4 — O Templo dos Enigmas: a walled courtyard north of the village, entered through a gate in
 * the fence (left of the pagoda) that Tsubaki unlocks. Three puzzles are played with the body, not menus:
 * turn mirror statues (E), stand on fraction plates and pull a lever, strike gongs (E). The rules live in
 * systems/temple.ts so the tests can play them too.
 */

// ── Puzzle state (not saved: a half-done puzzle simply starts over; solved ones come from the mission) ──
interface TempleState {
  mirrors: number[];
  plates: boolean[];
  fracRound: number;
  gongRound: number;
  gongProgress: number;
  /** gong index → time of the last strike (drives the swing). */
  struck: Record<number, number>;
  set: (p: Partial<TempleState>) => void;
  reset: () => void;
}
const fresh = () => ({ mirrors: [...MIRROR_START], plates: PLATES.map(() => false), fracRound: 0, gongRound: 0, gongProgress: 0, struck: {} });
export const useTemple = create<TempleState>((set) => ({ ...fresh(), set: (p) => set(p), reset: () => set(fresh()) }));
if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__temple = useTemple;

const stepDone = (ref: string) => (s: ReturnType<typeof useGameStore.getState>) => {
  const [m, st] = ref.split('.');
  return !!s.progress.missions[m]?.steps.includes(st) || s.progress.missions[m]?.status === 'done';
};
const solve = (k: keyof typeof TEMPLE_SOLVE_ACTIONS) => useGameStore.getState().runActions(TEMPLE_SOLVE_ACTIONS[k]);
const toast = (icon: string, text: string) => emit({ type: 'toast', icon, text });

/** Hook: registers an E-interaction at a fixed spot. */
function useSpot(id: string, pos: [number, number, number], radius: number, label: () => string | null, onInteract: () => void, tagHeight = 1.6) {
  // the registered item calls through a ref, so the label and action always see the latest render's state
  const fns = useRef({ label, onInteract });
  fns.current = { label, onInteract };
  const item = useMemo<Interactable>(() => ({
    id, position: new THREE.Vector3(...pos), radius, tagHeight,
    label: () => fns.current.label(),
    onInteract: () => fns.current.onInteract(),
  }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [id, pos[0], pos[1], pos[2]]);
  useInteractable(item);
}

/** Wide painted text (tablets, door target). */
function textTexture(text: string, w = 512, h = 128, bg = '#E9DFC9', fg = '#2A1E16', size = 64) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg;
  ctx.font = `bold ${size}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function Painted({ text, width, height, position, rotation, bg, fg, size }: { text: string; width: number; height: number; position: [number, number, number]; rotation?: [number, number, number]; bg?: string; fg?: string; size?: number }) {
  const tex = useMemo(() => textTexture(text, Math.round(128 * (width / height)), 128, bg, fg, size), [text, width, height, bg, fg, size]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width, height]} />
      <meshToonMaterial map={tex} gradientMap={getGradient()} side={THREE.DoubleSide} />
    </mesh>
  );
}

const STONE = '#B9AE9C';
const STONE_DARK = '#8E8474';
const WOOD = '#8A5A3A';
const LACQUER = '#B8382E';

// ── Walls, floor, gate ───────────────────────────────────────────────────────────
function Walls() {
  const { minX, maxX, minZ, maxZ } = TEMPLE;
  const h = 2.4;
  const segs: { c: [number, number]; size: [number, number] }[] = [
    { c: [minX, (minZ + maxZ) / 2], size: [0.6, maxZ - minZ] },
    { c: [maxX, (minZ + maxZ) / 2], size: [0.6, maxZ - minZ] },
    { c: [0, minZ], size: [maxX - minX + 0.6, 0.6] },
  ];
  return (
    <RigidBody type="fixed" colliders={false}>
      {segs.map((s, i) => (
        <group key={i} position={[s.c[0], 0, s.c[1]]}>
          <CuboidCollider args={[s.size[0] / 2, 2, s.size[1] / 2]} position={[0, 2, 0]} />
          <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[s.size[0], h, s.size[1]]} />
            <Toon color="#EDE3CF" tex="plaster" />
            <Ink thickness={0.03} />
          </mesh>
          <mesh position={[0, 0.3, 0]}>
            <boxGeometry args={[s.size[0] + 0.08, 0.6, s.size[1] + 0.08]} />
            <Toon color={STONE_DARK} tex="stone" />
          </mesh>
          {/* tiled cap */}
          <mesh position={[0, h + 0.12, 0]} castShadow>
            <boxGeometry args={[s.size[0] + 0.5, 0.24, s.size[1] + 0.5]} />
            <Toon color="#3F5277" tex="tiles" />
            <Ink thickness={0.02} />
          </mesh>
        </group>
      ))}
    </RigidBody>
  );
}

function Floor() {
  const { minX, maxX, minZ, maxZ } = TEMPLE;
  const tiles = useMemo(() => {
    const t: [number, number][] = [];
    for (let z = maxZ - 0.8; z > -27; z -= 1.2) t.push([GATE.x + (z < -24 ? (z + 24) * -1.4 : 0), z]);
    return t;
  }, [maxZ]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(minX + maxX) / 2, 0.012, (minZ + maxZ) / 2]} receiveShadow>
        <planeGeometry args={[maxX - minX, maxZ - minZ]} />
        <Toon color="#C9BFA9" tex="stone" />
      </mesh>
      {tiles.map(([x, z], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.025, z]} receiveShadow>
          <planeGeometry args={[1.5, 1.0]} />
          <Toon color="#A89C86" tex="stone" />
        </mesh>
      ))}
    </group>
  );
}

/** Wooden double door in the village fence. Closed (with a collider) until Tsubaki opens it. */
function Gate() {
  const open = useGameStore(stepDone('templo.portao'));
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const k = useRef(open ? 1 : 0);
  useFrame((_s, dt) => {
    k.current = THREE.MathUtils.damp(k.current, open ? 1 : 0, 2.5, dt);
    if (left.current) left.current.rotation.y = -k.current * 1.7;
    if (right.current) right.current.rotation.y = k.current * 1.7;
  });
  const w = GATE.halfWidth;
  useSpot('templo:portao', [GATE.x, 0, GATE.z + 0.9], 1.6, () => (open ? null : 'Portão do templo (trancado)'), () => {
    toast('🔒', 'O portão está trancado. A Tsubaki, guardiã do templo, tem a chave.');
    emit({ type: 'sfx', name: 'denied' });
  });
  return (
    <group position={[GATE.x, 0, GATE.z]}>
      <Torii position={[0, 0, -0.1]} />
      <Painted text="Templo dos Enigmas" width={2.2} height={0.42} position={[0, 2.55, 0.12]} bg="#2F2A36" fg="#F2D27A" size={46} />
      <group ref={left} position={[-w, 0, 0]}>
        <mesh position={[w / 2, 1.0, 0]} castShadow>
          <boxGeometry args={[w, 2, 0.12]} />
          <Toon color={WOOD} tex="wood" />
          <Ink thickness={0.02} />
        </mesh>
      </group>
      <group ref={right} position={[w, 0, 0]}>
        <mesh position={[-w / 2, 1.0, 0]} castShadow>
          <boxGeometry args={[w, 2, 0.12]} />
          <Toon color={WOOD} tex="wood" />
          <Ink thickness={0.02} />
        </mesh>
      </group>
      {!open && (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[w, 1.5, 0.2]} position={[0, 1.5, 0]} />
        </RigidBody>
      )}
    </group>
  );
}

function Decor() {
  const { minX, maxX, minZ, maxZ } = TEMPLE;
  return (
    <group>
      <StoneLantern position={[GATE.x - 1.6, 0, maxZ - 1.6]} />
      <StoneLantern position={[GATE.x + 1.6, 0, maxZ - 1.6]} />
      <StoneLantern position={[-2.4, 0, -33.4]} />
      <StoneLantern position={[2.4, 0, -33.4]} />
      {[-11.8, -10.2, 10.4, 11.9].map((x, i) => <Bamboo key={i} position={[x, 0, maxZ - 1.0]} seed={i + 3} />)}
      {[-12.1, 12.1].map((x, i) => [-35.8, -21.4].map((z, j) => <Bamboo key={`${i}${j}`} position={[x, 0, z]} seed={7 + i * 2 + j} />))}
      <SakuraTree position={[minX + 1.6, 0, minZ + 1.8]} scale={0.8} seed={11} />
      <SakuraTree position={[maxX - 1.6, 0, minZ + 1.8]} scale={0.8} seed={12} />
      <PineTree position={[2.6, 0, maxZ - 1.4]} scale={0.8} />
      <PineTree position={[11.6, 0, -24.2]} scale={0.7} />
      <PaperLantern position={[-1.6, 2.2, SHRINE[2] + 1.5]} color="#F2A541" />
      <PaperLantern position={[1.6, 2.2, SHRINE[2] + 1.5]} color="#F2A541" />
      <Painted text="Observe · Encontre a regra · Confira" width={6.4} height={0.5} position={[0, 2.0, minZ + 0.32]} bg="#EDE3CF" fg="#6B2E24" size={50} />
    </group>
  );
}

// ── Espelhos da Luz ──────────────────────────────────────────────────────────────
const BEAM_Y = 1.05;

function MirrorStatue({ index }: { index: number }) {
  const [i, j] = MIRRORS[index];
  const [x, z] = cellToWorld(i, j);
  const solved = useGameStore(stepDone('templo.espelhos'));
  const open = useGameStore(stepDone('templo.portao'));
  const head = useRef<THREE.Group>(null);
  const solvedRef = useRef(solved);
  solvedRef.current = solved;
  useFrame((_s, dt) => {
    const k = solvedRef.current ? MIRROR_SOLUTION[index] : useTemple.getState().mirrors[index];
    // the mirror line is at k×45° from east; three rotates +y from x toward −z, hence the minus
    const want = -THREE.MathUtils.degToRad(k * 45);
    if (head.current) {
      let cur = head.current.rotation.y;
      // turn the short way round (orientations repeat every 180°)
      while (want - cur > Math.PI / 2) cur += Math.PI;
      while (cur - want > Math.PI / 2) cur -= Math.PI;
      head.current.rotation.y = THREE.MathUtils.damp(cur, want, 10, dt);
    }
  });
  useSpot(`templo:espelho${index}`, [x, 0, z], 1.3,
    () => (solved || !open ? null : `Girar o espelho 45° (agora ${angleOf(useTemple.getState().mirrors[index])}°)`),
    () => {
      const st = useTemple.getState();
      const m = [...st.mirrors];
      m[index] = (m[index] + 1) % 4;
      st.set({ mirrors: m });
      emit({ type: 'sfx', name: 'mechanism', position: [x, 1, z] });
    }, 2.0);
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.38, 0.6, 0.38]} position={[0, 0.6, 0]} />
      </RigidBody>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.8, 0.6, 0.8]} />
        <Toon color={STONE} tex="stone" />
        <Ink thickness={0.02} />
      </mesh>
      {/* the turning part: a stone cat holding a round bronze mirror */}
      <group ref={head} position={[0, 0.6, 0]}>
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.34, 0.38, 0.1, 16]} />
          <Toon color={STONE_DARK} />
        </mesh>
        <mesh position={[0, BEAM_Y - 0.6, 0]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.72, 0.62, 0.06]} />
          <Toon color="#C9A35B" />
          <Ink thickness={0.015} />
        </mesh>
        <mesh position={[0, BEAM_Y - 0.6, 0.035]}>
          <planeGeometry args={[0.62, 0.52]} />
          <meshBasicMaterial color="#E8F4FF" />
        </mesh>
        <mesh position={[0, BEAM_Y - 0.6, -0.035]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.62, 0.52]} />
          <meshBasicMaterial color="#E8F4FF" />
        </mesh>
        {/* little stone ears on top so the statue reads as a cat */}
        {[-0.2, 0.2].map((ex) => (
          <mesh key={ex} position={[ex, BEAM_Y - 0.6 + 0.4, 0]}>
            <coneGeometry args={[0.08, 0.16, 4]} />
            <Toon color={STONE} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Beam() {
  const group = useRef<THREE.Group>(null);
  const crystal = useRef<THREE.Mesh>(null);
  const solved = useGameStore(stepDone('templo.espelhos'));
  const open = useGameStore(stepDone('templo.portao'));
  const mirrors = useTemple((s) => s.mirrors);
  const beam = useMemo(() => traceBeam(solved ? MIRROR_SOLUTION : mirrors), [solved, mirrors]);
  const hit = beam.end === 'crystal';
  const segments = useMemo(() => {
    const pts = beam.path.map(([i, j]) => cellToWorld(i, j));
    if (beam.end === 'wall' && beam.path.length >= 2) {
      // carry the light on half a cell, to the wall of the grid
      const [a, b] = [pts[pts.length - 2], pts[pts.length - 1]];
      pts.push([b[0] + (b[0] - a[0]) * 0.5, b[1] + (b[1] - a[1]) * 0.5]);
    }
    const out: { pos: [number, number, number]; len: number; rotY: number }[] = [];
    for (let k = 0; k < pts.length - 1; k++) {
      const [x0, z0] = pts[k];
      const [x1, z1] = pts[k + 1];
      if (x0 === x1 && z0 === z1) continue;
      out.push({ pos: [(x0 + x1) / 2, BEAM_Y, (z0 + z1) / 2], len: Math.hypot(x1 - x0, z1 - z0), rotY: Math.atan2(x1 - x0, z1 - z0) });
    }
    return out;
  }, [beam]);

  const fired = useRef(solved);
  useEffect(() => {
    if (!solved) fired.current = false; // e.g. a save reset while the scene stays mounted
    if (hit && !fired.current && open && !solved) {
      fired.current = true;
      const [cx, cz] = cellToWorld(...CRYSTAL_CELL);
      spawnParticles('sparkle', [cx, 1.3, cz], 30);
      toast('💎', 'A luz chegou ao cristal! Cada espelho virou o raio num canto de 90°.');
      solve('espelhos');
    }
  }, [hit, open, solved]);

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (crystal.current) {
      crystal.current.rotation.y = t * (hit ? 1.6 : 0.4);
      const m = crystal.current.material as THREE.MeshToonMaterial;
      m.emissiveIntensity = hit ? 1.2 + Math.sin(t * 5) * 0.3 : 0.15;
    }
    if (group.current) group.current.children.forEach((c, k) => c.scale.setScalar(1 + Math.sin(t * 8 + k) * 0.12));
  });
  const [sx, sz] = cellToWorld(...BEAM_SOURCE.cell);
  const [cx, cz] = cellToWorld(...CRYSTAL_CELL);
  return (
    <group>
      {/* the lantern that throws the beam east */}
      <group position={[sx, 0, sz]}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.4, 0.7, 0.4]} position={[0, 0.7, 0]} />
        </RigidBody>
        <mesh position={[0, 0.45, 0]} castShadow>
          <boxGeometry args={[0.7, 0.9, 0.7]} />
          <Toon color={STONE} tex="stone" />
          <Ink thickness={0.02} />
        </mesh>
        <mesh position={[0.3, BEAM_Y, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.16, 0.22, 0.3, 14]} />
          <Toon color="#FFE9A8" emissive="#FFC94D" emissiveIntensity={1.2} />
        </mesh>
      </group>
      {open && (
        <group ref={group}>
          {segments.map((sg, k) => (
            // the cylinder's axis (y) is tipped onto +z, then the group turns it along the segment
            <group key={k} position={sg.pos} rotation={[0, sg.rotY, 0]}>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.05, 0.05, sg.len, 8]} />
                <meshBasicMaterial color="#FFE48A" transparent opacity={0.85} />
              </mesh>
            </group>
          ))}
        </group>
      )}
      {/* the crystal on its pedestal */}
      <group position={[cx, 0, cz]}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.35, 0.5, 0.35]} position={[0, 0.5, 0]} />
        </RigidBody>
        <mesh position={[0, 0.4, 0]} castShadow>
          <cylinderGeometry args={[0.35, 0.42, 0.8, 8]} />
          <Toon color={STONE} tex="stone" />
          <Ink thickness={0.02} />
        </mesh>
        <mesh ref={crystal} position={[0, BEAM_Y + 0.1, 0]} scale={[1, 1.5, 1]}>
          <octahedronGeometry args={[0.24, 0]} />
          <Toon color="#9FE3FF" emissive="#6FD3FF" emissiveIntensity={0.15} />
          <Ink thickness={0.015} />
        </mesh>
      </group>
      {/* stone grid on the floor so the cells (and the straight lines) can be read */}
      {Array.from({ length: MIRROR_GRID.size * MIRROR_GRID.size }, (_, n) => {
        const [x, z] = cellToWorld(n % MIRROR_GRID.size, Math.floor(n / MIRROR_GRID.size));
        return (
          <mesh key={n} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.03, z]} receiveShadow>
            <planeGeometry args={[MIRROR_GRID.cell - 0.12, MIRROR_GRID.cell - 0.12]} />
            <Toon color={(n + Math.floor(n / MIRROR_GRID.size)) % 2 ? '#B7AC97' : '#C7BDA8'} />
          </mesh>
        );
      })}
    </group>
  );
}

function Mirrors() {
  return (
    <group>
      <Beam />
      {MIRRORS.map((_, k) => <MirrorStatue key={k} index={k} />)}
    </group>
  );
}

// ── Porta das Frações ────────────────────────────────────────────────────────────
function Plate({ index }: { index: number }) {
  const [x, z] = PLATE_SPOTS[index];
  const on = useTemple((s) => s.plates[index]);
  const top = useRef<THREE.Mesh>(null);
  useFrame((_s, dt) => {
    if (top.current) top.current.position.y = THREE.MathUtils.damp(top.current.position.y, on ? 0.04 : 0.1, 12, dt);
  });
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[1.25, 0.08, 1.25]} />
        <Toon color={STONE_DARK} tex="stone" />
      </mesh>
      <mesh ref={top} position={[0, 0.1, 0]} receiveShadow>
        <boxGeometry args={[1.05, 0.1, 1.05]} />
        <Toon color={on ? '#F2C94C' : '#D8CDB6'} emissive={on ? '#F2A541' : '#000000'} emissiveIntensity={on ? 0.5 : 0} />
      </mesh>
      <Painted text={PLATES[index].label} width={0.6} height={0.6} position={[0, 0.17, 0]} rotation={[-Math.PI / 2, 0, 0]} bg={on ? '#F2C94C' : '#E9DFC9'} fg="#2A1E16" size={88} />
    </group>
  );
}

/** Watches the player's feet: stepping onto a plate toggles it (stepping off does nothing). */
function PlateSensor() {
  const inside = useRef<number>(-1);
  useFrame(() => {
    const st = useGameStore.getState();
    const open = stepDone('templo.portao')(st);
    const solved = stepDone('templo.fracoes')(st);
    if (!open || solved || st.phase !== 'playing') return;
    // hysteresis on the horizontal distance only: enter within 0.55 m (feet on the ground), leave beyond 0.9 m
    // (past the stone rim), so stopping with a little momentum near the edge never toggles a plate twice.
    // Checking "grounded" for leaving made a landing bounce count as leaving and re-entering (a double toggle).
    const near = (k: number, r: number) => Math.abs(playerPosition.x - PLATE_SPOTS[k][0]) < r && Math.abs(playerPosition.z - PLATE_SPOTS[k][1]) < r;
    let now = inside.current >= 0 && near(inside.current, 0.9) ? inside.current : -1;
    if (now < 0 && playerGround.grounded && playerPosition.y < 0.9) {
      PLATE_SPOTS.forEach((_, k) => {
        if (near(k, 0.55)) now = k;
      });
    }
    if (now !== inside.current) {
      inside.current = now;
      if (now >= 0) {
        const t = useTemple.getState();
        const plates = [...t.plates];
        plates[now] = !plates[now];
        t.set({ plates });
        emit({ type: 'sfx', name: plates[now] ? 'blip' : 'ui_close' });
      }
    }
  });
  return null;
}

function FractionDoor() {
  const plates = useTemple((s) => s.plates);
  const round = useTemple((s) => s.fracRound);
  const solved = useGameStore(stepDone('templo.fracoes'));
  const open = useGameStore(stepDone('templo.portao'));
  const lit = solved ? 8 : litEighths(plates);
  const target = FRACTION_ROUNDS[Math.min(round, FRACTION_ROUNDS.length - 1)];
  const over = !solved && lit > 8;
  const slices = useMemo(() => Array.from({ length: 8 }, (_, k) => new THREE.CircleGeometry(0.95, 12, Math.PI / 2 - (k + 1) * (Math.PI / 4), Math.PI / 4 - 0.03)), []);
  useEffect(() => () => slices.forEach((g) => g.dispose()), [slices]);
  const [dx, , dz] = FRACTION_DOOR;

  useSpot('templo:alavanca', FRACTION_LEVER, 1.3, () => (solved || !open ? null : 'Puxar a alavanca (conferir o disco)'), () => {
    const t = useTemple.getState();
    const now = litEighths(t.plates);
    if (fractionSolved(t.fracRound, t.plates)) {
      emit({ type: 'sfx', name: 'mechanism' });
      spawnParticles('sparkle', [dx, 1.8, dz + 0.3], 24);
      if (t.fracRound + 1 < FRACTION_ROUNDS.length) {
        toast('🥧', `Certo! ${now}/8 é o mesmo que ${FRACTION_ROUNDS[t.fracRound].label}. A porta pede outra fração...`);
        t.set({ fracRound: t.fracRound + 1, plates: PLATES.map(() => false) });
      } else {
        toast('🚪', 'A Porta das Frações se abriu! Frações diferentes podem valer o mesmo tanto.');
        solve('fracoes');
      }
    } else {
      emit({ type: 'sfx', name: 'fizzle' });
      const want = FRACTION_ROUNDS[t.fracRound];
      toast('🤔', now > want.eighths
        ? `O disco tem ${now}/8 acesos. A porta pede ${want.label}, que é ${want.eighths}/8: passou um pouco.`
        : `O disco tem ${now}/8 acesos. A porta pede ${want.label}, que é ${want.eighths}/8: ainda falta.`);
    }
  });

  return (
    <group>
      {/* wall with the round door */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2.6, 1.6, 0.3]} position={[dx, 1.6, dz]} />
      </RigidBody>
      <mesh position={[dx, 1.5, dz]} castShadow receiveShadow>
        <boxGeometry args={[5.2, 3.0, 0.6]} />
        <Toon color="#EDE3CF" tex="plaster" />
        <Ink thickness={0.03} />
      </mesh>
      <group position={[dx, 3.1, dz]}>
        <JapaneseRoof w={5.6} d={1.4} h={0.5} color="#3F5277" overhang={0.3} />
      </group>
      <group position={[dx, 1.55, dz + 0.31]}>
        <mesh>
          <circleGeometry args={[1.08, 40]} />
          <meshBasicMaterial color="#3A2E28" />
        </mesh>
        {slices.map((g, k) => (
          <mesh key={k} geometry={g} position={[0, 0, 0.01]}>
            <meshBasicMaterial color={k < lit ? (over ? '#E8505B' : '#FFD46B') : '#6E6152'} />
          </mesh>
        ))}
        {solved && (
          <mesh position={[0, 0, 0.02]}>
            <ringGeometry args={[1.0, 1.08, 40]} />
            <meshBasicMaterial color="#FFF2B0" />
          </mesh>
        )}
      </group>
      <Painted text={solved ? 'Aberta!' : `A porta pede: ${target.label}`} width={2.4} height={0.42} position={[dx, 2.85, dz + 0.32]} bg="#2F2A36" fg="#F2D27A" size={50} />
      {!solved && <Painted text={`Rodada ${round + 1} de ${FRACTION_ROUNDS.length}`} width={1.5} height={0.26} position={[dx + 1.85, 0.5, dz + 0.32]} size={44} />}
      {PLATES.map((_, k) => <Plate key={k} index={k} />)}
      <PlateSensor />
      {/* the lever */}
      <group position={FRACTION_LEVER}>
        <mesh position={[0, 0.25, 0]} castShadow>
          <boxGeometry args={[0.5, 0.5, 0.4]} />
          <Toon color={STONE} tex="stone" />
          <Ink thickness={0.02} />
        </mesh>
        <mesh position={[0, 0.75, 0]} rotation={[0, 0, solved ? -0.6 : 0.5]}>
          <cylinderGeometry args={[0.04, 0.04, 0.8, 8]} />
          <Toon color={LACQUER} />
        </mesh>
      </group>
    </group>
  );
}

// ── Gongos da Sequência ──────────────────────────────────────────────────────────
function Gong({ index }: { index: number }) {
  const round = useTemple((s) => Math.min(s.gongRound, GONG_ROUNDS.length - 1));
  const value = GONG_ROUNDS[round].gongs[index];
  const solved = useGameStore(stepDone('templo.gongos'));
  const open = useGameStore(stepDone('templo.portao'));
  const [x, z, rotY] = gongSpot(index, GONG_ROUNDS[0].gongs.length);
  const disc = useRef<THREE.Group>(null);
  useFrame(() => {
    const at = useTemple.getState().struck[index] ?? -10;
    const t = performance.now() / 1000 - at;
    if (disc.current) disc.current.rotation.x = t < 2 ? Math.sin(t * 14) * 0.35 * Math.exp(-t * 2.2) : 0;
  });
  useSpot(`templo:gongo${index}`, [x, 0, z], 1.2, () => (solved || !open ? null : `Tocar o gongo ${value}`), () => {
    const t = useTemple.getState();
    t.set({ struck: { ...t.struck, [index]: performance.now() / 1000 } });
    emit({ type: 'sfx', name: 'temple_bell', position: [x, 1.4, z] });
    const r = strikeGong(t.gongRound, t.gongProgress, value);
    if (r === 'wrong') {
      emit({ type: 'sfx', name: 'fizzle' });
      toast('🔔', `O ${value} não continua a regra. A sequência recomeçou: olhe a tábua de novo.`);
      t.set({ gongProgress: 0 });
    } else if (r === 'done') {
      spawnParticles('sparkle', [x, 1.8, z], 20);
      if (t.gongRound + 1 < GONG_ROUNDS.length) {
        toast('🎶', `Isso! A regra era: ${GONG_ROUNDS[t.gongRound].rule}. A tábua mudou...`);
        t.set({ gongRound: t.gongRound + 1, gongProgress: 0 });
      } else {
        toast('🎶', `Os gongos cantaram juntos! A regra era: ${GONG_ROUNDS[t.gongRound].rule}.`);
        t.set({ gongProgress: 0 });
        solve('gongos');
      }
    } else {
      t.set({ gongProgress: r });
    }
  }, 2.4);
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.58, 1.0, 0.15]} position={[0, 1.0, 0]} />
      </RigidBody>
      {[-0.56, 0.56].map((px) => (
        <mesh key={px} position={[px, 1.0, 0]} castShadow>
          <boxGeometry args={[0.1, 2.0, 0.1]} />
          <Toon color={LACQUER} tex="wood" />
        </mesh>
      ))}
      <mesh position={[0, 2.0, 0]} castShadow>
        <boxGeometry args={[1.38, 0.12, 0.14]} />
        <Toon color="#2F2A36" />
        <Ink thickness={0.015} />
      </mesh>
      <group ref={disc} position={[0, 1.94, 0]}>
        <mesh position={[0, -0.62, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 0.06, 28]} />
          <Toon color="#C9A35B" />
          <Ink thickness={0.015} />
        </mesh>
        <Painted text={String(value)} width={0.46} height={0.46} position={[0, -0.62, 0.035]} bg="#C9A35B" fg="#3A2410" size={84} />
        <Painted text={String(value)} width={0.46} height={0.46} position={[0, -0.62, -0.035]} rotation={[0, Math.PI, 0]} bg="#C9A35B" fg="#3A2410" size={84} />
      </group>
    </group>
  );
}

function GongTablet() {
  const round = useTemple((s) => Math.min(s.gongRound, GONG_ROUNDS.length - 1));
  const progress = useTemple((s) => s.gongProgress);
  const solved = useGameStore(stepDone('templo.gongos'));
  const r = GONG_ROUNDS[solved ? GONG_ROUNDS.length - 1 : round];
  const blanks = r.answer.map((a, k) => (solved || k < progress ? String(a) : '?'));
  const text = [...r.shown.map(String), ...blanks].join(',  ');
  return (
    <group position={GONG_TABLET}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.3, 0.8, 0.2]} position={[0, 0.8, 0]} />
      </RigidBody>
      <mesh position={[0, 0.8, 0]} castShadow>
        <boxGeometry args={[2.7, 1.6, 0.36]} />
        <Toon color={STONE} tex="stone" />
        <Ink thickness={0.025} />
      </mesh>
      {/* readable from the courtyard (south) and from the gongs (north) */}
      <Painted text={text} width={2.4} height={0.5} position={[0, 1.05, 0.19]} size={58} />
      <Painted text={text} width={2.4} height={0.5} position={[0, 1.05, -0.19]} rotation={[0, Math.PI, 0]} size={58} />
      <Painted text={solved ? 'Sequências completas!' : `Sequência ${round + 1} de ${GONG_ROUNDS.length}`} width={1.9} height={0.28} position={[0, 0.5, 0.19]} size={44} />
    </group>
  );
}

function Gongs() {
  return (
    <group>
      <GongTablet />
      {GONG_ROUNDS[0].gongs.map((_, k) => <Gong key={k} index={k} />)}
    </group>
  );
}

// ── Santuário ────────────────────────────────────────────────────────────────────
function Shrine() {
  const ready = useGameStore((s) => ['espelhos', 'fracoes', 'gongos'].every((k) => stepDone(`templo.${k}`)(s)));
  const taken = useGameStore(stepDone('templo.santuario'));
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const k = useRef(ready ? 1 : 0);
  const fired = useRef(ready);
  useEffect(() => {
    if (!ready) fired.current = false;
    if (ready && !fired.current) {
      fired.current = true;
      emit({ type: 'sfx', name: 'wish' });
      toast('🏯', 'Os três enigmas foram resolvidos... as portas do santuário estão se abrindo!');
    }
  }, [ready]);
  const roof = useRef<THREE.Group>(null);
  useFrame((_s, dt) => {
    k.current = THREE.MathUtils.damp(k.current, ready ? 1 : 0, 1.5, dt);
    // the roof has no collider, so the follow camera ends up above it when the cat is inside: hide it then
    if (roof.current) roof.current.visible = !(Math.abs(playerPosition.x - SHRINE[0]) < 2.4 && Math.abs(playerPosition.z - SHRINE[2]) < 1.9);
    if (left.current) left.current.position.x = -0.55 - k.current * 1.0;
    if (right.current) right.current.position.x = 0.55 + k.current * 1.0;
  });
  const [x, , z] = SHRINE;
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2.2, 0.08, 1.5]} position={[0, 0.08, 0]} />
        <CuboidCollider args={[2.2, 1.6, 0.15]} position={[0, 1.6, -1.35]} />
        <CuboidCollider args={[0.15, 1.6, 1.5]} position={[-2.05, 1.6, 0]} />
        <CuboidCollider args={[0.15, 1.6, 1.5]} position={[2.05, 1.6, 0]} />
        {!ready && <CuboidCollider args={[1.2, 1.5, 0.12]} position={[0, 1.5, 1.35]} />}
      </RigidBody>
      {/* a low step (16 cm) the cat walks up without jumping */}
      <mesh position={[0, 0.08, 0]} receiveShadow castShadow>
        <boxGeometry args={[4.4, 0.16, 3.0]} />
        <Toon color={STONE_DARK} tex="stone" />
        <Ink thickness={0.02} />
      </mesh>
      {/* back and side walls, red pillars */}
      <mesh position={[0, 1.6, -1.35]} castShadow>
        <boxGeometry args={[4.2, 2.6, 0.2]} />
        <Toon color="#EDE3CF" tex="plaster" />
      </mesh>
      {[-2.05, 2.05].map((px) => (
        <mesh key={px} position={[px, 1.6, 0]} castShadow>
          <boxGeometry args={[0.2, 2.6, 2.8]} />
          <Toon color="#EDE3CF" tex="plaster" />
        </mesh>
      ))}
      {[-2.05, 2.05].map((px) => [-1.35, 1.35].map((pz) => (
        <mesh key={`${px}${pz}`} position={[px, 1.6, pz]} castShadow>
          <boxGeometry args={[0.26, 2.6, 0.26]} />
          <Toon color={LACQUER} tex="wood" />
          <Ink thickness={0.02} />
        </mesh>
      )))}
      <group ref={roof} position={[0, 2.9, 0]}>
        <JapaneseRoof w={5.2} d={3.8} h={1.4} color="#3F5277" />
      </group>
      {/* sliding lattice doors */}
      {[left, right].map((ref, n) => (
        <group key={n} ref={ref} position={[n ? 0.55 : -0.55, 0, 1.35]}>
          <mesh position={[0, 1.55, 0]} castShadow>
            <boxGeometry args={[1.1, 2.5, 0.08]} />
            <Toon color="#F6EEDC" />
            <Ink thickness={0.015} />
          </mesh>
          {[-0.35, 0, 0.35].map((lx) => (
            <mesh key={lx} position={[lx, 1.55, 0.05]}>
              <boxGeometry args={[0.04, 2.5, 0.02]} />
              <Toon color={WOOD} />
            </mesh>
          ))}
        </group>
      ))}
      {/* altar and the scroll */}
      <mesh position={[0, 0.65, -0.6]} castShadow>
        <boxGeometry args={[1.4, 0.7, 0.7]} />
        <Toon color={LACQUER} tex="wood" />
        <Ink thickness={0.02} />
      </mesh>
      {!taken && (
        <mesh position={[0, 1.08, -0.6]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.08, 0.08, 0.6, 12]} />
          <Toon color="#F6ECD2" emissive="#FFE9B0" emissiveIntensity={ready ? 0.8 : 0.2} />
        </mesh>
      )}
      <Painted text="Santuário" width={1.4} height={0.34} position={[0, 2.75, 1.42]} bg="#2F2A36" fg="#F2D27A" size={52} />
    </group>
  );
}

/** Hint plaques beside each puzzle (their E-interaction comes from the world objects in data/temple.ts). */
function Plaque({ position, title }: { position: [number, number, number]; title: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.9, 1.1, 0.16]} />
        <Toon color={STONE} tex="stone" />
        <Ink thickness={0.02} />
      </mesh>
      <Painted text={title} width={0.8} height={0.22} position={[0, 0.92, 0.085]} size={40} />
      <Painted text="👀 💡 📝" width={0.6} height={0.2} position={[0, 0.6, 0.085]} size={70} />
    </group>
  );
}

export function TempleOfRiddles() {
  // always built, so the shrine roof shows over the fence before the gate opens; the puzzles only answer once it is open.
  // This sits inside <StaticMerge>: walls, floor and decor get baked into a few meshes, while everything
  // that moves or changes colour is marked dynamic so it stays live.
  return (
    <group>
      <Walls />
      <Floor />
      <Decor />
      <group userData={{ dynamic: true }}>
        <Gate />
        {/* the puzzles sit behind the courtyard walls: nothing to see from the village (~190 draw calls) */}
        <DistanceCull center={[0, 0, -28]} far={24}>
          <Mirrors />
          <FractionDoor />
          <Gongs />
        </DistanceCull>
        <Shrine />
      </group>
      {(['placa_espelhos', 'placa_fracoes', 'placa_gongos'] as const).map((id, k) => (
        <Plaque key={id} position={OBJECTS_BY_ID[id].position} title={['Espelhos da Luz', 'Porta das Frações', 'Gongos'][k]} />
      ))}
    </group>
  );
}
