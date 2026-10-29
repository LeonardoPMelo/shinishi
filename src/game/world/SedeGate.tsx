import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { Toon, Ink } from '../materials';
import { useGameStore } from '../../store/gameStore';
import { JapaneseRoof, PaperLantern } from './Buildings';
import { INTERIORS_BY_ID } from '../../data/interiors';
import { PawEmblem } from './interiorProps';

/**
 * The great gate of Mikage's residence (Etapa 5 da expansão), at the far end of the Training Forest, against
 * the south fence: the one stretch of fence with room for it (checked against every collider; the first try,
 * north of the plaza, sat on the Mirante stairs). Tall red posts, a double tiled roof, stone walls on each side and heavy doors with the golden
 * paw. The doors stay shut until the Guarda Toshi lets the graduate in; the door itself is in Interiors.tsx
 * (the residence is one of the interiors).
 */

const G = INTERIORS_BY_ID.sede.house;
const RED = '#A8352C';
const STONE = '#A8A196';

export function SedeGate() {
  const open = useGameStore((s) => !!s.progress.flags.acesso_sede);
  const half = G.w / 2;
  return (
    <group position={[G.c[0], 0, G.c[1]]} rotation={[0, G.rot, 0]}>
      <RigidBody type="fixed" colliders={false}>
        {/* posts, the shut doorway (the cat goes in through the door, not through the gate), side walls */}
        <CuboidCollider args={[0.25, 1.9, 0.25]} position={[-half, 1.9, 0]} />
        <CuboidCollider args={[0.25, 1.9, 0.25]} position={[half, 1.9, 0]} />
        <CuboidCollider args={[half, 1.6, 0.2]} position={[0, 1.6, -0.25]} />
        <CuboidCollider args={[0.5, 0.9, 0.35]} position={[-half - 0.75, 0.9, -0.3]} />
        <CuboidCollider args={[0.5, 0.9, 0.35]} position={[half + 0.75, 0.9, -0.3]} />
      </RigidBody>
      {/* stone footing and posts */}
      {[-half, half].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.7, 0.5, 0.7]} />
            <Toon color={STONE} tex="stone" />
            <Ink thickness={0.015} />
          </mesh>
          <mesh position={[0, 2.1, 0]} castShadow>
            <cylinderGeometry args={[0.22, 0.25, 3.4, 14]} />
            <Toon color={RED} tex="wood" />
            <Ink thickness={0.015} />
          </mesh>
          <PaperLantern position={[0, 2.2, 0.4]} color="#E8A33D" />
        </group>
      ))}
      {/* side walls: plastered, on a stone base, with a little tiled cap */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (half + 0.75), 0, -0.3]}>
          <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.0, 0.6, 0.7]} />
            <Toon color={STONE} tex="stone" />
          </mesh>
          <mesh position={[0, 1.15, 0]} castShadow>
            <boxGeometry args={[0.96, 1.1, 0.55]} />
            <Toon color="#F1E6D2" tex="plaster" />
            <Ink thickness={0.012} />
          </mesh>
          <mesh position={[0, 1.8, 0]} castShadow>
            <boxGeometry args={[1.2, 0.18, 0.85]} />
            <Toon color="#3F4650" tex="tiles" />
          </mesh>
        </group>
      ))}
      {/* lintel, plaque and the double roof */}
      <mesh position={[0, 3.55, 0]} castShadow>
        <boxGeometry args={[G.w + 1.0, 0.28, 0.45]} />
        <Toon color={RED} tex="wood" />
        <Ink thickness={0.015} />
      </mesh>
      <mesh position={[0, 3.1, 0.24]}>
        <boxGeometry args={[1.3, 0.5, 0.06]} />
        <Toon color="#2E2A2E" />
      </mesh>
      <group position={[0, 3.1, 0.28]}>
        <PawEmblem scale={0.85} />
      </group>
      <group position={[0, 3.7, 0]}>
        <JapaneseRoof w={G.w + 0.8} d={1.9} h={0.7} color="#3F4650" overhang={0.6} upturn={0.4} />
      </group>
      <group position={[0, 4.35, 0]}>
        <JapaneseRoof w={G.w - 0.4} d={1.3} h={0.55} color="#3F4650" overhang={0.45} upturn={0.45} />
      </group>
      {/* the doors swing open once the guard lets you in (kept out of StaticMerge: they move) */}
      <group userData={{ dynamic: true }}>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * half - s * 0.05, 0, -0.1]} rotation={[0, open ? s * -1.2 : 0, 0]}>
            <mesh position={[-s * (half - 0.05) / 2, 1.55, 0]} castShadow>
              <boxGeometry args={[half - 0.12, 2.9, 0.12]} />
              <Toon color="#5A3B28" tex="planks" />
              <Ink thickness={0.012} />
            </mesh>
            {[0.7, 1.55, 2.4].map((y) => (
              <mesh key={y} position={[-s * (half - 0.05) / 2, y, 0.07]}>
                <boxGeometry args={[half - 0.2, 0.08, 0.03]} />
                <Toon color="#2E2A2E" />
              </mesh>
            ))}
            <group position={[-s * (half - 0.05) / 2, 1.9, 0.09]}>
              <PawEmblem scale={0.55} />
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}
