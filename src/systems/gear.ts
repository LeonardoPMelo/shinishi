import type { ItemPassive, Progress, Vec3 } from '../types';
import { ITEMS } from '../data/items';
import { WORLD_OBJECTS, type WorldObject } from '../data/world';
import { checkCondition } from './progression';
import { FARO_DURATION, FARO_COOLDOWN } from '../game/systems/playerState';

/**
 * What worn and eaten items change in play (Etapa 6 da expansão). Pure, so the tests check the numbers the
 * game uses: the Faro with the Faro Collar, the jump with the grilled fish, the backpack's compass.
 */

export const FARO = { duration: FARO_DURATION, cooldown: FARO_COOLDOWN };
/** Coleira do Faro. */
export const FARO_LONG = { duration: 9, cooldown: 8 };
/** Jump force with the energy potion (faster too) and with the grilled fish (jump only). */
export const BOOST_JUMP = 1.12;
/** Measured in play: 1.16 gave a 2.03 m jump, enough (with the capsule riding up an edge) to climb the tall rock
 * that the double jump unlocks; 1.13 keeps that gate (tests/economy.test.ts). */
export const SALTO_JUMP = 1.13;

export function hasPassive(progress: Progress, passive: ItemPassive) {
  return Object.values(progress.equipped).some((id) => !!id && ITEMS[id]?.passive === passive);
}

export function faroTimes(progress: Progress) {
  return hasPassive(progress, 'faro_longo') ? FARO_LONG : FARO;
}

/** The stronger of the two springs; they never add up. */
export function jumpMultiplier(boosted: boolean, springy: boolean) {
  return Math.max(boosted ? BOOST_JUMP : 1, springy ? SALTO_JUMP : 1);
}

// ── The backpack's compass ────────────────────────────────────────────────────
const PAWS: WorldObject[] = WORLD_OBJECTS.filter((o) => o.kind === 'pickup_paw');

export interface Bearing {
  id: string;
  position: Vec3;
  dist: number;
}

/** The nearest Golden Paw still to be found, or null when all eight are home. */
export function nearestPaw(progress: Progress, x: number, z: number): Bearing | null {
  let best: Bearing | null = null;
  for (const p of PAWS) {
    if (p.hideWhen && checkCondition(p.hideWhen, progress)) continue;
    const dist = Math.hypot(p.position[0] - x, p.position[2] - z);
    if (!best || dist < best.dist) best = { id: p.id, position: p.position, dist };
  }
  return best;
}

/**
 * Where to point the compass arrow on screen, in radians (0 = up, clockwise), given the camera's turn
 * (cameraAngle.theta: the camera looks along (-sin θ, -cos θ), like the stick in Shinichi.tsx).
 */
export function screenBearing(dx: number, dz: number, theta: number) {
  const forward = dx * -Math.sin(theta) + dz * -Math.cos(theta);
  const right = dx * Math.cos(theta) + dz * -Math.sin(theta);
  return Math.atan2(right, forward);
}
