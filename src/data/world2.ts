import type { DialogueTree, Vec3 } from '../types';
import type { WorldObject } from './world';

/** Capítulo 2 — new places and interactive objects. */

export const MIRANTE = { x0: 12.6, x1: 18.8, z0: -18.8, z1: -13.4, h: 2.4 };
/** Stairs climb from west (bottom) to east (top) inside this z band. */
export const MIRANTE_STAIRS = { xBottom: 8.2, xTop: MIRANTE.x0, z0: -17.5, z1: -15.7, brokenUntil: 11.1 };
export const TELESCOPE: Vec3 = [17.6, MIRANTE.h, -14.3];
export const KURO_MIRANTE: Vec3 = [16.4, MIRANTE.h, -17.4];

export const RAFTS = [
  { x: 9.6, phase: 0 },
  { x: 12.8, phase: Math.PI },
];

export const MUSHROOMS: { pos: Vec3; bounce: number; r: number }[] = [
  { pos: [-12.4, 0, 38.2], bounce: 12.6, r: 0.9 },
  { pos: [-17, 0, 31.6], bounce: 11, r: 0.8 },
];
export const TREEHOUSE = { pos: [-15.6, 4.2, 36.4] as Vec3, r: 1.5 };

export const BALL_START: Vec3 = [6, 0.6, 33.4];
export const GOAL = { x: 6, z: 39.0, halfWidth: 1.3, height: 1.5 };

export const HANG_SPOTS: Vec3[] = [
  [Math.cos(0.35) * 6.3, 0, Math.sin(0.35) * 6.3],
  [Math.cos(1.92) * 6.3, 0, Math.sin(1.92) * 6.3],
  [Math.cos(3.49) * 6.3, 0, Math.sin(3.49) * 6.3],
  [Math.cos(5.06) * 6.3, 0, Math.sin(5.06) * 6.3],
  [0, 0, -7.6],
];

const LANTERN_SPOTS: Vec3[] = [
  [-11.0, 0, -5.4], [10.4, 0, 2.8], [3.6, 0, 11.6], [11.2, 0, 14.9], [7.6, 0, -7.0],
];

export const CUB_SPOTS: Vec3[] = [
  [-15.4, 0, 13.4], [14.9, MIRANTE.h, -18.1], [-18.0, 0, 5.6], [5.4, 0, 26.2], [-14.6, 0, 30.6], [15.6, 0, 9.6],
];

export const FISH_ZONE = { x0: 4, x1: 14.5, z0: -8, z1: 4.5, start: [9.2, 0, -5.8] as Vec3 };
export const LEAF_ZONE = { center: [-4, 0, 34] as Vec3, radius: 3.4 };
export const VAULT: Vec3 = [-7.4, 0, -1.2];

const say = (speaker: string, text: string, onEnter?: string, label = 'Ok'): DialogueTree => ({
  start: { id: 'start', speaker, text, onEnter, options: [{ label, nextNodeId: null }] },
});

export const WORLD_OBJECTS_2: WorldObject[] = [
  ...LANTERN_SPOTS.map((pos, i): WorldObject => ({
    id: `lanterna_${i}`,
    kind: 'pickup_lantern',
    position: pos,
    label: 'Lanterna de papel',
    when: { active: 'festival', notStep: 'festival.pendurar' },
    hideWhen: { flag: `got_lanterna_${i}` },
    actions: `FLAG:got_lanterna_${i};GIVE:lanterna_papel;COUNT:lanternas_pegas`,
  })),
  ...HANG_SPOTS.map((pos, i): WorldObject => ({
    id: `pendurar_${i}`,
    kind: 'hang',
    position: pos,
    value: i,
    label: 'Pendurar a lanterna',
    usableWhen: { active: 'festival', step: 'festival.juntar', notFlag: `pendurada_${i}`, item: { id: 'lanterna_papel' } },
    actions: `FLAG:pendurada_${i};TAKE:lanterna_papel;COUNT:lanternas_penduradas;SFX:chime`,
  })),
  ...CUB_SPOTS.map((pos, i): WorldObject => ({
    id: `filhote_${i}`,
    kind: 'cub',
    position: pos,
    label: 'Achei você!',
    when: { active: 'filhotes' },
    hideWhen: { flag: `achou_filhote_${i}` },
    actions: `FLAG:achou_filhote_${i};COUNT:filhotes;SFX:voice_chitter`,
    radius: 1.6,
  })),
  {
    id: 'pista_1',
    kind: 'clue',
    position: [-2.6, 0, -3.4],
    label: 'Ler o bilhete do Roku',
    name: 'Bilhete amassado',
    when: { active: 'cofre' },
    dialogue: say('Bilhete do Roku', '"PRIMEIRO NÚMERO: quantas patas têm dois gatos juntos?"\n\n(Embaixo, um desenho de dois gatos. Bem tortos.)', 'FLAG:pista_cofre_1'),
  },
  {
    id: 'pista_2',
    kind: 'clue',
    position: [4.6, 0, -13.2],
    label: 'Ler o bilhete do Roku',
    name: 'Bilhete amassado',
    when: { active: 'cofre' },
    dialogue: say('Bilhete do Roku', '"SEGUNDO NÚMERO: a metade de dez."\n\n(Alguém desenhou um peixe cortado ao meio. Faz sentido.)', 'FLAG:pista_cofre_2'),
  },
  {
    id: 'pista_3',
    kind: 'clue',
    position: [-1.4, 0, 19.4],
    label: 'Ler o bilhete do Roku',
    name: 'Bilhete amassado',
    when: { active: 'cofre' },
    dialogue: say('Bilhete do Roku', '"TERCEIRO NÚMERO: conte as lanternas de pedra na margem, aqui do lado da ponte."\n\n(Olhe ao redor e conte com calma.)', 'FLAG:pista_cofre_3'),
  },
  {
    id: 'cofre',
    kind: 'vault',
    position: VAULT,
    rotation: 0.5,
    label: 'Abrir o cofre',
    name: 'Cofre do Guarda Roku',
    usableWhen: { active: 'cofre', notStep: 'cofre.abrir' },
    dialogue: {
      start: {
        id: 'start',
        speaker: 'Cofre do Guarda Roku',
        text: 'Um cofre de ferro com três rodinhas de números. Precisa de um código.',
        options: [
          { label: '🔢 Digitar o código', nextNodeId: null, action: 'CHALLENGE:cofre_codigo', when: { flag: ['pista_cofre_1', 'pista_cofre_2', 'pista_cofre_3'] } },
          { label: 'Ainda faltam pistas...', nextNodeId: null },
        ],
      },
    },
  },
  {
    id: 'escada_mirante',
    kind: 'examine',
    position: [10.4, 0, -16.6],
    label: 'Consertar a escada',
    name: 'Escada quebrada',
    radius: 2.2,
    usableWhen: { active: 'ponte', step: 'ponte.comprar', notFlag: 'escada_consertada' },
    dialogue: say('Escada quebrada', '*(martela, encaixa, martela no dedo, encaixa de novo)*\n\nSeis degraus novinhos! A escada do Mirante está firme outra vez.', 'TAKE:tabua:12;FLAG:escada_consertada;STEP:ponte.consertar;SFX:mechanism', 'Subir!'),
  },
  {
    id: 'luneta',
    kind: 'examine',
    position: TELESCOPE,
    label: 'Olhar pela luneta',
    name: 'Luneta do Mirante',
    radius: 1.8,
    dialogue: {
      start: {
        id: 'start',
        speaker: 'Luneta do Mirante',
        text: 'Lá longe, a Montanha do Gato brilha ao sol. Nas encostas, templos e cachoeiras.\nPerto da floresta, uma cabana na árvore que você nunca tinha visto...',
        onEnter: 'FLAG:viu_luneta',
        options: [
          { label: 'Que vista! 😺', nextNodeId: null, action: 'STEP:ponte.luneta' },
        ],
      },
    },
  },
  {
    id: 'bau_arvore',
    kind: 'chest',
    position: [TREEHOUSE.pos[0] + 0.5, TREEHOUSE.pos[1], TREEHOUSE.pos[2] - 0.4],
    rotation: 0.8,
    label: 'Abrir o baú',
    usableWhen: { notFlag: 'bau_arvore' },
    actions: 'FLAG:bau_arvore;COINS:30;GIVE:pata_dourada;COUNT:patas;SFX:chest',
  },
  {
    // Secret: crates by the fruit stall lead up to its canopy, where this chest waits.
    id: 'bau_toldo',
    kind: 'chest',
    position: [8.6, 2.22, -3.8],
    rotation: Math.PI / 2,
    label: 'Abrir o baú',
    usableWhen: { notFlag: 'bau_toldo' },
    actions: 'FLAG:bau_toldo;COINS:30;XP:15;GIVE:pocao_energia;SECRET:toldo_mercado;SFX:chest',
  },
  {
    id: 'lanterna_memoria',
    kind: 'examine',
    position: [0, 0, 1.7],
    label: 'Acender a Lanterna da Memória',
    // same spot as the fountain: the mission wins the button (Etapa 10)
    priority: 1,
    name: 'Lanterna da Memória',
    radius: 2.4,
    usableWhen: { active: 'lanternas_apagadas', step: 'lanternas_apagadas.kuro' },
    dialogue: say('Lanterna da Memória', 'Você escreve com cuidado: "Mestre Hoshi — o primeiro gato ninja da Vila das Patas".\n\nA chama acende... e, uma por uma, todas as lanternas do festival brilham de novo.', 'FLAG:lanternas_reacesas;STEP:lanternas_apagadas.reacender;SFX:secret', 'Que lindo...'),
  },
];
