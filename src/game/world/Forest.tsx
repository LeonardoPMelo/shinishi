import { RigidBody, CylinderCollider } from '@react-three/rapier';
import { Toon, Ink } from '../materials';
import { PILLARS, TALL_ROCK } from '../../data/world';
import { SakuraTree, PineTree, Bamboo, TrainingPost, StoneLantern } from './Props';
import { Rock } from './Rock';

function StonePillar({ pos, h }: { pos: [number, number, number]; h: number }) {
  return (
    <RigidBody type="fixed" colliders={false} position={pos}>
      <CylinderCollider args={[h / 2, 0.85]} position={[0, h / 2, 0]} />
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.85, 0.95, h, 8]} />
        <Toon color="#A39A8A" />
        <Ink thickness={0.025} />
      </mesh>
      <mesh position={[0, h + 0.03, 0]} receiveShadow>
        <cylinderGeometry args={[0.8, 0.8, 0.06, 8]} />
        <Toon color="#7FA65A" />
      </mesh>
    </RigidBody>
  );
}

function TallRock() {
  const { pos, h, r } = TALL_ROCK;
  return (
    <RigidBody type="fixed" colliders={false} position={pos}>
      <CylinderCollider args={[h / 2, r]} position={[0, h / 2, 0]} />
      <mesh position={[0, h / 2, 0]} scale={[1, 1, 0.9]} castShadow receiveShadow>
        <cylinderGeometry args={[r * 0.85, r * 1.1, h, 7]} />
        <Toon color="#8E8173" />
        <Ink thickness={0.03} />
      </mesh>
      <mesh position={[0, h + 0.05, 0]}>
        <cylinderGeometry args={[r * 0.8, r * 0.85, 0.1, 7]} />
        <Toon color="#6E9E5A" />
      </mesh>
      <Rock variant={3} kind="pebble" position={[r * 0.6, h * 0.4, r * 0.5]} rotation={[0.2, 0.3, 0.1]} scale={0.4} color="#9C8F7C" />
    </RigidBody>
  );
}

function TatamiMat({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[2.2, 0.04, 1.2]} />
        <Toon color="#CDBB7E" />
      </mesh>
      <mesh position={[0, 0.045, 0]}>
        <boxGeometry args={[2.25, 0.01, 0.08]} />
        <Toon color="#3E5A3A" />
      </mesh>
    </group>
  );
}

function ForestBanner({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 3.2, 6]} />
        <Toon color="#5A4032" />
      </mesh>
      <mesh position={[0.32, 2.2, 0]}>
        <boxGeometry args={[0.6, 1.6, 0.02]} />
        <Toon color={color} />
      </mesh>
      <mesh position={[0.32, 2.35, 0.015]}>
        <circleGeometry args={[0.16, 16]} />
        <Toon color="#FFF6E4" />
      </mesh>
    </group>
  );
}

export function Forest() {
  return (
    <group>
      <mesh position={[0, 0.012, 32.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[38, 13]} />
        <meshToonMaterial color="#6FA350" transparent opacity={0.55} />
      </mesh>

      {PILLARS.map((p, i) => <StonePillar key={i} pos={p.pos} h={p.h} />)}
      <TallRock />

      <TatamiMat position={[-4, 0, 30.6]} />
      <TatamiMat position={[-2, 0, 32.4]} rotation={0.3} />
      <TrainingPost position={[-6.5, 0, 27.6]} />
      <TrainingPost position={[-7.5, 0, 29]} />
      <ForestBanner position={[-1.2, 0, 26.6]} color="#7B4FA0" />
      <ForestBanner position={[-6.8, 0, 26.6]} color="#7B4FA0" />

      <SakuraTree position={[0.5, 0, 37.2]} seed={11} scale={1.3} />
      <SakuraTree position={[-8, 0, 37]} seed={12} />
      <PineTree position={[-17, 0, 28]} scale={1.2} />
      <PineTree position={[17, 0, 30]} scale={1.1} />
      <PineTree position={[-6, 0, 38.6]} />
      <PineTree position={[12.5, 0, 38.6]} scale={1.15} />
      {/* Etapa 10: 2 m toward the fence, off the carved code stone (its crown hung over it) */}
      <PineTree position={[18.3, 0, 36.6]} />
      <Bamboo position={[-16.6, 0, 33.5]} seed={4} />
      <Bamboo position={[16.6, 0, 26.6]} seed={5} />
      <Bamboo position={[3.5, 0, 38.4]} seed={6} />
      <StoneLantern position={[-2.2, 0, 26.6]} />
      <StoneLantern position={[2.2, 0, 26.6]} />
    </group>
  );
}
