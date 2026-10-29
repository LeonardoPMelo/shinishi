import type { Progress } from '../types';
import { MISSIONS } from '../data/missions';
import { NPC_DEFINITIONS, availableOffer } from '../data/npcs';

/**
 * The state of each mission, derived from the save (Etapa 2 da expansão), never stored apart from it, so it
 * cannot drift out of date:
 *  - 'concluida' / 'ativa': as saved;
 *  - 'disponivel': not started, and someone offers it now (or it has no giver: the world starts it, like the
 *    Golden Paws when the first one is found);
 *  - 'bloqueada': not started and nobody offers it yet (its condition, usually an earlier mission, is not met).
 * Abandoning is not offered: steps give items and flags through dialogue, so redoing a mission could pay them
 * twice. It can come back per mission once its steps are written to be repeatable.
 */
export type MissionState = 'bloqueada' | 'disponivel' | 'ativa' | 'concluida';

export function missionState(id: string, progress: Progress): MissionState {
  const saved = progress.missions[id];
  if (saved) return saved.status === 'done' ? 'concluida' : 'ativa';
  const mission = MISSIONS[id];
  if (!mission) return 'bloqueada';
  if (!mission.giver) return 'disponivel';
  return NPC_DEFINITIONS.some((npc) => availableOffer(npc, progress) === id) ? 'disponivel' : 'bloqueada';
}

/** Missions someone offers right now, with who offers them (for the mission log). */
export function offeredMissions(progress: Progress): { missionId: string; npcName: string }[] {
  const out: { missionId: string; npcName: string }[] = [];
  for (const npc of NPC_DEFINITIONS) {
    const id = availableOffer(npc, progress);
    if (id && !out.some((o) => o.missionId === id)) out.push({ missionId: id, npcName: npc.name });
  }
  return out;
}
