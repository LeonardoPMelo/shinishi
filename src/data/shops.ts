import type { Condition, Item, Mission } from '../types';
import type { Currency } from '../systems/inventory';
import { SHOP_OFFERS as SORA_OFFERS } from './shop';
import type { WorldObject } from './world';

/**
 * The village's shops and the items they sell (Etapa 6 da expansão). Each shop has its own speciality,
 * currency and keeper:
 *  - Peixaria do Seu Bigodes (coins): food that does something (energy, higher jumps, the Faro, treats for
 *    the rabbits);
 *  - Armazém do Boku (coins): equipment with a real use, and the place that buys what you found;
 *  - Sacola da Sora (gems): bands, potions and a collar, things for show (data/shop.ts).
 * Every item says what it is for (`effectText`); nothing is sold that has no use or no look. Prices never let
 * you earn by buying and selling back (tests/economy.test.ts).
 */

export const ECONOMY_ITEMS: Item[] = [
  {
    id: 'peixe_grelhado', name: 'Peixe Grelhado', icon: '🍢', category: 'consumivel', rarity: 'comum', sellPrice: 3,
    description: 'Espetinho do Seu Bigodes, crocante por fora. Dá aquela mola nas patas.',
    use: { kind: 'salto', seconds: 20 }, effectText: 'Pula mais alto por 20 segundos.',
  },
  {
    id: 'cha_erva', name: 'Chá de Erva-de-gato', icon: '🍵', category: 'consumivel', rarity: 'comum', sellPrice: 2,
    description: 'Receita da Luna. O nariz fica esperto na hora.',
    use: { kind: 'faro', seconds: 14 }, effectText: 'Faro na hora, por 14 segundos, mesmo que ainda esteja recarregando.',
  },
  {
    id: 'petisco_atum', name: 'Petisco de Atum', icon: '🥫', category: 'consumivel', rarity: 'comum', sellPrice: 1,
    description: 'Pedacinhos de atum seco. Nenhum coelho resiste (eles fingem que sim).',
    effectText: 'Perto de um coelho, aperte E: ele confia em você por 1 minuto.',
  },
  {
    id: 'mochila_exploradora', name: 'Mochila do Explorador', icon: '👝', category: 'equipamento', rarity: 'raro', slot: 'mochila', sellPrice: 15,
    passive: 'detector',
    description: 'Mochila de lona com uma bússola costurada na alça. A agulha gosta de ouro.',
    effectText: 'Vestida: uma bússola na tela aponta a Pata Dourada mais perto que ainda falta achar.',
  },
  {
    id: 'coleira_faro', name: 'Coleira do Faro', icon: '📿', category: 'equipamento', rarity: 'raro', slot: 'coleira', sellPrice: 12,
    passive: 'faro_longo', collar: { color: '#4F8A4A', charm: 'folha' },
    description: 'Coleira verde com uma folha de erva-de-gato prensada. Cheiro de mato fresco.',
    effectText: 'Vestida: o Faro dura 9 segundos (em vez de 6) e recarrega em 8 (em vez de 12).',
  },
  {
    id: 'coleira_sininho', name: 'Coleira do Sininho', icon: '🔔', category: 'cosmetico', rarity: 'comum', slot: 'coleira', sellPrice: 2,
    collar: { color: '#C0392B', charm: 'sino' },
    description: 'Vermelha, com um sininho dourado. Ninja silencioso? Hoje não.',
    effectText: 'Só para enfeitar: aparece no pescoço do Shinichi.',
  },
];

export interface ShopOffer {
  id: string;
  item: string;
  qty: number;
  price: number;
  /** Only one ever (equipment, bands). */
  once?: boolean;
  /** The keeper's sales talk. */
  pitch: string;
  /** Sold only once this holds (unlocked by progress); otherwise shown locked, with `lockedText`. */
  when?: Condition;
  lockedText?: string;
}

export interface ShopDef {
  id: string;
  name: string;
  icon: string;
  keeper: string;
  currency: Currency;
  greeting: string;
  /** Header colours: each shop looks like itself. */
  theme: { accent: string; bg: string };
  offers: ShopOffer[];
  /** Which of your items this shop buys (missing: it buys nothing). */
  buys?: (item: Item) => boolean;
  buysText?: string;
}

export const SHOPS: ShopDef[] = [
  {
    id: 'peixaria',
    name: 'Peixaria do Seu Bigodes',
    icon: '🐟',
    keeper: 'Seu Bigodes',
    currency: 'coins',
    greeting: 'Peixe fresquinho, petisco crocante e chá da Luna! Moedas, por favor. Escamas, não.',
    theme: { accent: '#2F5E8C', bg: '#E6F1F8' },
    offers: [
      { id: 'pex_onigiri', item: 'onigiri', qty: 1, price: 3, pitch: 'Da Chef Hana, com formato de pata.' },
      { id: 'pex_petisco_1', item: 'petisco_atum', qty: 1, price: 2, pitch: 'Um petisco, para um coelho.' },
      { id: 'pex_petisco_3', item: 'petisco_atum', qty: 3, price: 5, pitch: 'Pacote de 3: sai mais em conta, se você usar os 3.' },
      {
        id: 'pex_peixe', item: 'peixe_grelhado', qty: 1, price: 6, pitch: 'Receita nova, desde que aquele peixe fujão voltou.',
        when: { done: 'peixe_fujao' }, lockedText: 'Ajude o Seu Bigodes com o Peixe Fujão para liberar.',
      },
      {
        id: 'pex_cha', item: 'cha_erva', qty: 1, price: 5, pitch: 'A Luna deixou a receita comigo. Ela é tímida para vender.',
        when: { done: 'pocao' }, lockedText: 'Faça o Chá Calmante com a Luna para liberar.',
      },
    ],
    buys: (it) => it.category === 'consumivel' && it.sellPrice !== undefined,
    buysText: 'O Seu Bigodes compra comida e petiscos.',
  },
  {
    id: 'armazem',
    name: 'Armazém do Boku',
    icon: '📦',
    keeper: 'Boku',
    currency: 'coins',
    greeting: 'Equipamento de verdade para ninja de verdade. E eu compro o que você achou por aí... pela metade do preço, claro.',
    theme: { accent: '#5E8C4A', bg: '#EEF4E6' },
    offers: [
      {
        id: 'arm_mochila', item: 'mochila_exploradora', qty: 1, price: 35, once: true, pitch: 'A bússola da alça veio do mapa da Sora. Aponta para o ouro!',
        when: { done: 'mapa' }, lockedText: 'Ache o tesouro do Mapa da Sora para liberar.',
      },
      {
        id: 'arm_coleira', item: 'coleira_faro', qty: 1, price: 30, once: true, pitch: 'Só vendo para quem se formou na Academia. Regra da Professora Sumi.',
        when: { done: 'academia' }, lockedText: 'Para graduados da Academia Ninja.',
      },
      // Etapa 7: the wild lands. The expedition gives the rope or the cape (the route chosen with Yuki); the
      // other one is sold here, so both ways in the wild lands stay open
      {
        id: 'arm_pocao_cura', item: 'pocao_cura', qty: 1, price: 6, pitch: 'Receita da Doutora Momo. Para as terras selvagens, nunca saia sem duas.',
        when: { done: 'trilha' }, lockedText: 'Chega com a expedição às terras selvagens.',
      },
      {
        id: 'arm_corda', item: 'corda_ninja', qty: 1, price: 40, once: true, pitch: 'Corda de expedição. Amarra ponte, amarra barco, amarra o Taro.',
        when: { done: 'expedicao' }, lockedText: 'Material da expedição da Sede.',
      },
      {
        id: 'arm_capa', item: 'capa_vento', qty: 1, price: 40, once: true, pitch: 'Capa grossa: nem a ventania do mirante derruba quem usa.',
        when: { done: 'expedicao' }, lockedText: 'Material da expedição da Sede.',
      },
    ],
    buys: (it) => it.sellPrice !== undefined && it.category !== 'missao' && it.category !== 'colecionavel',
    buysText: 'O Boku compra comida, equipamentos e enfeites (colecionáveis e itens de missão, não).',
  },
  {
    id: 'sora',
    name: 'Sacola da Sora',
    icon: '🎒',
    keeper: 'Sora',
    currency: 'gems',
    greeting: 'Achados das minhas viagens! Aceito gemas. Minhocas, não.',
    theme: { accent: '#C2477A', bg: '#FBEFF4' },
    offers: [
      ...SORA_OFFERS,
      { id: 'sora_sininho', item: 'coleira_sininho', qty: 1, price: 4, once: true, pitch: 'Achei numa feira do outro lado da montanha. Tilinta!' },
    ],
  },
];

export const SHOPS_BY_ID: Record<string, ShopDef> = Object.fromEntries(SHOPS.map((s) => [s.id, s]));

/** Every offer in every shop, by id, with the shop it belongs to (ids are unique across shops). */
export const ALL_OFFERS: Record<string, ShopOffer & { shop: string; currency: Currency }> = Object.fromEntries(
  SHOPS.flatMap((s) => s.offers.map((o) => [o.id, { ...o, shop: s.id, currency: s.currency }])),
);

/** The counters at the market stalls (Buildings.tsx draws the stalls). */
export const SHOP_OBJECTS: WorldObject[] = [
  { id: 'balcao_peixaria', kind: 'examine', position: [7.5, 0, 0.7], label: '🐟 Peixaria do Seu Bigodes', name: 'Peixaria', radius: 1.6, actions: 'SHOP:peixaria' },
  { id: 'balcao_armazem', kind: 'examine', position: [7.5, 0, -4.2], label: '📦 Armazém do Boku', name: 'Armazém', radius: 1.6, actions: 'SHOP:armazem' },
];

// ── A mission that goes through a shop, an item and the animals ───────────────
export const RABBIT_FRIENDS = 3;

export const ECONOMY_MISSIONS: Mission[] = [
  {
    id: 'coelhos',
    chapter: 2,
    title: 'Amigo dos Coelhos',
    category: 'secundária',
    giver: 'pipo',
    description: 'Os coelhos fogem do Pipo. Ele quer saber o segredo para ficar amigo deles.',
    steps: [
      { id: 'ouvir', description: 'Ouça o Pipo', target: { npc: 'pipo' } },
      { id: 'alimentar', description: `Dê petiscos de atum a ${RABBIT_FRIENDS} coelhos (a Peixaria do Seu Bigodes vende)`, after: ['ouvir'], counter: { id: 'coelhos_alimentados', goal: RABBIT_FRIENDS } },
      { id: 'contar', description: 'Conte o segredo ao Pipo', after: ['alimentar'], target: { npc: 'pipo' } },
    ],
    rewards: { xp: 40, coins: 25, gems: 2, badges: ['Amigo dos Bichos'], items: { petisco_atum: 2 } },
    lesson: 'Confiança se ganha com calma e cuidado: chegar devagar, oferecer algo bom e não assustar.',
  },
];
