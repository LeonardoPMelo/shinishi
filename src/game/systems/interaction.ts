import { useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { playerPosition } from './playerState';
import { consume } from './input';
import { useGameStore } from '../../store/gameStore';

export interface Interactable {
  id: string;
  position: THREE.Vector3;
  radius: number;
  /** Prompt text, or null when the target cannot be used right now. */
  label: () => string | null;
  onInteract: () => void;
  /** Height of the floating "[E] ..." tag above `position` (default 1.5). */
  tagHeight?: number;
}

const registry = new Map<string, Interactable>();

export function useInteractable(item: Interactable | null) {
  useEffect(() => {
    if (!item) return;
    registry.set(item.id, item);
    return () => {
      registry.delete(item.id);
    };
  }, [item]);
}

export const getInteractable = (id: string | null) => (id ? registry.get(id) ?? null : null);

const flat = new THREE.Vector2();

/** Picks the closest usable target each frame and runs it when E is pressed. */
export function InteractionManager() {
  const setNearby = useGameStore((s) => s.setNearby);

  useFrame(() => {
    const { phase: rawPhase, nearbyInteractableId, nearbyInteractableLabel, celebrations } = useGameStore.getState();
    const phase = celebrations.length > 0 ? 'celebrating' : rawPhase;
    let best: Interactable | null = null;
    let bestLabel: string | null = null;

    if (phase === 'playing') {
      let bestDist = Infinity;
      for (const item of registry.values()) {
        flat.set(item.position.x - playerPosition.x, item.position.z - playerPosition.z);
        const d = flat.length();
        if (d > item.radius || Math.abs(item.position.y - playerPosition.y) > 2.2 || d >= bestDist) continue;
        const label = item.label();
        if (!label) continue;
        best = item;
        bestLabel = label;
        bestDist = d;
      }
    }

    const id = best?.id ?? null;
    if (id !== nearbyInteractableId || bestLabel !== nearbyInteractableLabel) setNearby(id, bestLabel);

    if (consume('interact') && best && phase === 'playing') best.onInteract();
  });

  return null;
}
