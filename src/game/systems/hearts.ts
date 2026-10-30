import { create } from 'zustand';
import { fullHearts, healCat, hurtCat, type Enemy, type Hearts, type Pinecone } from '../../systems/combat';
import { useUiSettings } from '../../store/uiSettings';
import { emit } from '../../systems/events';
import { abilityState, now, playerPosition } from './playerState';
import { spawnParticles } from './particles';

/**
 * Shinichi's hearts in the wild lands (Etapa 7 da expansão). Not saved: they fill up on every arrival, at the
 * campfire and after fainting. The rules are in systems/combat.ts; this applies them to the cat (push back,
 * blink, the faint and the trip back to the camp, done by game/systems/zone.ts).
 */
export const useHearts = create<Hearts & { fainted: boolean }>(() => ({ ...fullHearts('normal'), fainted: false }));

const level = () => useUiSettings.getState().combatLevel;

/** Full hearts for the current difficulty (arriving, resting, waking up). */
export function refillHearts() {
  useHearts.setState({ ...fullHearts(level()), fainted: false });
}

/** Knock-back speed (m/s) and how long it lasts. */
const KNOCK = { speed: 6, seconds: 0.22 };

/** Called by zone.ts: the trip back to the camp after fainting. Set there to avoid an import cycle. */
export const faintHandler: { current: (() => void) | null } = { current: null };

/** A creature (or a snare) hits the cat, from (fromX, fromZ). Returns whether it counted. */
export function hurtPlayer(damage: number, fromX: number, fromZ: number) {
  const s = useHearts.getState();
  if (s.fainted) return false;
  const r = hurtCat(s, damage, now(), level());
  if (!r.took) return false;
  useHearts.setState({ ...r.hearts, fainted: r.fainted });
  const dx = playerPosition.x - fromX;
  const dz = playerPosition.z - fromZ;
  const d = Math.max(Math.hypot(dx, dz), 1e-3);
  abilityState.knock.set((dx / d) * KNOCK.speed, 0, (dz / d) * KNOCK.speed);
  abilityState.knockUntil = now() + KNOCK.seconds;
  emit({ type: 'sfx', name: 'hurt' });
  spawnParticles('sparkle', [playerPosition.x, playerPosition.y + 0.4, playerPosition.z], 10, '#FF9A8A');
  if (r.fainted) {
    emit({ type: 'toast', icon: '💫', text: 'Shinichi ficou tonto e desmaiou... e acordou no acampamento, com tudo na mochila.' });
    faintHandler.current?.();
  }
  return true;
}

export function healPlayer(amount: number) {
  const s = useHearts.getState();
  useHearts.setState(healCat(s, amount));
}

export const heartsMissing = () => {
  const s = useHearts.getState();
  return s.hearts < s.max;
};

/** The creatures, their pinecones and the last noise, shared by the region, the HUD and the music. */
export const combatWorld = {
  enemies: [] as Enemy[],
  pinecones: [] as Pinecone[],
  /** A shuriken hit the scenery here (the creatures nearby go and look). */
  noise: null as null | { x: number; z: number; time: number },
};

/** Shurikens.tsx calls this when a star sticks in a rock or a tree. */
export function makeNoise(x: number, z: number) {
  combatWorld.noise = { x, z, time: now() };
}

if (import.meta.env.DEV) Object.assign(window as unknown as Record<string, unknown>, { __hearts: useHearts, __combat: combatWorld });
