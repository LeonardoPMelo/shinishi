import type { Progress, Vec3 } from '../types';
import { MISSIONS } from '../data/missions';
import { NPC_DEFINITIONS, availableOffer } from '../data/npcs';
import { availableSteps } from './progression';
import { stepTargetPosition } from '../ui/mapData';

/**
 * What the player should do next, in one line (Etapa 7). Before this, a new game showed no objective at
 * all: the HUD listed only an *active* mission, and the faro (key 4) laid no trail until one was active,
 * so the first minute depended on spotting a small "!" over Chef Hana.
 *  - with an active mission: its nearest open step that has a place (or the first open step);
 *  - otherwise: the first villager, in campaign order, who has a mission to offer.
 */
export interface Objective {
  kind: 'step' | 'offer';
  missionId: string;
  text: string;
  position: Vec3 | null;
}

const dist = (p: Vec3, from?: { x: number; z: number }) => (from ? Math.hypot(p[0] - from.x, p[2] - from.z) : 0);

export function currentObjective(progress: Progress, from?: { x: number; z: number }): Objective | null {
  const isActive = (id: string | null) => !!id && progress.missions[id]?.status === 'active';
  const missionId = isActive(progress.tracked) ? progress.tracked : Object.keys(MISSIONS).find(isActive) ?? null;
  if (missionId) {
    const steps = availableSteps(MISSIONS[missionId], progress);
    let best: Objective | null = null;
    for (const step of steps) {
      const position = stepTargetPosition(step);
      const o: Objective = { kind: 'step', missionId, text: step.description, position };
      if (!best) best = o;
      else if (position && (!best.position || dist(position, from) < dist(best.position, from))) best = o;
    }
    if (best) return best;
  }
  for (const npc of NPC_DEFINITIONS) {
    const offer = availableOffer(npc, progress);
    if (offer) return { kind: 'offer', missionId: offer, text: `${npc.name} precisa da sua ajuda`, position: npc.position };
  }
  return null;
}

/** True until the player has started any mission: the guide trail and the "first step" card show only then. */
export function isFirstSteps(progress: Progress) {
  return Object.keys(progress.missions).length === 0;
}
