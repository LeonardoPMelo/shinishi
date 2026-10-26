import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { Toon, Ink } from '../materials';
import { SHED_POS, KIKO_HOUSE, MACHINE_POS, FOOTPRINT_PATH } from '../../data/world';
import { House, PaperLantern } from './Buildings';
import { useGameStore } from '../../store/gameStore';
import { MISSIONS } from '../../data/missions';
import { isStepAvailable } from '../../systems/progression';

function Shed() {
  return (
    <RigidBody type="fixed" colliders={false} position={SHED_POS} rotation={[0, 0.2, 0]}>
      <CuboidCollider args={[1.2, 1, 1]} position={[0, 1, 0]} />
      <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 1.8, 2]} />
        <Toon color="#7E6450" />
        <Ink thickness={0.03} />
      </mesh>
      {[-0.6, -0.2, 0.2, 0.6].map((y) => (
        <mesh key={y} position={[1.21, 0.9 + y * 1.2, 0]}>
          <boxGeometry args={[0.02, 0.05, 2.02]} />
          <Toon color="#5E4838" />
        </mesh>
      ))}
      <mesh position={[0, 2.05, 0]} rotation={[0, 0, 0.12]}>
        <boxGeometry args={[2.8, 0.14, 2.4]} />
        <Toon color="#5C5048" />
      </mesh>
      <mesh position={[1.22, 0.7, 0.4]}>
        <boxGeometry args={[0.03, 1.2, 0.7]} />
        <Toon color="#3A2C22" />
      </mesh>
    </RigidBody>
  );
}

function Basket() {
  return (
    <group position={[SHED_POS[0], 0, SHED_POS[2] + 2]}>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.65, 0.55, 0.3, 14]} />
        <Toon color="#B98A52" />
        <Ink thickness={0.015} />
      </mesh>
      <mesh position={[0.1, 0.32, 0.1]} rotation={[0, 0.4, 0]} scale={[1, 0.25, 0.8]}>
        <sphereGeometry args={[0.6, 12, 8]} />
        <Toon color="#7FA6D9" />
      </mesh>
    </group>
  );
}

function Machine() {
  const steps = useGameStore((s) => s.progress.missions.inventor?.steps ?? []);
  const fan = useRef<THREE.Mesh>(null);
  const running = steps.includes('ligar');
  const installed = steps.includes('instalar');
  useFrame((_s, d) => {
    if (fan.current) fan.current.rotation.z += d * (running ? 6 : installed ? 1.2 : 0);
  });
  return (
    <group userData={{ dynamic: true }}>
    <RigidBody type="fixed" colliders={false} position={MACHINE_POS} rotation={[0, -0.5, 0]}>
      <CuboidCollider args={[0.9, 0.9, 0.7]} position={[0, 0.9, 0]} />
      <mesh position={[0, 0.8, 0]} castShadow>
        <boxGeometry args={[1.8, 1.6, 1.4]} />
        <Toon color="#C9873A" />
        <Ink thickness={0.03} />
      </mesh>
      <mesh position={[0.5, 1.95, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 0.8, 10]} />
        <Toon color="#6E7380" />
      </mesh>
      <mesh ref={fan} position={[0, 0.95, 0.72]}>
        <torusGeometry args={[0.36, 0.07, 6, installed ? 8 : 3]} />
        <Toon color={installed ? '#D6B04C' : '#7A7A7A'} />
      </mesh>
      <mesh position={[-0.55, 1.35, 0.72]}>
        <sphereGeometry args={[0.1, 10, 8]} />
        <Toon color="#E8453B" emissive="#E8453B" emissiveIntensity={running ? 0.2 : 0.8} />
      </mesh>
      <mesh position={[0, 0.25, 0.85]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[1.2, 0.08, 0.6]} />
        <Toon color="#8C6440" />
      </mesh>
      {running && [0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[-0.45 + i * 0.3, 0.32, 1.0]} scale={[1, 0.45, 0.3]}>
          <sphereGeometry args={[0.13, 8, 6]} />
          <Toon color="#8FB3D9" />
        </mesh>
      ))}
    </RigidBody>
    </group>
  );
}

/** Glowing paw prints that appear while the ghost investigation needs them. */
function Footprints() {
  const visible = useGameStore((s) => s.progress.missions.fantasma?.status === 'active' && isStepAvailable(MISSIONS.fantasma, 'pegadas', s.progress));
  const prints = useMemo(() => {
    const out: { pos: THREE.Vector3; rot: number }[] = [];
    for (let i = 0; i < FOOTPRINT_PATH.length - 1; i++) {
      const a = new THREE.Vector3(...FOOTPRINT_PATH[i]);
      const b = new THREE.Vector3(...FOOTPRINT_PATH[i + 1]);
      const rot = Math.atan2(b.x - a.x, b.z - a.z);
      for (let k = 0; k < 2; k++) {
        const p = a.clone().lerp(b, k / 2);
        const side = new THREE.Vector3(Math.cos(rot), 0, -Math.sin(rot)).multiplyScalar(k % 2 ? 0.14 : -0.14);
        out.push({ pos: p.add(side), rot });
      }
    }
    return out;
  }, []);
  const group = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (!group.current) return;
    group.current.children.forEach((c, i) => {
      const m = (c as THREE.Mesh).material as THREE.MeshBasicMaterial;
      if (m) m.opacity = 0.45 + 0.4 * Math.sin(s.clock.elapsedTime * 3 - i * 0.5);
    });
  });
  if (!visible) return null;
  return (
    <group ref={group} userData={{ dynamic: true }}>
      {prints.map((p, i) => (
        <mesh key={i} position={[p.pos.x, 0.04, p.pos.z]} rotation={[-Math.PI / 2, 0, p.rot]}>
          <circleGeometry args={[0.13, 10]} />
          <meshBasicMaterial color="#9FE3FF" transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  );
}

export function Outskirts() {
  return (
    <group>
      <Shed />
      <Basket />
      <House position={KIKO_HOUSE} rotY={-Math.PI / 2} size={[3.2, 2.2, 2.6]} wall="#E3E6EE" roof="#5A6E8C" noren="#C9873A" />
      <Machine />
      <PaperLantern position={[13.4, 2.2, 16.2]} color="#F2A541" />
      <Footprints />
    </group>
  );
}
