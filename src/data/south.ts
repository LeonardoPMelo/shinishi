import type { Challenge, DialogueOption, DialogueTree, Mission, NPCDefinition, Vec3 } from '../types';
import type { WorldObject } from './world';

/**
 * Bosque Antigo: the old forest south of the training forest (art audit §26). Tall cedars, a stream
 * crossed by a log or by stepping stones, a deer meadow with a fairy ring, rocky ledges to climb and the
 * Ancient Tree on its mound. New ground only. The challenge numbers come from these constants.
 */

export const SOUTH = { minX: -18.6, maxX: 18.6, minZ: 39.2, maxZ: 63.4 };
export const SOUTH_FENCE = { minX: -19.2, maxX: 19.2, maxZ: 64.0 };
/** The gap in the village's south fence (behind the training forest). */
export const SOUTH_GATE = { x: -2, z: 39.8, halfWidth: 1.5 };

/** A stream across the whole forest (west → east), narrow enough to jump, with a log and stones. */
export const STREAM = { z: 48.0, halfWidth: 0.8 };
export const LOG_BRIDGE = { x: 2.4, z0: 46.4, z1: 49.6, h: 0.32, halfWidth: 0.38 };
export const STREAM_STONES: Vec3[] = [[-9.0, 0, 47.5], [-9.4, 0, 48.6]];

/** The Ancient Tree on a low mound (two rings: a step, then the top). */
export const ANCIENT = { x: 5.0, z: 57.0, trunk: 1.3, mound: 4.4, moundH: 0.55 };
/** The story the challenge uses: around the trunk it is 18 cat steps; one hug covers 2 steps. */
/** Small torii on the trail in front of the mound (posts 1.5 m to each side). */
export const GROVE_TORII: Vec3 = [4.6, 0, 52.0];
export const HUG = { around: 18, perCat: 2 };
export const HUG_CATS = HUG.around / HUG.perCat;

/** Deer meadow with a fairy ring of mushrooms. */
export const MEADOW = { x: -11.6, z: 56.0, r: 3.6 };

/** Climbable ledges on the east side: each one a jump above the last; the moss waits on the top one. */
export const LEDGES: { x: number; z: number; r: number; h: number }[] = [
  { x: 11.6, z: 51.6, r: 1.1, h: 0.6 },
  { x: 13.2, z: 53.4, r: 1.0, h: 1.3 },
  { x: 14.6, z: 55.6, r: 1.05, h: 2.0 },
  { x: 15.8, z: 58.2, r: 1.3, h: 2.7 },
];

/** Three glowing moss tufts for the mission (meadow ring, behind the tree, top ledge). */
export const MOSS: Vec3[] = [
  [MEADOW.x + 0.4, 0.45, MEADOW.z - 0.2],
  [ANCIENT.x + 0.4, ANCIENT.moundH + 0.45, ANCIENT.z + ANCIENT.trunk + 1.2],
  [LEDGES[3].x, LEDGES[3].h + 0.45, LEDGES[3].z],
];

export const SOUTH_PATHS: [number, number][][] = [
  // from the training forest, through the south gate, to the log bridge
  [[-2.4, 28.6], [0.1, 30.8], [0.3, 34.5], [-1.6, 37.6], [-2.0, 40.4], [-1.2, 43.4], [2.0, 45.6], [2.4, 46.4]],
  // from the log to the torii and the mound
  [[2.4, 49.6], [3.4, 51.2], [4.6, 52.4]],
  // west branch: stones across the stream, up to the deer meadow
  [[-1.2, 43.4], [-6.6, 45.0], [-9.0, 46.6]],
  [[-9.4, 49.4], [-10.2, 51.2], [-11.2, 52.4]],
  // east branch toward the ledges
  [[3.6, 51.0], [8.0, 50.6], [10.4, 50.8]],
];

function segDist(x: number, z: number, [ax, az]: [number, number], [bx, bz]: [number, number]) {
  const vx = bx - ax, vz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
  return Math.hypot(x - ax - vx * t, z - az - vz * t);
}
export function southPathDistance(x: number, z: number) {
  let d = Infinity;
  for (const p of SOUTH_PATHS) for (let i = 0; i < p.length - 1; i++) d = Math.min(d, segDist(x, z, p[i], p[i + 1]));
  return d;
}

/** Spots kept clear of cedars and rocks: the trail, the stream, the mound, the meadow, the ledges. */
export function southFree(x: number, z: number, margin: number) {
  if (z < 40.4 + margin * 0.5) return false;
  if (southPathDistance(x, z) < 1.4 + margin) return false;
  if (Math.abs(z - STREAM.z) < STREAM.halfWidth + 0.4 + margin * 0.4) return false;
  if (Math.hypot(x - ANCIENT.x, z - ANCIENT.z) < ANCIENT.mound + 1.0 + margin) return false;
  if (Math.hypot(x - MEADOW.x, z - MEADOW.z) < MEADOW.r + 0.8 + margin) return false;
  if (LEDGES.some((l) => Math.hypot(x - l.x, z - l.z) < l.r + 0.9 + margin)) return false;
  return true;
}

/** Cedars: a jittered grid over the forest, denser toward the fences, never on a kept-clear spot. */
export function cedarSpots(): { x: number; z: number; s: number; seed: number }[] {
  let s = 4040;
  const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const out: { x: number; z: number; s: number; seed: number }[] = [];
  for (let x = -17.8; x < 18.2; x += 3.0) {
    for (let z = 41.6; z < 63.4; z += 3.0) {
      const px = x + (r() - 0.5) * 2.0;
      const pz = z + (r() - 0.5) * 2.0;
      const edge = Math.min(18.6 - Math.abs(px), 63.4 - pz);
      if (r() < (edge < 3.5 ? 0.08 : 0.5)) continue;
      if (Math.abs(px) > 18.2 || pz > 63.2) continue;
      if (!southFree(px, pz, 0.6)) continue;
      out.push({ x: px, z: pz, s: 0.85 + r() * 0.45, seed: out.length });
    }
  }
  return out;
}

/** In the stream's water (the log and the stones excluded). */
export function inStream(x: number, z: number) {
  if (z < 40.4 || Math.abs(z - STREAM.z) > STREAM.halfWidth) return false;
  if (Math.abs(x - LOG_BRIDGE.x) < LOG_BRIDGE.halfWidth + 0.1) return false;
  return !STREAM_STONES.some(([sx, , sz]) => Math.hypot(x - sx, z - sz) < 0.55);
}

// ── Mission ───────────────────────────────────────────────────────────────────

export const SOUTH_MISSIONS: Mission[] = [
  {
    id: 'arvore', chapter: 2, title: 'A Árvore Anciã', category: 'exploração', giver: 'hinoki',
    description: 'Depois da Floresta do Treinamento existe um bosque de cedros com uma árvore mais velha que a vila. A Sábia Hinoki cuida dela e precisa de ajuda para a festa da árvore.',
    steps: [
      { id: 'conhecer', description: 'Conheça a Sábia Hinoki no Bosque Antigo (portão sul)', target: { npc: 'hinoki' } },
      { id: 'abraco', description: 'Descubra quantos gatos são precisos para abraçar a Árvore Anciã', after: ['conhecer'], target: { object: 'placa_arvore' } },
      { id: 'musgo', description: 'Encontre 3 musgos-estrela pelo bosque', after: ['conhecer'], counter: { id: 'musgo', goal: MOSS.length } },
      { id: 'voltar', description: 'Leve os musgos à Sábia Hinoki', after: ['abraco', 'musgo'], target: { npc: 'hinoki' } },
    ],
    rewards: { xp: 60, coins: 25, gems: 2, badges: ['Amigo da Floresta'] },
    lesson: 'Dividir é repartir em partes iguais: 18 passos em abraços de 2 são 9 abraços. Explorar com calma (olhar para cima, atravessar o riacho, subir as pedras) também é parte de aprender.',
  },
];

export const SOUTH_CHALLENGES: Challenge[] = [
  {
    id: 'arvore_abraco',
    title: 'O Abraço da Árvore',
    skill: 'divisao',
    kind: 'number',
    story:
      `Dar a volta no tronco da Árvore Anciã leva ${HUG.around} passos de gato.\n` +
      `Um gato de braços abertos cobre ${HUG.perCat} passos. Quantos gatos de mãos dadas abraçam a árvore inteira?`,
    question: `${HUG.around} passos ÷ ${HUG.perCat} passos por gato = ?`,
    answer: HUG_CATS,
    observe: `Cada gato ocupa a MESMA parte da volta: ${HUG.perCat} passos. Partes iguais pedem divisão.`,
    hint: `Conte de ${HUG.perCat} em ${HUG.perCat} até chegar a ${HUG.around}: ${HUG.perCat}, ${HUG.perCat * 2}, ${HUG.perCat * 3}... Quantas vezes você contou?`,
    example: 'Parecido: uma mesa redonda com 12 lugares de volta e cada cadeira ocupa 3 lugares. 12 ÷ 3 = 4 cadeiras.',
    successText: `🌳 Isso! ${HUG_CATS} gatos de mãos dadas. Na festa da árvore, a vila inteira vai fazer esse abraço.\nA Sábia Hinoki vai precisar de muitos amigos!`,
    onSuccess: 'STEP:arvore.abraco;SFX:chime',
  },
];

const bye = (label = 'Até mais!'): DialogueOption => ({ label, nextNodeId: null });
const say = (speaker: string, text: string, options: DialogueOption[] = [bye()]): DialogueTree => ({ start: { id: 'start', speaker, text, options } });

export const SOUTH_OBJECTS: WorldObject[] = [
  {
    id: 'placa_bosque', kind: 'sign', position: [0.4, 0, 41.4], rotation: Math.PI, label: 'Ler a placa', name: 'Bosque Antigo',
    dialogue: say('Bosque Antigo',
      '🪧 BOSQUE ANTIGO\n↓ Árvore Anciã (pela ponte de tronco)   ·   ← Clareira dos Cervos   ·   → Pedras do Musgo\n"Os cedros têm mais de cem anos. Ande com respeito."'),
  },
  {
    id: 'placa_arvore', kind: 'examine', position: [ANCIENT.x - 1.4, ANCIENT.moundH, ANCIENT.z - ANCIENT.trunk - 1.4], label: 'Medir o tronco', name: 'Árvore Anciã', radius: 1.7,
    usableWhen: { active: 'arvore', step: 'arvore.conhecer', notStep: 'arvore.abraco' },
    dialogue: {
      start: {
        id: 'start', speaker: 'Árvore Anciã',
        text: `Um tronco enorme, cheio de musgo, com uma corda sagrada amarrada em volta.\nVocê dá a volta contando: ${HUG.around} passos de gato.`,
        options: [{ label: '🧮 Calcular o abraço', nextNodeId: null, action: 'CHALLENGE:arvore_abraco' }, bye('Vou dar outra volta')],
      },
    },
  },
  ...MOSS.map((pos, i): WorldObject => ({
    id: `musgo_${i}`, kind: 'pickup_herb', position: pos, label: 'Musgo-estrela',
    when: { active: 'arvore', step: 'arvore.conhecer' },
    hideWhen: { flag: `got_musgo_${i}` },
    actions: `FLAG:got_musgo_${i};COUNT:musgo`,
  })),
];

// ── Sábia Hinoki ─────────────────────────────────────────────────────────────

export const HINOKI: NPCDefinition = {
  id: 'hinoki',
  name: 'Sábia Hinoki',
  role: 'Guardiã do Bosque Antigo',
  position: [3.6, 0, 50.6],
  faceRotation: Math.PI,
  look: { species: 'cat', fur: '#6E5440', belly: '#F2E6D8', scale: 1.0, stripes: '#4A3A2C', accessory: 'sage' },
  voice: 'meow_low',
  barks: ['Escute: os cedros conversam com o vento.', 'Pise na ponte devagar.', 'Os cervos são tímidos, não corra.'],
  offers: [{ mission: 'arvore', when: { done: 'treino' } }],
  patrol: [[3.6, 0, 50.6], [6.8, 0, 50.6], [2.6, 0, 50.2], [3.6, 0, 50.6]],
  speed: 0.6,
  routes: [
    { when: { active: 'arvore', counter: { id: 'musgo', atLeast: MOSS.length }, step: 'arvore.abraco' }, tree: {
      start: {
        id: 'start', speaker: 'Sábia Hinoki', mood: 'happy',
        text: `Três musgos-estrela! E ${HUG_CATS} gatos para o abraço... vou ter que chamar a vila toda.\nVocê atravessou o riacho, subiu as pedras e olhou para cima. É assim que se conhece um bosque.`,
        options: [{ label: 'O bosque é lindo, Sábia Hinoki.', nextNodeId: 'end' }],
      },
      end: {
        id: 'end', speaker: 'Sábia Hinoki', mood: 'happy',
        text: 'Ele é velho e paciente. Volte sempre que precisar pensar com calma.\nE traga amigos para o abraço!',
        options: [{ label: '🌳 Obrigado!', nextNodeId: null, action: 'STEP:arvore.voltar' }],
      },
    } },
    { when: { active: 'arvore' }, tree: say('Sábia Hinoki',
      'A placa da árvore fica no monte, depois do torii. Os musgos-estrela brilham: um no círculo de cogumelos da clareira,\num atrás da Árvore Anciã e um no alto das pedras do leste. Suba com pulos firmes.',
      [bye('Vou procurar!')]) },
    { when: { done: 'treino', notStarted: 'arvore' }, tree: {
      start: {
        id: 'start', speaker: 'Sábia Hinoki',
        text: 'Um gato ninja no Bosque Antigo... o Mestre Lótus falou de você.\nSou a Hinoki. Daqui a pouco é a festa da Árvore Anciã e eu preciso de patas jovens. Ajuda esta velha?',
        options: [
          { label: '🌳 Ajudo! O que é preciso?', nextNodeId: 'task', action: 'START:arvore;STEP:arvore.conhecer' },
          { label: 'Agora não.', nextNodeId: null },
        ],
      },
      task: {
        id: 'task', speaker: 'Sábia Hinoki', mood: 'happy',
        text: 'Na festa, a vila abraça a árvore de mãos dadas. Quantos gatos são precisos? A placa no monte ajuda a medir.\nE preciso de 3 musgos-estrela para as lanternas. Eles brilham, mas ficam em lugares difíceis.',
        options: [bye('Pode deixar!')],
      },
    } },
    { when: { done: 'arvore' }, tree: say('Sábia Hinoki', 'Os musgos já estão nas lanternas. À noite o bosque inteiro brilha.') },
    { tree: say('Sábia Hinoki', 'Bem-vindo ao Bosque Antigo. Os cedros já eram velhos quando a vila nasceu.') },
  ],
};
