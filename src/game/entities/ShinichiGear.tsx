import { createPortal } from '@react-three/fiber';
import type * as THREE from 'three';
import { Toon, Ink } from '../materials';
import { useGameStore } from '../../store/gameStore';
import { ITEMS } from '../../data/items';

/**
 * What Shinichi wears besides the band (Etapa 6 da expansão): the collar on the neck bone and the backpack on
 * the chest bone of the GLB, so they follow every animation. Positions are in the bone's own space (Y runs
 * along the bone; on the chest, -Z points up the back), measured on the model.
 */

/**
 * Collar fit, in neck-bone space. Measured on the model: the chibi head hides the neck, so the collar sits
 * at the base of the neck, wide enough to show under the chin (a 0.11 m ring was buried in the fur).
 */
export const COLLAR = { y: -0.03, radius: 0.19, tube: 0.032 };
/** Backpack fit, in chest-bone space. */
export const PACK = { y: 0.06, back: -0.128 };

function Collar({ color, charm }: { color: string; charm: 'sino' | 'folha' }) {
  return (
    <group position={[0, COLLAR.y, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[COLLAR.radius, COLLAR.tube, 8, 28]} />
        <Toon color={color} />
        <Ink thickness={0.004} />
      </mesh>
      {/* the charm hangs under the chin (+Z on the neck bone is the throat side) */}
      <group position={[0, 0, COLLAR.radius + 0.02]}>
        {charm === 'sino' ? (
          <mesh position={[0, -0.03, 0.02]}>
            <sphereGeometry args={[0.045, 12, 10]} />
            <Toon color="#E2B84E" emissive="#E2B84E" emissiveIntensity={0.2} />
            <Ink thickness={0.004} />
          </mesh>
        ) : (
          <mesh position={[0, -0.02, 0.01]} rotation={[0.3, 0, 0.5]} scale={[1, 1.6, 0.3]}>
            <sphereGeometry args={[0.036, 10, 8]} />
            <Toon color="#8FCB5A" />
          </mesh>
        )}
      </group>
    </group>
  );
}

function Backpack() {
  return (
    <group position={[0, PACK.y, PACK.back]}>
      <mesh>
        <boxGeometry args={[0.16, 0.13, 0.08]} />
        <Toon color="#9B6B43" tex="planks" />
        <Ink thickness={0.005} />
      </mesh>
      {/* flap, the compass on the strap, and two straps around the chest */}
      <mesh position={[0, 0.03, -0.042]}>
        <boxGeometry args={[0.165, 0.07, 0.012]} />
        <Toon color="#7A5236" />
      </mesh>
      <mesh position={[0, -0.02, -0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.01, 14]} />
        <Toon color="#E2B84E" emissive="#E2B84E" emissiveIntensity={0.25} />
      </mesh>
      {[-0.05, 0.05].map((y) => (
        <mesh key={y} position={[0, y, 0.11]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.13, 0.008, 6, 20, Math.PI]} />
          <Toon color="#5A3B28" />
        </mesh>
      ))}
    </group>
  );
}

export function ShinichiGear({ root }: { root: THREE.Object3D }) {
  const collarId = useGameStore((s) => s.progress.equipped.coleira);
  const packId = useGameStore((s) => s.progress.equipped.mochila);
  const collar = collarId ? ITEMS[collarId]?.collar : undefined;
  const neck = root.getObjectByName('neck');
  const chest = root.getObjectByName('chest');
  return (
    <>
      {collar && neck && createPortal(<Collar color={collar.color} charm={collar.charm} />, neck)}
      {packId && chest && createPortal(<Backpack />, chest)}
    </>
  );
}
