import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';
import { getInteractable } from './interaction';
import { press } from './input';
import { usePad, FACE_LABELS } from './gamepad';

/**
 * Floating "[E] Falar com ..." tag above whatever Shinichi can use right now.
 * It follows the target (villagers on patrol move), and it is a button too, for touch.
 */
export function InteractTag() {
  const id = useGameStore((s) => s.nearbyInteractableId);
  const label = useGameStore((s) => s.nearbyInteractableLabel);
  const phase = useGameStore((s) => s.phase);
  const group = useRef<THREE.Group>(null);
  const padKey = usePad((s) => (s.active ? FACE_LABELS[s.style].left : null));

  useFrame(() => {
    const item = getInteractable(id);
    if (!group.current || !item) return;
    group.current.position.set(item.position.x, item.position.y + (item.tagHeight ?? 1.5), item.position.z);
  });

  if (!id || !label || phase !== 'playing') return null;
  const item = getInteractable(id);
  if (!item) return null;
  return (
    <group ref={group} position={[item.position.x, item.position.y + (item.tagHeight ?? 1.5), item.position.z]}>
      <Html center zIndexRange={[30, 0]} style={{ pointerEvents: 'auto' }}>
        <button className="world-tag" onClick={() => press('interact')} key={id}>
          <span className="world-tag-key">{padKey ?? 'E'}</span>
          <span>{label}</span>
        </button>
      </Html>
    </group>
  );
}
