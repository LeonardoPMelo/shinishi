import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import { create } from 'zustand';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import { Toon, Ink } from '../materials';
import { Rock } from './Rock';
import { LightPool } from './interiorParts';
import { usePondMaterial } from './EastDistrict';
import { useGameStore } from '../../store/gameStore';
import { emit } from '../../systems/events';
import { useSpot } from '../systems/training';
import { useZone } from '../systems/zone';
import { CAVE, w } from '../../data/wild';
import { SINGING, ECHO_STONE, TUNES, CHAMBER, WILD2_CODE_ACTIONS } from '../../data/wild2';
import { checkTune, type TuneState } from '../../systems/tune';

/**
 * A Caverna da Névoa, rebuilt (after Etapa 10), in local coordinates: a rock floor, stalagmites, crystal
 * clusters that light the floor around them, an underground pool, and the singing crystals: four pillars, each
 * with its colour and its note. The echo stone plays a tune; the cat plays it back on the pillars; three tunes
 * open the chamber in the north rock (systems/tune.ts has the rules, unit-tested). The mist and the darker air
 * inside are still CaveMood (WildRegion.tsx).
 */

const toast = (icon: string, text: string) => emit({ type: 'toast', icon, text });
/** Each pillar's sound: four different timbres, easy to tell apart. */
const NOTE_SFX = ['blip', 'ring', 'gem', 'temple_bell'] as const;

/** Stalagmites (solid), placed clear of the pillars, the stone, the pool and the chamber's mouth. */
const SPIKES: [number, number, number][] = [[19.5, -25.5, 1.0], [33, -26, 1.3], [22.6, -37.6, 1.6], [23.6, -32.4, 0.8], [29.4, -29.6, 0.9], [32.6, -33.4, 1.1], [33.4, -37.2, 1.4], [19.4, -34.0, 1.2]];
/** Glowing crystal clusters (decoration and light). */
const CLUSTERS: { x: number; z: number; c: string; s: number }[] = [
  { x: 19.2, z: -29.0, c: '#7FC8FF', s: 1.0 }, { x: 33.2, z: -29.0, c: '#C9A0FF', s: 0.9 }, { x: 30.0, z: -37.4, c: '#7FE0C8', s: 1.1 },
  { x: 20.6, z: -37.8, c: '#FF9FD2', s: 0.8 }, { x: 26.0, z: -24.8, c: '#9FD8FF', s: 0.7 },
];
export const CAVE_POOL = { x: 29.6, z: -26.4, rx: 1.6, rz: 1.1 };

function CrystalCluster({ x, z, c, s }: { x: number; z: number; c: string; s: number }) {
  const shards = useMemo(() => [[0, 0.5, 0, 0.12, 1.0], [0.18, 0.35, 0.08, 0.09, 0.7], [-0.16, 0.32, -0.06, 0.08, 0.64], [0.05, 0.28, -0.2, 0.07, 0.55]], []);
  return (
    <group position={[x, 0, z]} scale={s}>
      {shards.map(([px, , pz, r, h], i) => (
        <mesh key={i} position={[px, r * h * 2.2, pz]} rotation={[px * 1.4, i, -px * 1.2]} scale={[1, h * 2.6, 1]}>
          <octahedronGeometry args={[r, 0]} />
          <meshStandardMaterial color={c} emissive={c} emissiveIntensity={1.2} roughness={0.2} />
        </mesh>
      ))}
      <LightPool at={[0, 0]} size={[3.2 * s, 3.2 * s]} color={c} opacity={0.35} />
    </group>
  );
}

/** The static half: floor, stalagmites, clusters, the chamber's inside. */
export function WildCave() {
  const { x0, x1, z0, z1 } = CAVE;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, 0.015, (z0 + z1) / 2]} receiveShadow>
        <planeGeometry args={[x1 - x0, z1 - z0]} />
        {/* plain (the "stone" texture reads as masonry, not as a cave floor) */}
        <Toon color="#4C4854" />
      </mesh>
      {/* flat stones and pebbles over the floor */}
      {Array.from({ length: 16 }, (_, i) => {
        const x = x0 + 1 + ((i * 7.3) % (x1 - x0 - 2));
        const z = z1 - 1 - ((i * 4.1) % (z1 - z0 - 2));
        return <Rock key={i} variant={i % 5} kind="flat" position={[x, 0.04, z]} scale={[0.4 + (i % 3) * 0.15, 0.12, 0.35]} color={i % 2 ? '#5E5866' : '#6A6474'} contact={false} />;
      })}
      {SPIKES.map(([x, z, h], i) => (
        <RigidBody key={i} type="fixed" colliders={false} position={[x, 0, z]} userData={{ surface: 'stone' }}>
          <CylinderCollider args={[h / 2, 0.32]} position={[0, h / 2, 0]} />
          <mesh position={[0, h / 2, 0]} castShadow>
            <coneGeometry args={[0.38, h, 7]} />
            <Toon color="#6E6A78" tex="stone" />
            <Ink thickness={0.012} />
          </mesh>
          <mesh position={[0.25, h * 0.22, 0.1]}>
            <coneGeometry args={[0.18, h * 0.45, 6]} />
            <Toon color="#7A7686" tex="stone" />
          </mesh>
        </RigidBody>
      ))}
      {CLUSTERS.map((c, i) => <CrystalCluster key={i} {...c} />)}
      {/* the chamber's inside: dark rock, a glowing vein, a little shrine shelf */}
      <mesh position={[(CHAMBER.x0 + CHAMBER.x1) / 2, 1.3, CHAMBER.z0 + 0.02]}>
        <planeGeometry args={[CHAMBER.x1 - CHAMBER.x0, 2.6]} />
        <Toon color="#2E2A36" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(CHAMBER.x0 + CHAMBER.x1) / 2, 0.02, (CHAMBER.z0 + CHAMBER.z1) / 2]}>
        <planeGeometry args={[CHAMBER.x1 - CHAMBER.x0, CHAMBER.z1 - CHAMBER.z0]} />
        <Toon color="#3A3644" />
      </mesh>
      <CrystalCluster x={CHAMBER.x0 + 0.35} z={CHAMBER.z0 + 0.35} c="#9FE8FF" s={0.6} />
      <CrystalCluster x={CHAMBER.x1 - 0.35} z={CHAMBER.z0 + 0.35} c="#FFD86A" s={0.6} />
    </group>
  );
}

// ── The singing crystals ──────────────────────────────────────────────────────

const useTune = create<TuneState & { lit: number; set: (p: Partial<TuneState & { lit: number }>) => void }>((set) => ({
  round: 0, entered: [], playing: false, lit: -1, set: (p) => set(p),
}));

/** Plays a tune on the pillars: each one lights up and sounds, one after the other. */
function playTune(round: number) {
  const tune = TUNES[round];
  const st = useTune.getState();
  if (st.playing) return;
  st.set({ playing: true, entered: [] });
  tune.forEach((p, i) => {
    window.setTimeout(() => {
      useTune.getState().set({ lit: p });
      emit({ type: 'sfx', name: NOTE_SFX[p] });
    }, 300 + i * 750);
    window.setTimeout(() => useTune.getState().set({ lit: -1 }), 300 + i * 750 + 520);
  });
  window.setTimeout(() => useTune.getState().set({ playing: false }), 300 + tune.length * 750);
}

const tuneOpen = () => !!useGameStore.getState().progress.flags.camara_aberta;
const heard = () => !!useGameStore.getState().progress.missions.cristais_cantores?.steps.includes('escutar');

function EchoStone() {
  const [wx, , wz] = w(ECHO_STONE.x, ECHO_STONE.z);
  useSpot('pedra_eco_tocar', [wx, 0, wz], 1.5, () => {
    if (useZone.getState().zone !== 'selvagem' || tuneOpen() || !heard()) return null;
    return useTune.getState().playing ? null : `Ouvir a melodia ${useTune.getState().round + 1} de ${TUNES.length}`;
  }, () => playTune(useTune.getState().round), 1.4);
  return (
    <group position={[ECHO_STONE.x, 0, ECHO_STONE.z]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.4, 0.55]} position={[0, 0.4, 0]} />
      </RigidBody>
      <Rock variant={2} position={[0, 0.4, 0]} scale={[0.6, 0.45, 0.55]} color="#8A8496" contact={false} />
      {/* four little marks, one per colour, around its top */}
      {SINGING.map((s, i) => (
        <mesh key={s.id} position={[Math.cos((i / 4) * Math.PI * 2) * 0.32, 0.78, Math.sin((i / 4) * Math.PI * 2) * 0.32]}>
          <sphereGeometry args={[0.06, 8, 6]} />
          <meshBasicMaterial color={s.color} />
        </mesh>
      ))}
    </group>
  );
}

function SingingPillar({ i }: { i: number }) {
  const s = SINGING[i];
  const [wx, , wz] = w(s.x, s.z);
  const lit = useTune((t) => t.lit === i);
  const open = useGameStore((st) => !!st.progress.flags.camara_aberta);
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }, dt) => {
    const m = glow.current;
    if (!m) return;
    const want = lit ? 3.2 : open ? 1.4 + 0.3 * Math.sin(clock.elapsedTime * 2 + i) : 0.55;
    m.emissiveIntensity += (want - m.emissiveIntensity) * Math.min(1, dt * 12);
  });
  const touch = () => {
    const st = useTune.getState();
    emit({ type: 'sfx', name: NOTE_SFX[i] });
    st.set({ lit: i });
    window.setTimeout(() => useTune.getState().lit === i && useTune.getState().set({ lit: -1 }), 350);
    if (!heard() || tuneOpen() || st.playing) return;
    const r = checkTune(st, i);
    st.set({ round: r.round, entered: r.entered });
    if (r.result === 'wrong') {
      emit({ type: 'sfx', name: 'challenge_wrong' });
      useGameStore.getState().recordPractice('padroes', false);
      toast('🎵', 'Hmm, a melodia era outra. Volte à pedra do eco e escute de novo: dê um nome para cada cor, ajuda a lembrar.');
    } else if (r.result === 'round') {
      emit({ type: 'sfx', name: 'challenge_correct' });
      toast('🎶', `Isso! A melodia ${r.round} de ${TUNES.length}... os cristais esperam a próxima. Escute na pedra do eco.`);
    } else if (r.result === 'done') {
      useGameStore.getState().runActions(WILD2_CODE_ACTIONS.melodia);
      toast('💠', 'Os quatro cristais cantam juntos... e lá no fundo da caverna, a rocha se abre!');
    }
  };
  useSpot(`cristal_canto_${i}`, [wx, 0, wz], 1.3, () => {
    if (useZone.getState().zone !== 'selvagem') return null;
    return heard() && !tuneOpen() ? `Tocar o cristal ${s.id.replace('cristal_', '')}` : 'Tocar o cristal';
  }, touch, 2.1);
  return (
    <group position={[s.x, 0, s.z]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.9, 0.35]} position={[0, 0.9, 0]} />
      </RigidBody>
      <Rock variant={i + 1} kind="flat" position={[0, 0.12, 0]} scale={[0.55, 0.22, 0.5]} color="#6A6474" contact={false} />
      <mesh position={[0, 1.0, 0]} scale={[0.55, 1.6, 0.55]} rotation={[0, i, 0]} castShadow>
        <octahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial ref={glow} color={s.color} emissive={s.color} emissiveIntensity={0.55} roughness={0.15} />
      </mesh>
      <LightPool at={[0, 0]} size={[2.6, 2.6]} color={s.color} opacity={lit ? 0.6 : 0.25} />
    </group>
  );
}

/** The slab over the chamber: it sinks once the tunes are played. */
function ChamberSlab() {
  const open = useGameStore((s) => !!s.progress.flags.camara_aberta);
  const slab = useRef<THREE.Mesh>(null);
  const h = 2.6;
  useFrame((_s, d) => {
    if (!slab.current) return;
    const want = open ? -h / 2 + 0.05 : h / 2;
    slab.current.position.y += (want - slab.current.position.y) * Math.min(1, d * 1.2);
  });
  const cx = (CHAMBER.x0 + CHAMBER.x1) / 2;
  return (
    <group userData={{ dynamic: true }}>
      {!open && (
        <RigidBody type="fixed" colliders={false} userData={{ surface: 'stone' }}>
          <CuboidCollider args={[(CHAMBER.x1 - CHAMBER.x0) / 2, h / 2, 0.15]} position={[cx, h / 2, CHAMBER.z1 - 0.1]} />
        </RigidBody>
      )}
      <mesh ref={slab} position={[cx, h / 2, CHAMBER.z1 - 0.1]} castShadow>
        <boxGeometry args={[CHAMBER.x1 - CHAMBER.x0 + 0.1, h, 0.3]} />
        <Toon color="#6E6878" tex="stone" />
        <Ink thickness={0.015} />
      </mesh>
      {/* the four colours carved on it, like the echo stone */}
      {!open && SINGING.map((s, i) => (
        <mesh key={s.id} position={[cx - 0.75 + i * 0.5, 1.6, CHAMBER.z1 + 0.06]}>
          <circleGeometry args={[0.12, 12]} />
          <meshBasicMaterial color={s.color} />
        </mesh>
      ))}
    </group>
  );
}

export function WildCaveLife() {
  const water = usePondMaterial('#5E7A9A', '#2E3E5A');
  return (
    <group>
      <group userData={{ dynamic: true }}>
        <mesh position={[CAVE_POOL.x, 0.03, CAVE_POOL.z]} rotation={[-Math.PI / 2, 0, 0]} scale={[CAVE_POOL.rx, CAVE_POOL.rz, 1]}>
          <circleGeometry args={[1, 32]} />
          <primitive object={water} attach="material" />
        </mesh>
        <Sparkles count={30} scale={[14, 2.5, 12]} position={[26, 1.2, -31]} size={2.4} speed={0.25} color="#BFE8FF" opacity={0.75} />
      </group>
      <EchoStone />
      {SINGING.map((_, i) => <SingingPillar key={i} i={i} />)}
      <ChamberSlab />
    </group>
  );
}
