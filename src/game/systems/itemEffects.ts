import type { ItemEffect } from '../../types';
import { ITEMS } from '../../data/items';
import { useGameStore } from '../../store/gameStore';
import { abilityState, now, playerPosition } from './playerState';
import { spawnParticles } from './particles';
import { emit } from '../../systems/events';

/**
 * Using an item, from anywhere (key 3 / the pad / the bag): the store spends it (systems/inventory.ts), this
 * applies what it does to the cat and gives the feedback. One path, so the bag and the shortcut never differ.
 */
export function applyItemEffect(effect: ItemEffect, itemId: string) {
  const item = ITEMS[itemId];
  switch (effect.kind) {
    case 'impulso': {
      // a longer boost already running is kept, never shortened
      abilityState.boostUntil = Math.max(abilityState.boostUntil, now() + effect.seconds);
      emit({ type: 'sfx', name: 'potion' });
      emit({ type: 'toast', icon: item?.icon ?? '✨', text: `${item?.name ?? 'Energia'}: mais rápido e pulando mais alto por ${effect.seconds} segundos.` });
      spawnParticles('sparkle', [playerPosition.x, playerPosition.y + 0.3, playerPosition.z], 16);
      break;
    }
    case 'salto': {
      abilityState.jumpUntil = Math.max(abilityState.jumpUntil, now() + effect.seconds);
      emit({ type: 'sfx', name: 'boing' });
      emit({ type: 'toast', icon: item?.icon ?? '🍢', text: `${item?.name ?? 'Mola'}: pulando mais alto por ${effect.seconds} segundos.` });
      spawnParticles('sparkle', [playerPosition.x, playerPosition.y + 0.1, playerPosition.z], 12, '#FFB347');
      break;
    }
    case 'faro': {
      // Shinichi.tsx starts it on the next frame, with the trail to the objective, like the key does
      abilityState.faroRequest = effect.seconds;
      emit({ type: 'toast', icon: item?.icon ?? '🍵', text: `${item?.name ?? 'Chá'}: Faro por ${effect.seconds} segundos!` });
      break;
    }
  }
}

/** Spends one and applies it. Returns whether it worked (with feedback either way). */
export function useFromBag(itemId: string): boolean {
  const { result, effect } = useGameStore.getState().useItem(itemId);
  if (result === 'ok' && effect) {
    applyItemEffect(effect, itemId);
    return true;
  }
  emit({ type: 'sfx', name: 'denied' });
  return false;
}
