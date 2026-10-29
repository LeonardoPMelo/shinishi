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
