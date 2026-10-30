import type { Challenge, DialogueOption, DialogueTree, Mission, NPCDefinition, Vec3 } from '../types';
import type { WorldObject } from './world';

/**
 * Bambuzal das Águas Quentes: the area west of the village (art audit §26). A winding trail through a
 * bamboo grove up to the Jizō hill, a hot spring with its bathhouse, and the riverbank with a boardwalk
 * and a fishing pier. New ground only: no older mission coordinate moved. The numbers the challenges
 * ask about (stone piles, buckets) come from these same constants, so the scene always shows the answer.
 */

/** Where the cat may walk (the river closes the south side: the water splashes it back). */
export const WEST = { minX: -40.6, maxX: -19.2, minZ: -11.6, maxZ: 23.6 };
export const WEST_FENCE = { minX: -41.2, minZ: -12.2, maxZ: 21.0 };
/** The gap in the village's west fence. */
export const WEST_GATE = { x: -19.2, z: 6, halfWidth: 1.5 };

/** Crossroads clearing just past the gate. */
export const CLEARING = { x: -24.2, z: 6.0, r: 2.4 };

/** Jizō hill in the north-west corner: three earth terraces rising west, half a metre each. */
export const HILL = {
  x0: -40.6, z0: -11.6, z1: -2.6,
  levels: [
    { x1: -35.0, h: 0.5 },
    { x1: -36.4, h: 1.0 },
    { x1: -37.8, h: 1.5 },
  ],
  /** z of the stone steps on the east face of each level (where the trail arrives). */
  stepZ: -7.2,
};
/** Five Jizō statues on the top terrace; in front of the first four, piles of 1, 3, 6 and 10 pebbles. */
export const JIZO_X = -40.0;
// listed left to right as seen from the trail (looking west), so the first pile is the leftmost
export const JIZO_Z = [-4.8, -6.0, -7.2, -8.4, -9.6];
export const JIZO_PEBBLES = [1, 3, 6, 10];
/** Triangular numbers: each pile adds one more than the last (+2, +3, +4, so +5 next). */
export const JIZO_NEXT = JIZO_PEBBLES[3] + (JIZO_PEBBLES[3] - JIZO_PEBBLES[2]) + 1;

/** Hot spring: a rock-rimmed pool beside the bathhouse. */
export const ONSEN = { x: -31.8, z: 8.2, rx: 2.8, rz: 2.0 };
/** Goro's rule for the bath: 2 buckets of hot water for every 3 of cold. The big tub takes 15. */
export const ONSEN_MIX = { hot: 2, cold: 3, tub: 15 };
export const ONSEN_HOT = (ONSEN_MIX.tub / (ONSEN_MIX.hot + ONSEN_MIX.cold)) * ONSEN_MIX.hot;

/** Riverside boardwalk (just north of the bank) and the pier that reaches into the river. */
export const BOARDWALK = { x0: -38.5, x1: -22.0, z0: 18.6, z1: 20.6, h: 0.22 };
export const PIER = { x0: -30.2, x1: -28.8, z0: 20.6, z1: 23.6, h: 0.3 };

export interface WestHouse { pos: Vec3; rotY: number; size: [number, number, number]; wall: string; roof: string; noren?: string; flower?: string }
export const WEST_HOUSES: WestHouse[] = [
  // the bathhouse, door toward the pool
  { pos: [-37.6, 0, 8.2], rotY: Math.PI / 2, size: [3.4, 2.2, 2.8], wall: '#F3E9D8', roof: '#4F7A8C', noren: '#3E8C8C' },
  // fisherman's hut by the boardwalk, door toward the river
  { pos: [-35.6, 0, 15.2], rotY: 0, size: [2.8, 1.9, 2.4], wall: '#EDE0C8', roof: '#8C5A3E' },
];

export const WEST_PATHS: [number, number][][] = [
  // from the village path, through the gate, to the crossroads
  [[-9.0, 7.2], [-12.0, 6.4], [-15.0, 6.0], [-19.2, 6.0], [-22.0, 6.0]],
  // north: the winding bamboo trail up to the Jizō hill steps
  [[-24.4, 3.8], [-25.6, 1.2], [-24.2, -1.8], [-26.4, -4.6], [-30.0, -6.6], [-34.4, -7.2]],
  // west: to the hot spring
  [[-26.4, 6.6], [-28.6, 6.4]],
  // south: down to the riverside boardwalk
  [[-24.4, 8.2], [-25.2, 11.4], [-27.2, 15.0], [-28.6, 18.2]],
];

export type WestTree = { kind: 'sakura' | 'maple' | 'maple_green' | 'pine' | 'bamboo'; pos: Vec3; scale?: number; seed: number };

/** Hand-placed trees around the clearing, the spring and the river (the grove's bamboo is scattered in code). */
export const WEST_TREES: WestTree[] = [
  { kind: 'sakura', pos: [-21.6, 0, 9.6], seed: 41 },
  { kind: 'maple', pos: [-22.0, 0, 2.0], scale: 0.9, seed: 12 },
  { kind: 'pine', pos: [-21.0, 0, 15.8], scale: 1.1, seed: 8 },
  { kind: 'maple_green', pos: [-29.8, 0, 12.4], scale: 0.95, seed: 13 },
  { kind: 'sakura', pos: [-33.8, 0, 11.8], scale: 0.85, seed: 42 },
  { kind: 'pine', pos: [-40.0, 0, 3.2], scale: 1.2, seed: 9 },
  // moved out of the Trilha da Expedição's gate (Etapa 10: it stood between the posts)
  { kind: 'pine', pos: [-40.3, 0, 15.8], seed: 10 },
  { kind: 'maple', pos: [-39.6, 0, 18.0], scale: 0.85, seed: 14 },
  { kind: 'maple', pos: [-23.6, 0, 18.2], scale: 0.8, seed: 15 },
  { kind: 'maple_green', pos: [-36.0, 0, 3.0], scale: 0.8, seed: 16 },
  { kind: 'sakura', pos: [-34.0, 0, -11.0], scale: 0.85, seed: 43 },
];

/** Bamboo grove: seeded clumps inside this box, kept off the trail and the hill (see bambooClumps). */
export const GROVE = { x0: -35.0, x1: -20.4, z0: -11.2, z1: 2.4 };

function segDist(x: number, z: number, [ax, az]: [number, number], [bx, bz]: [number, number]) {
  const vx = bx - ax, vz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
  return Math.hypot(x - ax - vx * t, z - az - vz * t);
}
export function westPathDistance(x: number, z: number) {
  let d = Infinity;
  for (const p of WEST_PATHS) for (let i = 0; i < p.length - 1; i++) d = Math.min(d, segDist(x, z, p[i], p[i + 1]));
  return d;
}

/** Bamboo clumps for the grove: a jittered grid, thinned at random, never within 2 m of the trail. */
export function bambooClumps(): Vec3[] {
  let s = 777;
  const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const out: Vec3[] = [];
  for (let x = GROVE.x0 + 1; x < GROVE.x1; x += 2.6) {
    for (let z = GROVE.z0 + 1; z < GROVE.z1; z += 2.6) {
      const px = x + (r() - 0.5) * 1.6;
      const pz = z + (r() - 0.5) * 1.6;
      if (r() < 0.22) continue;
      if (westPathDistance(px, pz) < 2.1) continue;
      if (px < HILL.levels[0].x1 + 1.2 && pz < HILL.z1 + 1.2) continue;
      if (Math.hypot(px - CLEARING.x, pz - CLEARING.z) < CLEARING.r + 1.6) continue;
      out.push([px, 0, pz]);
    }
  }
  return out;
}

/** Inside the hot water (the pool's rim excluded). */
export function inOnsen(x: number, z: number) {
  const dx = (x - ONSEN.x) / ONSEN.rx;
  const dz = (z - ONSEN.z) / ONSEN.rz;
  return dx * dx + dz * dz < 0.86;
}

// ── Mission ───────────────────────────────────────────────────────────────────

export const WEST_MISSIONS: Mission[] = [
  {
    id: 'aguas', chapter: 2, title: 'As Águas Quentes', category: 'educativa', giver: 'goro',
    description: 'Atrás da cerca oeste, o Seu Goro cuida de uma fonte termal no meio do bambuzal. Hoje a água não acerta a temperatura, e as estátuas da colina guardam um enigma antigo.',
    steps: [
      { id: 'conhecer', description: 'Conheça o Seu Goro na fonte termal (portão oeste)', target: { npc: 'goro' } },
      { id: 'mistura', description: 'Calcule quantos baldes de água quente vão na banheira', after: ['conhecer'], target: { object: 'placa_onsen' } },
      { id: 'jizo', description: 'Suba a colina dos Jizō e descubra quantas pedrinhas faltam', after: ['conhecer'], target: { object: 'jizo_pedras' } },
      { id: 'voltar', description: 'Conte ao Seu Goro o que descobriu', after: ['mistura', 'jizo'], target: { npc: 'goro' } },
    ],
    rewards: { xp: 60, coins: 25, gems: 2, badges: ['Mestre das Proporções'] },
    lesson: 'Proporção é uma receita que cresce sem mudar o gosto: 2 para 3 continua 2 para 3 com 5 baldes ou com 15. E todo padrão tem uma regra: descubra quanto ele cresce a cada passo.',
  },
];

export const WEST_CHALLENGES: Challenge[] = [
  {
    id: 'onsen_proporcao',
    title: 'A Mistura do Banho',
    skill: 'proporcoes',
    kind: 'number',
    story:
      `O Seu Goro sempre mistura ${ONSEN_MIX.hot} baldes de água QUENTE para cada ${ONSEN_MIX.cold} baldes de água FRIA.\n` +
      `A banheira grande leva ${ONSEN_MIX.tub} baldes ao todo. Quantos baldes de água quente ela precisa?`,
    question: `${ONSEN_MIX.hot} quentes para cada ${ONSEN_MIX.hot + ONSEN_MIX.cold} baldes; ${ONSEN_MIX.tub} baldes → quantos quentes?`,
    answer: ONSEN_HOT,
    observe: `Uma "rodada" da receita tem ${ONSEN_MIX.hot} quentes + ${ONSEN_MIX.cold} frias = ${ONSEN_MIX.hot + ONSEN_MIX.cold} baldes. Quantas rodadas cabem na banheira?`,
    hint: `${ONSEN_MIX.tub} ÷ ${ONSEN_MIX.hot + ONSEN_MIX.cold} = ${ONSEN_MIX.tub / (ONSEN_MIX.hot + ONSEN_MIX.cold)} rodadas. Em cada rodada vão ${ONSEN_MIX.hot} baldes quentes.`,
    example: 'Parecido: suco com 1 copo de suco para cada 4 de água. Uma jarra de 10 copos tem 10 ÷ 5 = 2 rodadas, então 2 copos de suco.',
    successText: `♨️ Isso! ${ONSEN_HOT} baldes quentes e ${ONSEN_MIX.tub - ONSEN_HOT} frios. A receita cresceu, o gosto continuou o mesmo.\nO Seu Goro já sente a água "no ponto" de longe.`,
    onSuccess: 'STEP:aguas.mistura;SFX:splash',
  },
  {
    id: 'jizo_padrao',
    title: 'As Pedrinhas dos Jizō',
    skill: 'padroes',
    kind: 'number',
    story:
      `Na frente dos Jizō há montinhos de pedrinhas: ${JIZO_PEBBLES.join(', ')}.\n` +
      'O quinto Jizō ainda não tem montinho. Quantas pedrinhas ele deve ganhar para continuar o padrão?',
    question: `${JIZO_PEBBLES.join(', ')}, ?`,
    answer: JIZO_NEXT,
    observe: 'Não olhe só os números: olhe quanto cada montinho CRESCE em relação ao anterior.',
    hint: `De 1 para 3 cresce 2, de 3 para 6 cresce 3, de 6 para 10 cresce 4. E agora?`,
    example: 'Parecido: 2, 3, 5, 8... cresce 1, 2, 3. O próximo cresce 4: 8 + 4 = 12.',
    successText: `🪨 Isso! ${JIZO_PEBBLES[3]} + 5 = ${JIZO_NEXT}. Você empilha as pedrinhas com cuidado na frente do quinto Jizō.\nO vento passa pelos bambus como se fosse um "obrigado".`,
    onSuccess: 'STEP:aguas.jizo;FLAG:jizo_completo;SFX:chime',
  },
];

const bye = (label = 'Até mais!'): DialogueOption => ({ label, nextNodeId: null });
const say = (speaker: string, text: string, options: DialogueOption[] = [bye()]): DialogueTree => ({ start: { id: 'start', speaker, text, options } });

export const WEST_OBJECTS: WorldObject[] = [
  {
    id: 'placa_bambuzal', kind: 'sign', position: [-21.4, 0, 3.8], rotation: Math.PI / 2, label: 'Ler a placa', name: 'Bambuzal das Águas Quentes',
    dialogue: say('Bambuzal das Águas Quentes',
      '🪧 BAMBUZAL DAS ÁGUAS QUENTES\n↑ Colina dos Jizō   ·   ← Fonte termal   ·   ↓ Margem do rio\n"Fale baixo no bambuzal: os bambus escutam."'),
  },
  {
    id: 'placa_onsen', kind: 'examine', position: [-28.4, 0, 5.0], label: 'Ler a receita do banho', name: 'Receita do banho', radius: 1.5,
    usableWhen: { active: 'aguas', step: 'aguas.conhecer', notStep: 'aguas.mistura' },
    dialogue: {
      start: {
        id: 'start', speaker: 'Receita do banho',
        text: `Uma tábua pintada à mão: "${ONSEN_MIX.hot} baldes QUENTES para cada ${ONSEN_MIX.cold} FRIOS. Sempre."\nAo lado, a banheira grande e uma pilha de baldes vermelhos e azuis.`,
        options: [{ label: '🧮 Calcular a mistura', nextNodeId: null, action: 'CHALLENGE:onsen_proporcao' }, bye('Vou pensar')],
      },
    },
  },
  {
    id: 'jizo_pedras', kind: 'examine', position: [JIZO_X + 1.6, HILL.levels[2].h, -7.2], label: 'Olhar os montinhos', name: 'Os cinco Jizō', radius: 1.6,
    usableWhen: { active: 'aguas', step: 'aguas.conhecer', notStep: 'aguas.jizo' },
    dialogue: {
      start: {
        id: 'start', speaker: 'Os cinco Jizō',
        text: 'Cinco estátuas de pedra com babadores vermelhos. Na frente de quatro delas, montinhos de pedrinhas.\nConte cada montinho com calma, da esquerda para a direita.',
        options: [{ label: '🧮 Completar o padrão', nextNodeId: null, action: 'CHALLENGE:jizo_padrao' }, bye('Vou contar de novo')],
      },
    },
  },
];

// ── Seu Goro ─────────────────────────────────────────────────────────────────

export const GORO: NPCDefinition = {
  id: 'goro',
  name: 'Seu Goro',
  role: 'Cuidador da fonte termal',
  position: [-27.8, 0, 9.2],
  faceRotation: Math.PI * 0.6,
  look: { species: 'bear', fur: '#B07A4A', belly: '#E6CDA8', scale: 1.1, accessory: 'happi' },
  voice: 'grunt',
  barks: ['Ahh, nada como água quentinha.', 'Cuidado: a fonte é quente de verdade!', 'Os bambus estão cantando hoje.'],
  offers: [{ mission: 'aguas', when: { done: 'receita' } }],
  patrol: [[-27.8, 0, 9.2], [-26.4, 0, 6.8], [-28.6, 0, 11.4], [-27.8, 0, 9.2]],
  speed: 0.7,
  routes: [
    { when: { active: 'aguas', step: ['aguas.mistura', 'aguas.jizo'] }, tree: {
      start: {
        id: 'start', speaker: 'Seu Goro', mood: 'happy',
        text: `${ONSEN_HOT} quentes e ${ONSEN_MIX.tub - ONSEN_HOT} frias... perfeito! E você completou as pedrinhas dos Jizō?\nMeu avô dizia que quem entende um padrão entende o mundo.`,
        options: [{ label: 'Era só ver quanto crescia!', nextNodeId: 'end' }],
      },
      end: {
        id: 'end', speaker: 'Seu Goro', mood: 'happy',
        text: 'Pois então. Proporção na banheira, padrão na colina.\nVolte quando quiser: a fonte é sua também. Só não pule dentro, hein!',
        options: [{ label: '♨️ Obrigado, Seu Goro!', nextNodeId: null, action: 'STEP:aguas.voltar' }],
      },
    } },
    { when: { active: 'aguas' }, tree: say('Seu Goro',
      'A receita do banho está na tábua perto da fonte. E a colina dos Jizō fica no fim da trilha dos bambus.\nResolva os dois e volte aqui.',
      [bye('Vou lá!')]) },
    { when: { done: 'receita', notStarted: 'aguas' }, tree: {
      start: {
        id: 'start', speaker: 'Seu Goro',
        text: 'Ei, gatinho! Sou o Goro, cuido desta fonte há trinta anos.\nHoje errei a mistura e a água ficou quente demais... minha cabeça já não faz conta como antes. Me ajuda?',
        options: [
          { label: '♨️ Ajudo! Qual é o problema?', nextNodeId: 'task', action: 'START:aguas;STEP:aguas.conhecer' },
          { label: 'Agora não, Seu Goro.', nextNodeId: null },
        ],
      },
      task: {
        id: 'task', speaker: 'Seu Goro', mood: 'happy',
        text: 'A receita está pintada na tábua ao lado da fonte. E, já que vai andar por aí: os Jizō da colina estão esperando pedrinhas.\nAlguém começou um padrão e não terminou.',
        options: [bye('Pode deixar!')],
      },
    } },
    { when: { done: 'aguas' }, tree: say('Seu Goro', 'A água hoje está no ponto certinho. Proporção é coisa séria, viu?') },
    { tree: say('Seu Goro', 'Bem-vindo ao bambuzal! A fonte é quente de verdade, então é só para olhar e esquentar as patas de longe.') },
  ],
};
