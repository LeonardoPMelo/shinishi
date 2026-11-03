import type { Challenge, DialogueOption, DialogueTree, Item, Mission, NPCDefinition, Vec3 } from '../types';
import type { WorldObject } from './world';
import type { OrderPuzzle } from '../systems/orderPuzzle';

/**
 * O Templo de Mikage: the walled precinct north of the Bairro das Glicínias, where the village's leader lives.
 * The wisteria lane runs straight north through the great gate; past it a forecourt with the purification
 * basin, a koi pond under an arched bridge and a bamboo grove; a stone stair climbs to the upper terrace, where
 * the residence (the Sede, data/interiors.ts) stands behind four guardian lanterns, with the bell pavilion on
 * one side and the archive pavilion on the other. A spring on the terrace falls as a waterfall into the pond,
 * and the old watch tower in the corner is the hardest place in the village to reach.
 *
 * It moved here from the Clareira dos Cervos (that gate is now the way out to the wild lands, data/wild.ts):
 * the seat of the village belongs in the village, at the end of its finest street.
 *
 * Missions:
 *  - O Sino que Toca Sozinho (investigation + empathy): three clues and a deduction; the answer is a nest;
 *  - As Lanternas dos Guardiões (logic, order puzzle): the archive's verses light the four lanterns, and the
 *    stone behind the waterfall slides open;
 *  - As Patas de Jade (exploration): the temple kitten hid three jade paws in hard places (under the bridge,
 *    in the bamboo, on top of the watch tower).
 */

// ── Layout ────────────────────────────────────────────────────────────────────

/** The axis of the precinct: the wisteria lane's line, straight north. */
export const AXIS_X = 27.6;
/** Outer walls (the south one is the Glicínias' north fence line). */
export const PRECINCT_WALL = { x0: 20.2, x1: 41.2, z0: -36.4, z1: -14.2 };
/** Where the cat may stand (data/regions.ts). */
export const PRECINCT = { minX: 20.6, maxX: 40.8, minZ: -36.0, maxZ: -14.2 };
/** The great gate in the south wall. */
export const GREAT_GATE = { x: AXIS_X, z: -14.2, halfWidth: 1.6 };
/** The upper terrace: a stone platform across the whole precinct. */
export const TERRACE = { x0: 20.2, x1: 41.2, z0: -36.4, z1: -22.4, h: 1.6 };
/** The stone stair up the terrace face (a ramp under the steps, like the Mirante's). */
export const STAIRS = { x0: 26.0, x1: 29.2, zBottom: -19.4, zTop: TERRACE.z1, steps: 8 };
/** The residence: its front on the terrace, the door (to the Sede interior) on the axis. */
export const RESIDENCE = { x: AXIS_X, z: -31.2, w: 10, d: 7 };
export const RESIDENCE_FRONT = RESIDENCE.z + RESIDENCE.d / 2;
/** The koi pond in the forecourt, its arched bridge (west → east), and the plunge pool under the waterfall. */
export const TEMPLE_POND = { x: 34.8, z: -18.6, rx: 3.1, rz: 2.3 };
export const PLUNGE = { x: 35.2, z: -21.5, rx: 1.3, rz: 0.8 };
export const ARCH_BRIDGE = { z: TEMPLE_POND.z, x0: 31.0, x1: 38.6, top0: 33.6, top1: 36.0, h: 0.75, halfWidth: 0.8 };
/** The spring on the terrace, its channel to the edge, and the waterfall. */
export const SPRING = { x: 35.2, z: -25.0 };
export const WATERFALL = { x: 35.2, w: 1.2 };
/** The niche in the terrace wall behind the waterfall, shut by a stone slab until the lanterns are lit. */
export const NICHE = { x: 35.2, w: 1.4, depth: 1.2, h: 1.25 };
/** Bell pavilion (west of the stair) and archive pavilion (east of the residence), on the terrace. */
export const BELL = { x: 23.0, z: -24.8, half: 1.1 };
export const ARCHIVE = { x: 37.0, z: -30.4, w: 5.0, d: 3.6 };
/** The old watch tower in the north-east corner and the blocks that climb to it (each a jump above the last). */
export const TOWER_STEPS: { x: number; z: number; w: number; d: number; h: number }[] = [
  { x: 34.6, z: -34.9, w: 1.2, d: 1.2, h: 2.25 },
  { x: 36.3, z: -35.1, w: 1.1, d: 1.0, h: 2.9 },
];
export const TOWER = { x: 38.7, z: -34.6, w: 2.4, d: 2.4, h: 3.55 };
/** Bamboo grove (west of the forecourt) and where the jade paw hides in it. */
export const BAMBOO_GROVE = { x0: 20.8, x1: 25.2, z0: -22.0, z1: -17.8 };

/** The four guardian lanterns flanking the walk to the residence: their carvings, in the order they stand. */
export const GUARDIANS = ['gato', 'carpa', 'grou', 'tartaruga'] as const;
export const GUARDIAN_LOOK: Record<string, { name: string; icon: string }> = {
  gato: { name: 'Gato', icon: '🐱' },
  carpa: { name: 'Carpa', icon: '🐟' },
  grou: { name: 'Grou', icon: '🕊️' },
  tartaruga: { name: 'Tartaruga', icon: '🐢' },
};
export const GUARDIAN_LANTERNS: Record<string, [number, number]> = {
  gato: [25.4, -23.4],
  carpa: [29.8, -23.4],
  grou: [25.4, -25.4],
  tartaruga: [29.8, -25.4],
};
/** The archive's verses: exactly one order fits all four (tests/precinct.test.ts). */
export const LANTERN_PUZZLE: OrderPuzzle = {
  id: 'lanternas_guardias',
  pieces: [...GUARDIANS],
  rules: [
    { text: 'A tartaruga, que é a mais paciente, acende por último.', rule: { kind: 'last', a: 'tartaruga' } },
    { text: 'O gato não acende primeiro: ele espera alguém mostrar o caminho.', rule: { kind: 'notFirst', a: 'gato' } },
    { text: 'O grou voa antes da carpa.', rule: { kind: 'before', a: 'grou', b: 'carpa' } },
    { text: 'A carpa acende logo depois do grou, sem ninguém entre os dois.', rule: { kind: 'rightAfter', a: 'carpa', b: 'grou' } },
  ],
};
export const LANTERNS_LIT = 'FLAG:lanternas_acesas;STEP:lanternas_guardias.acender;SFX:mechanism;SKILL:logica';
/** Actions run by world components (checked by systems/validateData.ts). */
export const PRECINCT_CODE_ACTIONS: Record<string, string> = { lanternas: LANTERNS_LIT };

/** The jade paws the kitten hid: under the bridge (crouch), in the bamboo, on the watch tower. */
export const JADE_PAWS: { id: string; at: Vec3; where: string }[] = [
  { id: 'jade_ponte', at: [34.8, 0.05, ARCH_BRIDGE.z], where: 'debaixo da ponte' },
  { id: 'jade_bambu', at: [21.5, 0, -20.6], where: 'no bambuzal' },
  { id: 'jade_torre', at: [TOWER.x, TOWER.h, TOWER.z], where: 'no alto da torre de vigia' },
];

/** Stone paths of the forecourt and the terrace (drawn as paving). */
export const PRECINCT_PATHS: [number, number][][] = [
  // the axis: gate → stair, and stair top → residence door
  [[AXIS_X, -13.4], [AXIS_X, STAIRS.zBottom]],
  [[AXIS_X, STAIRS.zTop], [AXIS_X, RESIDENCE_FRONT]],
  // to the bridge
  [[AXIS_X, -16.8], [ARCH_BRIDGE.x0, -16.8], [ARCH_BRIDGE.x0, ARCH_BRIDGE.z]],
  // to the basin
  [[AXIS_X, -16.0], [23.6, -16.0]],
  // on the terrace: to the bell, and to the archive
  [[26.0, -24.7], [BELL.x + BELL.half, -24.7]],
  [[29.2, -24.7], [33.6, -24.7], [33.6, -28.2], [ARCHIVE.x, -28.2]],
];

// ── NPCs ──────────────────────────────────────────────────────────────────────

const say = (speaker: string, text: string, options: DialogueOption[] = [{ label: 'Ok', nextNodeId: null }], onEnter?: string): DialogueTree => ({
  start: { id: 'start', speaker, text, onEnter, options },
});

export const REN: NPCDefinition = {
  id: 'ren',
  name: 'Guarda Ren',
  role: 'Guarda do Portão do Templo',
  position: [24.6, 0, -15.5],
  faceRotation: 0,
  // up and down the west side of the entrance walk, between the guard post and the bamboo
  patrol: [[24.6, 0, -15.5], [24.6, 0, -17.2]],
  speed: 0.9,
  look: { species: 'cat', fur: '#8C8C94', belly: '#E6E3DE', scale: 1.0, mask: '#5C5C66', eyes: 'sharp', accessory: 'guard', outfit: '#3F4A6E' },
  voice: 'meow_low',
  barks: ['Templo de Mikage: patas limpas, coração tranquilo.', 'Eu vigio o portão. O portão vigia eu. Somos uma equipe.', 'Viu um sino tocando sozinho? Não? Que bom. Quer dizer... que pena.'],
  reactions: [
    { when: { flag: 'ninho_sino' }, barks: ['Shhh! Os filhotes do sino estão dormindo.', 'Agora o sino só toca quando a gente quer. E os passarinhos agradecem.'] },
    { when: { flag: 'patas_lavadas' }, barks: ['Patas lavadas! Assim se entra num templo.'] },
  ],
  offers: [{ mission: 'sino_misterioso' }],
  routes: [
    { when: { notStarted: 'sino_misterioso' }, tree: {
      start: {
        id: 'start', speaker: 'Guarda Ren',
        text: 'Bem-vindo ao Templo de Mikage, a residência do líder da vila.\nMas, cá entre nós... tem um mistério aqui. O grande sino toca SOZINHO. De manhã cedo e no fim da tarde. Ninguém puxa a corda!',
        options: [
          { label: '🔍 Eu investigo!', nextNodeId: 'aceita' },
          { label: 'Um fantasma?!', nextNodeId: 'fantasma' },
        ],
      },
      fantasma: {
        id: 'fantasma', speaker: 'Guarda Ren',
        text: 'Foi o que o Toshi disse. Depois ele dormiu de luz acesa uma semana.\nEu acho que todo mistério tem uma explicação. Só falta alguém com bom faro para achar.',
        options: [{ label: '🔍 Deixa comigo.', nextNodeId: 'aceita' }],
      },
      aceita: {
        id: 'aceita', speaker: 'Guarda Ren', mood: 'happy',
        text: 'Ótimo! O sino fica no pavilhão do terraço, à esquerda da escadaria.\nOlhe o sino, procure pistas em volta dele e leia o meu diário de guarda, na mesinha do portão. Depois me conte o que descobriu.',
        options: [{ label: 'Combinado!', nextNodeId: null, action: 'START:sino_misterioso;STEP:sino_misterioso.ouvir;TRACK:sino_misterioso' }],
      },
    } },
    { when: { step: ['sino_misterioso.sino', 'sino_misterioso.pena', 'sino_misterioso.migalhas', 'sino_misterioso.diario'], notStep: 'sino_misterioso.deduzir' }, tree: say('Guarda Ren',
      'Uma pena azul, migalhas e palha, e o sino tocando bem na hora em que os passarinhos comem... Hmm.\nVocê já sabe quem é o "fantasma"?',
      [{ label: '🔍 Já sei!', nextNodeId: null, action: 'CHALLENGE:sino_quem' }, { label: 'Ainda estou pensando', nextNodeId: null }]) },
    { when: { active: 'sino_misterioso', notStep: 'sino_misterioso.deduzir' }, tree: say('Guarda Ren', 'O sino fica no pavilhão do terraço, à esquerda da escadaria. Meu diário está na mesinha ao lado do portão. Olhe tudo com calma!') },
    { when: { step: 'sino_misterioso.deduzir', notStep: 'sino_misterioso.ninho' }, tree: say('Guarda Ren', 'Passarinhos fazendo ninho na viga do sino! Cada vez que pousam na corda... DOOONG.\nNão vamos tirar o ninho daí: amarre a corda do sino com cuidado, para ela não balançar quando eles pousarem.') },
    { when: { step: 'sino_misterioso.ninho', notStep: 'sino_misterioso.contar' }, tree: say('Guarda Ren',
      'Amarrou? E o ninho ficou lá, quietinho? Você resolveu o mistério sem assustar ninguém.\nIsso é coisa de ninja de verdade: o mais forte não é quem expulsa, é quem cuida.',
      [{ label: '🐦 Os filhotes agradecem!', nextNodeId: null, action: 'STEP:sino_misterioso.contar' }]) },
    { when: { done: 'sino_misterioso' }, tree: say('Guarda Ren', 'Os passarinhos já aprenderam a pousar na viga, não na corda. E o Toshi voltou a dormir de luz apagada.') },
    { tree: say('Guarda Ren', 'Lá em cima, no terraço, fica a residência do Mikage. Para entrar nela, só com a Faixa Índigo da Academia. Mas o jardim e o lago são de todo mundo: aproveite!') },
  ],
};

export const BUNKO: NPCDefinition = {
  id: 'bunko',
  name: 'Arquivista Bunko',
  role: 'Guardião do Arquivo do Templo',
  position: [35.8, TERRACE.h, -29.5],
  faceRotation: 0,
  look: { species: 'tanuki', fur: '#8A7560', belly: '#E8DCC4', scale: 0.95, mask: '#4E4034', eyes: 'sleepy', accessory: 'sage', outfit: '#5A4A6E' },
  voice: 'chitter',
  barks: ['Arquivo é memória que não esquece. Diferente de mim.', 'Cuidado com o pó. Ele é mais velho que a vila.', 'Ler devagar também é ler. Às vezes, é ler melhor.'],
  reactions: [{ when: { flag: 'lanternas_acesas' }, barks: ['As lanternas acesas de novo... Faz tanto tempo!', 'Viu o que estava atrás da cascata? Eu sabia! Quer dizer, eu desconfiava.'] }],
  offers: [{ mission: 'lanternas_guardias' }],
  routes: [
    { when: { notStarted: 'lanternas_guardias' }, tree: {
      start: {
        id: 'start', speaker: 'Arquivista Bunko',
        text: 'Ah, uma visita! Desculpe a bagunça: são só uns trezentos rolos de pergaminho.\nEstá vendo as quatro lanternas de pedra lá fora? Cada uma tem um bicho gravado: gato, carpa, grou e tartaruga. Os antigos as acendiam numa ordem certa, e diziam que a água abria passagem.',
        options: [{ label: 'A água abria passagem?', nextNodeId: 'agua' }],
      },
      agua: {
        id: 'agua', speaker: 'Arquivista Bunko',
        text: 'É o que está escrito! Eu sempre quis ver, mas minhas patas tremem com fósforo.\nO rolo com os versos está na mesa do arquivo. Leia com atenção: cada verso é uma regra, e só UMA ordem obedece a todas.',
        options: [{ label: '🏮 Vou acender!', nextNodeId: null, action: 'START:lanternas_guardias;STEP:lanternas_guardias.ouvir;TRACK:lanternas_guardias' }],
      },
    } },
    { when: { active: 'lanternas_guardias', notStep: 'lanternas_guardias.rolo' }, tree: say('Arquivista Bunko', 'O rolo dos versos está na mesa, aqui no arquivo. Leia primeiro, acenda depois!') },
    { when: { step: 'lanternas_guardias.rolo', notStep: 'lanternas_guardias.acender' }, tree: say('Arquivista Bunko',
      'Uma dica de velho arquivista: comece pelo verso que diz o lugar certinho de alguém, como "por último".\nDepois junte os que andam em dupla. Se as chamas apagarem, tudo bem: é só tentar de novo.') },
    { when: { step: 'lanternas_guardias.acender', notStep: 'lanternas_guardias.cascata' }, tree: say('Arquivista Bunko', 'Ouvi um barulho de pedra arrastando lá embaixo, perto da cascata! Vá ver o que a água abriu!') },
    { when: { step: 'lanternas_guardias.cascata', notStep: 'lanternas_guardias.contar' }, tree: say('Arquivista Bunko',
      'Um amuleto atrás da cascata! Os antigos guardavam ali os presentes para quem soubesse ler com paciência.\nVou escrever no arquivo: "Neste dia, um gatinho leu os versos e as lanternas voltaram a brilhar."',
      [{ label: '📜 Pode escrever!', nextNodeId: null, action: 'STEP:lanternas_guardias.contar' }]) },
    { when: { done: 'lanternas_guardias' }, tree: say('Arquivista Bunko', 'Volte quando quiser. Arquivo bom é arquivo visitado. E espanado. Principalmente espanado.') },
    { tree: say('Arquivista Bunko', 'Aqui guardamos a história da vila: as cheias, as colheitas, até o dia em que o Mikage tentou fazer bolo. Foi uma página triste.') },
  ],
};

export const TAMA: NPCDefinition = {
  id: 'tama',
  name: 'Tama',
  role: 'Gatinha do templo',
  position: [30.4, 0, -15.6],
  faceRotation: 0,
  patrol: [[30.4, 0, -15.6], [31.0, 0, -17.2], [32.6, 0, -15.4]],
  speed: 1.5,
  look: { species: 'cat', fur: '#F2D2A8', belly: '#FFF6EA', scale: 0.7, stripes: '#D9A066', eyes: 'round', accessory: 'kid' },
  voice: 'meow_high',
  barks: ['Duvido você me achar! Ah, não, espera, você me achou.', 'Sabia que as carpas têm nome? Aquela é a Dona Bolha.', 'Quando eu crescer, vou ser guarda. Ou carpa.'],
  reactions: [{ when: { done: 'patas_de_jade' }, barks: ['Você é o melhor achador de coisas do mundo inteiro!', 'Amanhã eu escondo de novo. Mais difícil! (Mentira, eu fico com medo da torre.)'] }],
  offers: [{ mission: 'patas_de_jade' }],
  routes: [
    { when: { notStarted: 'patas_de_jade' }, tree: {
      start: {
        id: 'start', speaker: 'Tama', mood: 'sad',
        text: 'Psiu! Você é bom de achar coisas? Eu escondi as três Patas de Jade do templo para brincar de esconde-esconde...\nE agora eu não lembro onde. O Mikage vai usar elas na festa da lua!',
        options: [{ label: 'Calma, eu ajudo!', nextNodeId: 'dicas' }],
      },
      dicas: {
        id: 'dicas', speaker: 'Tama',
        text: 'Eu lembro de três coisas: uma eu escondi onde a água passa por baixo de quem anda por cima.\nOutra eu escondi onde as varas verdes fazem barulho de chuva.\nE a outra... eu subi, subi, subi, e lá de cima dava para ver o telhado do Mikage. Foi a vez que eu mais tive medo!',
        options: [{ label: '🐾 Vou procurar!', nextNodeId: null, action: 'START:patas_de_jade;STEP:patas_de_jade.ouvir;TRACK:patas_de_jade' }],
      },
    } },
    { when: { active: 'patas_de_jade', notStep: 'patas_de_jade.achar' }, tree: say('Tama',
      'Onde a água passa por baixo de quem anda por cima... onde as varas fazem barulho de chuva... e lá no alto, de onde se vê o telhado!\nPara subir alto, pule de bloco em bloco. Eu fui pelos blocos de pedra atrás do arquivo.') },
    { when: { step: 'patas_de_jade.achar', notStep: 'patas_de_jade.devolver' }, tree: say('Tama', 'AS TRÊS! Você achou as três! Até a da torre?!\nObrigada, obrigada! E me desculpa por ter dado trabalho. Da próxima vez eu anoto onde escondo.',
      [{ label: '🐾 Promessa de amigo!', nextNodeId: null, action: 'STEP:patas_de_jade.devolver' }]) },
    { when: { done: 'patas_de_jade' }, tree: say('Tama', 'O Mikage colocou as patas no altar da festa da lua. Ele disse que fui muito corajosa por pedir ajuda. Você também foi corajoso na torre!') },
    { tree: say('Tama', 'Eu moro no templo! Quer dizer, eu moro no cantinho quente perto da cozinha do templo. É a melhor parte.') },
  ],
};

// ── Items, challenges, missions ───────────────────────────────────────────────

export const PRECINCT_ITEMS: Item[] = [
  { id: 'pata_jade', name: 'Pata de Jade', icon: '🟢', category: 'missao', description: 'Uma patinha de jade verde-clara, lisinha de tanto ser segurada. A Tama escondeu três.' },
  { id: 'amuleto_guardiao', name: 'Amuleto dos Guardiões', icon: '🧿', category: 'colecionavel', rarity: 'epico', description: 'Guardado atrás da cascata pelos antigos: quatro bichos gravados (gato, carpa, grou e tartaruga) em volta de uma pata dourada.' },
];

export const PRECINCT_CHALLENGES: Challenge[] = [
  {
    id: 'sino_quem', skill: 'logica', kind: 'choice', title: 'O Sino que Toca Sozinho',
    story: 'O que você descobriu:\n1. o sino toca de manhã cedo e no fim da tarde, mesmo nos dias SEM vento;\n2. uma pena azul-clara, pequenininha, presa na corda do sino;\n3. migalhas de arroz e fiapos de palha embaixo do sino;\n4. o Guarda Ren estava no portão todas as vezes (está no diário).',
    question: 'Quem faz o sino tocar?',
    choices: ['Um fantasma do templo', 'O vento da montanha', 'Passarinhos fazendo ninho na viga do sino', 'O Guarda Ren, de brincadeira'],
    answer: 2,
    observe: 'Teste cada suspeito contra TODAS as pistas. Quem não combina com uma delas já está fora.',
    hint: 'Sem vento, o vento não pode ser. O Ren estava no portão. Fantasma não deixa pena nem migalha. Quem come de manhã cedo e no fim da tarde, e usa palha?',
    example: 'Parecido: "as flores aparecem amassadas toda manhã, com terra fresquinha e marcas de pata pequena". Foi o vento? Não deixa pata. Foi um coelho cavando? Combina com tudo.',
    successText: '🐦 Passarinhos! A palha é do ninho, as migalhas são da comida e a pena caiu quando eles pousaram na corda. Cada pousada: DOOONG.',
    onSuccess: 'STEP:sino_misterioso.deduzir;SKILL:logica',
  },
];

export const PRECINCT_MISSIONS: Mission[] = [
  {
    id: 'sino_misterioso',
    chapter: 5,
    title: 'O Sino que Toca Sozinho',
    category: 'investigação',
    giver: 'ren',
    description: 'O grande sino do Templo de Mikage toca sozinho de manhã cedo e no fim da tarde. O Guarda Ren quer saber por quê.',
    steps: [
      { id: 'ouvir', description: 'Ouça o Guarda Ren no portão do Templo de Mikage (norte do Bairro das Glicínias)', target: { npc: 'ren' } },
      { id: 'sino', description: 'Examine o sino no pavilhão do terraço', after: ['ouvir'], target: { object: 'sino_mikage' } },
      { id: 'pena', description: 'Procure pistas perto do sino', after: ['ouvir'], target: { object: 'pista_pena' } },
      { id: 'migalhas', description: 'Procure mais pistas embaixo do pavilhão', after: ['ouvir'], target: { object: 'pista_migalhas' } },
      { id: 'diario', description: 'Leia o diário do Guarda Ren (mesinha do portão)', after: ['ouvir'], target: { object: 'pista_diario' } },
      { id: 'deduzir', description: 'Conte ao Ren quem faz o sino tocar', after: ['sino', 'pena', 'migalhas', 'diario'], target: { npc: 'ren' } },
      { id: 'ninho', description: 'Amarre a corda do sino sem assustar o ninho', after: ['deduzir'], target: { object: 'sino_amarrar' } },
      { id: 'contar', description: 'Volte ao Guarda Ren', after: ['ninho'], target: { npc: 'ren' } },
    ],
    rewards: { xp: 70, coins: 25, gems: 2, badges: ['Detetive do Templo'] },
    lesson: 'Investigar é testar cada explicação contra todas as pistas. E resolver um problema não é expulsar quem o causa: às vezes é só achar um jeito de todo mundo caber.',
  },
  {
    id: 'lanternas_guardias',
    chapter: 5,
    title: 'As Lanternas dos Guardiões',
    category: 'educativa',
    giver: 'bunko',
    description: 'Quatro lanternas de pedra guardam a residência do Mikage. Um rolo antigo diz a ordem de acendê-las, e que então "a água abre passagem".',
    steps: [
      { id: 'ouvir', description: 'Ouça o Arquivista Bunko no pavilhão do arquivo (terraço do templo)', target: { npc: 'bunko' } },
      { id: 'rolo', description: 'Leia o rolo dos versos na mesa do arquivo', after: ['ouvir'], target: { object: 'rolo_lanternas' } },
      { id: 'acender', description: 'Acenda as quatro lanternas na ordem dos versos', after: ['rolo'], target: { position: [AXIS_X, TERRACE.h, -24.7] } },
      { id: 'cascata', description: 'Descubra o que a cascata escondia', after: ['acender'], target: { object: 'bau_cascata' } },
      { id: 'contar', description: 'Conte ao Arquivista Bunko', after: ['cascata'], target: { npc: 'bunko' } },
    ],
    rewards: { xp: 90, coins: 30, gems: 3, badges: ['Guardião das Lanternas'] },
    lesson: 'Regras que dizem o lugar exato de alguém ("por último") são o melhor começo. Depois, as que andam em dupla ("logo depois") prendem as peças juntas. O resto se encaixa.',
  },
  {
    id: 'patas_de_jade',
    chapter: 5,
    title: 'As Patas de Jade',
    category: 'exploração',
    giver: 'tama',
    description: 'A Tama, a gatinha do templo, escondeu as três Patas de Jade para brincar e esqueceu onde. Só lembra de três pistas.',
    steps: [
      { id: 'ouvir', description: 'Ouça a Tama perto do lago do templo', target: { npc: 'tama' } },
      { id: 'achar', description: 'Encontre as 3 Patas de Jade pelo templo', after: ['ouvir'], counter: { id: 'jade', goal: JADE_PAWS.length } },
      { id: 'devolver', description: 'Devolva as patas à Tama', after: ['achar'], target: { npc: 'tama' } },
    ],
    rewards: { xp: 70, coins: 30, gems: 2, badges: ['Achador do Templo'] },
    lesson: 'Explorar é olhar onde ninguém olha: por baixo, por dentro e lá no alto. E pedir ajuda quando a gente se enrola é coragem também.',
    onComplete: `TAKE:pata_jade:${JADE_PAWS.length}`,
  },
];

// ── Objects ───────────────────────────────────────────────────────────────────

export const PRECINCT_OBJECTS: WorldObject[] = [
  {
    id: 'placa_templo', kind: 'sign', position: [29.8, 0, -12.3], label: 'Ler a placa', name: 'Templo de Mikage',
    dialogue: say('Templo de Mikage', '⛩️ TEMPLO DE MIKAGE — Residência do Líder da Vila das Patas\n↑ Residência e Salão de Audiências (pela escadaria)   ·   ← Sino   ·   → Lago e Arquivo\n"Patas limpas, coração tranquilo. Quem sabe, ensina."'),
  },
  {
    id: 'bacia_patas', kind: 'examine', position: [23.6, 0, -16.6], label: 'Lavar as patas na fonte', name: 'Fonte de purificação', radius: 1.5,
    dialogue: say('Fonte de purificação', 'Uma bacia de pedra com água fresquinha que desce da cascata por um bambu.\nVocê lava as patinhas, uma de cada vez, como manda a tradição. Splish. Pronto: patas de visita!', undefined, 'FLAG:patas_lavadas;SFX:splash'),
  },
  {
    // the board itself is drawn with the precinct (game/world/MikagePrecinct.tsx)
    id: 'quadro_templo', kind: 'examine', position: [31.0, 0, -15.2], label: 'Ler o quadro de avisos', name: 'Quadro de avisos do templo',
    dialogue: say('Quadro de avisos do templo', '📌 Avisos da Sede\n• A residência só recebe os graduados da Academia Ninja (falar com o Guarda Toshi, no terraço).\n• Proibido alimentar as carpas com bolinho. Elas ficam enjoadas. (Dona Bolha, principalmente.)\n• Expedições às Terras Selvagens: a saída é pela Clareira dos Cervos, no fim do Bosque Antigo. Falar com a Batedora Kaze.'),
  },
  {
    id: 'estatua_gato_oeste', kind: 'examine', position: [23.9, 0, -12.6], label: 'Olhar a estátua', name: 'Gato guardião',
    dialogue: say('Gato guardião', 'Um gato de pedra sentado, com uma bola entre as patas: o guardião que segura o mundo.\nOs antigos diziam que os guardiões vigiam de boca fechada, para ouvir melhor.'),
  },
  {
    id: 'estatua_gato_leste', kind: 'examine', position: [31.3, 0, -12.6], label: 'Olhar a estátua', name: 'Gata guardiã',
    dialogue: say('Gata guardiã', 'Uma gata de pedra com um filhote embaixo da pata: a guardiã que protege quem é pequeno.\nAlguém deixou uma flor de glicínia na cabeça dela. Ficou bonito.'),
  },
  {
    id: 'placa_residencia', kind: 'sign', position: [32.5, TERRACE.h, -26.4], label: 'Ler a placa', name: 'Residência do Líder',
    dialogue: say('Residência do Líder', '🏯 RESIDÊNCIA DO LÍDER DA VILA — Sede de Mikage\nSalão de Audiências · Biblioteca · Sala de Mapas · Jardim · Pátio de Treinamento\n"Ninguém fica para trás. Quem sabe, ensina. Quem erra, tenta de novo." — Pacto das Patas'),
  },
  // O Sino que Toca Sozinho
  {
    id: 'sino_mikage', kind: 'examine', position: [BELL.x, TERRACE.h, BELL.z], label: 'Examinar o sino', name: 'Grande sino', radius: 1.4, priority: 1,
    when: { active: 'sino_misterioso', notStep: 'sino_misterioso.sino' },
    dialogue: say('Grande sino', 'Um sino de bronze enorme, pendurado numa viga grossa. A corda balança um pouquinho... sem ninguém por perto.\nLá no alto, entre a viga e o telhado, dá para ver um montinho de alguma coisa. Muito alto para alcançar.', undefined, 'STEP:sino_misterioso.sino'),
  },
  {
    id: 'sino_amarrar', kind: 'examine', position: [BELL.x, TERRACE.h, BELL.z], label: 'Amarrar a corda do sino', name: 'Grande sino', radius: 1.4, priority: 1,
    when: { step: 'sino_misterioso.deduzir', notStep: 'sino_misterioso.ninho' },
    dialogue: say('Grande sino', 'Bem devagar, sem barulho, você amarra a corda na coluna do pavilhão.\nLá em cima, dois biquinhos aparecem na beira do ninho, piam baixinho... e voltam a dormir.', undefined, 'FLAG:ninho_sino;STEP:sino_misterioso.ninho;SFX:chime'),
  },
  {
    id: 'sino_tocar', kind: 'examine', position: [BELL.x, TERRACE.h, BELL.z], label: 'Olhar o sino', name: 'Grande sino', radius: 1.4,
    when: { notStep: 'sino_misterioso.ninho' },
    dialogue: say('Grande sino', 'O grande sino do templo. Toca nas festas, nos anos-novos e, pelo jeito, quando ele bem entende.'),
  },
  {
    id: 'sino_ninho', kind: 'examine', position: [BELL.x, TERRACE.h, BELL.z], label: 'Olhar o ninho', name: 'Ninho do sino', radius: 1.4,
    when: { step: 'sino_misterioso.ninho' },
    dialogue: say('Ninho do sino', 'A corda amarrada, o ninho na viga e dois filhotes de passarinho azul dormindo. O sino agora só toca quando alguém quer.'),
  },
  {
    id: 'pista_pena', kind: 'clue', position: [21.1, TERRACE.h, -24.2], label: 'Olhar a pena', name: 'Uma pena',
    when: { active: 'sino_misterioso', notStep: 'sino_misterioso.pena' },
    dialogue: say('Uma pena', 'Uma pena azul-clara, pequenininha, presa num fiapo da corda do sino. De passarinho, com certeza. Não de fantasma.', undefined, 'STEP:sino_misterioso.pena'),
  },
  {
    id: 'pista_migalhas', kind: 'clue', position: [24.9, TERRACE.h, -24.2], label: 'Olhar o chão do pavilhão', name: 'Migalhas e palha',
    when: { active: 'sino_misterioso', notStep: 'sino_misterioso.migalhas' },
    dialogue: say('Migalhas e palha', 'Migalhas de arroz e fiapos de palha seca espalhados bem embaixo do sino. Alguém anda comendo e... construindo alguma coisa lá em cima?', undefined, 'STEP:sino_misterioso.migalhas'),
  },
  {
    id: 'pista_diario', kind: 'clue', position: [25.0, 0, -14.9], label: 'Ler o diário de guarda', name: 'Diário do Guarda Ren',
    when: { active: 'sino_misterioso', notStep: 'sino_misterioso.diario' },
    dialogue: say('Diário do Guarda Ren', '"Segunda: sino tocou ao nascer do sol. Sem vento. Eu no portão.\nTerça: tocou no fim da tarde. Sem vento. Eu no portão, comendo bolinho.\nQuarta: tocou ao nascer do sol e no fim da tarde. Os passarinhos do bambuzal fazem uma festa nesses horários. Eu no portão. Sem bolinho (acabou)."', undefined, 'STEP:sino_misterioso.diario'),
  },
  // As Lanternas dos Guardiões
  {
    id: 'rolo_lanternas', kind: 'clue', position: [37.9, TERRACE.h, -31.3], label: 'Ler o rolo dos versos', name: 'Rolo dos versos',
    when: { step: 'lanternas_guardias.ouvir', notStep: 'lanternas_guardias.rolo' },
    dialogue: say('Rolo dos versos', `"Quando os guardiões brilharem na ordem certa, a água abrirá passagem."\n${LANTERN_PUZZLE.rules.map((r, i) => `${i + 1}. ${r.text}`).join('\n')}\n(Cada verso é uma regra. Só uma ordem obedece a todas.)`, undefined, 'STEP:lanternas_guardias.rolo'),
  },
  {
    id: 'bau_cascata', kind: 'chest', position: [NICHE.x, 0, TERRACE.z1 - 0.7], label: 'Abrir o baú escondido', name: 'Baú da cascata',
    usableWhen: { flag: 'lanternas_acesas' },
    hideWhen: { flag: 'bau_cascata_aberto' },
    actions: 'GIVE:amuleto_guardiao;COINS:20;GEMS:1;FLAG:bau_cascata_aberto;STEP:lanternas_guardias.cascata;SECRET:cascata_templo',
  },
  // As Patas de Jade
  ...JADE_PAWS.map((j): WorldObject => ({
    // the tower's one only from its top (a small radius in its middle: the ground around the tower is farther)
    id: j.id, kind: 'examine', position: j.at, label: 'Pegar a Pata de Jade', name: 'Pata de Jade', radius: j.id === 'jade_torre' ? 0.6 : j.id === 'jade_ponte' ? 1.0 : 1.3,
    when: { active: 'patas_de_jade', notFlag: j.id },
    actions: `FLAG:${j.id};GIVE:pata_jade;COUNT:jade;SFX:pickup`,
  })),
];

export const PRECINCT_NPCS: NPCDefinition[] = [REN, BUNKO, TAMA];
