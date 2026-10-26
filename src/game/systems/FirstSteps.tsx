import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { abilityState, now, playerPosition } from './playerState';
import { useGameStore } from '../../store/gameStore';
import { currentObjective, isFirstSteps } from '../../systems/objective';

/**
 * The first minute (Etapa 7): until the player starts a first mission, the golden paw prints of the faro
 * appear on their own every few seconds, pointing at whoever has a mission to offer. No tutorial screen:
 * the HUD card says the goal in one line, the prints show the way. Stops for good once a mission begins.
 */
const EVERY = 9;
const SHOW = 4.5;

export function FirstSteps() {
  const next = useRef(0);
  useFrame(() => {
    const s = useGameStore.getState();
    if (s.phase !== 'playing' || !isFirstSteps(s.progress)) {
      next.current = 0;
      return;
    }
    const t = now();
    // the first prints a moment after the game starts, once the player has looked around
    if (!next.current) next.current = t + 2.5;
    if (t < next.current) return;
    next.current = t + EVERY;
    if (abilityState.trail && t < abilityState.trail.until) return;
    const goal = currentObjective(s.progress, playerPosition)?.position;
    if (!goal || Math.hypot(goal[0] - playerPosition.x, goal[2] - playerPosition.z) < 3.5) return;
    abilityState.trail = { from: new THREE.Vector3(playerPosition.x, 0, playerPosition.z), to: new THREE.Vector3(goal[0], 0, goal[2]), until: t + SHOW };
  });
  return null;
}
