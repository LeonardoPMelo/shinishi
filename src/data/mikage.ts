import type { Challenge, DialogueTree, Item, Mission, NPCDefinition, Vec3 } from '../types';
import type { WorldObject } from './world';
import { INTERIORS_BY_ID } from './interiors';
import { YUKI_TRAIL_ROUTES } from './wild';
import type { OrderPuzzle } from '../systems/orderPuzzle';

/**
 * A Sede de Mikage (Etapa 5 da expansão): the residence and seat of the village's leader, behind the great
 * gate at the far end of the Training Forest (south, past the stream), at the foot of the mountains. Mikage is original to this game: a very tall, silver-grey old cat with a white
 * mane, a torn ear from the Great Flood, an indigo haori with the golden paw, and a staff with a small bell.
 * Wise and warm, hopeless with paperwork, fond of jasmine tea and of terrible puns.
 *
 * Spaces (data/interiors.ts): entrance gate, ornamental garden, training yard, audience hall, meeting room,
 * library, Mikage's office, the map room and a reserved room behind a secret bookcase. Missions:
 *  - A Audiência (main): meet Mikage (after the academy's graduation);
 *  - Os Registros Sumidos (investigation): three pages, three clues, one deduction;
 *  - A Expedição (planning + a decision): read the map, choose the route at the council (it changes what to
 *    pack and what you get, and is saved for the wild region), count the supplies;
 *  - O Segredo da Biblioteca (logic + stealth): a poem, five books in order, the secret door, the nightingale
 *    floor, the Founding Scroll.
 */

const S = INTERIORS_BY_ID.sede;
const at = (x: number, z: number, y = 0): Vec3 => [S.origin[0] + x, y, S.origin[1] + z];

const say = (speaker: string, text: string, options?: DialogueTree['start']['options'], onEnter?: string): DialogueTree => ({
  start: { id: 'start', speaker, text, onEnter, options: options ?? [{ label: 'Ok', nextNodeId: null }] },
});

// ── Puzzles ───────────────────────────────────────────────────────────────────
export const BOOK_COLORS: Record<string, { name: string; color: string }> = {
  azul: { name: 'Azul', color: '#3E6FB8' },
  vermelho: { name: 'Vermelho', color: '#B8433A' },
  amarelo: { name: 'Amarelo', color: '#D9AE38' },
  roxo: { name: 'Roxo', color: '#7A4FB0' },
  verde: { name: 'Verde', color: '#4F8A4A' },
};

export const BOOK_PUZZLE: OrderPuzzle = {
  id: 'livros_fundacao',
  // as they stand on the shelf, left to right
  pieces: ['vermelho', 'verde', 'azul', 'roxo', 'amarelo'],
  rules: [
    { text: 'O azul abre o caminho.', rule: { kind: 'first', a: 'azul' } },
    { text: 'O amarelo fica bem no meio.', rule: { kind: 'at', a: 'amarelo', index: 2 } },
    { text: 'O vermelho vem antes do verde, mas não logo antes.', rule: { kind: 'beforeNotNext', a: 'vermelho', b: 'verde' } },
    { text: 'O roxo nunca é o último.', rule: { kind: 'notLast', a: 'roxo' } },
  ],
};
export const BOOK_SOLVED = 'FLAG:biblioteca_aberta;STEP:pergaminho.livros;SFX:mechanism;SKILL:logica';

/** The shelf of books (room coordinates) and the secret bookcase that slides away. */
export const BOOK_SHELF = { at: [9.0, -1.0] as [number, number], spacing: 0.34 };
/** Closed, it covers the doorway at x 9.5; open, it has slid east to x 10.75. */
export const SECRET_CASE = { at: [9.5, -4.68] as [number, number], openX: 10.75, w: 1.4 };
/** Nightingale boards in the reserved room and where a heard cat goes back to (in the library). */
export const SEDE_NIGHTINGALE = { rect: [8, -8.8, 11, -5.6] as [number, number, number, number], back: [9.5, -3.6] as [number, number] };

/** The training yard targets: hit them from the smallest number to the largest (shuriken, key 1). */
export const YARD_TARGETS = [
  { value: 6, at: [5.0, 1.2] as [number, number] },
  { value: 2, at: [7.0, 1.2] as [number, number] },
  { value: 4, at: [9.0, 1.2] as [number, number] },
];
export const YARD_TARGETS_DONE = 'FLAG:alvos_sede;COINS:15;SFX:chime;SKILL:padroes';

/** Every action the residence's 3D components run (checked by systems/validateData.ts). */
export const SEDE_CODE_ACTIONS: Record<string, string> = {
  livros: BOOK_SOLVED,
  alvos: YARD_TARGETS_DONE,
};

// ── Items ─────────────────────────────────────────────────────────────────────
export const SEDE_ITEMS: Item[] = [
  { id: 'pagina_registro', name: 'Página dos Registros', icon: '📄', category: 'missao', description: 'Uma das páginas sumidas dos registros da vila. Tem cheiro de... chá?' },
  { id: 'corda_ninja', name: 'Corda Ninja', icon: '🪢', category: 'ferramenta', rarity: 'raro', description: 'Corda trançada para a rota do rio. A Conselheira Yuki garante: aguenta até o Taro pendurado.' },
  { id: 'capa_vento', name: 'Capa Corta-Vento', icon: '🧥', category: 'ferramenta', rarity: 'raro', description: 'Capa grossa para a rota da montanha. Tem um bolso só para peixe seco.' },
  { id: 'pergaminho_fundacao', name: 'Pergaminho da Fundação', icon: '📜', category: 'colecionavel', rarity: 'lendario', description: 'O Pacto das Patas, escrito depois da Grande Cheia: "Ninguém fica para trás. Quem sabe, ensina. Quem erra, tenta de novo."' },
];

// ── Challenges ────────────────────────────────────────────────────────────────
export const SEDE_CHALLENGES: Challenge[] = [
  {
    id: 'quem_levou', skill: 'logica', kind: 'choice', title: 'Os Registros Sumidos',
    story: 'As pistas das três páginas:\n1. cheiro de chá de jasmim e uma marca redonda de xícara;\n2. uma pegada de tinta enorme, com pelo branco;\n3. um bilhete: "devolver os registros. — M."\nNa Sede, a Yuki só bebe chá de hortelã, o Fumi tem patas pequenas de tanuki e o Toshi não sai do portão.',
    question: 'Quem levou os registros?',
    choices: ['O Guarda Toshi', 'A Conselheira Yuki', 'O bibliotecário Fumi', 'O próprio Mikage'],
    answer: 3,
    observe: 'Use as pistas para descartar suspeitos, um de cada vez. Quem não combina com UMA pista já está fora.',
    hint: 'O chá de jasmim descarta a Yuki (hortelã). A pata enorme descarta o Fumi. O Toshi não sai do portão. Quem sobra, assina com "M." e tem pelo branco?',
    example: 'Parecido: "quem comeu o bolo tem bigode comprido e usa chapéu". Se só um suspeito tem as duas coisas, foi ele.',
    successText: '🔍 O próprio Mikage! Jasmim, pata enorme, juba branca e a assinatura "M.". Deduzir é juntar pistas até sobrar uma só resposta.',
    onSuccess: 'STEP:documentos.deduzir',
  },
  {
    id: 'mapa_coordenadas', skill: 'geometria', kind: 'choice', title: 'A Sala dos Mapas',
    story: 'O mapa da região é dividido em quadrados: colunas de A a E (da esquerda para a direita) e linhas de 1 a 5 (de cima para baixo).\nA Ponte de Cipó fica no quadrado C4. O Vale das Névoas fica 2 colunas à direita e 3 linhas acima da ponte.',
    question: 'Em que quadrado fica o Vale das Névoas?',
    choices: ['E1', 'E7', 'A1', 'D2'],
    answer: 0,
    observe: 'Mexa em uma direção de cada vez: primeiro as colunas (letras), depois as linhas (números). "Acima" é para a linha 1.',
    hint: 'De C, duas colunas à direita: D, E. Da linha 4, três linhas acima: 3, 2, 1.',
    example: 'Parecido: de B2, uma coluna à direita e duas linhas abaixo: C4.',
    successText: '🗺️ E1! Coluna C → E e linha 4 → 1. Ler coordenadas é como os exploradores conversam sobre o mapa.',
    onSuccess: 'STEP:expedicao.mapa',
  },
  {
    id: 'suprimentos_rio', skill: 'fracoes', kind: 'number', title: 'Suprimentos: Rota do Rio',
    story: 'A rota do rio leva 3 dias. Vão 4 gatos na expedição.\nCada gato come 3/4 de um peixe seco por dia.',
    question: 'Quantos peixes secos a equipe precisa levar?',
    answer: 9,
    observe: 'Descubra quanto UM gato come na viagem toda; depois multiplique pela equipe.',
    hint: 'Um gato em 3 dias: 3 × 3/4 = 9/4. Para 4 gatos: 4 × 9/4. (Ou: os 4 gatos juntos comem 4 × 3/4 = 3 peixes por dia.)',
    example: 'Parecido: 2 gatos, 4 dias, 1/2 peixe por dia: juntos comem 1 peixe por dia, então 4 peixes.',
    successText: '🐟 9 peixes secos! 4 gatos × 3/4 = 3 por dia, e 3 dias × 3 = 9.',
    onSuccess: 'STEP:expedicao.suprimentos',
  },
  {
    id: 'suprimentos_montanha', skill: 'fracoes', kind: 'number', title: 'Suprimentos: Rota da Montanha',
    story: 'A rota da montanha leva 5 dias. Vão 4 gatos na expedição.\nCada gato come 3/4 de um peixe seco por dia.',
    question: 'Quantos peixes secos a equipe precisa levar?',
    answer: 15,
    observe: 'Descubra quanto a equipe toda come em UM dia; depois multiplique pelos dias.',
    hint: 'Por dia, os 4 gatos juntos comem 4 × 3/4 = 3 peixes. São 5 dias.',
    example: 'Parecido: 2 gatos, 4 dias, 1/2 peixe por dia: juntos comem 1 peixe por dia, então 4 peixes.',
    successText: '🐟 15 peixes secos! 3 por dia × 5 dias. Caminho mais longo, mochila mais pesada.',
    onSuccess: 'STEP:expedicao.suprimentos',
  },
];

// ── Missions ──────────────────────────────────────────────────────────────────
export const SEDE_MISSIONS: Mission[] = [
  {
    id: 'audiencia',
    chapter: 5,
    title: 'A Audiência',
    category: 'principal',
    giver: 'sumi',
    description: 'O Mikage, líder da Vila das Patas, quer conhecer o novo graduado da Academia.',
    steps: [
      { id: 'portao', description: 'Fale com o Guarda Toshi no portão da Sede (no fim da Floresta do Treinamento, ao sul)', target: { npc: 'toshi' } },
      { id: 'mikage', description: 'Encontre o Mikage no Salão de Audiências', target: { npc: 'mikage' } },
    ],
    rewards: { xp: 40, coins: 10 },
    lesson: 'Um líder de verdade conhece a história de quem ele lidera, e escuta antes de falar.',
  },
  {
    id: 'documentos',
    chapter: 5,
    title: 'Os Registros Sumidos',
    category: 'investigação',
    giver: 'mikage',
    description: 'Três páginas dos registros da vila sumiram da Sede. Cada uma tem uma pista de quem as levou.',
    steps: [
      { id: 'ouvir', description: 'Ouça o Mikage', target: { npc: 'mikage' } },
      { id: 'biblioteca', description: 'Procure uma página na Biblioteca', after: ['ouvir'], target: { object: 'pagina_biblioteca' } },
      { id: 'reunioes', description: 'Procure uma página na Sala de Reuniões', after: ['ouvir'], target: { object: 'pagina_reunioes' } },
      { id: 'mapas', description: 'Procure uma página na Sala de Mapas', after: ['ouvir'], target: { object: 'pagina_mapas' } },
      { id: 'deduzir', description: 'Junte as pistas e conte ao Mikage quem levou', after: ['biblioteca', 'reunioes', 'mapas'], target: { npc: 'mikage' } },
      { id: 'contar', description: 'Ouça o que o Mikage tem a dizer', after: ['deduzir'], target: { npc: 'mikage' } },
    ],
    rewards: { xp: 70, coins: 30, gems: 2 },
    lesson: 'Para deduzir, junte as pistas e descarte quem não combina com elas. Às vezes a resposta é quem menos se espera.',
    onComplete: 'TAKE:pagina_registro:3',
  },
  {
    id: 'expedicao',
    chapter: 5,
    title: 'A Expedição',
    category: 'educativa',
    giver: 'yuki',
    description: 'A Conselheira Yuki planeja uma expedição às terras selvagens. Falta ler o mapa, escolher a rota e calcular os suprimentos.',
    steps: [
      { id: 'ouvir', description: 'Ouça a Conselheira Yuki', target: { npc: 'yuki' } },
      { id: 'mapa', description: 'Leia o mapa da região na mesa de mapas', after: ['ouvir'], target: { object: 'mesa_mapa_regiao' } },
      { id: 'reuniao', description: 'Escolha a rota na mesa do conselho (Sala de Reuniões)', after: ['mapa'], target: { object: 'mesa_conselho_rota' } },
      { id: 'suprimentos', description: 'Calcule os suprimentos (caixas na Sala de Reuniões)', after: ['reuniao'], target: { object: 'caixas_rio' } },
      { id: 'relatorio', description: 'Leve o plano à Conselheira Yuki', after: ['suprimentos'], target: { npc: 'yuki' } },
    ],
    rewards: { xp: 70, coins: 25, gems: 2 },
    lesson: 'Planejar é escolher com informação: cada rota tem vantagens e custos, e os números dizem o que levar.',
  },
  {
    id: 'pergaminho',
    chapter: 5,
    title: 'O Segredo da Biblioteca',
    category: 'exploração',
    giver: 'fumi',
    description: 'Dizem que uma estante da biblioteca esconde a sala onde está o Pergaminho da Fundação.',
    steps: [
      { id: 'ouvir', description: 'Ouça o bibliotecário Fumi', target: { npc: 'fumi' } },
      { id: 'poema', description: 'Leia o poema do catálogo', after: ['ouvir'], target: { object: 'catalogo_poema' } },
      { id: 'livros', description: 'Puxe os cinco livros da estante na ordem do poema', after: ['poema'], target: { object: 'catalogo_poema' } },
      { id: 'artefato', description: 'Atravesse a Área Reservada sem acordar o chão e pegue o pergaminho', after: ['livros'], target: { object: 'pedestal_fundacao' } },
      { id: 'mikage', description: 'Leve o Pergaminho da Fundação ao Mikage', after: ['artefato'], target: { npc: 'mikage' } },
    ],
    rewards: { xp: 90, coins: 30, gems: 3, badges: ['Guardião da História'] },
    lesson: 'Regras bem lidas abrem portas (literalmente). E a história de um lugar explica por que as pessoas são como são.',
  },
];

// ── Objects ───────────────────────────────────────────────────────────────────
export const SEDE_OBJECTS: WorldObject[] = [
  // the three pages
  {
    id: 'pagina_biblioteca', kind: 'clue', position: at(5.4, -3.6), label: 'Olhar o livro de receitas de chá', name: 'Página dos Registros', radius: 1.4,
    when: { active: 'documentos', step: 'documentos.ouvir', notStep: 'documentos.biblioteca' },
    dialogue: say('Página dos Registros', 'Dentro de um livro de receitas de chá!\nA página tem uma marca redonda de xícara... e cheira a jasmim.', [{ label: '📄 Guardar a página', nextNodeId: null }], 'STEP:documentos.biblioteca;GIVE:pagina_registro'),
  },
  {
    id: 'pagina_reunioes', kind: 'clue', position: at(-6.0, -2.6), label: 'Olhar debaixo da almofada grande', name: 'Página dos Registros', radius: 1.4,
    when: { active: 'documentos', step: 'documentos.ouvir', notStep: 'documentos.reunioes' },
    dialogue: say('Página dos Registros', 'Debaixo da almofada maior da mesa do conselho.\nTem uma pegada de tinta ENORME... com uns fios de pelo branco grudados.', [{ label: '📄 Guardar a página', nextNodeId: null }], 'STEP:documentos.reunioes;GIVE:pagina_registro'),
  },
  {
    id: 'pagina_mapas', kind: 'clue', position: at(5.0, -8.6), label: 'Olhar embaixo do tinteiro', name: 'Página dos Registros', radius: 1.4,
    when: { active: 'documentos', step: 'documentos.ouvir', notStep: 'documentos.mapas' },
    dialogue: say('Página dos Registros', 'Presa embaixo do tinteiro, com um bilhetinho:\n"Lembrar: devolver os registros à biblioteca. — M."', [{ label: '📄 Guardar a página', nextNodeId: null }], 'STEP:documentos.mapas;GIVE:pagina_registro'),
  },
  // the expedition
  {
    id: 'mesa_mapa_regiao', kind: 'examine', position: at(5.2, -6.6), label: 'Estudar o mapa da região', name: 'Mapa da região', radius: 1.6,
    when: { active: 'expedicao', step: 'expedicao.ouvir', notStep: 'expedicao.mapa' }, actions: 'CHALLENGE:mapa_coordenadas',
  },
  {
    id: 'mesa_mapa_vista', kind: 'examine', position: at(5.2, -6.6), label: 'Olhar o mapa', name: 'Mapa da região', radius: 1.6,
    when: { notStep: 'expedicao.ouvir' },
    dialogue: say('Mapa da região', 'Um mapa enorme das terras além da vila: rios, montanhas, uma ponte de cipó e um vale cheio de névoa.\nAlguém desenhou um peixinho em cada acampamento.'),
  },
  {
    id: 'mesa_conselho_rota', kind: 'examine', position: at(-7.5, -1.6), label: 'Reunir o conselho', name: 'Mesa do conselho', radius: 1.6,
    when: { active: 'expedicao', step: 'expedicao.mapa', notStep: 'expedicao.reuniao' },
    dialogue: {
      start: {
        id: 'start', speaker: 'Conselheira Yuki',
        text: 'O conselho está reunido. Duas rotas até o Vale das Névoas:\n• Rota do Rio: 3 dias, mas é preciso atravessar a correnteza.\n• Rota da Montanha: 5 dias, segura, mas muito fria.\nVocê leu o mapa: o que o conselho decide?',
        options: [
          { label: '🌊 Rota do Rio (mais rápida)', nextNodeId: 'rio' },
          { label: '⛰️ Rota da Montanha (mais segura)', nextNodeId: 'montanha' },
        ],
      },
      rio: {
        id: 'rio', speaker: 'Conselheira Yuki',
        text: 'Rota do Rio, então! Vamos precisar de corda para a correnteza.\nAgora as caixas de suprimentos: quantos peixes secos levar?',
        onEnter: 'FLAG:rota_rio;STEP:expedicao.reuniao',
        options: [{ label: '📦 Às caixas!', nextNodeId: null }],
      },
      montanha: {
        id: 'montanha', speaker: 'Conselheira Yuki',
        text: 'Rota da Montanha, então! Mais longa, então mais comida, e capas para o frio.\nAgora as caixas de suprimentos: quantos peixes secos levar?',
        onEnter: 'FLAG:rota_montanha;STEP:expedicao.reuniao',
        options: [{ label: '📦 Às caixas!', nextNodeId: null }],
      },
    },
  },
  {
    id: 'caixas_rio', kind: 'examine', position: at(-9.6, -3.9), label: 'Calcular os suprimentos', name: 'Caixas de suprimentos', radius: 1.5,
    when: { active: 'expedicao', flag: 'rota_rio', step: 'expedicao.reuniao', notStep: 'expedicao.suprimentos' }, actions: 'CHALLENGE:suprimentos_rio',
  },
  {
    id: 'caixas_montanha', kind: 'examine', position: at(-9.6, -3.9), label: 'Calcular os suprimentos', name: 'Caixas de suprimentos', radius: 1.5,
    when: { active: 'expedicao', flag: 'rota_montanha', step: 'expedicao.reuniao', notStep: 'expedicao.suprimentos' }, actions: 'CHALLENGE:suprimentos_montanha',
  },
  // the library secret
  {
    id: 'catalogo_poema', kind: 'clue', position: at(7.0, -1.0), label: 'Ler o poema do catálogo', name: 'Catálogo da biblioteca', radius: 1.4,
    when: { notFlag: 'biblioteca_aberta' },
    dialogue: {
      start: {
        id: 'start', speaker: 'Catálogo da biblioteca',
        text: 'Na última página, um poema antigo, ao lado dos cinco livros coloridos:\n"O azul abre o caminho.\nO amarelo fica bem no meio.\nO vermelho vem antes do verde, mas não logo antes.\nO roxo nunca é o último."',
        onEnter: 'STEP:pergaminho.poema',
        options: [{ label: '📚 Puxar os livros nessa ordem', nextNodeId: null }],
      },
    },
  },
  {
    id: 'pedestal_fundacao', kind: 'clue', position: at(9.5, -9.35), label: 'Pegar o Pergaminho da Fundação', name: 'Pergaminho da Fundação', radius: 1.3,
    when: { flag: 'biblioteca_aberta', notFlag: 'pergaminho_pego' },
    dialogue: say('Pergaminho da Fundação',
      'Um pergaminho enrolado numa fita índigo, sob um pouco de poeira.\nNa capa, uma patinha dourada, igual à do haori do Mikage.',
      [{ label: '📜 Levar ao Mikage', nextNodeId: null }],
      'FLAG:pergaminho_pego;GIVE:pergaminho_fundacao;STEP:pergaminho.artefato;SFX:chest'),
  },
  // things to look at
  {
    id: 'rocha_pacto', kind: 'examine', position: at(-4.6, 3.8), label: 'Ler a pedra gravada', name: 'Pedra do Pacto', radius: 1.5,
    dialogue: say('Pedra do Pacto', 'Gravado na pedra, já gasto pela chuva:\n"Ninguém fica para trás. Quem sabe, ensina. Quem erra, tenta de novo."'),
  },
  {
    id: 'lagoa_carpas_sede', kind: 'examine', position: at(-7.5, 4.2), label: 'Olhar as carpas', name: 'Lago do jardim', radius: 1.6,
    dialogue: say('Lago do jardim', 'Três carpas: uma branca, uma laranja e uma que parece estar com sono.\nUma plaquinha: "Por favor, não pescar as conselheiras."'),
  },
  {
    id: 'mesa_mikage', kind: 'examine', position: at(-7.5, -7.6), label: 'Olhar a mesa do Mikage', name: 'Mesa do Mikage', radius: 1.6,
    dialogue: say('Mesa do Mikage', 'Uma lista de tarefas, com letra tremida:\n"1. Liderar a vila. 2. Achar meus óculos. 3. Liderar a vila de óculos."\nAo lado, três xícaras de chá de jasmim pela metade.'),
  },
  {
    id: 'placa_alvos', kind: 'sign', position: at(7.0, 4.0), label: 'Ler a placa do desafio', name: 'Desafio de Precisão', radius: 1.6,
    dialogue: say('Desafio de Precisão', 'Acerte os três alvos com o shuriken de treino (tecla 1, RB no controle), do MENOR número para o MAIOR.\nErrou a ordem? Os alvos voltam e você recomeça.'),
  },
];

// ── People ────────────────────────────────────────────────────────────────────
export const MIKAGE: NPCDefinition = {
  id: 'mikage',
  name: 'Mikage',
  role: 'Líder da Vila das Patas',
  position: at(0, -8.6, 0.35),
  faceRotation: 0,
  look: { species: 'cat', fur: '#A9A9B4', belly: '#F4F2EE', scale: 1.25, mask: '#8C8C99', eyes: 'round' },
  voice: 'meow_low',
  offers: [{ mission: 'documentos', when: { done: 'audiencia' } }],
  barks: ['Hm-hm. Onde foi que eu deixei meu chá?', 'Uma vila é feita de patas que se ajudam.', 'Liderar é fácil. Achar os óculos é que é difícil.'],
  routes: [
    // O Segredo da Biblioteca: the founding story
    { when: { active: 'pergaminho', step: 'pergaminho.artefato', notStep: 'pergaminho.mikage' }, tree: {
      start: {
        id: 'start', speaker: 'Mikage', mood: 'surprised',
        text: 'O Pergaminho da Fundação... Fazia tantos anos que ninguém o via.\nSente aqui, Shinichi. Vou contar como esta vila nasceu.',
        options: [{ label: 'Estou ouvindo.', nextNodeId: 'cheia' }],
      },
      cheia: {
        id: 'cheia', speaker: 'Mikage',
        text: 'Antes da vila, havia só casinhas espalhadas na beira do rio. Cada família por si.\nUm ano veio a Grande Cheia. O rio subiu de noite e levou pontes, casas, barcos.\nEu era só um mensageiro magricela. Corri de casa em casa acordando todo mundo. Foi assim que rasguei esta orelha.',
        options: [{ label: 'E depois?', nextNodeId: 'pacto' }],
      },
      pacto: {
        id: 'pacto', speaker: 'Mikage', mood: 'happy',
        text: 'Depois, ninguém conseguia reconstruir sozinho. Então juntamos as patas: os fortes carregaram, os que sabiam contar fizeram os planos, os pequenos levaram recados.\nQuando terminamos a primeira ponte, escrevemos o Pacto das Patas: "Ninguém fica para trás. Quem sabe, ensina. Quem erra, tenta de novo."',
        options: [{ label: 'Por isso existe a Academia...', nextNodeId: 'fim' }],
      },
      fim: {
        id: 'fim', speaker: 'Mikage', mood: 'happy',
        text: 'Exatamente. E por isso você, que tentou de novo sempre que precisou, está aqui.\nFique com o pergaminho por um tempo. Uma história só continua viva se alguém a carrega.',
        options: [{ label: '🐾 Vou cuidar dele.', nextNodeId: null, action: 'STEP:pergaminho.mikage' }],
      },
    } },
    // Os Registros Sumidos
    { when: { active: 'documentos', step: 'documentos.deduzir', notStep: 'documentos.contar' }, tree: {
      start: {
        id: 'start', speaker: 'Mikage', mood: 'surprised',
        text: 'EU?! Jasmim... pata grande... "M."...\n*(olha para a xícara em cima de uma página dos registros)*\n...Ah. Eu usei os registros como porta-copos. Por três semanas.',
        options: [{ label: '😹 Acontece, Mikage.', nextNodeId: 'licao' }],
      },
      licao: {
        id: 'licao', speaker: 'Mikage', mood: 'happy',
        text: 'Você investigou com cuidado e não teve medo de dizer a verdade a um líder. Isso vale mais que qualquer registro.\nVou devolvê-los à biblioteca. E comprar porta-copos. Muitos porta-copos.',
        options: [{ label: '📚 Combinado!', nextNodeId: null, action: 'STEP:documentos.contar' }],
      },
    } },
    { when: { active: 'documentos', step: ['documentos.biblioteca', 'documentos.reunioes', 'documentos.mapas'], notStep: 'documentos.deduzir' }, tree: say('Mikage',
      'As três páginas! E então, detetive? Quem levou os registros?',
      [{ label: '🧠 Já sei quem foi!', nextNodeId: null, action: 'CHALLENGE:quem_levou' }, { label: 'Vou pensar mais', nextNodeId: null }]) },
    { when: { active: 'documentos' }, tree: say('Mikage', 'Uma página na biblioteca, uma na sala de reuniões e uma na sala de mapas, eu acho.\nCada página guarda uma pista de quem as levou.') },
    // A Audiência
    { when: { active: 'audiencia', step: 'audiencia.portao' }, tree: {
      start: {
        id: 'start', speaker: 'Mikage',
        text: 'Então você é o Shinichi. A Sumi não para de falar de você.\nEu sou o Mikage. Cuido da Vila das Patas há mais anos do que esta juba tem fios brancos.',
        options: [{ label: 'É uma honra, Mikage.', nextNodeId: 'sede' }],
      },
      sede: {
        id: 'sede', speaker: 'Mikage',
        text: 'Esta casa é de todos. Ande à vontade: o jardim, o pátio de treino, a biblioteca do Fumi, a sala de mapas da Yuki.\nE se puder me ajudar com uma coisinha... alguns registros da vila sumiram.',
        options: [{ label: '🐾 Pode contar comigo.', nextNodeId: null, action: 'STEP:audiencia.mikage' }],
      },
    } },
    { when: { notStarted: 'documentos', done: 'audiencia' }, tree: {
      start: {
        id: 'start', speaker: 'Mikage',
        text: 'Três páginas dos registros da vila sumiram daqui da Sede. Ninguém sabe como.\nVocê, que se formou na Academia, investigaria para mim?',
        options: [
          { label: '🔍 Eu investigo!', nextNodeId: null, action: 'START:documentos;STEP:documentos.ouvir' },
          { label: 'Mais tarde', nextNodeId: null },
        ],
      },
    } },
    { tree: say('Mikage', 'Lembre do Pacto, Shinichi: ninguém fica para trás.\n...E se vir uma xícara de chá de jasmim por aí, é minha.') },
  ],
};

export const TOSHI: NPCDefinition = {
  id: 'toshi',
  name: 'Guarda Toshi',
  role: 'Guarda do portão da Sede',
  position: [-6.4, 0, 61.0],
  faceRotation: Math.PI,
  look: { species: 'cat', fur: '#6B5A4A', belly: '#D9CBB8', scale: 1.05, mask: '#4A3D32', eyes: 'round' },
  voice: 'meow_low',
  barks: ['Portão vigiado, vila tranquila.', 'Nada passa por mim. Exceto borboletas. Elas são rápidas.'],
  routes: [
    { when: { active: 'audiencia', notStep: 'audiencia.portao' }, tree: {
      start: {
        id: 'start', speaker: 'Guarda Toshi', mood: 'happy',
        text: 'A Faixa Índigo da Academia! Então você é o graduado que o Mikage está esperando.\nPode entrar. O Salão de Audiências fica bem no fundo, depois do jardim e do pátio.',
        options: [{ label: '🚪 Obrigado, Toshi!', nextNodeId: null, action: 'STEP:audiencia.portao;FLAG:acesso_sede;SFX:mechanism' }],
      },
    } },
    { when: { flag: 'acesso_sede' }, tree: say('Guarda Toshi', 'Pode passar, graduado! E se o Mikage oferecer chá de jasmim, aceite: ele fica feliz.') },
    { tree: say('Guarda Toshi', 'Esta é a Sede do Mikage, o líder da vila, aos pés da montanha.\nSó entram os graduados da Academia Ninja. A Academia fica no dojô, lá na vila, perto da praça: a Professora Sumi cuida das matrículas.') },
  ],
};

export const YUKI: NPCDefinition = {
  id: 'yuki',
  name: 'Conselheira Yuki',
  role: 'Estrategista da Sede',
  // far from the map table's spot, so walking up to her never offers the map instead (seen in play)
  position: at(7.4, -5.7),
  faceRotation: -Math.PI / 2,
  look: { species: 'cat', fur: '#F2F0EC', belly: '#FFFFFF', scale: 0.95, mask: '#D8D4CC', eyes: 'round' },
  voice: 'meow',
  offers: [{ mission: 'expedicao', when: { done: 'audiencia' } }, { mission: 'trilha', when: { done: 'expedicao' } }],
  // once the trail is open she leads the expedition from the camp in the wild lands (data/wild.ts)
  visibleWhen: { notStep: 'trilha.portao' },
  barks: ['Um bom plano tem plano B. E plano C.', 'Hortelã ajuda a pensar. Jasmim ajuda a esquecer coisas, pelo visto.'],
  routes: [
    { when: { active: 'expedicao', step: 'expedicao.suprimentos', notStep: 'expedicao.relatorio', flag: 'rota_rio' }, tree: say('Conselheira Yuki',
      'Rota do Rio, 9 peixes secos, 3 dias. Plano aprovado!\nLeve esta Corda Ninja: na correnteza, ela vai fazer falta. Quando a expedição partir, você vai junto.',
      [{ label: '🪢 Pegar a corda', nextNodeId: null, action: 'GIVE:corda_ninja;STEP:expedicao.relatorio' }]) },
    { when: { active: 'expedicao', step: 'expedicao.suprimentos', notStep: 'expedicao.relatorio', flag: 'rota_montanha' }, tree: say('Conselheira Yuki',
      'Rota da Montanha, 15 peixes secos, 5 dias. Plano aprovado!\nLeve esta Capa Corta-Vento: lá em cima, o frio não perdoa. Quando a expedição partir, você vai junto.',
      [{ label: '🧥 Pegar a capa', nextNodeId: null, action: 'GIVE:capa_vento;STEP:expedicao.relatorio' }]) },
    { when: { active: 'expedicao' }, tree: say('Conselheira Yuki', 'Primeiro o mapa (a mesa aqui do lado), depois a reunião (Sala de Reuniões), depois as caixas.\nUm passo de cada vez: é assim que expedições voltam para casa.') },
    { when: { notStarted: 'expedicao', done: 'audiencia' }, tree: {
      start: {
        id: 'start', speaker: 'Conselheira Yuki',
        text: 'Ah, o graduado! Eu sou a Yuki, estrategista da Sede.\nOs batedores viram fogueiras estranhas no Vale das Névoas, nas terras selvagens. Há quem diga que é um tal General Hissui juntando bandidos.\nVamos mandar uma expedição para ver de perto. Preciso de alguém bom com mapas e números. Topa ajudar no plano?',
        options: [
          { label: '🗺️ Topo!', nextNodeId: null, action: 'START:expedicao;STEP:expedicao.ouvir' },
          { label: 'Depois', nextNodeId: null },
        ],
      },
    } },
    ...YUKI_TRAIL_ROUTES,
    { when: { done: 'expedicao', flag: 'rota_rio' }, tree: say('Conselheira Yuki', 'A rota do rio está marcada no mapa. Quando as terras selvagens abrirem, a corda vai junto com você.') },
    { when: { done: 'expedicao', flag: 'rota_montanha' }, tree: say('Conselheira Yuki', 'A rota da montanha está marcada no mapa. Quando as terras selvagens abrirem, a capa vai junto com você.') },
    { tree: say('Conselheira Yuki', 'Os mapas não mentem. Os cartógrafos, às vezes, desenham peixinhos demais.') },
  ],
};

export const FUMI: NPCDefinition = {
  id: 'fumi',
  name: 'Fumi',
  role: 'Bibliotecário da Sede',
  position: at(5.0, -0.8),
  faceRotation: Math.PI / 2,
  look: { species: 'tanuki', fur: '#8C7A62', belly: '#E9DCC6', scale: 0.9, mask: '#4A3D32', eyes: 'round' },
  voice: 'chitter',
  offers: [{ mission: 'pergaminho', when: { done: 'audiencia' } }],
  barks: ['Shhh. Biblioteca.', 'Livro fora do lugar é livro perdido.', 'Nada de chá perto dos livros. NADA.'],
  routes: [
    { when: { active: 'pergaminho', flag: 'biblioteca_aberta', notStep: 'pergaminho.artefato' }, tree: say('Fumi',
      'A estante abriu! Mas cuidado: o chão da sala reservada é de rouxinol, igual ao da Academia.\nAtravesse agachado, ou as tábuas cantam e você volta para cá.') },
    { when: { active: 'pergaminho' }, tree: say('Fumi', 'O poema está no catálogo, ali perto dos cinco livros coloridos. Leia com atenção: a ordem tem que bater com TODAS as frases.') },
    { when: { notStarted: 'pergaminho', done: 'audiencia' }, tree: {
      start: {
        id: 'start', speaker: 'Fumi',
        text: 'Shhh. Sou o Fumi, bibliotecário. Quer ouvir um segredo?\nDizem que uma das estantes esconde a sala do Pergaminho da Fundação. A pista é um poema no catálogo... que ninguém nunca entendeu.',
        options: [
          { label: '📚 Eu vou descobrir!', nextNodeId: null, action: 'START:pergaminho;STEP:pergaminho.ouvir' },
          { label: 'Shhh, depois', nextNodeId: null },
        ],
      },
    } },
    { when: { done: 'pergaminho' }, tree: say('Fumi', 'O pergaminho voltou a ser lido depois de tantos anos. Uma biblioteca serve para isso.') },
    { tree: say('Fumi', 'Shhh. Os livros estão dormindo.') },
  ],
};

export const SEDE_NPCS: NPCDefinition[] = [MIKAGE, TOSHI, YUKI, FUMI];
