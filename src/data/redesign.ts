import type { Challenge, DialogueOption, DialogueTree, Item, Vec3 } from '../types';
import type { WorldObject } from './world';

/**
 * Redesign of the three thin chapter-1 missions (§28): each one now has something to do in the world,
 * not just a conversation. The step ids that existed before are kept, so saves stay valid.
 *
 *  - mei_coragem: the stone pillars in the training forest (data/world.ts PILLARS) go up by the same
 *    0.6 m each time; seeing the pattern makes the climb less scary. Climb them and ring the bell on top.
 *  - contas: price → carry the apples across the village to Dona Neko → change → the "take 3, pay 2" deal.
 *  - kuro: three clues in the forest and a stone carved with a number code before Kuro shows himself.
 */

const bye = (label = 'Até mais!'): DialogueOption => ({ label, nextNodeId: null });
const say = (speaker: string, text: string, options: DialogueOption[] = [bye()], onEnter?: string): DialogueTree => ({
  start: { id: 'start', speaker, text, options, onEnter },
});

// ── A Coragem da Luna ─────────────────────────────────────────────────────────

/** Pillar heights, same as PILLARS in world.ts (kept here so the challenge text can't drift). */
export const PILLAR_HEIGHTS = [0.6, 1.2, 1.8, 2.4];
export const PILLAR_STEP = 0.6;
/** The bell on the rim of the tallest pillar ([-13.8, 0, 35.4], 2.4 m), on the side facing Luna: the
 *  forest chest already sits in the middle of that pillar top. */
export const PILLAR_BELL: Vec3 = [-13.35, 2.4, 34.95];
/** Luna waits at the foot of the first pillar now (was by the tatami mats). */
export const LUNA_FOREST: Vec3 = [-8.0, 0, 31.8];

// ── As Contas do Boku ────────────────────────────────────────────────────────

export const APPLES = { count: 3, price: 4, paid: 20 };
export const DEAL = { wants: 6, take: 3, pay: 2, price: APPLES.price };
/** What Seu Bigodes pays for 6 apples with "take 3, pay 2": 2 groups of 3, paying 2 in each → 4 apples. */
export const DEAL_TOTAL = (DEAL.wants / DEAL.take) * DEAL.pay * DEAL.price;

// ── A Sombra na Floresta ─────────────────────────────────────────────────────

/** "MESTRE" with A = 1, B = 2, ... */
export const KURO_CODE = [13, 5, 19, 20, 18, 5];
export const KURO_WORD = KURO_CODE.map((n) => String.fromCharCode(64 + n)).join('');

const CLUES: { id: string; pos: Vec3; label: string; text: string }[] = [
  { id: 'kuro_pista_pegadas', pos: [8.4, 0, 33.0], label: 'Examinar as pegadas',
    text: 'Pegadas de gato na terra úmida. Grandes, firmes... e todas apontam para o leste da floresta.\nQuem passou aqui não estava com pressa.' },
  { id: 'kuro_pista_fio', pos: [15.0, 0, 29.0], label: 'Examinar o fio vermelho',
    text: 'Um fio de lã vermelha preso num galho, na altura de um cachecol.\nO mesmo vermelho do cachecol que viram na floresta.' },
  { id: 'kuro_pista_pena', pos: [11.6, 0, 37.2], label: 'Examinar a pena',
    text: 'Uma pena preta enfiada na terra, como um marcador.\nAo lado, alguém riscou uma seta com a garra: aponta para uma pedra entalhada.' },
];

export const REDESIGN_OBJECTS: WorldObject[] = [
  {
    id: 'sino_pilar', kind: 'examine', position: PILLAR_BELL, label: 'Tocar o sino', name: 'Sino dos pilares', radius: 1.2,
    usableWhen: { active: 'mei_coragem', step: 'mei_coragem.medir', notStep: 'mei_coragem.pilares' },
    dialogue: say('Sino dos pilares',
      '*(blém!)* Lá de baixo, a Luna arregala os olhos e bate palmas.\n"Você subiu! E cada pulo era igualzinho ao outro!"',
      [{ label: '🔔 Agora é sua vez, Luna!', nextNodeId: null, action: 'STEP:mei_coragem.pilares;SFX:bell' }]),
  },
  {
    id: 'placa_promocao', kind: 'examine', position: [5.6, 0, -2.6], label: 'Ler a promoção', name: 'Quadro do Boku', radius: 1.4,
    usableWhen: { active: 'contas', step: 'contas.troco', notStep: 'contas.promocao' },
    dialogue: {
      start: {
        id: 'start', speaker: 'Quadro do Boku',
        text: `Escrito a giz: "PROMOÇÃO! Leve ${DEAL.take} maçãs, pague só ${DEAL.pay}!"\nO Seu Bigodes chega correndo: "Quero ${DEAL.wants} maçãs! Quanto fica?"\nO Boku olha para você, suando.`,
        options: [{ label: '🧮 Calcular a promoção', nextNodeId: null, action: 'CHALLENGE:kenzo_promocao' }, bye('Já volto')],
      },
    },
  },
  ...CLUES.map((c): WorldObject => ({
    id: c.id, kind: 'clue', position: c.pos, label: c.label, name: 'Pista',
    when: { active: 'kuro' },
    hideWhen: { flag: `${c.id}_lida` },
    dialogue: say('Pista', c.text, [{ label: '🔎 Anotado', nextNodeId: null, action: `FLAG:${c.id}_lida;COUNT:kuro_pistas` }]),
  })),
  {
    id: 'pedra_codigo', kind: 'examine', position: [16.4, 0, 34.4], label: 'Ler a pedra entalhada', name: 'Pedra entalhada', radius: 1.5,
    usableWhen: { active: 'kuro', step: 'kuro.pistas', notStep: 'kuro.decifrar' },
    dialogue: {
      start: {
        id: 'start', speaker: 'Pedra entalhada',
        text: `Números riscados com garra: ${KURO_CODE.join(' · ')}\nEmbaixo, menor: "A = 1".`,
        options: [{ label: '🧩 Decifrar o código', nextNodeId: null, action: 'CHALLENGE:kuro_codigo' }, bye('Vou pensar')],
      },
    },
  },
];

export const REDESIGN_CHALLENGES: Challenge[] = [
  {
    id: 'luna_pilares',
    title: 'Os Pilares da Luna',
    skill: 'padroes',
    kind: 'choice',
    story:
      `"Os pilares ficam cada vez MAIS altos!", diz a Luna.\nO primeiro tem ${PILLAR_HEIGHTS[0].toString().replace('.', ',')} m, depois ${PILLAR_HEIGHTS.slice(1).map((h) => h.toString().replace('.', ',')).join(' m, ')} m.\n` +
      'Quanto cada pilar sobe em relação ao anterior?',
    question: `${PILLAR_HEIGHTS.map((h) => h.toString().replace('.', ',')).join(' → ')} : quanto sobe a cada pilar?`,
    choices: ['0,6 m', '1,2 m', '2,4 m'],
    answer: 0,
    observe: 'Não compare com o chão: compare cada pilar com o anterior.',
    hint: '1,2 − 0,6 = ? E 1,8 − 1,2? E 2,4 − 1,8? Repare se é sempre igual.',
    example: 'Parecido: escadas de 15, 30, 45 cm. Cada degrau sobe 15 cm, mesmo que o último pareça alto.',
    successText: '🪨 Isso! Sobe sempre 0,6 m. O último pilar não é um pulo gigante: é o mesmo pulo, quatro vezes.\n"Então... se eu consigo o primeiro, consigo todos?", pergunta a Luna.',
    onSuccess: 'STEP:mei_coragem.medir',
  },
  {
    id: 'kenzo_promocao',
    title: 'A Promoção do Boku',
    skill: 'multiplicacao',
    kind: 'number',
    story:
      `Promoção: leve ${DEAL.take} maçãs, pague ${DEAL.pay}. Cada maçã custa ${DEAL.price} moedas.\n` +
      `O Seu Bigodes quer ${DEAL.wants} maçãs. Quanto ele paga?`,
    question: `${(DEAL.wants / DEAL.take) * DEAL.pay} maçãs pagas × ${DEAL.price} moedas = ?`,
    answer: DEAL_TOTAL,
    observe: `Separe as ${DEAL.wants} maçãs em grupos de ${DEAL.take}. Em cada grupo, ele só paga ${DEAL.pay}.`,
    hint: `${DEAL.wants} ÷ ${DEAL.take} = ${DEAL.wants / DEAL.take} grupos. Em cada grupo paga ${DEAL.pay} maçãs: ${(DEAL.wants / DEAL.take) * DEAL.pay} maçãs pagas. Agora é só multiplicar pelo preço.`,
    example: 'Parecido: "leve 2, pague 1", pães a 3 moedas, a pessoa leva 4 pães.\n4 ÷ 2 = 2 grupos, paga 1 em cada = 2 pães pagos. 2 × 3 = 6 moedas.',
    successText: `🍎 ${DEAL_TOTAL} moedas! Sem a promoção seriam ${DEAL.wants * DEAL.price}. O Seu Bigodes economizou ${DEAL.wants * DEAL.price - DEAL_TOTAL} e saiu assobiando.\nO Boku anota tudo no caderninho... com a SUA letra.`,
    onSuccess: 'STEP:contas.promocao',
  },
  {
    id: 'kuro_codigo',
    title: 'O Código da Pedra',
    skill: 'padroes',
    kind: 'choice',
    story: `Na pedra: ${KURO_CODE.join(' · ')}\nE uma dica: "A = 1". Que palavra está escondida?`,
    question: `${KURO_CODE.join(' · ')} = ?`,
    choices: [KURO_WORD, 'FESTIVAL', 'LANTERNA'],
    answer: 0,
    observe: 'Se A = 1, então B = 2, C = 3... Cada número é a posição de uma letra no alfabeto.',
    hint: 'Conte o alfabeto nos dedos: A, B, C, D, E (5)... O 13 é a 13ª letra. Comece por ela.',
    example: 'Parecido: 7 · 1 · 20 · 15. G é a 7ª letra, A a 1ª, T a 20ª, O a 15ª: GATO.',
    successText: `🧩 ${KURO_WORD}. Kuro deixou o nome do seu mestre riscado na pedra.\nUm galho estala atrás de você. Alguém estava esperando você descobrir.`,
    onSuccess: 'STEP:kuro.decifrar',
  },
];

export const REDESIGN_ITEMS: Item[] = [
  { id: 'sacola_macas', name: 'Sacola de Maçãs', icon: '🍎', description: 'Três maçãs vermelhas do Boku, para a Dona Neko. Não coma no caminho!' },
  { id: 'moedas_neko', name: 'Nota de 20 Moedas', icon: '💴', description: 'O pagamento da Dona Neko. Levar ao Boku para calcular o troco.' },
];
