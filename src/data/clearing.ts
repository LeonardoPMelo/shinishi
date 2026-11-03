import type { Challenge, DialogueOption, DialogueTree, Mission, NPCDefinition } from '../types';
import type { WorldObject } from './world';
import { MEADOW } from './south';

/**
 * A Clareira dos Cervos: the far end of the Bosque Antigo, where the village ends. The gate in the south fence
 * (it used to be Mikage's, before the residence moved to the Bairro das Glicínias) is now the way out: a
 * rustic gate of stone and logs, and past it a trail through thick forest, over a brook, to where the trees
 * close in and the wild lands begin. Walking to the end of the trail takes the cat there (the wild lands are
 * a zone of their own, game/systems/zone.ts); the Batedora Kaze checks travellers before they go.
 */

/** The gate in the south fence (TRAIL_GATE in data/wild.ts stands here). */
export const EXIT_GATE = { x: -9.0, z: 64.0, halfWidth: 1.6 };
/** The trail past the gate: where the cat may walk, and the line that takes it to the wild lands. */
export const EXIT_TRAIL = { x0: -11.4, x1: -6.6, z0: 63.4, z1: 70.8 };
export const EXIT_TRIGGER_Z = 69.8;
/** The brook across the trail, with its stepping stones. */
export const EXIT_BROOK = { z: 66.9, halfWidth: 0.55 };
export const EXIT_BROOK_STONES: [number, number][] = [[-9.5, 66.6], [-8.6, 67.2]];
/** The path from the meadow to the gate (joined to SOUTH_PATHS). */
export const CLEARING_PATH: [number, number][] = [[-11.2, 52.4], [-10.6, 57.6], [-9.0, 61.0], [-9.0, 64.0]];

/** Every deer in the clearing: the meadow herd and the family by the gate. Fawns are the small ones. */
export const CLEARING_DEER: { x: number; z: number; rot: number; s: number; phase: number }[] = [
  { x: MEADOW.x - 1.0, z: MEADOW.z + 0.6, rot: 0.6, s: 1, phase: 0 },
  { x: MEADOW.x + 1.2, z: MEADOW.z + 1.2, rot: 2.4, s: 0.92, phase: 1.7 },
  { x: MEADOW.x + 0.2, z: MEADOW.z - 1.1, rot: -1.0, s: 0.6, phase: 3.1 },
  { x: -15.6, z: 60.2, rot: 1.2, s: 1.05, phase: 0.8 },
  { x: -14.4, z: 61.4, rot: 2.9, s: 0.58, phase: 2.3 },
  { x: -16.4, z: 61.8, rot: -0.4, s: 0.62, phase: 1.1 },
  { x: -5.2, z: 59.4, rot: -2.2, s: 0.95, phase: 2.6 },
];
export const FAWN_SCALE = 0.75;
export const FAWNS = CLEARING_DEER.filter((d) => d.s < FAWN_SCALE).length;
/** Walking past the end of the trail (game/world/ExitTrail.tsx) does what the gate does. */
export const CLEARING_CODE_ACTIONS: Record<string, string> = { trilha: 'STEP:trilha.portao;TRAVEL:selvagem' };

const say = (speaker: string, text: string, options: DialogueOption[] = [{ label: 'Ok', nextNodeId: null }], onEnter?: string): DialogueTree => ({
  start: { id: 'start', speaker, text, onEnter, options },
});

export const KAZE: NPCDefinition = {
  id: 'kaze',
  name: 'Batedora Kaze',
  role: 'Batedora da Expedição',
  position: [-6.9, 0, 61.4],
  faceRotation: Math.PI,
  look: { species: 'cat', fur: '#B5653A', belly: '#F2DCC4', scale: 0.95, stripes: '#8A4526', eyes: 'sharp', accessory: 'explorer', outfit: '#4F6B52' },
  voice: 'meow',
  barks: ['Daqui para frente, a vila acaba e a aventura começa.', 'Mochila leve, olhos abertos, patas prontas.', 'Os cervos sabem quando vai chover. Eu só sei quando já choveu.'],
  reactions: [
    { when: { done: 'antes_de_partir' }, barks: ['Boa trilha, batedor! E volte inteiro, combinado?'] },
    { when: { step: 'trilha.portao' }, barks: ['De volta das Terras Selvagens? Conta tudo! Quer dizer, depois. Eu estou de guarda.'] },
  ],
  offers: [{ mission: 'antes_de_partir', when: { done: 'audiencia' } }],
  routes: [
    { when: { done: 'audiencia', notStarted: 'antes_de_partir' }, tree: {
      start: {
        id: 'start', speaker: 'Batedora Kaze',
        text: 'Opa! Eu sou a Kaze, batedora da Conselheira Yuki. Este portão é a saída da vila: depois dele, a trilha leva às Terras Selvagens.\nAntes de alguém passar por aqui, eu faço duas perguntas. Regra da expedição!',
        options: [{ label: 'Pode perguntar!', nextNodeId: 'regras' }],
      },
      regras: {
        id: 'regras', speaker: 'Batedora Kaze',
        text: 'Primeira: um batedor sabe OBSERVAR. Vá até o tronco caído na beira da clareira e conte os filhotes de cervo (os pequenininhos).\nSegunda: um batedor sabe o que fazer quando as coisas apertam. Essa eu pergunto aqui.',
        options: [{ label: '🦌 Vou observar!', nextNodeId: null, action: 'START:antes_de_partir;STEP:antes_de_partir.ouvir;TRACK:antes_de_partir' }],
      },
    } },
    { when: { step: 'antes_de_partir.ouvir', notStep: 'antes_de_partir.regras' }, tree: say('Batedora Kaze',
      'Pergunta de batedor: você está na trilha, seus corações estão quase acabando e um javali bloqueia o caminho. O que você faz?',
      [{ label: '💭 Responder', nextNodeId: null, action: 'CHALLENGE:regras_trilha' }, { label: 'Depois eu respondo', nextNodeId: null }]) },
    { when: { step: ['antes_de_partir.cervos', 'antes_de_partir.regras'], notStep: 'antes_de_partir.pronto' }, tree: say('Batedora Kaze',
      'Olhos atentos e cabeça fria: é disso que a expedição precisa.\nToma: uma Poção de Ervas para a mochila. E lembre: voltar também é parte da aventura.',
      [{ label: '🧉 Obrigado, Kaze!', nextNodeId: null, action: 'STEP:antes_de_partir.pronto' }]) },
    { when: { active: 'antes_de_partir' }, tree: say('Batedora Kaze', 'O tronco caído fica na beira da clareira, a oeste do caminho. Conte só os filhotes: os cervos pequenininhos.') },
    { when: { notStep: 'trilha.ouvir' }, tree: say('Batedora Kaze',
      'O portão fica fechado até a Sede autorizar uma expedição. Regra da Conselheira Yuki: ninguém vai para as Terras Selvagens sem plano.\nEnquanto isso, aproveite os cervos. Eles adoram quando a gente fica quietinho.') },
    { tree: say('Batedora Kaze', 'A trilha segue pelo meio da floresta, atravessa o riacho e chega às Terras Selvagens. É só caminhar até o fim.\nSe as coisas apertarem lá fora, o acampamento da expedição é o seu porto seguro.') },
  ],
};

export const CLEARING_CHALLENGES: Challenge[] = [
  {
    id: 'cervos_filhotes', skill: 'adicao', kind: 'number', title: 'Os Filhotes da Clareira',
    story: `Do tronco caído dá para ver toda a Clareira dos Cervos: a manada da campina dos cogumelos e a família que pasta perto do portão.\nOs filhotes são os cervos pequenininhos, com menos da metade da altura dos adultos.`,
    question: 'Quantos filhotes de cervo há na clareira, somando os dois grupos?',
    answer: FAWNS,
    observe: 'Conte cada grupo separado e depois some. Os filhotes são os bem menores.',
    hint: 'Na campina dos cogumelos há um filhote. Perto do portão, uma mamãe cervo está com mais dois.',
    example: 'Parecido: 2 patinhos num lago e 3 no outro: 2 + 3 = 5 patinhos.',
    successText: `🦌 ${FAWNS} filhotes! Um batedor que conta direito sabe quantos bichos precisa proteger na trilha.`,
    onSuccess: 'STEP:antes_de_partir.cervos;SKILL:adicao',
  },
  {
    id: 'regras_trilha', skill: 'logica', kind: 'choice', title: 'Regra de Batedor',
    story: 'Você está na trilha das Terras Selvagens. Seus corações estão quase acabando e um javali enorme bloqueia o caminho.',
    question: 'O que um bom batedor faz?',
    choices: ['Ataca de qualquer jeito', 'Recua, toma uma poção ou volta ao acampamento, e planeja de novo', 'Grita bem alto até o javali ir embora', 'Fica parado esperando'],
    answer: 1,
    observe: 'Pense no que mantém você seguro E deixa você tentar de novo depois.',
    hint: 'Com poucos corações, o mais importante é se recuperar. O javali não vai a lugar nenhum.',
    example: 'Parecido: no meio de uma prova difícil, respirar e reler a pergunta funciona melhor do que chutar tudo.',
    successText: '🧭 Isso! Recuar para se recuperar não é desistir: é planejar. Batedor esperto volta para contar a história.',
    onSuccess: 'STEP:antes_de_partir.regras',
  },
];

export const CLEARING_MISSIONS: Mission[] = [
  {
    id: 'antes_de_partir',
    chapter: 6,
    title: 'Antes de Partir',
    category: 'treinamento',
    giver: 'kaze',
    description: 'A Batedora Kaze guarda a saída da vila, na Clareira dos Cervos. Antes de alguém seguir para as Terras Selvagens, ela faz duas perguntas.',
    steps: [
      { id: 'ouvir', description: 'Ouça a Batedora Kaze no portão da Clareira dos Cervos (fim do Bosque Antigo)', target: { npc: 'kaze' } },
      { id: 'cervos', description: 'Conte os filhotes de cervo do tronco caído', after: ['ouvir'], target: { object: 'tronco_cervos' } },
      { id: 'regras', description: 'Responda à pergunta de batedor da Kaze', after: ['ouvir'], target: { npc: 'kaze' } },
      { id: 'pronto', description: 'Volte à Batedora Kaze', after: ['cervos', 'regras'], target: { npc: 'kaze' } },
    ],
    rewards: { xp: 50, coins: 15, items: { pocao_cura: 1 }, badges: ['Batedor Prudente'] },
    lesson: 'Antes de uma aventura: observar com calma e saber recuar quando é preciso. Coragem com cuidado vai mais longe.',
  },
];

export const CLEARING_OBJECTS: WorldObject[] = [
  {
    id: 'placa_saida', kind: 'sign', position: [-11.9, 0, 62.4], label: 'Ler a placa', name: 'Saída da Vila',
    dialogue: say('Saída da Vila', '🪧 SAÍDA DA VILA DAS PATAS\n↓ Terras Selvagens (pela Trilha da Expedição)   ·   ↑ Bosque Antigo e Vila\n"Daqui em diante, a floresta manda. Leve uma poção, volte antes do escuro."'),
  },
  {
    id: 'tronco_cervos', kind: 'examine', position: [-15.6, 0, 57.4], label: 'Observar os cervos', name: 'Tronco caído', radius: 1.6, priority: 1,
    when: { step: 'antes_de_partir.ouvir', notStep: 'antes_de_partir.cervos' },
    actions: 'CHALLENGE:cervos_filhotes',
  },
  {
    id: 'tronco_cervos_vista', kind: 'examine', position: [-15.6, 0, 57.4], label: 'Sentar no tronco', name: 'Tronco caído', radius: 1.6,
    dialogue: say('Tronco caído', 'Daqui dá para ver a clareira inteira: os cervos pastando, a campina dos cogumelos e o portão da saída lá no fundo.'),
  },
];

export const CLEARING_NPCS: NPCDefinition[] = [KAZE];
