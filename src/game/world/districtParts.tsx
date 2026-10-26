import { useMemo } from 'react';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { Toon, Ink } from '../materials';
import { PaperLantern } from './Buildings';

/** Pieces shared by the districts outside the village fence (§25, §26). */

const WOOD = '#6A4630';
const STONE = '#A8A196';

/** A wooden post-and-rail fence from a to b, with its own invisible wall collider (3 m tall). */
export function FenceLine({ a, b }: { a: [number, number]; b: [number, number] }) {
  const { rails, len, rot, seg } = useMemo(() => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const rot = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    const n = Math.max(1, Math.round(len / 2.4));
    const seg = len / n;
    return { rails: Array.from({ length: n }, (_, i) => i * seg), len, rot, seg };
  }, [a, b]);
  return (
    <group position={[a[0], 0, a[1]]} rotation={[0, rot, 0]}>
      {rails.map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0.55, 0]} castShadow>
            <boxGeometry args={[0.16, 1.1, 0.16]} />
            <Toon color="#7A5536" />
          </mesh>
          {[0.75, 0.4].map((y) => (
            <mesh key={y} position={[seg / 2, y, 0]}>
              <boxGeometry args={[seg, 0.1, 0.07]} />
              <Toon color="#94693F" />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[len, 0.55, 0]} castShadow>
        <boxGeometry args={[0.16, 1.1, 0.16]} />
        <Toon color="#7A5536" />
      </mesh>
      <RigidBody type="fixed" colliders={false} position={[len / 2, 0, 0]}>
        <CuboidCollider args={[len / 2 + 0.3, 3, 0.3]} position={[0, 2, 0]} />
      </RigidBody>
    </group>
  );
}

/**
 * Gate in the village fence: two posts and a little tiled roof. `alongX` puts the opening across a
 * fence that runs along x (the south fence); otherwise the fence runs along z (east/west fences).
 */
export function DistrictGate({ x, z, halfWidth, roof, lantern, alongX = false }: { x: number; z: number; halfWidth: number; roof: string; lantern: string; alongX?: boolean }) {
  return (
    <group position={[x, 0, z]} rotation={[0, alongX ? Math.PI / 2 : 0, 0]}>
      {[-1, 1].map((s) => (
        <RigidBody key={s} type="fixed" colliders={false} position={[0, 0, s * (halfWidth + 0.05)]}>
          <CuboidCollider args={[0.14, 1.2, 0.14]} position={[0, 1.2, 0]} />
          <mesh position={[0, 1.2, 0]} castShadow>
            <boxGeometry args={[0.26, 2.4, 0.26]} />
            <Toon color={WOOD} tex="wood" />
            <Ink thickness={0.02} />
          </mesh>
        </RigidBody>
      ))}
      <mesh position={[0, 2.45, 0]} castShadow>
        <boxGeometry args={[0.36, 0.16, halfWidth * 2 + 0.7]} />
        <Toon color={WOOD} tex="wood" />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.32, 2.62, 0]} rotation={[0, 0, s * 0.62]} castShadow>
          <boxGeometry args={[0.72, 0.06, halfWidth * 2 + 1.0]} />
          <Toon color={roof} tex="tiles" />
        </mesh>
      ))}
      <PaperLantern position={[0.2, 2.1, -halfWidth + 0.35]} color={lantern} />
      <PaperLantern position={[0.2, 2.1, halfWidth - 0.35]} color={lantern} />
    </group>
  );
}

export function Bench({ position, rotY = 0 }: { position: [number, number, number]; rotY?: number }) {
  return (
    <RigidBody type="fixed" colliders={false} position={position} rotation={[0, rotY, 0]}>
      <CuboidCollider args={[0.75, 0.22, 0.24]} position={[0, 0.22, 0]} />
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.08, 0.46]} />
        <Toon color="#9B7048" tex="planks" />
        <Ink thickness={0.012} />
      </mesh>
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} position={[x, 0.2, 0]} castShadow>
          <boxGeometry args={[0.12, 0.4, 0.4]} />
          <Toon color={STONE} tex="stone" />
        </mesh>
      ))}
    </RigidBody>
  );
}

/** Earth terraces with a stone face and a soil (or grass) top, each with a half-height step. */
export function TerraceBox({ x0, x1, z0, z1, h, top = '#6FA350' }: { x0: number; x1: number; z0: number; z1: number; h: number; top?: string }) {
  const w = x1 - x0;
  const d = z1 - z0;
  return (
    <RigidBody type="fixed" colliders={false} userData={{ surface: 'stone' }}>
      <CuboidCollider args={[w / 2, h / 2, d / 2]} position={[(x0 + x1) / 2, h / 2, z0 + d / 2]} />
      <mesh position={[(x0 + x1) / 2, h / 2 - 0.02, z0 + d / 2]} castShadow receiveShadow>
        <boxGeometry args={[w, h - 0.04, d]} />
        <Toon color={STONE} tex="stone" />
        <Ink thickness={0.02} />
      </mesh>
      <mesh position={[(x0 + x1) / 2, h - 0.02, z0 + d / 2]} receiveShadow>
        <boxGeometry args={[w - 0.1, 0.05, d - 0.1]} />
        <Toon color={top} />
      </mesh>
    </RigidBody>
  );
}

/** A stone step block (half of a 0.5 m rise) at (x, z), `h` tall, w × d. */
export function StepBlock({ x, z, h, w = 1.0, d = 0.48 }: { x: number; z: number; h: number; w?: number; d?: number }) {
  return (
    <RigidBody type="fixed" colliders={false} userData={{ surface: 'stone' }}>
      <CuboidCollider args={[w / 2, h / 2, d / 2]} position={[x, h / 2, z]} />
      <mesh position={[x, h / 2, z]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <Toon color="#8E877C" tex="stone" />
      </mesh>
    </RigidBody>
  );
}
