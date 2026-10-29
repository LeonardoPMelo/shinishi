import type { Challenge, DialogueTree, Item, Mission, NPCDefinition } from '../types';
import type { WorldObject } from './world';
import { INTERIORS_BY_ID, toWorld } from './interiors';
import type { OrderPuzzle } from '../systems/orderPuzzle';
import type { CircuitDef } from '../systems/academy';

/**
 * A Academia Ninja (Etapa 5 da expansão), inside the dojo on the plaza's north-east. It teaches by doing:
 *  - Circuito das Patas (Professor Haru): platforms, a balance beam and an optional high route, against the clock;
 *  - Corredor do Rouxinol (Haru): a nightingale floor, crossed crouching (a real piece of Japanese history);
 *  - Sala da Lógica (Professora Sumi): levers pulled in the order the clues allow (always exactly one);
 *  - Sala dos Números (Sumi): a board of three problems of growing difficulty, plus an optional extra one.
 * One seal for each; with the four, the graduation: a band, a technique (Passo Leve), and the key to Mikage's
 * residence. The room is in data/interiors.ts; the rules of the body tests and puzzles in systems/.
 */

const A = INTERIORS_BY_ID.academia;

const say = (speaker: string, text: string, options?: DialogueTree['start']['options'], onEnter?: string): DialogueTree => ({
  start: { id: 'start', speaker, text, onEnter, options: options ?? [{ label: 'Ok', nextNodeId: null }] },
});

// ── The body tests (room coordinates) ─────────────────────────────────────────
export const CIRCUIT: CircuitDef = {
  start: { at: [4.2, 5.0], r: 0.9, minY: -1 },
  checkpoints: [
    { name: 'Plataforma baixa', options: [{ at: [7.0, 3.0], r: 0.85, minY: 0.45 }] },
    { name: 'Plataforma média', options: [{ at: [7.0, 0.0], r: 0.85, minY: 1.05 }] },
    {
      name: 'Fim da viga (ou a torre alta)',
      options: [{ at: [7.0, -5.1], r: 0.75, minY: 1.05 }, { at: [4.6, -2.0], r: 0.65, minY: 2.75 }],
    },
    { name: 'Plataforma alta', options: [{ at: [2.9, -5.2], r: 0.85, minY: 1.65 }] },
    { name: 'Chegada', options: [{ at: [4.2, 5.0], r: 0.9, minY: -1 }] },
  ],
  area: { minX: 1.2, maxX: 8.5, minZ: -6.5, maxZ: 6.5 },
  // a clean run measured in play: 8.4 s; first tries by hand take a good deal longer
  medals: { ouro: 13, prata: 22 },
};

/** The nightingale boards (room coordinates) and where a caught cat goes back to. */
export const NIGHTINGALE = { rect: [-1.2, -5.4, 1.2, -0.4] as [number, number, number, number], back: [0, 1.0] as [number, number] };

export const LEVER_SYMBOLS: Record<string, { icon: string; name: string }> = {
  peixe: { icon: '🐟', name: 'Peixe' },
  lua: { icon: '🌙', name: 'Lua' },
  folha: { icon: '🍃', name: 'Folha' },
  sino: { icon: '🔔', name: 'Sino' },
};
/** Where each lever stands (room coordinates, north wall of the logic room). */
export const LEVER_SPOTS: Record<string, [number, number]> = {
  peixe: [-7.2, -5.95],
  lua: [-5.9, -5.95],
  folha: [-4.6, -5.95],
  sino: [-3.3, -5.95],
};

export const LEVER_ROUNDS: OrderPuzzle[] = [
  {
    id: 'alavancas_1',
    pieces: ['peixe', 'lua', 'sino'],
    rules: [
      { text: 'O sino toca por último.', rule: { kind: 'last', a: 'sino' } },
      { text: 'O peixe vem antes da lua.', rule: { kind: 'before', a: 'peixe', b: 'lua' } },
    ],
  },
  {
    id: 'alavancas_2',
    pieces: ['peixe', 'lua', 'folha', 'sino'],
    rules: [
      { text: 'A folha não é a primeira.', rule: { kind: 'notFirst', a: 'folha' } },
      { text: 'A folha não é a última.', rule: { kind: 'notLast', a: 'folha' } },
      { text: 'A lua vem logo depois do sino.', rule: { kind: 'rightAfter', a: 'lua', b: 'sino' } },
      { text: 'O peixe vem antes da folha.', rule: { kind: 'before', a: 'peixe', b: 'folha' } },
    ],
  },
];
/** What solving each round does. */
export const LEVER_SOLVED = ['FLAG:alavancas_1;SFX:mechanism;SKILL:logica', 'FLAG:alavancas_2;STEP:academia.logica;SFX:mechanism;SKILL:logica;GEMS:2'];
/** Finishing the circuit while enrolled. */
export const CIRCUIT_DONE = 'STEP:academia.circuito';

/** Every action the academy's 3D components run (checked by systems/validateData.ts). */
export const ACADEMY_CODE_ACTIONS: Record<string, string> = {
  alavancas_1: LEVER_SOLVED[0],
  alavancas_2: LEVER_SOLVED[1],
  circuito: CIRCUIT_DONE,
};

// ── Items ─────────────────────────────────────────────────────────────────────
export const ACADEMY_ITEMS: Item[] = [
  {
    id: 'faixa_academia', name: 'Faixa Índigo da Academia', icon: '🎓', band: '#2E3A78', rarity: 'raro',
    description: 'Entregue na formatura da Academia Ninja. Bordado na ponta: uma patinha e a palavra "persistência".',
  },
];

// ── Challenges (the numbers board) ────────────────────────────────────────────
export const ACADEMY_CHALLENGES: Challenge[] = [
  {
    id: 'acad_sequencia', skill: 'padroes', kind: 'number', title: 'Quadro dos Números · 1',
    story: 'No quadro da Professora Sumi: 2, 5, 11, 23, ...\nCada número sai do anterior sempre pela mesma regra.',
    question: 'Qual é o próximo número?',
    answer: 47,
    observe: 'Compare cada número com o anterior: o 5 com o 2, o 11 com o 5. Ele cresce somando sempre o mesmo? Ou outra coisa?',
    hint: 'A regra é "dobrar e somar 1": 2 × 2 + 1 = 5; 5 × 2 + 1 = 11. Faça o mesmo com o 23.',
    example: 'Parecido: 1, 3, 7, 15... cada um é o dobro do anterior mais 1. O próximo é 15 × 2 + 1 = 31.',
    successText: '✨ 47! 23 × 2 + 1 = 47. Achar a regra é metade da lógica ninja.',
    onSuccess: 'FLAG:academia_num1;COUNT:academia_numeros',
  },
  {
    id: 'acad_fracoes', skill: 'fracoes', kind: 'number', title: 'Quadro dos Números · 2',
    story: 'A academia recebeu 36 bolinhos de arroz para o acampamento.\n1/3 vai para os alunos novos e 1/4 para os instrutores. O resto fica com a turma do Shinichi.',
    question: 'Quantos bolinhos ficam com a turma do Shinichi?',
    answer: 15,
    observe: 'Calcule cada parte separada: um terço de 36 e um quarto de 36. Depois veja quanto sobra.',
    hint: '1/3 de 36 = 36 ÷ 3 = 12. 1/4 de 36 = 36 ÷ 4 = 9. Agora: 36 − 12 − 9.',
    example: 'Parecido: 24 peixes; 1/2 para o almoço (12) e 1/4 para o jantar (6). Sobram 24 − 12 − 6 = 6.',
    successText: '🍙 15 bolinhos! 36 − 12 − 9 = 15. A turma vai acampar de barriga cheia.',
    onSuccess: 'FLAG:academia_num2;COUNT:academia_numeros',
  },
  {
    id: 'acad_medidas', skill: 'divisao', kind: 'number', title: 'Quadro dos Números · 3',
    story: 'Para a ponte de treino, cada tábua mede 40 centímetros.\nO vão entre as duas pedras tem 3 metros e 20 centímetros.',
    question: 'Quantas tábuas, uma depois da outra, cobrem o vão exatamente?',
    answer: 8,
    observe: 'Antes de dividir, coloque as duas medidas na mesma unidade. 1 metro tem 100 centímetros.',
    hint: '3 m e 20 cm = 300 + 20 = 320 cm. Quantas vezes o 40 cabe no 320?',
    example: 'Parecido: um vão de 2 metros (200 cm) e tábuas de 50 cm: 200 ÷ 50 = 4 tábuas.',
    successText: '🪵 8 tábuas! 320 ÷ 40 = 8. Medir certo antes de cortar poupa madeira (e dedos).',
    onSuccess: 'FLAG:academia_num3;COUNT:academia_numeros',
  },
  {
    id: 'acad_extra', skill: 'algebra', kind: 'number', title: 'Desafio extra da Sumi',
    story: 'Desafio opcional, para quem gosta de quebrar a cabeça:\n"Pensei num número. Multipliquei por 3 e depois somei 4. Deu 31."',
    question: 'Em que número a Professora Sumi pensou?',
    answer: 9,
    observe: 'Desfaça as contas de trás para frente: a última coisa que ela fez foi somar 4.',
    hint: 'Tire o 4: 31 − 4 = 27. A primeira coisa foi "vezes 3": desfaça com uma divisão.',
    example: 'Parecido: "multipliquei por 2 e somei 5, deu 17". 17 − 5 = 12, e 12 ÷ 2 = 6.',
    successText: '🧠 9! 9 × 3 = 27, 27 + 4 = 31. Desfazer contas é o começo da álgebra.',
    onSuccess: 'FLAG:academia_num4;GEMS:2',
  },
];

// ── The mission ───────────────────────────────────────────────────────────────
export const ACADEMY_MISSIONS: Mission[] = [
  {
    id: 'academia',
    chapter: 5,
    title: 'A Academia Ninja',
    category: 'treinamento',
    giver: 'sumi',
    description: 'A Academia Ninja abriu as portas no dojô. Quatro provas, quatro selos e, no fim, a formatura.',
    steps: [
      { id: 'matricula', description: 'Matricule-se com a Professora Sumi (dentro do dojô)', target: { npc: 'sumi' } },
      { id: 'numeros', description: 'Selo dos Números: resolva o quadro da Sala dos Números', after: ['matricula'], target: { object: 'quadro_numeros_1' }, counter: { id: 'academia_numeros', goal: 3 } },
      { id: 'logica', description: 'Selo da Lógica: puxe as alavancas na ordem certa (Sala da Lógica)', after: ['matricula'], target: { object: 'quadro_pistas_1' } },
      { id: 'rouxinol', description: 'Selo do Silêncio: atravesse o Corredor do Rouxinol sem fazer as tábuas cantarem', after: ['matricula'], target: { object: 'pergaminho_rouxinol' } },
      { id: 'circuito', description: 'Selo do Movimento: complete o Circuito das Patas', after: ['matricula'], target: { npc: 'haru' } },
      { id: 'formatura', description: 'Volte à Professora Sumi para a formatura', after: ['numeros', 'logica', 'rouxinol', 'circuito'], target: { npc: 'sumi' } },
    ],
    rewards: { xp: 120, coins: 40, gems: 4, badges: ['Graduado da Academia'], items: { faixa_academia: 1 }, ability: 'passo_leve' },
    lesson: 'Cada prova treinou uma coisa: achar regras (números), deduzir com pistas (lógica), controlar o corpo (silêncio) e planejar o caminho (circuito). Errar fez parte de todas.',
    onComplete: 'FLAG:graduado_academia;START:audiencia;TRACK:audiencia',
  },
];

// ── Objects ───────────────────────────────────────────────────────────────────
const enrolled = { active: 'academia', step: 'academia.matricula' } as const;

export const ACADEMY_OBJECTS: WorldObject[] = [
  // the numbers board: one problem at a time (each exists only in its turn)
  {
    id: 'quadro_numeros_0', kind: 'examine', position: toWorld(A, -7.9, 3.2), label: 'Olhar o quadro', name: 'Quadro dos Números', radius: 1.7,
    when: { notStarted: 'academia' },
    dialogue: say('Quadro dos Números', 'Números escritos com giz, setas e um desenho de peixe de óculos.\nEmbaixo: "Para tentar, faça a matrícula com a Professora Sumi."'),
  },
  {
    id: 'quadro_numeros_1', kind: 'examine', position: toWorld(A, -7.9, 3.2), label: 'Resolver o problema 1 do quadro', name: 'Quadro dos Números', radius: 1.7,
    when: { ...enrolled, notFlag: 'academia_num1' }, actions: 'CHALLENGE:acad_sequencia',
  },
  {
    id: 'quadro_numeros_2', kind: 'examine', position: toWorld(A, -7.9, 3.2), label: 'Resolver o problema 2 do quadro', name: 'Quadro dos Números', radius: 1.7,
    when: { flag: 'academia_num1', notFlag: 'academia_num2' }, actions: 'CHALLENGE:acad_fracoes',
  },
  {
    id: 'quadro_numeros_3', kind: 'examine', position: toWorld(A, -7.9, 3.2), label: 'Resolver o problema 3 do quadro', name: 'Quadro dos Números', radius: 1.7,
    when: { flag: 'academia_num2', notFlag: 'academia_num3' }, actions: 'CHALLENGE:acad_medidas',
  },
  {
    id: 'quadro_numeros_4', kind: 'examine', position: toWorld(A, -7.9, 3.2), label: 'Desafio extra (opcional)', name: 'Quadro dos Números', radius: 1.7,
    when: { flag: 'academia_num3', notFlag: 'academia_num4' }, actions: 'CHALLENGE:acad_extra',
  },
  // the clues for the levers
  {
    id: 'quadro_pistas_1', kind: 'clue', position: toWorld(A, -7.9, -3.2), label: 'Ler as pistas das alavancas', name: 'Pistas da Professora Sumi', radius: 1.7,
    when: { notFlag: 'alavancas_1' },
    dialogue: say('Pistas da Professora Sumi',
      'Rodada 1 · Puxe as alavancas do 🐟 Peixe, da 🌙 Lua e do 🔔 Sino, uma de cada vez:\n• O sino toca por último.\n• O peixe vem antes da lua.',
      [{ label: 'Entendi. Às alavancas!', nextNodeId: null }]),
  },
  {
    id: 'quadro_pistas_2', kind: 'clue', position: toWorld(A, -7.9, -3.2), label: 'Ler as pistas da rodada 2', name: 'Pistas da Professora Sumi', radius: 1.7,
    when: { flag: 'alavancas_1', notFlag: 'alavancas_2' },
    dialogue: say('Pistas da Professora Sumi',
      'Rodada 2 · Agora são as quatro: 🐟 Peixe, 🌙 Lua, 🍃 Folha e 🔔 Sino.\n• A folha não é a primeira nem a última.\n• A lua vem logo depois do sino.\n• O peixe vem antes da folha.',
      [{ label: 'Vou pensar com calma.', nextNodeId: null }]),
  },
  {
    id: 'quadro_pistas_3', kind: 'examine', position: toWorld(A, -7.9, -3.2), label: 'Olhar o quadro de pistas', name: 'Pistas da Professora Sumi', radius: 1.7,
    when: { flag: 'alavancas_2' },
    dialogue: say('Pistas da Professora Sumi', 'Embaixo das pistas, a Sumi escreveu com letra caprichada:\n"Quem testa uma ideia e descarta o que não serve já está pensando como um ninja."'),
  },
  // the scroll at the end of the nightingale corridor
  {
    id: 'pergaminho_rouxinol', kind: 'clue', position: toWorld(A, 0, -5.95), label: 'Pegar o pergaminho do silêncio', name: 'Pergaminho do Rouxinol', radius: 1.3,
    when: { active: 'academia', step: 'academia.matricula', notStep: 'academia.rouxinol' },
    dialogue: {
      start: {
        id: 'start', speaker: 'Pergaminho do Rouxinol',
        text: 'Escrito pelo Professor Haru:\n"No Japão de verdade, o Castelo Nijō, em Kyoto, tem corredores de chão-rouxinol. As tábuas cantam quando alguém pisa, para avisar os guardas. Você atravessou o nosso em silêncio."',
        onEnter: 'STEP:academia.rouxinol;SFX:chime',
        options: [{ label: '🐾 Selo do Silêncio!', nextNodeId: null }],
      },
    },
  },
];

// ── People ────────────────────────────────────────────────────────────────────
export const SUMI: NPCDefinition = {
  id: 'sumi',
  name: 'Professora Sumi',
  role: 'Diretora da Academia · números e lógica',
  position: toWorld(A, -6.7, 1.7),
  faceRotation: Math.PI / 2,
  look: { species: 'cat', fur: '#2E2A2E', belly: '#E9E2D6', scale: 1.0, mask: '#2E2A2E', eyes: 'round' },
  voice: 'meow_low',
  offers: [{ mission: 'academia', when: { done: 'templo' } }],
  barks: ['Errar é só o primeiro passo do acerto.', 'Quem conta direito não perde o bolinho.', 'Se a resposta tem regra, eu quero ver a regra!'],
  routes: [
    { when: { active: 'academia', step: ['academia.numeros', 'academia.logica', 'academia.rouxinol', 'academia.circuito'], notStep: 'academia.formatura' }, tree: {
      start: {
        id: 'start', speaker: 'Professora Sumi', mood: 'happy',
        text: 'Quatro selos! Números, lógica, silêncio e movimento.\nShinichi, nem tudo dá certo de primeira, e ninguém acerta sempre. O que faz um ninja é tentar de novo, e de novo.',
        options: [{ label: '🎓 Receber a formatura', nextNodeId: 'faixa' }],
      },
      faixa: {
        id: 'faixa', speaker: 'Professora Sumi', mood: 'happy',
        text: 'Esta é a Faixa Índigo da Academia, e o Haru vai te ensinar o Passo Leve: agachado, você anda mais rápido e em silêncio.\nE tem mais: o Mikage, o líder da vila, pediu para conhecer você. A Sede fica no fim da Floresta do Treinamento, ao sul, depois do riacho.',
        options: [{ label: '🐾 Obrigado, professora!', nextNodeId: null, action: 'STEP:academia.formatura' }],
      },
    } },
    { when: { active: 'academia' }, tree: {
      start: {
        id: 'start', speaker: 'Professora Sumi',
        text: 'Quatro provas, um selo cada:\n• Números: o quadro aqui atrás, três problemas.\n• Lógica: as alavancas na sala ao norte.\n• Silêncio: o Corredor do Rouxinol.\n• Movimento: o Circuito das Patas, com o Professor Haru.',
        options: [{ label: 'Pode deixar!', nextNodeId: null }],
      },
    } },
    { when: { notStarted: 'academia', done: 'templo' }, tree: {
      start: {
        id: 'start', speaker: 'Professora Sumi',
        text: 'Bem-vindo à Academia Ninja! Eu sou a Sumi, diretora e professora de números e lógica.\nAqui a gente aprende fazendo: pulando, pensando, contando. Quer se matricular?',
        options: [
          { label: '📝 Quero me matricular!', nextNodeId: null, action: 'START:academia;STEP:academia.matricula' },
          { label: 'Só estou olhando', nextNodeId: null },
        ],
      },
    } },
    { when: { notStarted: 'academia' }, tree: say('Professora Sumi', 'As matrículas abrem quando o Templo dos Enigmas for desvendado: a Tsubaki diz que é a melhor aula de lógica da vila.\nEnquanto isso, pode experimentar o circuito e o corredor à vontade!') },
    { when: { active: 'audiencia' }, tree: say('Professora Sumi', 'O Mikage espera por você! O portão da Sede fica no fim da Floresta do Treinamento, ao sul: atravesse a ponte do riacho e siga reto.') },
    { tree: say('Professora Sumi', 'O quadro tem um desafio extra, se você quiser. E as alavancas voltam ao lugar sozinhas: pode jogar de novo quando quiser.') },
  ],
};

export const HARU: NPCDefinition = {
  id: 'haru',
  name: 'Professor Haru',
  role: 'Professor de movimento e furtividade',
  position: toWorld(A, 3.0, 3.0),
  faceRotation: 0,
  look: { species: 'cat', fur: '#D9A15B', belly: '#FFF1DC', scale: 0.95, mask: '#B87A3A', eyes: 'round' },
  voice: 'meow_high',
  barks: ['Joelhos dobrados, olhos no próximo pulo!', 'Um, dois, PULA!', 'Agachado, o chão nem percebe você.'],
  routes: [
    { when: { active: 'academia', step: 'academia.matricula' }, tree: {
      start: {
        id: 'start', speaker: 'Professor Haru',
        text: 'Opa, aluno novo! Eu cuido das provas do corpo. Sobre qual você quer saber?',
        options: [
          { label: '🏃 O Circuito das Patas', nextNodeId: 'circuito' },
          { label: '🐦 O Corredor do Rouxinol', nextNodeId: 'rouxinol' },
          { label: 'Já sei tudo!', nextNodeId: null },
        ],
      },
      circuito: {
        id: 'circuito', speaker: 'Professor Haru',
        text: 'Fique no tapete da largada e aperte E na lanterna para começar.\nPlataforma baixa, média, a viga de equilíbrio, os degraus até a plataforma alta e de volta ao tapete.\nQuem tem salto duplo pode cortar caminho pela torre alta!',
        options: [{ label: 'E as medalhas?', nextNodeId: 'medalhas' }, { label: 'Bora!', nextNodeId: null }],
      },
      medalhas: {
        id: 'medalhas', speaker: 'Professor Haru',
        text: 'Até 13 segundos: ouro. Até 22: prata. Completou: bronze, e o selo é seu do mesmo jeito.\nCair da viga não zera nada: é só subir de novo.',
        options: [{ label: 'Bora!', nextNodeId: null }],
      },
      rouxinol: {
        id: 'rouxinol', speaker: 'Professor Haru',
        text: 'As tábuas do corredor cantam como passarinho quando alguém pisa forte: é o chão-rouxinol.\nNo segundo "piu", eu ouço e você volta para o começo.\nO segredo: atravesse AGACHADO (C ou Ctrl, LT no controle, 🐾 no celular).',
        options: [{ label: 'Silêncio total!', nextNodeId: null }],
      },
    } },
    { when: { done: 'academia' }, tree: say('Professor Haru', 'Graduado! Agora com o Passo Leve, você anda agachado quase tão rápido quanto andando.\nO circuito continua aqui: tente bater o seu tempo!') },
    { tree: say('Professor Haru', 'Quer treinar? Matricule-se com a Professora Sumi, na Sala dos Números!') },
  ],
};

export const ACADEMY_NPCS: NPCDefinition[] = [SUMI, HARU];
