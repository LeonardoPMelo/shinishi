import type { Item } from '../types';
import { CHAPTER3_ITEMS } from './chapter3';
import { TEMPLE_ITEMS } from './temple';
import { SHOP_ITEMS } from './shop';
import { REDESIGN_ITEMS } from './redesign';
import { INTERIOR_ITEMS } from './interiors';
import { ACADEMY_ITEMS } from './academy';
import { SEDE_ITEMS } from './mikage';
import { ECONOMY_ITEMS } from './shops';
import { WILD_ITEMS } from './wild';

const list: Item[] = [
  { id: 'receita', name: 'Receita do Bolinho Supremo', icon: '📜', description: 'A receita secreta da Chef Hana. Está um pouco amassada e cheira a peixe.' },
  { id: 'peixe', name: 'Peixe Saltitante', icon: '🐟', description: 'Um dos peixes do jutsu atrapalhado do Taro. Ainda se mexe um pouquinho.' },
  { id: 'engrenagem', name: 'Engrenagem', icon: '⚙️', description: 'Peça de metal com dentes. O Kiko jura que é essencial.' },
  { id: 'mapa', name: 'Mapa do Tesouro', icon: '🗺️', description: '"Onde a água canta e a ponte vermelha dorme, cave sob a terceira lanterna."' },
  { id: 'bussola', name: 'Bússola Antiga', icon: '🧭', description: 'Aponta sempre para... a cantina. Talvez esteja com fome.' },
  { id: 'pergaminho', name: 'Pergaminho do Primeiro Gato', icon: '📿', description: 'Um texto antigo sobre o primeiro gato ninja da vila. Termina com a palavra "Kuro".' },
  { id: 'pata_dourada', name: 'Pata Dourada', icon: '🐾', description: 'Moeda antiga escondida pela vila. Dizem que existem 8.', category: 'colecionavel', rarity: 'raro' },
  { id: 'onigiri', name: 'Onigiri de Atum', icon: '🍙', description: 'Presente da Chef Hana. Delicioso e com formato de pata. Comer dá um pouquinho de energia (5 segundos de impulso).', category: 'consumivel', rarity: 'comum', use: { kind: 'impulso', seconds: 5 }, sellPrice: 2, effectText: 'Mais rápido e pulando mais alto por 5 segundos.' },
  { id: 'fita', name: 'Fita da Coragem', icon: '🎀', description: 'A Luna te deu esta fita. Lembra que coragem é tentar mesmo com medo.' },
  { id: 'lanterna_papel', name: 'Lanterna de Papel', icon: '🏮', description: 'Para enfeitar a praça no Festival das Lanternas.' },
  { id: 'tabua', name: 'Tábua de Madeira', icon: '🪵', description: 'Boa para consertar degraus. Cheira a floresta.' },
  { id: 'medalha', name: 'Medalha do Guarda', icon: '🎖️', description: 'O Roku guardava isso no cofre. "Por bravura (quase sempre)".' },
  { id: 'pocao_energia', name: 'Poção de Energia', icon: '🧪', description: 'Tecla 3: mais rápido e pulando mais alto por 10 segundos. Sabor: chá de erva-de-gato.', category: 'consumivel', rarity: 'comum', use: { kind: 'impulso', seconds: 10 }, sellPrice: 1, effectText: 'Tecla 3: mais rápido e pulando mais alto por 10 segundos.' },
  { id: 'faixa_vermelha', name: 'Faixa Ninja Vermelha', icon: '🟥', description: 'Presente do Festival. Use na mochila para trocar a cor da faixa do Shinichi.', band: '#C9302C' },
  { id: 'faixa_dourada', name: 'Faixa Ninja Dourada', icon: '🟨', description: 'Para quem trouxe a luz de volta à vila. Pode usar com orgulho.', band: '#D9A520' },
];

list.push(...CHAPTER3_ITEMS, ...TEMPLE_ITEMS, ...SHOP_ITEMS, ...REDESIGN_ITEMS, ...INTERIOR_ITEMS, ...ACADEMY_ITEMS, ...SEDE_ITEMS, ...ECONOMY_ITEMS, ...WILD_ITEMS);

// every band is worn in the 'faixa' slot (the color paints Shinichi's headband)
for (const item of list) {
  if (item.band) {
    item.slot ??= 'faixa';
    item.category ??= 'cosmetico';
    item.effectText ??= 'Vestida: muda a cor da faixa do Shinichi.';
  }
}

export const ITEMS: Record<string, Item> = Object.fromEntries(list.map((i) => [i.id, i]));
