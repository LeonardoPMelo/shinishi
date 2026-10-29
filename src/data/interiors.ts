import type { Challenge, Item, Mission, NPCDefinition, Vec3 } from '../types';
import type { WorldObject } from './world';
import type { Rect } from './regions';

/**
 * Houses you can walk into (Etapa 4 da expansão). Each interior is a real room in the same physics world,
 * built far east of the map (x ≥ 200, beyond the fog), with an open top so the camera can look in from
 * above. A door on the house outside and one inside take the cat between them (game/systems/zone.ts); the
 * outdoor world is hidden while inside.
 *
 * Everything an interior needs is data here: the house outside (to place the door), the room, its furniture,
 * and its interactive objects, which are ordinary world objects (examine, chests, clues) placed in the room,
 * so missions, chests and the save treat them like any other.
 */

export type PropKind =
  | 'balcao' | 'fogao' | 'mesa_baixa' | 'almofada' | 'prateleira' | 'barril' | 'aquario' | 'lanterna'
  | 'relogio' | 'bancada' | 'estante' | 'movel_coberto' | 'tapete' | 'teia' | 'janela' | 'quadro_receitas';

export interface Prop {
  kind: PropKind;
  /** Room coordinates: x across, z along (+z is the door wall); metres from the room centre. */
  at: [number, number];
  /** Turn around the vertical axis (radians). */
  rot?: number;
  /** Wall props: which wall they hang on. */
  wall?: 'n' | 's' | 'e' | 'w';
  color?: string;
}

export interface InteriorDef {
  id: string;
  name: string;
  /** Room centre in the world (far east of the map). */
  origin: [number, number];
  /** Inner width (x), depth (z) and wall height. */
  size: { w: number; d: number; h: number };
  floor: string;
  wall: string;
  wainscot: string;
  /** Warm light colour inside. */
  light: string;
  /** The house outside: centre, turn, width and depth, as built in world/Buildings.tsx (the door is on its +z side). */
  house: { c: [number, number]; rot: number; w: number; d: number };
  props: Prop[];
}

export const INTERIORS: InteriorDef[] = [
  {
    id: 'cantina',
    name: 'Cantina da Chef Hana',
    origin: [200, 0],
    size: { w: 9, d: 7, h: 2.7 },
    floor: '#9B6B43',
    wall: '#F3E3C8',
    wainscot: '#8A5A36',
    light: '#FFC88A',
    house: { c: [-8.5, -8.5], rot: 0.35, w: 5, d: 3.8 },
    props: [
      { kind: 'balcao', at: [0.5, -2.6] },
      { kind: 'fogao', at: [-3.4, -2.9] },
      { kind: 'prateleira', at: [2.6, -3.3], wall: 'n' },
      { kind: 'prateleira', at: [-1.2, -3.3], wall: 'n' },
      { kind: 'quadro_receitas', at: [-4.35, -0.6], wall: 'w' },
      { kind: 'aquario', at: [4.05, -0.4], rot: -Math.PI / 2 },
      { kind: 'mesa_baixa', at: [-2.4, 0.9] },
      { kind: 'mesa_baixa', at: [0.6, 1.1] },
      { kind: 'mesa_baixa', at: [3.0, 2.1] },
      { kind: 'almofada', at: [-2.4, 0.15] }, { kind: 'almofada', at: [-2.4, 1.65] }, { kind: 'almofada', at: [-3.25, 0.9] }, { kind: 'almofada', at: [-1.55, 0.9] },
      { kind: 'almofada', at: [0.6, 0.35] }, { kind: 'almofada', at: [0.6, 1.85] }, { kind: 'almofada', at: [-0.25, 1.1] }, { kind: 'almofada', at: [1.45, 1.1] },
      { kind: 'almofada', at: [3.0, 1.35] }, { kind: 'almofada', at: [3.0, 2.85] }, { kind: 'almofada', at: [2.15, 2.1] }, { kind: 'almofada', at: [3.85, 2.1] },
      { kind: 'barril', at: [-3.9, -1.6] },
      { kind: 'barril', at: [-3.9, 2.9] },
      { kind: 'lanterna', at: [-1, 0.5] },
      { kind: 'lanterna', at: [2, 0.5] },
      { kind: 'janela', at: [-4.5, 2.0], wall: 'w' },
      { kind: 'janela', at: [4.5, 2.2], wall: 'e' },
    ],
  },
  {
    id: 'relojoeiro',
    name: 'Casa do Relojoeiro',
    origin: [230, 0],
    size: { w: 7, d: 6, h: 2.5 },
    floor: '#5E4636',
    wall: '#D9CBB2',
    wainscot: '#4D382B',
    light: '#E8C27A',
    house: { c: [-13.5, -2.5], rot: Math.PI / 2, w: 3.6, d: 3 },
    props: [
      { kind: 'relogio', at: [0, -2.75] },
      { kind: 'bancada', at: [-2.3, -2.4] },
      { kind: 'estante', at: [3.25, -1.2], rot: -Math.PI / 2 },
      { kind: 'movel_coberto', at: [2.3, 1.7] },
      { kind: 'movel_coberto', at: [-2.6, 1.4], color: '#CFC6B6' },
      { kind: 'tapete', at: [0, 0.4], color: '#7E3B32' },
      { kind: 'teia', at: [-3.4, -2.9] },
      { kind: 'teia', at: [3.4, -2.9] },
      { kind: 'teia', at: [3.4, 2.9] },
      { kind: 'lanterna', at: [0, 0.2] },
      { kind: 'janela', at: [-3.5, 0.2], wall: 'w' },
    ],
  },
];

export const INTERIORS_BY_ID: Record<string, InteriorDef> = Object.fromEntries(INTERIORS.map((i) => [i.id, i]));

// ── Geometry: where the doors are ─────────────────────────────────────────────

/** Room point → world point (rooms are not turned). */
export const toWorld = (def: InteriorDef, x: number, z: number): Vec3 => [def.origin[0] + x, 0, def.origin[1] + z];

/** The house's front door outside, the spot in front of it the cat comes out on, and the way it faces. */
export function outsideDoor(def: InteriorDef) {
  const [cx, cz] = def.house.c;
  const fx = Math.sin(def.house.rot);
  const fz = Math.cos(def.house.rot);
  const half = def.house.d / 2;
  return {
    door: [cx + fx * half, 0, cz + fz * half] as Vec3,
    /** 1.4 m out: clear of the door step and the house collider. */
    spot: [cx + fx * (half + 1.4), 0, cz + fz * (half + 1.4)] as Vec3,
    /** Heading of the cat coming out (looking away from the house). */
    heading: def.house.rot,
  };
}

/** Inside: the door on the south wall (+z), and where the cat stands after coming in (facing in, -z). */
export function insideDoor(def: InteriorDef) {
  const zWall = def.size.d / 2;
  return {
    door: toWorld(def, 0, zWall),
    spot: toWorld(def, 0, zWall - 1.3),
  };
}

/** The room's floor area, for the walkable regions (data/regions.ts). */
export function interiorRect(def: InteriorDef): Rect {
  return {
    minX: def.origin[0] - def.size.w / 2,
    maxX: def.origin[0] + def.size.w / 2,
    minZ: def.origin[1] - def.size.d / 2,
    maxZ: def.origin[1] + def.size.d / 2,
  };
}

export function interiorAt(x: number, z: number): InteriorDef | null {
  for (const def of INTERIORS) {
    const r = interiorRect(def);
    if (x >= r.minX - 0.5 && x <= r.maxX + 0.5 && z >= r.minZ - 0.5 && z <= r.maxZ + 0.5) return def;
  }
  return null;
}

/**
 * Where to point the player for something at `pos`: inside a room they are not in, its door outside (the
 * map, the objective card's trail and the faro all lead to the door). Elsewhere, the point itself.
 */
export function reachablePosition(pos: Vec3, from?: { x: number; z: number }): Vec3 {
  const room = interiorAt(pos[0], pos[2]);
  if (!room) return pos;
  if (from && interiorAt(from.x, from.z)?.id === room.id) return pos;
  return outsideDoor(room).spot;
}

// ── People, missions, challenges and things inside ────────────────────────────

const C = INTERIORS_BY_ID.cantina;
const R = INTERIORS_BY_ID.relojoeiro;

export const INTERIOR_ITEMS: Item[] = [
  {
    id: 'engrenagem_dourada', name: 'Engrenagem Dourada', icon: '⚙️', category: 'colecionavel', rarity: 'raro',
    description: 'Estava escondida no relógio do velho Tique. Gravado nela: "O tempo ensina quem presta atenção."',
  },
];

export const INTERIOR_CHALLENGES: Challenge[] = [
  {
    id: 'tigelas_mesa',
    skill: 'multiplicacao',
    title: 'Mesa Posta',
    kind: 'number',
    story: 'São 3 mesas, cada uma com 4 almofadas. Cada almofada precisa de uma tigela. A Mimi já colocou 5 tigelas.',
    question: 'Quantas tigelas ainda faltam?',
    answer: 7,
    observe: 'Primeiro descubra quantas tigelas são no total; depois tire as que já estão na mesa.',
    hint: 'Total: 3 mesas × 4 almofadas. Depois subtraia as 5 que já estão lá.',
    example: 'Parecido: 2 mesas com 3 almofadas = 2 × 3 = 6 tigelas. Se já tem 2, faltam 6 − 2 = 4.',
    successText: '🍚 7 tigelas! 3 × 4 = 12, e 12 − 5 = 7. A cantina está pronta para o almoço.',
    onSuccess: 'STEP:mesa_posta.contar',
  },
  {
    id: 'relogio_angulo',
    skill: 'geometria',
    title: 'O Relógio Parado',
    kind: 'choice',
    story: 'O diário do relojoeiro diz: "Os ponteiros formam um ângulo reto, e o pequeno aponta para a direita. Nessa hora, o relógio se abre."',
    question: 'Para que hora você gira os ponteiros?',
    choices: ['3 horas', '6 horas', '12 horas', '9 horas'],
    answer: 0,
    observe: 'Ângulo reto é 90°, como o canto de um caderno. No relógio, "direita" é o lado do número 3.',
    hint: 'O ponteiro grande fica no 12. Qual número, à direita, faz um canto reto com o 12?',
    example: 'Parecido: às 6 horas os ponteiros ficam em linha reta, 180°, meia volta. Às 12, os dois juntos: 0°.',
    successText: '🕒 3 horas! O ponteiro grande no 12 e o pequeno no 3 fazem um quarto de volta: 90°. Clique!',
    onSuccess: 'STEP:relogio_parado.relogio;FLAG:relogio_aberto;SFX:mechanism',
  },
];

export const INTERIOR_MISSIONS: Mission[] = [
  {
    id: 'mesa_posta',
    chapter: 1,
    title: 'Mesa Posta',
    category: 'educativa',
    giver: 'mimi',
    description: 'A Mimi, ajudante da cantina, precisa pôr as mesas antes do almoço. Quantas tigelas faltam?',
    steps: [
      { id: 'ouvir', description: 'Fale com a Mimi dentro da cantina', target: { npc: 'mimi' } },
      { id: 'contar', description: 'Conte as tigelas que faltam (pilha de tigelas no balcão)', after: ['ouvir'], target: { object: 'pilha_tigelas' } },
      { id: 'avisar', description: 'Conte à Mimi', after: ['contar'], target: { npc: 'mimi' } },
    ],
    rewards: { xp: 30, coins: 12, gems: 1, items: { onigiri: 2 } },
    lesson: 'Para achar o que falta: calcule o total (multiplicação) e tire o que já existe (subtração).',
  },
  {
    id: 'relogio_parado',
    chapter: 1,
    title: 'O Relógio Parado',
    category: 'investigação',
    giver: 'mochi',
    description: 'A casa do velho relojoeiro Tique está fechada há anos. Dizem que o relógio dele guarda um segredo.',
    steps: [
      { id: 'ouvir', description: 'Ouça a história da Vovó Mochi', target: { npc: 'mochi' } },
      { id: 'diario', description: 'Procure pistas na Casa do Relojoeiro', after: ['ouvir'], target: { object: 'diario_relojoeiro' } },
      { id: 'relogio', description: 'Acerte a hora do relógio parado', after: ['diario'], target: { object: 'relogio_grande' } },
      { id: 'compartimento', description: 'Abra o compartimento secreto', after: ['relogio'], target: { object: 'bau_relojoeiro' } },
      { id: 'contar', description: 'Conte à Vovó Mochi o que encontrou', after: ['compartimento'], target: { npc: 'mochi' } },
    ],
    rewards: { xp: 60, coins: 20, gems: 2, badges: ['Detetive do Tempo'] },
    lesson: 'Um ângulo reto é um quarto de volta (90°). Ler com atenção (o diário) e observar (o relógio) resolveu o mistério.',
  },
];

const say = (speaker: string, text: string, onEnter?: string, label = 'Ok') => ({
  start: { id: 'start', speaker, text, onEnter, options: [{ label, nextNodeId: null }] },
});

export const INTERIOR_OBJECTS: WorldObject[] = [
  // ── Cantina ──
  {
    id: 'pilha_tigelas', kind: 'examine', position: toWorld(C, 1.6, -2.35), label: 'Contar as tigelas', name: 'Pilha de tigelas',
    usableWhen: { active: 'mesa_posta', step: 'mesa_posta.ouvir', notStep: 'mesa_posta.contar' },
    actions: 'CHALLENGE:tigelas_mesa', radius: 1.6,
  },
  {
    id: 'bau_cantina', kind: 'chest', position: toWorld(C, -0.9, -3.0), label: 'Abrir o baú atrás do balcão',
    hideWhen: { flag: 'bau_cantina' }, actions: 'FLAG:bau_cantina;COINS:15;GIVE:onigiri;SFX:chest', radius: 1.4,
  },
  {
    id: 'aquario_cantina', kind: 'examine', position: toWorld(C, 3.5, -0.4), label: 'Olhar o aquário', name: 'Aquário',
    dialogue: say('Aquário', 'Um peixinho dourado nada em círculos. Ele olha para você...\n...e você tem certeza de que ele está julgando seus bigodes.'), radius: 1.5,
  },
  {
    id: 'quadro_receitas', kind: 'examine', position: toWorld(C, -3.8, -0.6), label: 'Ler o quadro de receitas', name: 'Quadro de receitas',
    dialogue: say('Quadro de receitas', 'Receitas da Chef Hana, com desenhos de peixe por todo lado.\nUma está riscada: "Bolinho de Peixe Explosivo — NUNCA MAIS."'), radius: 1.5,
  },
  // ── Casa do Relojoeiro ──
  {
    id: 'diario_relojoeiro', kind: 'clue', position: toWorld(R, -2.3, -2.0), label: 'Ler o diário empoeirado', name: 'Diário do relojoeiro',
    usableWhen: { active: 'relogio_parado', step: 'relogio_parado.ouvir' },
    dialogue: {
      start: {
        id: 'start', speaker: 'Diário do relojoeiro',
        text: '"Guardei minha melhor peça onde só quem entende o tempo vai achar.\nOs ponteiros formam um ângulo reto, e o pequeno aponta para a direita. Nessa hora, o relógio se abre."',
        onEnter: 'STEP:relogio_parado.diario',
        options: [{ label: 'Um ângulo reto... e para a direita.', nextNodeId: null }],
      },
    },
    radius: 1.5,
  },
  {
    id: 'relogio_grande', kind: 'examine', position: toWorld(R, 0, -2.25), label: 'Girar os ponteiros do relógio', name: 'Relógio parado',
    usableWhen: { active: 'relogio_parado', step: 'relogio_parado.diario', notStep: 'relogio_parado.relogio' },
    actions: 'CHALLENGE:relogio_angulo', radius: 1.6,
  },
  {
    id: 'bau_relojoeiro', kind: 'chest', position: toWorld(R, 0.9, -2.6), label: 'Abrir o compartimento do relógio',
    when: { flag: 'relogio_aberto' }, hideWhen: { flag: 'bau_relojoeiro' },
    actions: 'FLAG:bau_relojoeiro;GIVE:engrenagem_dourada;STEP:relogio_parado.compartimento;SFX:chest', radius: 1.4,
  },
  {
    id: 'estante_relojoeiro', kind: 'examine', position: toWorld(R, 2.75, -1.2), label: 'Olhar a estante', name: 'Estante',
    dialogue: say('Estante', 'Livros sobre engrenagens, molas e pêndulos. Um deles se chama "Como Consertar Relógios Sem Chorar".\nA página 1 está cheia de marcas de lágrimas.'), radius: 1.5,
  },
];

export const MIMI: NPCDefinition = {
  id: 'mimi',
  name: 'Mimi',
  role: 'Ajudante da cantina',
  position: toWorld(C, -1.2, -1.7),
  faceRotation: 0,
  look: { species: 'cat', fur: '#F2C38B', belly: '#FFF3E0', scale: 0.85, mask: '#C97C3D', eyes: 'round' },
  voice: 'meow_high',
  offers: [{ mission: 'mesa_posta' }],
  barks: ['Bem-vindo à cantina! Cuidado, o chão está encerado!', 'A Chef Hana diz que peixe feliz dá bolinho feliz.'],
  routes: [
    { when: { active: 'mesa_posta', step: 'mesa_posta.contar' }, tree: {
      start: {
        id: 'start', speaker: 'Mimi', mood: 'happy',
        text: 'Faltam 7? Então são 12 no total... e eu já tinha posto 5. Faz sentido!\nObrigada, Shinichi! Leva uns onigiris, são os primeiros do dia.',
        options: [{ label: '🍙 Valeu, Mimi!', nextNodeId: null, action: 'STEP:mesa_posta.avisar' }],
      },
    } },
    { when: { active: 'mesa_posta' }, tree: say('Mimi', 'As tigelas estão empilhadas no balcão. Conta quantas faltam pra mim?') },
    { when: { notStarted: 'mesa_posta' }, tree: {
      start: {
        id: 'start', speaker: 'Mimi',
        text: 'Oi! Eu sou a Mimi, ajudo a Chef Hana aqui na cantina.\nO almoço é já já e eu me perdi contando as tigelas... me ajuda?',
        options: [
          { label: '🍚 Ajudo, sim!', nextNodeId: null, action: 'START:mesa_posta;STEP:mesa_posta.ouvir' },
          { label: 'Agora não', nextNodeId: null },
        ],
      },
    } },
    { tree: say('Mimi', 'A cantina fica cheia no almoço. Volta mais tarde pra provar o bolinho!') },
  ],
};

/**
 * Vovó Mochi's lines for the clockmaker mystery (data/npcs2.ts adds them before her small talk). She offers one
 * thing at a time, first match wins: the bridge (ponte), then the garden (horta, Capítulo 3), then this. The offer in
 * npcs2.ts has the same condition, so the mission log never lists it as available while she talks about something else.
 */
export const MOCHI_CLOCK_ROUTES: NPCDefinition['routes'] = [
  { when: { active: 'relogio_parado', step: 'relogio_parado.compartimento' }, tree: {
    start: {
      id: 'start', speaker: 'Vovó Mochi', mood: 'happy',
      text: 'Uma engrenagem dourada! O Tique dizia que era a peça mais bonita que ele já fez.\nEle ia gostar de saber que foi você que achou. Guarde com carinho, querido.',
      options: [{ label: '⚙️ Pode deixar, vovó!', nextNodeId: null, action: 'STEP:relogio_parado.contar' }],
    },
  } },
  { when: { active: 'relogio_parado' }, tree: say('Vovó Mochi', 'A casa do Tique fica no lado oeste da vila, a porta está destrancada.\nProcure pistas... ele escrevia tudo num diário.') },
  { when: { notStarted: 'relogio_parado', done: 'horta' }, tree: {
    start: {
      id: 'start', speaker: 'Vovó Mochi',
      text: 'Sabia que naquela casa do oeste morava o Tique, o relojoeiro?\nQuando ele se mudou para a montanha, o relógio dele parou... e ninguém nunca descobriu o segredo.',
      options: [
        { label: '🔍 Eu descubro!', nextNodeId: null, action: 'START:relogio_parado;STEP:relogio_parado.ouvir' },
        { label: 'Que mistério...', nextNodeId: null },
      ],
    },
  } },
];
