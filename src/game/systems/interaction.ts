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

/**
 * The closest usable target: within its radius on the ground, at most 2.2 m above or below, with a label
 * right now. Nothing while a dialogue, challenge, panel or celebration is up (`phase` other than playing).
 */
export function pickInteractable(
  items: Iterable<Interactable>,
  player: { x: number; y: number; z: number },
  phase: string,
): { item: Interactable; label: string } | null {
  if (phase !== 'playing') return null;
  let best: { item: Interactable; label: string } | null = null;
  let bestDist = Infinity;
  for (const item of items) {
    const d = Math.hypot(item.position.x - player.x, item.position.z - player.z);
    if (d > item.radius || Math.abs(item.position.y - player.y) > 2.2 || d >= bestDist) continue;
    const label = item.label();
    if (!label) continue;
    best = { item, label };
    bestDist = d;
  }
  return best;
}

/** Picks the closest usable target each frame and runs it when E is pressed. */
export function InteractionManager() {
  const setNearby = useGameStore((s) => s.setNearby);

  useFrame(() => {
    const { phase: rawPhase, nearbyInteractableId, nearbyInteractableLabel, celebrations, panel } = useGameStore.getState();
    const phase = celebrations.length > 0 ? 'celebrating' : panel ? 'panel' : rawPhase;
    const picked = pickInteractable(registry.values(), playerPosition, phase);
    const best = picked?.item ?? null;
    const bestLabel = picked?.label ?? null;

    const id = best?.id ?? null;
    if (id !== nearbyInteractableId || bestLabel !== nearbyInteractableLabel) setNearby(id, bestLabel);

    if (consume('interact') && best && phase === 'playing') best.onInteract();
  });

  return null;
}
