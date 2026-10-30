import * as THREE from 'three';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { Toon, Ink } from '../materials';
import type { TexName } from '../textures';

/** Shared bits of the interiors (Etapa 4 and 5 da expansão): colours, a box, a solid box. */

export const WOOD = '#6A4630';
export const DARK = '#3B2A20';
export const PAPER = '#FFF3D9';
export const INDIGO = '#3D3552';
export const GOLD = '#D9A520';

/**
 * Interiors are open-topped and seen from above: the camera may pass over or through their walls, so their
 * bodies are left out of the camera probe. A constant object (see Shinichi.tsx: a new userData object on each
 * render makes @react-three/rapier reset the body).
 */
export const ROOM_BODY = { noCamera: true } as const;

export function Box({ size, at, color, tex, ink = 0, rot }: { size: [number, number, number]; at: [number, number, number]; color: string; tex?: TexName; ink?: number; rot?: number }) {
  return (
    <mesh position={at} rotation={rot ? [0, rot, 0] : undefined} castShadow receiveShadow>
      <boxGeometry args={size} />
      <Toon color={color} tex={tex} />
      {ink > 0 && <Ink thickness={ink} />}
    </mesh>
  );
}

/** A solid piece of furniture: collider and box on the floor. */
export function Solid({ size, color, tex, ink = 0.02, y = 0 }: { size: [number, number, number]; color: string; tex?: TexName; ink?: number; y?: number }) {
  return (
    <RigidBody type="fixed" colliders={false} userData={ROOM_BODY}>
      <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} position={[0, y + size[1] / 2, 0]} />
      <Box size={size} at={[0, y + size[1] / 2, 0]} color={color} tex={tex} ink={ink} />
    </RigidBody>
  );
}

/** Just a collider (for shapes drawn some other way). */
export function Blocker({ size, at }: { size: [number, number, number]; at: [number, number, number] }) {
  return (
    <RigidBody type="fixed" colliders={false} userData={ROOM_BODY}>
      <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} position={at} />
    </RigidBody>
  );
}

let poolTex: THREE.CanvasTexture | null = null;
/** A soft round spot, white in the middle and clear at the edge (drawn once, shared). */
function poolTexture() {
  if (poolTex) return poolTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  poolTex = new THREE.CanvasTexture(c);
  poolTex.colorSpace = THREE.SRGBColorSpace;
  return poolTex;
}

/**
 * Warm light on the floor under a lamp or by a window: a soft spot added on top of the floor. Cheaper than a
 * real light (no extra cost for every other material on screen) and it reads as the lamp lighting the room.
 */
export function LightPool({ at, size, color, opacity = 0.32 }: { at: [number, number]; size: [number, number]; color: string; opacity?: number }) {
  return (
    <mesh position={[at[0], 0.035, at[1]]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={poolTexture()} color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
    </mesh>
  );
}
