import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { Toon, Ink } from '../materials';
import { PineTree } from './Props';
import { Rock } from './Rock';
import { usePondMaterial } from './EastDistrict';
import { useIconTexture } from '../systems/training';
import { useGameStore } from '../../store/gameStore';
import { useZone } from '../systems/zone';
import { playerPosition } from '../systems/playerState';
import { EXIT_GATE, EXIT_TRAIL, EXIT_TRIGGER_Z, EXIT_BROOK, EXIT_BROOK_STONES, CLEARING_CODE_ACTIONS } from '../../data/clearing';

/**
 * The way out of the village (data/clearing.ts): the gate in the Clareira dos Cervos' fence, the trail through
 * thick forest past it, the brook, and the end of the trail, where walking on takes the cat to the wild lands.
 * The gate is a stone-and-log affair, plain and sturdy (not the temple's lacquer and gold): it says "outside".
 * Static parts merge with the village (`ExitTrail`); the rope, the water and the walk-on are `ExitTrailLife`.
 */

const STONE = '#8E877C';
const LOG = '#7A5A44';
const STONE_DATA = { surface: 'stone' };
const SOIL = '#8C6E4E';

/** A cairn pillar of stacked stones with a log post rising from it. */
function Cairn({ x }: { x: number }) {
  return (
    <group position={[x, 0, EXIT_GATE.z]}>
      {[[0, 0.3, 0.62, 0.6], [0.05, 0.85, 0.52, 0.5], [-0.03, 1.32, 0.44, 0.44]].map(([dx, y, r, h], i) => (
        <mesh key={i} position={[dx, y, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[r * 0.92, r, h, 7]} />
          <Toon color={i % 2 ? '#9A9184' : STONE} tex="stone" />
          <Ink thickness={0.015} />
        </mesh>
      ))}
      <mesh position={[0, 2.3, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.2, 2.4, 8]} />
        <Toon color={LOG} tex="bark" />
        <Ink thickness={0.015} />
      </mesh>
      {/* a torch bracket */}
      <mesh position={[0, 2.2, 0.28]} rotation={[0.4, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 0.5, 6]} />
        <Toon color="#4A3426" />
      </mesh>
    </group>
  );
}

function ExitGate() {
  const { x, z, halfWidth } = EXIT_GATE;
  const sign = useIconTexture('🐾', '#F3E2B8', '#2A1E16');
  const px = halfWidth + 0.55;
  return (
    <group>
      <RigidBody type="fixed" colliders={false} userData={STONE_DATA}>
        {[-1, 1].map((s) => <CuboidCollider key={s} args={[0.6, 2.2, 0.6]} position={[x + s * px, 2.2, z]} />)}
      </RigidBody>
      <Cairn x={x - px} />
      <Cairn x={x + px} />
      {/* the lashed crossbeam and the carved board */}
      <mesh position={[x, 3.42, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.2, 0.22, px * 2 + 1.0, 9]} />
        <Toon color={LOG} tex="bark" />
        <Ink thickness={0.015} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[x + s * px, 3.42, z]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.24, 0.04, 5, 12]} />
          <Toon color="#C9B48C" />
        </mesh>
      ))}
      {[-0.5, 0.5].map((dx) => (
        <mesh key={dx} position={[x + dx, 3.05, z + 0.05]}>
          <cylinderGeometry args={[0.015, 0.015, 0.55, 4]} />
          <Toon color="#C9B48C" />
        </mesh>
      ))}
      <mesh position={[x, 2.75, z + 0.06]} castShadow>
        <boxGeometry args={[1.5, 0.5, 0.08]} />
        <Toon color="#9B7048" tex="wood" />
        <Ink thickness={0.012} />
      </mesh>
      {/* the paw faces the village (the board's north side) */}
      <mesh position={[x, 2.75, z - 0.05]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.42, 0.42]} />
        <meshBasicMaterial map={sign} transparent />
      </mesh>
      {/* the straw rope with paper streamers, hung under the beam */}
      <mesh position={[x, 3.1, z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, px * 2 - 0.4, 6]} />
        <Toon color="#D8C27A" tex="thatch" />
      </mesh>
      {[-1.1, -0.35, 0.35, 1.1].map((dx) => (
        <mesh key={dx} position={[x + dx, 2.85, z + 0.02]}>
          <planeGeometry args={[0.12, 0.38]} />
          <Toon color="#FFF6E4" side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

/** Trees, rocks and ferns crowding the trail: the forest gets thicker the farther you go. */
function TrailForest() {
  const trees = useMemo(() => {
    let s = 6262;
    const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    const out: { x: number; z: number; s: number }[] = [];
    for (let z = EXIT_TRAIL.z0 + 1.2; z < EXIT_TRAIL.z1 + 1.5; z += 1.6) {
      for (const side of [-1, 1]) {
        const edge = side < 0 ? EXIT_TRAIL.x0 : EXIT_TRAIL.x1;
        out.push({ x: edge + side * (0.9 + r() * 1.4), z: z + (r() - 0.5) * 0.8, s: 1.0 + r() * 0.5 });
        if (r() > 0.4) out.push({ x: edge + side * (2.6 + r() * 1.8), z: z + (r() - 0.5) * 1.2, s: 1.15 + r() * 0.5 });
      }
    }
    // the trees close in past the end of the trail
    for (let x = EXIT_TRAIL.x0 - 0.6; x <= EXIT_TRAIL.x1 + 0.6; x += 1.4) out.push({ x, z: EXIT_TRAIL.z1 + 1.4 + r() * 0.6, s: 1.3 + r() * 0.4 });
    return out;
  }, []);
  const rocks: [number, number, number, number][] = [
    [-11.0, 65.2, 0.55, 1], [-6.9, 66.0, 0.45, 2], [-11.1, 68.6, 0.6, 3], [-7.0, 69.4, 0.5, 4], [-10.6, 70.4, 0.4, 0],
  ];
  const ferns: [number, number][] = [[-10.8, 64.6], [-7.2, 65.0], [-10.9, 67.8], [-7.1, 68.2], [-10.7, 69.6], [-7.4, 70.3]];
  return (
    <group>
      {trees.map((t, i) => <PineTree key={i} position={[t.x, 0, t.z]} scale={t.s} />)}
      {rocks.map(([x, z, s, v], i) => (
        <Rock key={i} variant={v} position={[x, s * 0.4, z]} scale={[s * 1.3, s, s * 1.1]} color={i % 2 ? STONE : '#7F776B'} castShadow receiveShadow />
      ))}
      {ferns.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          {[0, 1, 2, 3, 4].map((k) => (
            <mesh key={k} position={[Math.cos(k * 1.26) * 0.18, 0.18, Math.sin(k * 1.26) * 0.18]} rotation={[0, -k * 1.26, -0.8]} scale={[1, 0.12, 0.3]}>
              <sphereGeometry args={[0.32, 6, 3]} />
              <Toon color={k % 2 ? '#4F7A3A' : '#5E8C46'} wind />
            </mesh>
          ))}
        </group>
      ))}
      {/* the dirt trail, and a marker post with a ribbon halfway */}
      <mesh position={[(EXIT_TRAIL.x0 + EXIT_TRAIL.x1) / 2, 0.014, (EXIT_GATE.z + EXIT_TRAIL.z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1.8, EXIT_TRAIL.z1 - EXIT_GATE.z + 0.6]} />
        <Toon color={SOIL} />
      </mesh>
      <mesh position={[-7.6, 0.7, 68.4]} castShadow>
        <boxGeometry args={[0.16, 1.4, 0.16]} />
        <Toon color={LOG} tex="wood" />
      </mesh>
      <mesh position={[-7.6, 1.25, 68.5]}>
        <boxGeometry args={[0.04, 0.4, 0.12]} />
        <Toon color="#C0573E" />
      </mesh>
      {/* stepping stones over the brook (flush: you can also just splash across) */}
      {EXIT_BROOK_STONES.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.06, z]} rotation={[0, i, 0]} scale={[1, 1, 0.8]} receiveShadow>
          <cylinderGeometry args={[0.32, 0.36, 0.1, 7]} />
          <Toon color="#A8A196" tex="stone" />
        </mesh>
      ))}
    </group>
  );
}

/** Kaze's lookout by the gate: a small tent, a pack and a ring of stones. */
function ScoutCamp() {
  return (
    <group position={[-4.6, 0, 62.2]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.75, 0.6, 0.65]} position={[0, 0.6, 0]} />
      </RigidBody>
      <mesh position={[0, 0.6, 0]} rotation={[0, 0, 0]} castShadow>
        <coneGeometry args={[0.95, 1.2, 4]} />
        <Toon color="#4F6B52" />
        <Ink thickness={0.015} />
      </mesh>
      <mesh position={[-1.2, 0.22, 0.6]} castShadow>
        <boxGeometry args={[0.4, 0.44, 0.28]} />
        <Toon color="#8C5A3A" />
      </mesh>
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[-0.9 + Math.cos((i / 7) * Math.PI * 2) * 0.32, 0.06, 1.3 + Math.sin((i / 7) * Math.PI * 2) * 0.32]}>
          <sphereGeometry args={[0.09, 6, 5]} />
          <Toon color={STONE} />
        </mesh>
      ))}
    </group>
  );
}

export function ExitTrail() {
  return (
    <group>
      <ExitGate />
      <TrailForest />
      <ScoutCamp />
    </group>
  );
}

/**
 * The rope across the gate (until the Sede authorizes the expedition: Yuki's "trilha.ouvir"), the brook, the
 * torches, the mist at the end, and the walk-on: past EXIT_TRIGGER_Z the trail takes the cat to the wild lands
 * (the same actions as the gate's "Seguir pela Trilha da Expedição").
 */
export function ExitTrailLife() {
  const open = useGameStore((s) => !!s.progress.missions.trilha?.steps.includes('ouvir'));
  const water = usePondMaterial('#C8EDE2', '#5FA8B8');
  const sent = useRef(false);
  useFrame(() => {
    if (useZone.getState().zone !== 'outdoor') {
      sent.current = false;
      return;
    }
    const st = useGameStore.getState();
    const past = playerPosition.z > EXIT_TRIGGER_Z && playerPosition.x > EXIT_TRAIL.x0 - 0.5 && playerPosition.x < EXIT_TRAIL.x1 + 0.5;
    if (!past) {
      sent.current = false;
      return;
    }
    if (sent.current || st.phase !== 'playing' || useZone.getState().fading) return;
    if (!st.progress.missions.trilha?.steps.includes('ouvir')) return;
    sent.current = true;
    st.runActions(CLEARING_CODE_ACTIONS.trilha);
  });
  const flames = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    flames.current?.children.forEach((m, i) => m.scale.setScalar(1 + Math.sin(clock.elapsedTime * 10 + i * 2) * 0.15));
  });
  const { x, z, halfWidth } = EXIT_GATE;
  const px = halfWidth + 0.55;
  return (
    <group userData={{ dynamic: true }}>
      {!open && (
        <group>
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={[px - 0.6, 1.5, 0.15]} position={[x, 1.5, z]} />
          </RigidBody>
          {[0.75, 1.15].map((y) => (
            <mesh key={y} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.035, 0.035, px * 2 - 0.9, 5]} />
              <Toon color="#C9B48C" />
            </mesh>
          ))}
        </group>
      )}
      <group ref={flames}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[x + s * px, 2.55, z + 0.4]}>
            <sphereGeometry args={[0.1, 8, 6]} />
            <meshBasicMaterial color="#FFB347" />
          </mesh>
        ))}
      </group>
      <mesh position={[(EXIT_TRAIL.x0 + EXIT_TRAIL.x1) / 2, 0.03, EXIT_BROOK.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[EXIT_TRAIL.x1 - EXIT_TRAIL.x0 + 6, EXIT_BROOK.halfWidth * 2]} />
        <primitive object={water} attach="material" />
      </mesh>
      <Sparkles count={24} scale={[5, 2, 2.4]} position={[(EXIT_TRAIL.x0 + EXIT_TRAIL.x1) / 2, 1.0, EXIT_TRAIL.z1 - 0.4]} size={5} speed={0.2} color="#E8F2EC" opacity={0.6} />
    </group>
  );
}
