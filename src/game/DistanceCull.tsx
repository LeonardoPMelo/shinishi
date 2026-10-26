import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { detailFactor } from '../store/uiSettings';

/**
 * Hides its children while the camera is farther than `far` from `center` (Etapa 1).
 * For the animated decoration that StaticMerge cannot bake (deer, koi, steam, temple gongs...): each piece
 * is a handful of separate meshes, and from across the village they were hundreds of draw calls for a few
 * pixels. Checked every 8 frames; a small hysteresis keeps it from flickering at the edge.
 */
export function DistanceCull({ center, far, children }: { center: [number, number, number]; far: number; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const frame = useRef(Math.floor(Math.random() * 8));
  useFrame(({ camera }) => {
    const g = group.current;
    if (!g || (frame.current = (frame.current + 1) % 8) !== 0) return;
    const dx = camera.position.x - center[0];
    const dz = camera.position.z - center[2];
    const d = Math.sqrt(dx * dx + dz * dz);
    // the auto quality can shorten the detail distance on weak GPUs (never below 60%)
    const reach = far * detailFactor();
    if (g.visible && d > reach + 2) g.visible = false;
    else if (!g.visible && d < reach) g.visible = true;
  });
  // marked dynamic: StaticMerge must leave it alone (it toggles visibility at runtime)
  return (
    <group ref={group} userData={{ dynamic: true }}>
      {children}
    </group>
  );
}
