import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { Toon, Ink } from '../materials';
import { getPuffGeometry } from '../foliageGeometry';
import { GARDEN } from '../../data/world';
import { useGameStore } from '../../store/gameStore';
import { StoneLantern } from './Props';

const HEDGE = '#3F7A4A';
const WALL_H = 3.4;

/**
 * A clipped hedge built from overlapping leaf clusters on both faces and along the top, over a darker
 * core that fills the gaps. The old one was a flat green box with a row of puffs on top, which read as
 * a painted crate in the art audit (§25).
 */
function Hedge({ from, to }: { from: [number, number]; to: [number, number] }) {
  const cx = (from[0] + to[0]) / 2;
  const cz = (from[1] + to[1]) / 2;
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const rot = -Math.atan2(to[1] - from[1], to[0] - from[0]);
  const n = Math.max(2, Math.round(len / 0.8));
  const tufts: { p: [number, number, number]; s: [number, number, number]; c: string }[] = [];
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + (len * (i + 0.5)) / n;
    const j = (i * 7) % 5;
    for (const side of [-1, 1]) {
      for (const [y, k] of [[0.75, 0.62], [1.85, 0.6], [2.8, 0.52]] as const) {
        tufts.push({ p: [x + ((j % 3) - 1) * 0.08, y + (j % 2) * 0.1, side * (0.36 + (j % 2) * 0.03)], s: [k, k * 1.05, 0.34], c: (i + j) % 3 ? HEDGE : '#4A8A55' });
      }
    }
    tufts.push({ p: [x, WALL_H - 0.12 + (j % 2) * 0.06, 0], s: [0.58, 0.36, 0.56], c: i % 2 ? '#4A8A55' : '#56965E' });
  }
  return (
    <RigidBody type="fixed" colliders={false} position={[cx, 0, cz]} rotation={[0, rot, 0]}>
      <CuboidCollider args={[len / 2, WALL_H / 2, 0.45]} position={[0, WALL_H / 2, 0]} />
      <mesh position={[0, (WALL_H - 0.2) / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[len, WALL_H - 0.2, 0.62]} />
        <Toon color="#2F6038" />
      </mesh>
      {tufts.map((t, i) => (
        <mesh key={i} position={t.p} scale={t.s} rotation={[0, i * 1.9, 0]} geometry={getPuffGeometry(i, 'low')} dispose={null} castShadow={i % 3 === 0}>
          <Toon color={t.c} vertexColors />
        </mesh>
      ))}
    </RigidBody>
  );
}

function StoneDoor() {
  const open = useGameStore((s) => !!s.progress.flags.porta_aberta);
  const slab = useRef<THREE.Group>(null);
  const [x, , z] = GARDEN.door;

  useFrame((_s, d) => {
    if (!slab.current) return;
    const target = open ? -3.2 : 0;
    slab.current.position.y += (target - slab.current.position.y) * Math.min(1, d * 1.5);
  });

  return (
    <group position={[x, 0, z]} userData={{ dynamic: true }}>
      {!open && (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.35, WALL_H / 2, 0.85]} position={[0, WALL_H / 2, 0]} />
        </RigidBody>
      )}
      <group ref={slab}>
        <mesh position={[0, 1.35, 0]} castShadow>
          <boxGeometry args={[0.5, 2.7, 1.6]} />
          <Toon color="#8E8A80" />
          <Ink thickness={0.03} />
        </mesh>
        {[-0.45, -0.15, 0.15, 0.45].map((zz, i) => (
          <mesh key={i} position={[0.27, 1.9, zz]}>
            <boxGeometry args={[0.03, 0.22, 0.14]} />
            <Toon color={open ? '#FFC857' : '#5E5A52'} emissive={open ? '#FFB300' : '#000000'} emissiveIntensity={open ? 0.9 : 0} />
          </mesh>
        ))}
        <mesh position={[0.27, 1.2, 0]} rotation={[0, Math.PI / 2, 0]}>
          <circleGeometry args={[0.16, 14]} />
          <Toon color="#5E5A52" />
        </mesh>
      </group>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, WALL_H / 2, s * 0.95]} castShadow>
          <boxGeometry args={[0.8, WALL_H + 0.2, 0.3]} />
          <Toon color="#9C968A" />
        </mesh>
      ))}
      <mesh position={[0, WALL_H + 0.2, 0]}>
        <boxGeometry args={[0.9, 0.25, 2.3]} />
        <Toon color="#5E5A52" />
      </mesh>
    </group>
  );
}

function KoiPond() {
  const fish = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (fish.current) fish.current.rotation.y = s.clock.elapsedTime * 0.5;
  });
  return (
    <group position={[-14.2, 0, -17.2]} userData={{ dynamic: true }}>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.25, 20]} />
        <Toon color="#4FA9D6" emissive="#2E7FB0" emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.2, 1.45, 20]} />
        <Toon color="#9A9488" />
      </mesh>
      <group ref={fish}>
        {[0, 1].map((i) => (
          <mesh key={i} position={[Math.cos(i * Math.PI) * 0.6, 0.08, Math.sin(i * Math.PI) * 0.6]} rotation={[0, i * Math.PI, 0]} scale={[1, 0.4, 0.45]}>
            <sphereGeometry args={[0.16, 8, 6]} />
            <Toon color={i ? '#F28C38' : '#FFFFFF'} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Altar() {
  return (
    <RigidBody type="fixed" colliders={false} position={[-15.8, 0, -14.6]}>
      <CuboidCollider args={[0.6, 0.35, 0.4]} position={[0, 0.35, 0]} />
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[1.2, 0.7, 0.8]} />
        <Toon color="#9C8F7C" />
        <Ink thickness={0.02} />
      </mesh>
      <mesh position={[0, 0.72, 0]}>
        <boxGeometry args={[1.3, 0.06, 0.9]} />
        <Toon color="#7A2E2E" />
      </mesh>
    </RigidBody>
  );
}

function Pedestal() {
  return (
    <RigidBody type="fixed" colliders={false} position={[-16.6, 0, -13.4]}>
      <CylinderCollider args={[0.4, 0.38]} position={[0, 0.4, 0]} />
      <mesh position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.4, 0.8, 8]} />
        <Toon color="#B3AA9A" />
        <Ink thickness={0.02} />
      </mesh>
    </RigidBody>
  );
}

export function SecretGarden() {
  const { maxX, maxZ, minX, minZ } = GARDEN;
  const dz = GARDEN.door[2];
  return (
    <group>
      <Hedge from={[maxX, minZ]} to={[maxX, dz - 0.95]} />
      <Hedge from={[maxX, dz + 0.95]} to={[maxX, maxZ]} />
      <Hedge from={[minX, maxZ]} to={[maxX - 0.45, maxZ]} />
      <StoneDoor />
      <mesh position={[(minX + maxX) / 2, 0.014, (minZ + maxZ) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[maxX - minX, maxZ - minZ]} />
        <meshToonMaterial color="#8CC46A" />
      </mesh>
      <KoiPond />
      <Altar />
      <Pedestal />
      <StoneLantern position={[-13.2, 0, -13]} />
      <StoneLantern position={[-18.2, 0, -15.6]} />
    </group>
  );
}
