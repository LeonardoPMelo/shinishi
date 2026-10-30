import type { Condition, DialogueTree, Vec3 } from '../types';
import { WORLD_OBJECTS_2 } from './world2';
import { CHAPTER3_OBJECTS } from './chapter3';
import { TEMPLE_OBJECTS } from './temple';
import { EAST_OBJECTS } from './east';
import { WEST_OBJECTS } from './west';
import { SOUTH_OBJECTS } from './south';
import { REDESIGN_OBJECTS } from './redesign';
import { INTERIOR_OBJECTS } from './interiors';
import { ACADEMY_OBJECTS } from './academy';
import { SEDE_OBJECTS } from './mikage';
import { SHOP_OBJECTS } from './shops';
import { WILD_OBJECTS } from './wild';
import { STORY_OBJECTS } from './story';

export type WorldObjectKind =
  | 'pickup_herb'
  | 'pickup_fish'
  | 'pickup_paw'
  | 'chest'
  | 'sign'
  | 'examine'
  | 'dig'
  | 'lantern'
  | 'door'
  | 'machine'
  | 'ring'
  | 'fountain'
  | 'bell'
  | 'listen'
  | 'pickup_lantern'
  | 'hang'
  | 'cub'
  | 'clue'
  | 'vault';

export interface WorldObject {
  id: string;
  kind: WorldObjectKind;
  position: Vec3;
  rotation?: number;
  /** Prompt text: "E · <label>". */
  label: string;
  /** Name shown as speaker when the object narrates. */
  name?: string;
  /** Object exists only while this holds. */
  when?: Condition;
  /** Object is gone (or used) once this holds. */
  hideWhen?: Condition;
  /** Interaction is possible only while this holds (object may still be visible). */
  usableWhen?: Condition;
  actions?: string;
  dialogue?: DialogueTree;
  value?: number;
  radius?: number;
  /** Wins the interact button over everyday objects in the same spot (game/systems/interaction.ts). */
  priority?: number;
}

const say = (speaker: string, text: string, onEnter?: string, label = 'Ok'): DialogueTree => ({
  start: { id: 'start', speaker, text, onEnter, options: [{ label, nextNodeId: null }] },
});

// ── Layout anchors (also used by the map) ────────────────────────────────────
export const RIVER = { z: 23, halfWidth: 2, bridgeHalfWidth: 1.45 };
export const WORLD_BOUNDS = { minX: -18.6, maxX: 18.6, minZ: -18.6, maxZ: 39.2 };
export const GARDEN = { minX: -19, maxX: -12, minZ: -19, maxZ: -12, door: [-12, 0, -14.75] as Vec3 };
export const SHED_POS: Vec3 = [-16.3, 0, 17.6];
export const KIKO_HOUSE: Vec3 = [15.6, 0, 15.2];
export const MACHINE_POS: Vec3 = [13.2, 0, 18.4];
export const RIVER_LANTERNS: Vec3[] = [[-3, 0, 19.9], [-5, 0, 19.9], [-7, 0, 19.9]];
export const PILLARS: { pos: Vec3; h: number }[] = [
  { pos: [-9, 0, 30], h: 0.6 },
  { pos: [-10.6, 0, 31.8], h: 1.2 },
  { pos: [-12.2, 0, 33.6], h: 1.8 },
  { pos: [-13.8, 0, 35.4], h: 2.4 },
];
// 1.8 m: out of reach of a single jump (1.5 m), comfortable with the double jump (up to 2.8 m)
/**
 * The rock the double jump is for (Pata Dourada on top). Was 1.8 m, but a single jump climbed it: its apex
 * is ~1.52 m and the cat's round capsule rides up an edge ~0.38 m higher (measured, Etapa 3 da expansão).
 * 2.4 m: out of reach for a single jump (~1.9) and for one with the energy potion (~2.3); a double jump,
 * with the timing Master Lótus teaches, clears it.
 */
export const TALL_ROCK = { pos: [10, 0, 35] as Vec3, h: 2.4, r: 1.15 };
export const STEPPING_STONES: Vec3[] = [[-12, 0, 21.4], [-12.4, 0, 23], [-12, 0, 24.6]];
export const FOOTPRINT_PATH: Vec3[] = [
  [-3, 0, 8.6], [-4.6, 0, 9.3], [-6.2, 0, 10.2], [-7.8, 0, 11.2], [-9.2, 0, 12.4],
  [-10.3, 0, 13.8], [-11.4, 0, 15.1], [-12.6, 0, 16.2], [-13.6, 0, 17.1],
];

const FISH_SPOTS: Vec3[] = [
  [-6, 0, -1], [-11, 0, 4], [4, 0, 9.4], [10, 0, 5], [12, 0, -6], [-2, 0, -9],
  [-14, 0, -6], [14, 0, 1], [3, 0, 15], [-9, 0, 13], [16, 0, -14], [-1, 0, 18.5],
];

const PAW_SPOTS: { pos: Vec3; extra?: string }[] = [
  { pos: [-12.6, 0.5, -6.8] },
  { pos: [-15, 0.5, 11.4] },
  { pos: [17.7, 0.5, -6.6] },
  { pos: [TALL_ROCK.pos[0], TALL_ROCK.h + 0.55, TALL_ROCK.pos[2]], extra: 'STEP:treino.pedra_alta' },
  { pos: [-16.6, 1.3, -13.4] },
  { pos: [0, 1.25, 23] },
  { pos: [STEPPING_STONES[1][0], 0.95, STEPPING_STONES[1][2]] },
  // was [17.5, 0.5, 38.8]: something in the corner kept the cat about 1 m away (pickup radius 0.95)
  { pos: [16.2, 0.5, 37.0] },
];

export const RINGS: Vec3[] = [
  [1.5, 1.6, 28.4], [4, 1.8, 30], [6.6, 1.6, 31.6], [9.2, 2.0, 30.6], [11.4, 1.6, 28.8], [13.4, 1.9, 27.4],
];

export const LANTERN_PUZZLE: { pos: Vec3; value: number }[] = [
  { pos: [-9.6, 0, -13.2], value: 10 },
  { pos: [-9.1, 0, -14.3], value: 12 },
  { pos: [-9.1, 0, -15.4], value: 16 },
  { pos: [-9.6, 0, -16.5], value: 20 },
];

export const WORLD_OBJECTS: WorldObject[] = [
  ...FISH_SPOTS.map((pos, i): WorldObject => ({
    id: `fish_${i}`,
    kind: 'pickup_fish',
    position: pos,
    label: 'Peixe',
    when: { active: 'chuva_peixes' },
    hideWhen: { flag: `got_fish_${i}` },
    actions: `FLAG:got_fish_${i};GIVE:peixe;COUNT:peixes_pegos`,
  })),
  ...PAW_SPOTS.map(({ pos, extra }, i): WorldObject => ({
    id: `paw_${i}`,
    kind: 'pickup_paw',
    position: pos,
    label: 'Pata Dourada',
    hideWhen: { flag: `got_paw_${i}` },
    actions: `FLAG:got_paw_${i};START:patas_douradas;GIVE:pata_dourada;COUNT:patas${extra ? `;${extra}` : ''}`,
  })),
  ...RINGS.map((pos, i): WorldObject => ({
    id: `ring_${i}`,
    kind: 'ring',
    position: pos,
    label: 'Argola',
    value: i,
    when: { active: 'treino', notStep: 'treino.argolas' },
  })),
  ...LANTERN_PUZZLE.map(({ pos, value }, i): WorldObject => ({
    id: `lantern_${i}`,
    kind: 'lantern',
    position: pos,
    value,
    label: `Acender a lanterna ${value}`,
    usableWhen: { active: 'lanternas', flag: 'sequencia_entendida', notFlag: 'porta_aberta' },
    actions: value === 16
      ? 'FLAG:porta_aberta;STEP:lanternas.acender;SECRET:jardim'
      : 'SFX:fizzle',
  })),
  {
    id: 'lapide',
    kind: 'sign',
    position: [-10.9, 0, -12.4],
    rotation: -0.9,
    label: 'Ler a lápide antiga',
    name: 'Lápide antiga',
    dialogue: {
      start: {
        id: 'start',
        speaker: 'Lápide antiga',
        text: '"Só quem enxerga o padrão encontra o jardim do primeiro gato."\n\n2 · 4 · 8 · ?',
        options: [
          { label: '🧮 Descobrir o número', nextNodeId: null, action: 'CHALLENGE:lanternas_sequencia', when: { active: 'lanternas', notFlag: 'sequencia_entendida' } },
          { label: 'Deixar para depois', nextNodeId: null },
        ],
      },
    },
  },
  {
    id: 'porta_secreta',
    kind: 'door',
    position: GARDEN.door,
    rotation: Math.PI / 2,
    label: 'Examinar a porta de pedra',
    name: 'Porta de pedra',
    usableWhen: { notFlag: 'porta_aberta' },
    dialogue: say('Porta de pedra', 'Uma porta de pedra pesada, coberta de musgo. Há quatro lanternas gravadas nela...\ne um buraquinho no formato de uma pata.'),
  },
  {
    id: 'pergaminho_altar',
    kind: 'examine',
    position: [-15.8, 0, -14.6],
    label: 'Pegar o pergaminho do altar',
    name: 'Altar do Jardim',
    when: { flag: 'porta_aberta' },
    hideWhen: { flag: 'got_pergaminho' },
    usableWhen: { active: 'lanternas' },
    dialogue: say('Pergaminho do Primeiro Gato', '"O primeiro gato ninja protegia a vila em silêncio. Quando foi esquecido,\nseu aprendiz jurou que a vila lembraria dele um dia.\n\nO nome do aprendiz era Kuro."', 'FLAG:got_pergaminho;GIVE:pergaminho;STEP:lanternas.pergaminho', 'Guardar o pergaminho'),
  },
  {
    id: 'bau_jardim',
    kind: 'chest',
    position: [-17.4, 0, -17.2],
    rotation: 0.6,
    label: 'Abrir o baú',
    when: { flag: 'porta_aberta' },
    usableWhen: { notFlag: 'bau_jardim' },
    actions: 'FLAG:bau_jardim;COINS:25;GIVE:onigiri;SFX:chest',
  },
  {
    id: 'bau_floresta',
    kind: 'chest',
    position: [PILLARS[3].pos[0], PILLARS[3].h, PILLARS[3].pos[2]],
    rotation: -0.4,
    label: 'Abrir o baú',
    usableWhen: { notFlag: 'bau_floresta' },
    actions: 'FLAG:bau_floresta;COINS:20;XP:10;SFX:chest',
  },
  {
    id: 'cerejeira_receita',
    kind: 'examine',
    position: [-4.5, 0, -11],
    label: 'Sacudir a cerejeira',
    name: 'Cerejeira',
    radius: 2.2,
    usableWhen: { step: 'receita.kenzo', notFlag: 'got_receita' },
    dialogue: say('Cerejeira', '*(você sacode a árvore com as patinhas)*\n\nUma chuva de pétalas cai... e um pergaminho amassado cai bem na sua cabeça. PLOFT!', 'FLAG:got_receita;GIVE:receita;STEP:receita.arvore', 'Ai! Achei!'),
  },
  {
    id: 'estoque_cantina',
    kind: 'examine',
    position: [-8.3, 0, -4.5],
    rotation: 0.45,
    label: 'Investigar os caixotes',
    name: 'Estoque da cantina',
    radius: 2.2,
    usableWhen: { active: 'peixes', step: 'peixes.talk_tofu', notStep: 'peixes.estoque' },
    dialogue: {
      start: {
        id: 'start', speaker: 'Estoque da cantina',
        text: '*(você fareja os caixotes empilhados)*\n\nSeis caixotes, todos vazios. Cada etiqueta diz "8 peixes frescos".\nAntes de procurar o culpado, vale conferir: quantos peixes havia ao todo?',
        options: [
          { label: '🧮 Contar os peixes', nextNodeId: null, action: 'CHALLENGE:estoque_caixotes' },
          { label: 'Volto depois', nextNodeId: null },
        ],
      },
    },
  },
  {
    id: 'caixote_mercado',
    kind: 'examine',
    position: [9.9, 0, -5.6],
    label: 'Vasculhar o caixote',
    name: 'Caixote do mercado',
    usableWhen: { active: 'inventor', notFlag: 'got_gear_caixote' },
    dialogue: say('Caixote do mercado', 'Entre nabos e um chinelo perdido... uma engrenagem brilhante!', 'FLAG:got_gear_caixote;GIVE:engrenagem;COUNT:engrenagens', 'Pegar'),
  },
  {
    id: 'maquina_kiko',
    kind: 'machine',
    position: MACHINE_POS,
    rotation: -0.5,
    label: 'Usar a máquina do Kiko',
    name: 'Peixomática 3000',
    usableWhen: { active: 'inventor' },
    dialogue: {
      start: {
        id: 'start',
        speaker: 'Peixomática 3000',
        text: 'Uma máquina cheia de canos, alavancas e um botão escrito "NÃO APERTE (APERTE)".',
        options: [
          { label: '⚙️ Encaixar as 3 engrenagens', nextNodeId: null, action: 'TAKE:engrenagem:3;STEP:inventor.instalar;SFX:mechanism', when: { step: 'inventor.pecas', notStep: 'inventor.instalar' } },
          { label: '🔴 Apertar o botão', nextNodeId: 'boom', when: { step: 'inventor.calcular' } },
          { label: 'Sair de perto devagar', nextNodeId: null },
        ],
      },
      boom: {
        id: 'boom',
        speaker: 'Peixomática 3000',
        text: 'VRRRRRRR... CLANC... *POF!*\n\nUma nuvem de confete cobre tudo. Quando ela baixa, dez peixes estão\norganizados por tamanho em fileiras perfeitas. A máquina... funcionou?!',
        onEnter: 'SFX:boom',
        options: [{ label: '😹 Funcionou!', nextNodeId: null, action: 'STEP:inventor.ligar' }],
      },
    },
  },
  {
    id: 'terra_fofa',
    kind: 'dig',
    position: [-7, 0, 19.0],
    label: 'Cavar na terra fofa',
    name: 'Terra fofa',
    usableWhen: { active: 'mapa', notFlag: 'got_tesouro' },
    dialogue: say('Terra fofa', '*(cava, cava, cava... terra voando para todo lado)*\n\nTOC! Um baú pequenininho! Dentro: uma bússola antiga e 30 moedas.', 'FLAG:got_tesouro;GIVE:bussola;COINS:30;STEP:mapa.cavar', 'Tesouro!'),
  },
  {
    id: 'galpao',
    kind: 'listen',
    position: [SHED_POS[0] + 1.6, 0, SHED_POS[2]],
    label: 'Escutar o barulho',
    name: 'Galpão velho',
    radius: 2.4,
    usableWhen: { active: 'fantasma', notStep: 'fantasma.pegadas' },
    dialogue: say('Galpão velho', '*(encosta a orelha na madeira)*\n\n"ZZZRRRRR... HHHNNNN... ZZZRRRR..."\n\nO "fantasma" está bem atrás do galpão.', 'STEP:fantasma.pegadas', 'Espiar atrás do galpão'),
  },
  {
    id: 'quadro_vila',
    kind: 'sign',
    position: [-4.6, 0, 2.6],
    rotation: 1.2,
    label: 'Ler o quadro da vila',
    name: 'Quadro da Vila',
    dialogue: say('Quadro da Vila',
      '📌 Chef Hana procura ajudante (de novo).\n' +
      '📌 Treinos com o Mestre Lótus na Floresta, depois da ponte vermelha.\n' +
      '📌 AVISO DO GUARDA ROKU: o rio é molhado. Já testei.\n' +
      '📌 Achados e perdidos: uma meia. Só uma.'),
  },
  {
    id: 'placa_ponte',
    kind: 'sign',
    position: [2.4, 0, 19.6],
    rotation: 0.3,
    label: 'Ler a placa',
    name: 'Placa',
    dialogue: say('Placa', '⬇ Floresta do Treinamento\n\n"Ninjas atravessam pela ponte. Gatos espertos também.\nGatos MUITO espertos tentam as pedras." — Mestre Lótus'),
  },
  {
    id: 'placa_argolas',
    kind: 'sign',
    position: [-0.6, 0, 27.2],
    rotation: 0.4,
    label: 'Ler a placa',
    name: 'Placa de treino',
    dialogue: say('Placa de treino', 'CIRCUITO DAS ARGOLAS\nPasse pelas argolas na ordem, pulando. A argola dourada é a próxima.\n\nObservar antes de pular é metade do salto.'),
  },
  {
    id: 'fonte',
    kind: 'fountain',
    position: [0, 0, 1.7],
    label: 'Jogar uma moeda na fonte',
    name: 'Fonte de Lótus',
    radius: 2.2,
    usableWhen: { coins: 1 },
    actions: 'COINS:-1;SFX:wish',
  },
  {
    id: 'sino_templo',
    kind: 'bell',
    position: [3.2, 0, -12.4],
    label: 'Tocar o sino do templo',
    name: 'Sino do templo',
    actions: 'SFX:temple_bell',
  },
];

WORLD_OBJECTS.push(...WORLD_OBJECTS_2, ...CHAPTER3_OBJECTS, ...TEMPLE_OBJECTS, ...EAST_OBJECTS, ...WEST_OBJECTS, ...SOUTH_OBJECTS, ...REDESIGN_OBJECTS, ...INTERIOR_OBJECTS, ...ACADEMY_OBJECTS, ...SEDE_OBJECTS, ...SHOP_OBJECTS, ...WILD_OBJECTS, ...STORY_OBJECTS);

export const OBJECTS_BY_ID: Record<string, WorldObject> = Object.fromEntries(WORLD_OBJECTS.map((o) => [o.id, o]));

export const WISHES = [
  '🐟 Você desejou um peixe infinito. A fonte faz "blub". Parece um talvez.',
  '✨ Você desejou ser o ninja mais rápido. Um peixinho passa mais rápido que você.',
  '🍙 Você desejou um onigiri. Nada aconteceu, mas a esperança é deliciosa.',
  '😺 Você desejou que todos na vila fossem felizes. A água brilhou um pouquinho.',
  '🌸 Uma pétala cai bem no seu nariz. A fonte tem senso de humor.',
];
