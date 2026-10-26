import { useMemo } from 'react';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { Toon, Ink } from '../materials';
import { KURO_CODE, DEAL } from '../../data/redesign';
import { Rock } from './Rock';

/** Props for the redesigned chapter-1 missions (§28): the pillar bell, Kuro's code stone, Boku's chalkboard. */

function textTexture(lines: string[], { w = 256, h = 128, bg, fg, font }: { w?: number; h?: number; bg: string; fg: string; font: string }) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = font;
  lines.forEach((l, i) => g.fillText(l, w / 2, (h * (i + 1)) / (lines.length + 1)));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A small bronze bell hung from a bamboo arch on top of the tallest pillar. */
export function PillarBell() {
  return (
    // the arch runs along the pillar's rim (tangent), so it stays on top of the stone
    <group rotation={[0, Math.PI / 4, 0]}>
      {[-0.32, 0.32].map((x) => (
        <mesh key={x} position={[x, 0.55, 0]}>
          <cylinderGeometry args={[0.035, 0.04, 1.1, 6]} />
          <Toon color="#86BC4E" />
        </mesh>
      ))}
      <mesh position={[0, 1.1, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, 0.75, 6]} />
        <Toon color="#86BC4E" />
      </mesh>
      <mesh position={[0, 0.88, 0]}>
        <sphereGeometry args={[0.13, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        <Toon color="#C9A23A" side={THREE.DoubleSide} />
        <Ink thickness={0.012} />
      </mesh>
      <mesh position={[0, 0.98, 0]}>
        <boxGeometry args={[0.01, 0.12, 0.01]} />
        <Toon color="#5A4032" />
      </mesh>
      {/* a red cord hanging from the bell */}
      <mesh position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.4, 4]} />
        <Toon color="#C8302C" />
      </mesh>
    </group>
  );
}

/** A mossy standing stone with the claw-scratched number code (always there; readable during the mission). */
export function CodeStone() {
  const tex = useMemo(() => textTexture([KURO_CODE.join(' · '), 'A = 1'], { bg: '#8E877C', fg: '#3A3430', font: 'bold 30px serif' }), []);
  return (
    // the carved face looks west, toward where the clues lead the cat from
    <RigidBody type="fixed" colliders={false} rotation={[0, Math.PI / 2, 0]}>
      <CuboidCollider args={[0.5, 0.65, 0.22]} position={[0, 0.65, 0]} />
      <Rock variant={7} position={[0, 0.65, 0]} scale={[0.72, 0.85, 0.3]} color="#8E877C" ink={0.02} castShadow receiveShadow />
      <mesh position={[0, 0.72, -0.27]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.82, 0.41]} />
        <meshToonMaterial map={tex} transparent opacity={0.92} />
      </mesh>
      <mesh position={[0.2, 1.18, 0]} scale={[0.4, 0.12, 0.3]}>
        <sphereGeometry args={[1, 9, 5]} />
        <Toon color="#5E8F48" />
      </mesh>
    </RigidBody>
  );
}

/** Boku's chalkboard on a little easel, with the offer written in chalk. */
export function PromoBoard() {
  const tex = useMemo(() => textTexture(['PROMOÇÃO!', `Leve ${DEAL.take} maçãs`, `pague só ${DEAL.pay}`], { bg: '#2F4A3A', fg: '#F6F0DC', font: 'bold 26px sans-serif', h: 160 }), []);
  return (
    <group rotation={[0, 0.5, 0]}>
      {[-0.28, 0.28].map((x) => (
        <mesh key={x} position={[x, 0.5, -0.08]} rotation={[0.15, 0, 0]}>
          <boxGeometry args={[0.05, 1.0, 0.05]} />
          <Toon color="#7A5536" />
        </mesh>
      ))}
      <mesh position={[0, 0.72, -0.02]} rotation={[0.15, 0, 0]} castShadow>
        <boxGeometry args={[0.66, 0.54, 0.04]} />
        <Toon color="#7A5536" />
        <Ink thickness={0.012} />
      </mesh>
      <mesh position={[0, 0.72, 0.005]} rotation={[0.15, 0, 0]}>
        <planeGeometry args={[0.58, 0.46]} />
        <meshToonMaterial map={tex} />
      </mesh>
      {/* three apples in a little crate at its foot */}
      <mesh position={[0.3, 0.1, 0.25]}>
        <boxGeometry args={[0.36, 0.2, 0.26]} />
        <Toon color="#B98A52" />
      </mesh>
      {[-0.08, 0.02, 0.12].map((x, i) => (
        <mesh key={i} position={[0.3 + x, 0.24, 0.25 + (i % 2) * 0.05]}>
          <sphereGeometry args={[0.055, 10, 8]} />
          <Toon color="#D83A2E" />
        </mesh>
      ))}
    </group>
  );
}
