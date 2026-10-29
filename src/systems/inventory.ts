import type { EquipSlot, Item, ItemCategory, ItemEffect, PlayerStats, Progress } from '../types';
import { ITEMS } from '../data/items';

/**
 * The one place that changes what Shinichi carries (Etapa 2 da expansão): adding and taking items, buying,
 * selling, using and wearing. Pure functions over { player, progress }: the store calls them and only
 * writes the result, the shops and the bag only show it. Every rule lives here and is tested
 * (tests/inventory.test.ts), so the coming shops, tools and equipment add data, not logic.
 */

export interface Bag {
  player: PlayerStats;
  progress: Progress;
}

export type Currency = 'coins' | 'gems';

export interface Offer {
  item: string;
  qty: number;
  price: number;
  /** Missing = gems (Sora's bag sells for Gemas do Saber). */
  currency?: Currency;
  /** Only one ever (bands, unique tools). */
  once?: boolean;
}

export const categoryOf = (item: Item | undefined): ItemCategory => item?.category ?? 'missao';

export const countOf = (progress: Progress, id: string) => progress.inventory[id] ?? 0;

/** Adds (or, with a negative amount, takes) items; never below zero. Taking the last one also takes it off. */
export function withItem(progress: Progress, id: string, amount: number): Progress {
  const count = Math.max(0, countOf(progress, id) + amount);
  const inventory = { ...progress.inventory, [id]: count };
  if (count === 0) delete inventory[id];
  let equipped = progress.equipped;
  if (count === 0 && Object.values(equipped).includes(id)) {
    equipped = Object.fromEntries(Object.entries(equipped).filter(([, v]) => v !== id));
  }
  return { ...progress, inventory, equipped };
}

const balance = (player: PlayerStats, c: Currency) => (c === 'gems' ? player.gems ?? 0 : player.coins);
const pay = (player: PlayerStats, c: Currency, amount: number): PlayerStats =>
  c === 'gems' ? { ...player, gems: Math.max(0, (player.gems ?? 0) - amount) } : { ...player, coins: Math.max(0, player.coins - amount) };

export type BuyResult = 'ok' | 'poor' | 'owned' | 'unknown';

/**
 * Buys an offer. All checks come before any change, and the result is a new bag: a second click on the
 * same "buy" only repeats a valid purchase (enough money, not a once-only item already owned).
 */
export function buy(bag: Bag, offer: Offer | undefined): { result: BuyResult; bag: Bag } {
  if (!offer || !ITEMS[offer.item] || offer.qty <= 0 || offer.price < 0) return { result: 'unknown', bag };
  const currency = offer.currency ?? 'gems';
  if (offer.once && countOf(bag.progress, offer.item) > 0) return { result: 'owned', bag };
  if (balance(bag.player, currency) < offer.price) return { result: 'poor', bag };
  return {
    result: 'ok',
    bag: { player: pay(bag.player, currency, offer.price), progress: withItem(bag.progress, offer.item, offer.qty) },
  };
}

export type SellResult = 'ok' | 'notSellable' | 'none' | 'worn';

/** Sells items for coins. Story items have no price and cannot be sold; a worn item must be taken off first. */
export function sell(bag: Bag, id: string, qty = 1): { result: SellResult; bag: Bag; coins: number } {
  const item = ITEMS[id];
  if (!item || item.sellPrice === undefined || categoryOf(item) === 'missao') return { result: 'notSellable', bag, coins: 0 };
  if (qty <= 0 || countOf(bag.progress, id) < qty) return { result: 'none', bag, coins: 0 };
  if (Object.values(bag.progress.equipped).includes(id) && countOf(bag.progress, id) - qty < 1) return { result: 'worn', bag, coins: 0 };
  const coins = item.sellPrice * qty;
  return {
    result: 'ok',
    coins,
    bag: { player: { ...bag.player, coins: bag.player.coins + coins }, progress: withItem(bag.progress, id, -qty) },
  };
}

export type UseResult = 'ok' | 'none' | 'notUsable';

/** Spends one item and says what it does; the game applies the effect (it knows the clock and the cat). */
export function useItem(bag: Bag, id: string): { result: UseResult; bag: Bag; effect?: ItemEffect } {
  const item = ITEMS[id];
  if (!item?.use) return { result: 'notUsable', bag };
  if (countOf(bag.progress, id) < 1) return { result: 'none', bag };
  return { result: 'ok', effect: item.use, bag: { ...bag, progress: withItem(bag.progress, id, -1) } };
}

export type EquipResult = 'ok' | 'notWearable' | 'none';

/** Wears an item in its slot (the one there before goes back to the bag, it was never taken out). */
export function equip(progress: Progress, id: string): { result: EquipResult; progress: Progress } {
  const item = ITEMS[id];
  if (!item?.slot) return { result: 'notWearable', progress };
  if (countOf(progress, id) < 1) return { result: 'none', progress };
  return { result: 'ok', progress: { ...progress, equipped: { ...progress.equipped, [item.slot]: id } } };
}

export function unequip(progress: Progress, slot: EquipSlot): Progress {
  if (!progress.equipped[slot]) return progress;
  const equipped = { ...progress.equipped };
  delete equipped[slot];
  return { ...progress, equipped };
}

export const wornIn = (progress: Progress, slot: EquipSlot): Item | null => {
  const id = progress.equipped[slot];
  return id ? ITEMS[id] ?? null : null;
};
