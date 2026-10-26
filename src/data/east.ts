import type { Challenge, DialogueOption, DialogueTree, Mission, NPCDefinition, Vec3 } from '../types';
import type { WorldObject } from './world';

/**
 * Bairro das Glicínias: the residential district east of the village (art audit §25).
 * Entered through a gap in the east fence. Everything here is new ground, so no older mission
 * coordinate moved. The counts the challenges ask about (koi, tea bushes) are drawn from these
 * same constants, so what the child counts in the scene is always the right answer.
 */

/** Where the cat may walk: east of the village fence, south up to the rocky ridge. */
export const EAST = { minX: 19.2, maxX: 40.6, minZ: -13.6, maxZ: 18.9 };
/** Fence posts around the district (the ridge closes the south side). */
export const EAST_FENCE = { maxX: 41.2, minZ: -14.2 };
/** The gap in the village's east fence. */
export const EAST_GATE = { x: 19.2, z: 2, halfWidth: 1.5 };

export const EAST_PLAZA = { x: 27, z: 2, r: 3.1 };
/** Wisteria tunnel over the lane that leaves the plaza to the north. */
export const PERGOLA = { x: 27.3, z0: -1.4, z1: -5.2, halfWidth: 1.45 };
/** Koi pond (an ellipse) with stepping stones across. */
export const POND = { x: 31, z: 10, rx: 3.3, rz: 2.2 };
export const POND_STONES: Vec3[] = [[29.6, 0, 7.7], [30.3, 0, 9.0], [31.1, 0, 10.3], [31.8, 0, 11.7]];
/** The koi the child counts: 5 orange, 3 white, 4 spotted (12 in all). */
export const KOI = { orange: 5, white: 3, spotted: 4 } as const;
export const KOI_TOTAL = KOI.orange + KOI.white + KOI.spotted;

/** Tea terraces rising south toward the ridge: each level has 2 rows of 7 bushes. */
export const TEA = {
  x0: 34.6, x1: 40.6,
  levels: [
    { z0: 8.6, h: 0.5 },
    { z0: 12.0, h: 1.0 },
    { z0: 15.4, h: 1.5 },
  ],
  // touches the ridge face, so there is no gap to fall into between the top terrace and the rock
  z1: 19.45,
  rows: 2,
  perRow: 7,
};
export const TEA_TOTAL = TEA.levels.length * TEA.rows * TEA.perRow;

/** Lookout on the ridge, one jump above the top terrace. */
export const LOOKOUT = { x0: 36.4, x1: 40.6, z0: 19.45, z1: 21.8, h: 2.0 };
export const WIND_BELL: Vec3 = [38.6, LOOKOUT.h, 20.7];

export interface EastHouse {
  pos: Vec3;
  rotY: number;
  size: [number, number, number];
  wall: string;
  roof: string;
  noren?: string;
  flower?: string;
}

/** Houses along the lane (fronts face the lane) plus Dona Fuji's tea house by the terraces. */
export const EAST_HOUSES: EastHouse[] = [
  { pos: [23.2, 0, -5.4], rotY: Math.PI / 2, size: [3.2, 2.2, 3.0], wall: '#F3E7D6', roof: '#8F74BE', flower: '#C7A6E8' },
  { pos: [23.2, 0, -10.8], rotY: Math.PI / 2, size: [3.0, 2.0, 2.8], wall: '#EFE2CC', roof: '#5E8C6A', noren: '#4F6B52' },
  { pos: [32.4, 0, -5.8], rotY: -Math.PI / 2, size: [3.0, 2.1, 3.0], wall: '#F5EADB', roof: '#C25A5E', flower: '#FFD1E3' },
  { pos: [32.4, 0, -11.0], rotY: -Math.PI / 2, size: [3.2, 2.3, 3.0], wall: '#EDE3D3', roof: '#5A74A8' },
  // Dona Fuji's tea house: the biggest one, facing the plaza
  { pos: [37.6, 0, -1.6], rotY: -Math.PI / 2, size: [3.6, 2.4, 3.4], wall: '#F6ECDD', roof: '#A486D2', noren: '#9C7CC8', flower: '#C7A6E8' },
];

/** Dirt paths of the district (joined to the village network in Ground.PATHS). */
export const EAST_PATHS: [number, number][][] = [
  // from the market path, around the fish stall and the house corner, through the gate, to the plaza
  // (traced on the physics occupancy grid so nothing stands on it)
  [[7.5, -1.1], [7.6, 1.9], [11.0, 1.8], [15.2, 1.7], [16.6, 1.1], [18.0, 1.6], [19.2, 2.0], [23.9, 2.0]],
  // north lane under the wisteria tunnel
  [[27.2, -1.0], [27.3, -6.5], [27.6, -12.8]],
  // east: plaza → pond → terraces
  [[30.0, 2.6], [33.0, 4.4], [34.4, 7.6]],
  // to Dona Fuji's door
  [[30.1, 1.4], [33.8, -0.6]],
];

// ── Mission ───────────────────────────────────────────────────────────────────

export const EAST_MISSIONS: Mission[] = [
  {
    id: 'glicinias', chapter: 2, title: 'O Bairro das Glicínias', category: 'exploração', giver: 'fuji',
    description: 'Atrás da cerca leste existe um bairro de casas, glicínias, um lago de carpas e terraços de chá. A Dona Fuji cuida de tudo e precisa de olhos atentos.',
    steps: [
      { id: 'conhecer', description: 'Conheça a Dona Fuji no Bairro das Glicínias (portão leste)', target: { npc: 'fuji' } },
      { id: 'carpas', description: 'Conte as carpas do lago e descubra a fração', after: ['conhecer'], target: { object: 'lago_carpas' } },
      { id: 'cha', description: 'Conte os pés de chá dos terraços', after: ['conhecer'], target: { object: 'placa_terracos' } },
      { id: 'sino', description: 'Suba ao mirante da crista e toque o sino de vento', after: ['carpas', 'cha'], target: { object: 'sino_vento' } },
      { id: 'voltar', description: 'Conte à Dona Fuji o que viu lá de cima', after: ['sino'], target: { npc: 'fuji' } },
    ],
    rewards: { xp: 60, coins: 25, gems: 2, badges: ['Jardineiro das Glicínias'] },
    lesson: 'Contar com cuidado é a base de tudo: agrupar (fileiras, terraços) deixa a conta rápida, e a fração diz que parte do todo você está olhando.',
  },
];

export const EAST_CHALLENGES: Challenge[] = [
  {
    id: 'carpas_fracao',
    title: 'As Carpas do Lago',
    skill: 'fracoes',
    kind: 'choice',
    story:
      `No lago nadam ${KOI_TOTAL} carpas: ${KOI.orange} laranja, ${KOI.white} brancas e ${KOI.spotted} malhadas.\n` +
      'A Dona Fuji quer saber: que FRAÇÃO das carpas é branca?',
    question: `${KOI.white} brancas de ${KOI_TOTAL} carpas = ?`,
    choices: ['1/3', '1/4', '3/4'],
    answer: 1,
    observe: `A fração compara a PARTE (as brancas) com o TODO (todas as ${KOI_TOTAL} carpas). A parte vai em cima, o todo embaixo.`,
    hint: `Escreva ${KOI.white}/${KOI_TOTAL}. Agora divida em cima e embaixo pelo mesmo número: os dois cabem no 3.`,
    example: 'Parecido: 2 peixes vermelhos de 8 peixes = 2/8. Dividindo os dois por 2: 1/4.\nQuer dizer: 1 em cada 4 peixes é vermelho.',
    successText: `🐟 Isso! ${KOI.white}/${KOI_TOTAL} = 1/4. Uma em cada quatro carpas é branca.\nA Dona Fuji vai gostar: ela diz que as brancas trazem chuva boa para o chá.`,
    onSuccess: 'STEP:glicinias.carpas;SFX:splash',
  },
  {
    id: 'cha_terracos',
    title: 'Os Terraços de Chá',
    skill: 'multiplicacao',
    kind: 'number',
    story:
      `Os terraços de chá têm ${TEA.levels.length} degraus. Em cada degrau há ${TEA.rows} fileiras com ${TEA.perRow} pés de chá.\n` +
      'Quantos pés de chá a Dona Fuji cuida ao todo?',
    question: `${TEA.levels.length} degraus × ${TEA.rows * TEA.perRow} pés por degrau = ?`,
    answer: TEA_TOTAL,
    observe: 'Todos os degraus são iguais e todas as fileiras têm o mesmo número de pés. Grupos iguais pedem multiplicação.',
    hint: `Primeiro um degrau: ${TEA.rows} fileiras de ${TEA.perRow} = ${TEA.rows * TEA.perRow}. Depois junte os ${TEA.levels.length} degraus.`,
    example: 'Parecido: 2 prateleiras, cada uma com 3 fileiras de 5 potes.\nUma prateleira: 3 × 5 = 15. Duas: 15 + 15 = 30.',
    successText: `🍵 Isso! ${TEA_TOTAL} pés de chá. Agrupar por degrau deixou a conta curta.\nLá em cima da crista tem um sino de vento: a Dona Fuji disse que dali se vê o bairro inteiro.`,
    onSuccess: 'STEP:glicinias.cha',
  },
];

const bye = (label = 'Até mais!'): DialogueOption => ({ label, nextNodeId: null });
const say = (speaker: string, text: string, options: DialogueOption[] = [bye()]): DialogueTree => ({ start: { id: 'start', speaker, text, options } });

export const EAST_OBJECTS: WorldObject[] = [
  {
    id: 'placa_bairro', kind: 'sign', position: [21.2, 0, 4.2], rotation: -Math.PI / 2, label: 'Ler a placa', name: 'Bairro das Glicínias',
    dialogue: say('Bairro das Glicínias',
      '🪧 BAIRRO DAS GLICÍNIAS\n← Vila das Patas   ·   Lago das Carpas →   ·   Terraços de Chá ↘\n"Ande devagar: aqui as flores crescem por cima das ruas."'),
  },
  {
    id: 'lago_carpas', kind: 'examine', position: [POND.x - POND.rx - 0.4, 0, POND.z - 0.6], label: 'Contar as carpas', name: 'Lago das Carpas', radius: 1.8,
    usableWhen: { active: 'glicinias', step: 'glicinias.conhecer', notStep: 'glicinias.carpas' },
    dialogue: {
      start: {
        id: 'start', speaker: 'Lago das Carpas',
        text: `As carpas passeiam devagar. Olhe com calma e conte cada cor:\nlaranja, brancas e malhadas (brancas com manchas laranja).`,
        options: [{ label: '🧮 Já contei! Resolver a fração', nextNodeId: null, action: 'CHALLENGE:carpas_fracao' }, bye('Vou olhar mais um pouco')],
      },
    },
  },
  {
    id: 'placa_terracos', kind: 'examine', position: [TEA.x0 - 0.7, 0, TEA.levels[0].z0 - 0.3], label: 'Olhar os terraços', name: 'Terraços de Chá', radius: 1.6,
    usableWhen: { active: 'glicinias', step: 'glicinias.conhecer', notStep: 'glicinias.cha' },
    dialogue: {
      start: {
        id: 'start', speaker: 'Terraços de Chá',
        text: 'Degraus de terra sobem até a crista, cada um com fileiras certinhas de pés de chá.\nConte um degrau com atenção: os outros são iguais.',
        options: [{ label: '🧮 Calcular o total', nextNodeId: null, action: 'CHALLENGE:cha_terracos' }, bye('Vou contar de novo')],
      },
    },
  },
  {
    id: 'sino_vento', kind: 'examine', position: WIND_BELL, label: 'Tocar o sino de vento', name: 'Sino de vento', radius: 1.4,
    usableWhen: { active: 'glicinias', step: ['glicinias.carpas', 'glicinias.cha'], notStep: 'glicinias.sino' },
    dialogue: say('Sino de vento',
      '*(tlim... tlim...)*\nDaqui de cima dá para ver tudo: a pérgola roxa, o lago, as casas, e lá longe a fonte da praça.\nO bairro parece um mapa vivo.',
      [{ label: '🔔 Que vista!', nextNodeId: null, action: 'STEP:glicinias.sino;SFX:bell' }]),
  },
];

// ── Dona Fuji ────────────────────────────────────────────────────────────────

export const FUJI: NPCDefinition = {
  id: 'fuji',
  name: 'Dona Fuji',
  role: 'Jardineira das glicínias',
  position: [33.6, 0, 0.6],
  faceRotation: -Math.PI * 0.6,
  look: { species: 'cat', fur: '#9A9AA6', belly: '#EEEAF2', scale: 1.0, stripes: '#6E6E7C', accessory: 'granny' },
  voice: 'meow_low',
  barks: ['As glicínias pedem paciência.', 'Cuidado com o lago, as carpas são tímidas.', 'Chá bom nasce de terra bem cuidada.'],
  offers: [{ mission: 'glicinias', when: { done: 'peixes' } }],
  patrol: [[33.6, 0, 0.6], [30.6, 0, 4.6], [27.4, 0, -2.6], [33.6, 0, 0.6]],
  speed: 0.8,
  routes: [
    { when: { active: 'glicinias', step: 'glicinias.sino' }, tree: {
      start: {
        id: 'start', speaker: 'Dona Fuji', mood: 'happy',
        text: 'Ouvi o sino daqui! Então você subiu a crista.\nDiga: lá de cima, o bairro parece grande ou pequeno?',
        options: [{ label: 'Pequeno... mas cheio de coisas!', nextNodeId: 'end' }],
      },
      end: {
        id: 'end', speaker: 'Dona Fuji', mood: 'happy',
        text: `É assim mesmo. ${KOI_TOTAL} carpas, ${TEA_TOTAL} pés de chá, cinco casas... quando a gente conta, cuida melhor.\nVolte sempre. As glicínias florescem de novo a cada primavera.`,
        options: [{ label: '🌸 Obrigado, Dona Fuji!', nextNodeId: null, action: 'STEP:glicinias.voltar' }],
      },
    } },
    { when: { active: 'glicinias' }, tree: say('Dona Fuji',
      'As carpas ficam no lago ao sul da praça; os terraços de chá sobem até a crista.\nConte com calma: agrupar ajuda. Depois suba ao mirante e toque o sino de vento.',
      [bye('Vou lá!')]) },
    { when: { done: 'peixes', notStarted: 'glicinias' }, tree: {
      start: {
        id: 'start', speaker: 'Dona Fuji',
        text: 'Ora, um visitante da vila! Sou a Fuji. Cuido das glicínias, do lago e do chá deste bairro.\nMinhas costas já não sobem a crista como antes... Você me empresta seus olhos de gato ninja?',
        options: [
          { label: '🌸 Empresto! O que é preciso?', nextNodeId: 'task', action: 'START:glicinias;STEP:glicinias.conhecer' },
          { label: 'Agora não, Dona Fuji.', nextNodeId: null },
        ],
      },
      task: {
        id: 'task', speaker: 'Dona Fuji', mood: 'happy',
        text: 'Preciso saber quantas carpas brancas tenho em relação ao lago todo, e quantos pés de chá cuido.\nE quando terminar, suba ao mirante e toque o sino de vento, para eu saber que deu tudo certo.',
        options: [bye('Pode deixar!')],
      },
    } },
    { when: { done: 'glicinias' }, tree: say('Dona Fuji', 'O chá deste ano vai sair especial. Dizem que folha contada com carinho fica mais doce.') },
    { tree: say('Dona Fuji', 'Seja bem-vindo ao Bairro das Glicínias. Ande devagar: aqui as flores crescem por cima das ruas.') },
  ],
};

/** Inside the koi pond's water (stepping stones excluded): the same friendly splash as the river. */
export function inPond(x: number, z: number) {
  const dx = (x - POND.x) / POND.rx;
  const dz = (z - POND.z) / POND.rz;
  if (dx * dx + dz * dz > 0.86) return false;
  return !POND_STONES.some(([sx, , sz]) => Math.hypot(x - sx, z - sz) < 0.6);
}

/** Rocky ridge closing the district to the south (it continues the waterfall cliff): [x0, x1, height]. */
export const RIDGE: { x0: number; x1: number; h: number; z0: number }[] = [
  { x0: 19.8, x1: 25.6, h: 4.2, z0: 19.5 },
  { x0: 25.6, x1: 31.2, h: 5.2, z0: 19.6 },
  { x0: 31.2, x1: 36.4, h: 4.6, z0: 19.4 },
  { x0: 36.4, x1: 41.6, h: 3.6, z0: LOOKOUT.z1 },
];
export const RIDGE_Z1 = 24.4;

export type EastTree = { kind: 'sakura' | 'maple' | 'maple_green' | 'pine' | 'bamboo'; pos: Vec3; scale?: number; seed: number };

/**
 * Trees placed by hand for composition (framing the gate, the plaza, the pond and the lane), never on a
 * path, a house, the pond or the terraces (tests/east.test.ts checks it). Ridge-top pines sit at the
 * ridge height. Kinds and sizes alternate so no two neighbours look the same.
 */
export const EAST_TREES: EastTree[] = [
  { kind: 'sakura', pos: [21.0, 0, -0.9], scale: 1.05, seed: 21 },
  { kind: 'maple', pos: [24.2, 0, 6.6], seed: 3 },
  { kind: 'maple_green', pos: [21.3, 0, 9.4], scale: 1.1, seed: 4 },
  { kind: 'pine', pos: [21.6, 0, 15.6], scale: 1.05, seed: 1 },
  { kind: 'maple', pos: [25.6, 0, 12.9], scale: 0.9, seed: 5 },
  { kind: 'sakura', pos: [27.6, 0, 15.8], scale: 0.95, seed: 22 },
  { kind: 'maple', pos: [33.2, 0, 14.6], scale: 1.1, seed: 6 },
  { kind: 'maple_green', pos: [35.6, 0, 4.6], scale: 0.85, seed: 7 },
  { kind: 'pine', pos: [40.1, 0, 4.4], seed: 2 },
  { kind: 'pine', pos: [40.2, 0, -6.8], scale: 1.15, seed: 3 },
  { kind: 'sakura', pos: [39.4, 0, -11.2], scale: 0.9, seed: 23 },
  { kind: 'maple_green', pos: [36.0, 0, -12.0], scale: 0.8, seed: 8 },
  { kind: 'maple', pos: [20.4, 0, -13.3], scale: 0.8, seed: 9 },
  { kind: 'pine', pos: [20.0, 0, -8.1], scale: 0.7, seed: 4 },
  { kind: 'bamboo', pos: [24.6, 0, -13.5], seed: 31 },
  { kind: 'bamboo', pos: [29.6, 0, -13.6], seed: 32 },
  { kind: 'bamboo', pos: [40.3, 0, 7.2], seed: 33 },
  { kind: 'maple_green', pos: [29.0, 0, -8.3], scale: 0.65, seed: 10 },
  // on top of the ridge
  { kind: 'pine', pos: [22.6, 4.2, 21.8], scale: 1.1, seed: 5 },
  { kind: 'pine', pos: [28.8, 5.2, 22.2], scale: 1.25, seed: 6 },
  { kind: 'maple', pos: [33.6, 4.6, 21.6], scale: 0.95, seed: 11 },
  { kind: 'pine', pos: [39.6, 3.6, 23.0], seed: 7 },
];
