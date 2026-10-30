import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { Toon, Ink } from '../materials';
import { useGameStore } from '../../store/gameStore';
import { useIconTexture } from '../systems/training';
import { OBJECTS_BY_ID } from '../../data/world';
import { STELES, JADE } from '../../data/story';
import type { Vec3 } from '../../types';

/**
 * The things of chapter 7 in the world (Etapa 8 da expansão), placed where data/story.ts puts their objects:
 * the three steles of the old techniques, the sun pedestal and the hatch of the Celeiro do Sol in the temple's
 * sanctuary, the basket in Mestre Kuma's shed and the lectern with the flood record in Mikage's library.
 * The interaction itself is the world object's (WorldObjects.tsx); this only draws and makes solid.
 */

const at = (id: string): Vec3 => OBJECTS_BY_ID[id].position;
const STONE_DATA = { surface: 'stone' };

const STELE_ICON: Record<string, string> = { estela_faro: '👃', estela_miado: '😺', estela_salto: '🌀' };

function Stele({ id, pos }: { id: string; pos: Vec3 }) {
  const tex = useIconTexture(STELE_ICON[id], '#D9CDB2', '#3A2E22');
  // set back 0.9 m from the reading spot, facing it
  return (
    <group position={[pos[0], pos[1], pos[2] - 0.9]}>
      <RigidBody type="fixed" colliders={false} userData={STONE_DATA}>
        <CuboidCollider args={[0.45, 0.8, 0.18]} position={[0, 0.8, 0]} />
      </RigidBody>
      <mesh position={[0, 0.8, 0]} castShadow>
        <boxGeometry args={[0.9, 1.6, 0.34]} />
        {/* plain stone: the "stone" texture reads as bricks */}
        <Toon color="#A89C86" />
        <Ink thickness={0.02} />
      </mesh>
      <mesh position={[0, 1.66, 0]} scale={[1, 0.45, 0.4]}>
        <sphereGeometry args={[0.45, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Toon color="#9A8E78" />
      </mesh>
      <mesh position={[0, 1.15, 0.175]}>
        <planeGeometry args={[0.52, 0.52]} />
        <meshBasicMaterial map={tex} transparent />
      </mesh>
      {/* a few lines of carved text */}
      {[0.75, 0.6, 0.45].map((y) => (
        <mesh key={y} position={[0, y, 0.175]}>
          <planeGeometry args={[0.6, 0.04]} />
          <meshBasicMaterial color="#6E6250" />
        </mesh>
      ))}
    </group>
  );
}

/** The sun pedestal: the disc shows once it is set in; then the round stone beside the altar sinks. */
function SunPedestal() {
  const open = useGameStore((s) => !!s.progress.flags.celeiro_aberto);
  const p = at('pedestal_sol');
  const h = at('inscricao_celeiro');
  const slab = useRef<THREE.Mesh>(null);
  useFrame((_s, d) => {
    if (slab.current) slab.current.position.y += ((open ? -0.6 : 0.06) - slab.current.position.y) * Math.min(1, d * 1.2);
  });
  return (
    <>
      {/* the sun carved on the sanctuary's back wall, above the altar: dark until the disc is set in */}
      <group position={[p[0], 0, p[2] - 1.66]}>
        <mesh position={[0, 1.85, 0]}>
          <circleGeometry args={[0.3, 24]} />
          <Toon color={open ? '#E2B84E' : '#6E6250'} emissive={open ? '#E2B84E' : undefined} emissiveIntensity={open ? 0.8 : 0} />
        </mesh>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} position={[Math.cos((i / 8) * Math.PI * 2) * 0.42, 1.85 + Math.sin((i / 8) * Math.PI * 2) * 0.42, 0]} rotation={[0, 0, (i / 8) * Math.PI * 2]}>
            <planeGeometry args={[0.16, 0.05]} />
            <Toon color={open ? '#E2B84E' : '#7E7262'} />
          </mesh>
        ))}
      </group>
      {/* the hatch of the granary: a round stone that sinks, and the glow of the baskets below */}
      <group position={[h[0], 0, h[2] - 0.9]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
          <circleGeometry args={[0.95, 24]} />
          <meshBasicMaterial color={open ? '#2A1E16' : '#8E8170'} />
        </mesh>
        <mesh ref={slab} position={[0, 0.06, 0]} userData={{ dynamic: true }}>
          <cylinderGeometry args={[0.9, 0.9, 0.12, 24]} />
          <Toon color="#A89C86" tex="stone" />
        </mesh>
        {open && (
          <>
            {[[-0.35, 0.1], [0.3, -0.2], [0.05, 0.35]].map(([x, z]) => (
              <mesh key={`${x}${z}`} position={[x, -0.15, z]}>
                <cylinderGeometry args={[0.16, 0.13, 0.22, 8]} />
                <Toon color="#C9A56A" emissive="#FFD58A" emissiveIntensity={0.35} />
              </mesh>
            ))}
          </>
        )}
      </group>
    </>
  );
}

/** Vovó Mochi's basket in the shed, with the jade ribbon on the handle until Shinichi takes it. */
function Basket() {
  const taken = useGameStore((s) => !!s.progress.missions.cesto?.steps.includes('cesto'));
  const p = at('cesto_antigo');
  return (
    <group position={[p[0] - 0.7, 0, p[2]]} rotation={[0, 0.4, 0]}>
      <mesh position={[0, 0.17, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.24, 0.34, 14, 1, true]} />
        <meshToonMaterial color="#B08A52" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.24, 14]} />
        <Toon color="#9A7442" />
      </mesh>
      <mesh position={[0, 0.34, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.3, 0.025, 6, 20, Math.PI]} />
        <Toon color="#8C6A3A" />
      </mesh>
      {/* the cloth it was wrapped in, folded beside it */}
      <mesh position={[0.45, 0.04, 0.1]}>
        <boxGeometry args={[0.36, 0.08, 0.3]} />
        <Toon color="#D9CDB2" />
      </mesh>
      {!taken && (
        <mesh position={[0, 0.62, 0]} rotation={[0, 0, 0.3]}>
          <torusGeometry args={[0.07, 0.022, 6, 12]} />
          <Toon color={JADE} emissive={JADE} emissiveIntensity={0.25} />
        </mesh>
      )}
    </group>
  );
}

/** The lectern in Mikage's library with the record of the Great Flood. */
function Lectern() {
  const p = at('registro_cheia');
  return (
    <group position={[p[0] + 0.85, 0, p[2]]} rotation={[0, -Math.PI / 2, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.25, 0.5, 0.2]} position={[0, 0.5, 0]} />
      </RigidBody>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[0.16, 0.9, 0.16]} />
        <Toon color="#6E4A30" tex="wood" />
      </mesh>
      <mesh position={[0, 0.95, 0.02]} rotation={[-0.45, 0, 0]}>
        <boxGeometry args={[0.55, 0.04, 0.4]} />
        <Toon color="#7A5236" tex="wood" />
      </mesh>
      <mesh position={[0, 0.99, 0.03]} rotation={[-0.45, 0, 0]}>
        <boxGeometry args={[0.48, 0.03, 0.34]} />
        <Toon color="#F4EAD2" />
      </mesh>
    </group>
  );
}

/** Outdoors (drawn with the village). */
export function StoryPropsOutdoor() {
  return (
    <>
      {STELES.map((s) => <Stele key={s.id} id={s.id} pos={s.at} />)}
      <SunPedestal />
      <Basket />
    </>
  );
}

/** Inside Mikage's residence (drawn always; it is far off the map, like the rooms). */
export function StoryPropsSede() {
  return <Lectern />;
}
