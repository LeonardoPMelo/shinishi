/** Game events that other modules (audio, notifications) can listen to without touching game logic. */
export type GameEvent =
  | { type: 'missionStart'; missionId: string }
  | { type: 'step'; missionId: string; stepId: string }
  | { type: 'missionComplete'; missionId: string }
  | { type: 'item'; itemId: string; amount: number }
  | { type: 'coins'; amount: number }
  | { type: 'gems'; amount: number }
  | { type: 'xp'; amount: number }
  | { type: 'levelUp'; level: number }
  | { type: 'ability'; abilityId: string }
  | { type: 'challenge'; result: 'correct' | 'wrong'; skill?: string; firstTry?: boolean }
  | { type: 'secret'; id: string }
  | { type: 'sfx'; name: string; position?: [number, number, number] }
  | { type: 'dialogueOpen'; npcId: string }
  | { type: 'dialogueClose' }
  | { type: 'toast'; text: string; icon?: string }
  /** Go to another zone through a gate (the wild lands' trail, Etapa 7): game/systems/zone.ts does it. */
  | { type: 'travel'; to: string };

type Listener = (e: GameEvent) => void;
const listeners = new Set<Listener>();

/**
 * Listeners are sound, notices and effects: one of them failing must never cut the game logic that emitted the
 * event in half (seen in Etapa 5: a broken notice stopped a mission's completion between paying the rewards
 * and starting the next mission). The error is still reported.
 */
export function emit(e: GameEvent) {
  listeners.forEach((l) => {
    try {
      l(e);
    } catch (err) {
      console.error('[eventos] um ouvinte falhou em', e.type, err);
    }
  });
}

export function onGameEvent(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
