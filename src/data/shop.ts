import type { Item } from '../types';

/**
 * A Sacola da Sora: the place to spend gems. Gems are only ever earned in play (challenges, missions):
 * nothing here involves real money. The catalogue is small on purpose: cosmetic bands (worn from the
 * backpack) and Energy Potions, sold one by one or in a pack, so comparing prices is part of the fun.
 */

export const SHOP_ITEMS: Item[] = [
  { id: 'faixa_azul', name: 'Faixa Azul do Rio', icon: '🟦', description: 'Tingida com flores azuis da beira do rio. Use na mochila.', band: '#2F7FC9' },
  { id: 'faixa_verde', name: 'Faixa Verde da Floresta', icon: '🟩', description: 'Da cor do bambu novo. Ótima para se esconder no mato.', band: '#3E9A4A' },
  { id: 'faixa_rosa', name: 'Faixa Rosa Sakura', icon: '🌸', description: 'Cor de cerejeira em flor. A Luna diz que combina com você.', band: '#E8789A' },
  { id: 'faixa_roxa', name: 'Faixa Roxa do Templo', icon: '🟪', description: 'Da cor do crepúsculo atrás do Templo dos Enigmas.', band: '#7A4FB0' },
];

export interface ShopOffer {
  id: string;
  item: string;
  qty: number;
  price: number;
  /** Bands are bought once; consumables can be bought again. */
  once?: boolean;
  /** Shown before the price (Sora's sales talk). */
  pitch: string;
}

export const SHOP_OFFERS: ShopOffer[] = [
  { id: 'faixa_azul', item: 'faixa_azul', qty: 1, price: 4, once: true, pitch: 'Achei no rio, juro que estava seca.' },
  { id: 'faixa_verde', item: 'faixa_verde', qty: 1, price: 4, once: true, pitch: 'Camuflagem de floresta. Testada por mim.' },
  { id: 'faixa_rosa', item: 'faixa_rosa', qty: 1, price: 5, once: true, pitch: 'Edição de primavera. Só tenho uma.' },
  { id: 'faixa_roxa', item: 'faixa_roxa', qty: 1, price: 6, once: true, pitch: 'Rara! Vem lá do lado do templo.' },
  { id: 'pocao_1', item: 'pocao_energia', qty: 1, price: 2, pitch: 'Uma poção, para uma emergência.' },
  { id: 'pocao_3', item: 'pocao_energia', qty: 3, price: 5, pitch: 'Pacote de 3! Compare antes de escolher...' },
];

export const OFFERS_BY_ID: Record<string, ShopOffer> = Object.fromEntries(SHOP_OFFERS.map((o) => [o.id, o]));

/** Gems per unit, as Sora explains it: divide the price by how many come in the pack. */
export const unitPrice = (o: ShopOffer) => o.price / o.qty;
