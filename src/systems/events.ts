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
  | { type: 'toast'; text: string; icon?: string };

type Listener = (e: GameEvent) => void;
const listeners = new Set<Listener>();

export function emit(e: GameEvent) {
  listeners.forEach((l) => l(e));
}

export function onGameEvent(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
