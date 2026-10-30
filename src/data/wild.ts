import type { Challenge, Condition, DialogueOption, DialogueTree, Item, Mission, NPCDefinition, Vec3 } from '../types';
import type { WorldObject } from './world';
import type { OrderPuzzle } from '../systems/orderPuzzle';
import type { EnemyKind } from '../systems/combat';

/**
 * As Terras Selvagens (Etapa 7 da expansão): the region past the Trilha da Expedição, west of the village.
 * Like the houses you walk into, it is its own zone far from the village map (x around 500), reached through a
 * gate in the Bambuzal's west fence; the village is not drawn while the cat is there.
 *
 * Local coordinates below (x east, z south), turned into world ones by `w()`. The river runs north to south
 * through the middle: the camp and the meadow on the east bank, the forest, the bandits' clearing and the
 * canyon to Hissui's outpost on the west bank, the cave, the ruins and the windy lookout up north-east.
 * Every number the code and the tests use lives here.
 */

export const WILD_ORIGIN: [number, number] = [500, 0];
/** Where the cat may walk, in local coordinates (the cliffs and the tree wall close it). */
export const WILD = { minX: -48, maxX: 48, minZ: -40.4, maxZ: 38 };
export const w = (x: number, z: number, y = 0): Vec3 => [WILD_ORIGIN[0] + x, y, WILD_ORIGIN[1] + z];
export const toLocal = (x: number, z: number) => ({ x: x - WILD_ORIGIN[0], z: z - WILD_ORIGIN[1] });

/** The walkable rectangle in world coordinates (data/regions.ts). */
export const WILD_RECT = {
  minX: WILD_ORIGIN[0] + WILD.minX, maxX: WILD_ORIGIN[0] + WILD.maxX,
  minZ: WILD_ORIGIN[1] + WILD.minZ, maxZ: WILD_ORIGIN[1] + WILD.maxZ,
};
export const inWildWorld = (x: number, z: number) => x >= WILD_RECT.minX - 4 && x <= WILD_RECT.maxX + 4 && z >= WILD_RECT.minZ - 4 && z <= WILD_RECT.maxZ + 4;

// ── Getting there ────────────────────────────────────────────────────────────

/** The gate in the village (Bambuzal's west fence, between the bathhouse and the fisherman's hut). */
export const TRAIL_GATE = { at: [-40.0, 0, 12.0] as Vec3, out: [-38.6, 0, 12.0] as Vec3, heading: Math.PI / 2 };
/** The way back, on the camp's east edge, and where the cat arrives (facing west, into the region). */
export const WILD_GATE = { at: w(45.6, 22), arrive: w(42.4, 22), heading: -Math.PI / 2 };
/** Where a fainted cat wakes up: by the campfire. */
export const WILD_RESPAWN = w(36.6, 24.4);
export const CAMPFIRE = { at: w(34, 22), reach: 2.0 };

// ── Ground, water and walls ──────────────────────────────────────────────────

/** The river (local x 4..9) from the waterfall to the south edge; the water splashes the cat back. */
export const WILD_RIVER = { x0: 4, x1: 9, z0: -38.6, z1: 38 };
/** The rope bridge: broken until the Corda Ninja ties it (flag ponte_consertada). */
export const ROPE_BRIDGE = { z: 24, x0: 2.6, x1: 10.4, half: 0.8, h: 0.32 };
/** The stepping stones further north: a hop from one to the next. */
export const WILD_STONES: [number, number][] = [[4.9, -6], [6.5, -6], [8.1, -6]];
export const WILD_STONE_R = 0.62;

export function inWildRiver(lx: number, lz: number, bridgeFixed: boolean) {
  if (lx < WILD_RIVER.x0 || lx > WILD_RIVER.x1 || lz < WILD_RIVER.z0 || lz > WILD_RIVER.z1) return false;
  if (bridgeFixed && Math.abs(lz - ROPE_BRIDGE.z) < ROPE_BRIDGE.half) return false;
  return !WILD_STONES.some(([sx, sz]) => Math.hypot(lx - sx, lz - sz) < WILD_STONE_R);
}

/**
 * Rock walls and cliffs (local boxes x0..x1, z0..z1, h tall): the north cliff with the alcove behind the
 * waterfall, the canyon that leads to the outpost, the outpost's palisade, and the cave's rock ring.
 */
export interface WildWall { x0: number; x1: number; z0: number; z1: number; h: number; kind: 'cliff' | 'palisade' }
export const WILD_WALLS: WildWall[] = [
  // north cliff, with a recess behind the waterfall (x 8.6..11.8)
  { x0: -48, x1: 8.6, z0: -43, z1: -38.6, h: 8, kind: 'cliff' },
  { x0: 8.6, x1: 11.8, z0: -43, z1: -40.6, h: 8, kind: 'cliff' },
  { x0: 11.8, x1: 48, z0: -43, z1: -38.6, h: 8, kind: 'cliff' },
  // the canyon: a corridor x -40..-34 from the clearing (z -3) up to the outpost (z -25)
  { x0: -48, x1: -40, z0: -25, z1: -3, h: 4.5, kind: 'cliff' },
  { x0: -34, x1: -26, z0: -25, z1: -6, h: 4.5, kind: 'cliff' },
  // the outpost's palisade on the east side (the canyon is the only way in)
  { x0: -27, x1: -26, z0: -38.6, z1: -25, h: 3.4, kind: 'palisade' },
  // the cave's rock ring, open to the sky, the way in on the south side (x 24..28)
  { x0: 15, x1: 18, z0: -38.6, z1: -21, h: 5, kind: 'cliff' },
  { x0: 34, x1: 37, z0: -38.6, z1: -21, h: 5, kind: 'cliff' },
  { x0: 18, x1: 24, z0: -24, z1: -21, h: 5, kind: 'cliff' },
  { x0: 28, x1: 34, z0: -24, z1: -21, h: 5, kind: 'cliff' },
];

export const CANYON = { x0: -40, x1: -34, z0: -25, z1: -3 };
export const OUTPOST = { x0: -48, x1: -27, z0: -38.6, z1: -25 };
export const CAVE = { x0: 18, x1: 34, z0: -38.6, z1: -24 };
/** The windy steps up to the lookout: without the Capa Corta-Vento the gusts push the cat back down. */
export const WIND_ZONE = { x0: 39, x1: 48, z0: -31, z1: -24.5, back: -23 };
export const LOOKOUT = { x0: 39, x1: 48, z0: -38.6, z1: -31, h: 3 };
/** Steps from the meadow up to the lookout (x 42..45), 0.5 m each, south to north. */
export const LOOKOUT_STEPS = { x0: 42, x1: 45, z: -25.5, step: 1.0, count: 6 };
/** The trees and posts in the way, as circles (local x, z, r): the creatures and the tests read them. */
export const BRIDGE_REPAIR = w(11.2, 24);

// ── Areas (the name on the HUD, the map) ─────────────────────────────────────

export interface WildArea { id: string; name: string; rect: [number, number, number, number] }
/** First match wins, so the small places come before the big ones around them. */
export const WILD_AREAS: WildArea[] = [
  { id: 'acampamento', name: 'Acampamento da Expedição', rect: [27, 12, 48, 34] },
  { id: 'mirante', name: 'Mirante do Vento', rect: [39, -40, 48, -24.5] },
  { id: 'caverna', name: 'Caverna da Névoa', rect: [18, -40, 34, -24] },
  { id: 'ruinas', name: 'Ruínas do Sol', rect: [22, -18, 40, -1] },
  { id: 'cachoeira', name: 'Cachoeira do Véu', rect: [2, -41, 14, -30] },
  { id: 'posto', name: 'Posto Avançado do Hissui', rect: [-48, -40, -26, -25] },
  { id: 'desfiladeiro', name: 'Desfiladeiro das Pedras', rect: [-40, -25, -34, -3] },
  { id: 'clareira', name: 'Clareira dos Bandidos', rect: [-26, -24, -4, -2] },
  { id: 'cerejeiras', name: 'Bosque das Cerejeiras', rect: [-48, 8, -28, 38] },
  { id: 'abandonado', name: 'Acampamento Abandonado', rect: [-28, 28, -14, 38] },
  { id: 'rio', name: 'Rio Corredeira', rect: [3, -30, 10, 38] },
  { id: 'mata', name: 'Mata Fechada', rect: [-28, -2, 3, 38] },
  { id: 'campina', name: 'Campina das Ervas', rect: [10, -1, 27, 38] },
];

export function wildAreaAt(x: number, z: number): string | null {
  const l = toLocal(x, z);
  return WILD_AREAS.find((a) => l.x >= a.rect[0] && l.x <= a.rect[2] && l.z >= a.rect[1] && l.z <= a.rect[3])?.name ?? null;
}

// ── Trees and props (decoration with colliders, drawn by WildRegion.tsx) ─────

/** Seeded scatter, so the forest is the same every visit and the tests can check it. */
function scatter(seed: number, n: number, rect: [number, number, number, number], minGap: number, avoid: (x: number, z: number) => boolean) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const out: [number, number][] = [];
  for (let tries = 0; out.length < n && tries < n * 40; tries++) {
    const x = rect[0] + rnd() * (rect[2] - rect[0]);
    const z = rect[1] + rnd() * (rect[3] - rect[1]);
    if (avoid(x, z) || out.some(([ox, oz]) => Math.hypot(ox - x, oz - z) < minGap)) continue;
    out.push([x, z]);
  }
  return out;
}

/** Trails kept clear of trees (local polylines): camp → bridge → forest → cherry grove; forest → clearing → canyon; stones → ruins → cave. */
export const WILD_TRAILS: [number, number][][] = [
  [[42, 22], [34, 22], [24, 24], [12, 24], [2, 24], [-6, 22], [-14, 24], [-24, 26], [-36, 26]],
  [[-6, 22], [-8, 12], [-12, 2], [-16, -6], [-24, -8], [-37, -6], [-37, -24], [-38, -30]],
  [[24, 24], [18, 10], [14, -2], [9.5, -6], [3.5, -6], [-4, -8], [-12, -6]],
  [[14, -2], [22, -6], [30, -8], [30, -14]],
  [[22, -6], [26, -16], [26, -23], [26, -30]],
  [[30, -8], [38, -16], [43.5, -22], [43.5, -26]],
  [[-14, 24], [-20, 32]],
];

export function distToTrail(x: number, z: number) {
  let best = Infinity;
  for (const line of WILD_TRAILS) {
    for (let i = 0; i < line.length - 1; i++) {
      const [ax, az] = line[i];
      const [bx, bz] = line[i + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
    }
  }
  return best;
}

const inRect = (x: number, z: number, r: { x0: number; x1: number; z0: number; z1: number }, pad = 0) =>
  x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
export const inWall = (x: number, z: number, pad = 0) => WILD_WALLS.some((wl) => inRect(x, z, wl, pad));

/** Places that must stay open (camp, clearings, the river and its banks, the ruins). */
function keepOpen(x: number, z: number) {
  if (distToTrail(x, z) < 2.4) return true;
  if (x > 2 && x < 11) return true; // river and banks
  if (inWall(x, z, 1.2)) return true;
  if (inRect(x, z, CANYON, 0.5) || inRect(x, z, OUTPOST, 0) || inRect(x, z, CAVE, 0.5)) return true;
  if (inRect(x, z, { x0: 26, x1: 48, z0: 10, z1: 36 })) return true; // camp
  if (inRect(x, z, { x0: 21, x1: 41, z0: -19, z1: 0 })) return true; // ruins
  if (inRect(x, z, { x0: 38, x1: 48, z0: -40, z1: -20 })) return true; // lookout
  if (Math.hypot(x + 16, z + 11) < 9) return true; // the bandits' clearing
  if (Math.hypot(x + 21, z - 33) < 4.5) return true; // abandoned camp
  return false;
}

export const WILD_PINES = scatter(71, 46, [-30, -2, 2, 37], 2.6, keepOpen).concat(scatter(73, 10, [-26, -38, 2, -22], 3.2, keepOpen));
export const WILD_CHERRIES = scatter(79, 12, [-47, 9, -29, 37], 3.6, keepOpen);
export const WILD_MAPLES = scatter(83, 9, [11, -1, 26, 37], 4.5, (x, z) => keepOpen(x, z) || Math.hypot(x - 18, z - 18) < 6);
/** Bento's cherry tree: the big one at the end of the forest trail. */
export const BENTO_TREE = { x: -37.5, z: 26.5 };

// ── Resources ────────────────────────────────────────────────────────────────

/** Erva de Luz: grows back every visit. Walk over it to pick it. */
export const HERB_SPOTS: [number, number][] = [
  [14, 30], [17, 33], [21, 29], [24, 34], [13, 14], [19, 8], [23, 15], [16, 2], [-4, 32], [-10, 34],
];
/** Cristais da Névoa: in the cave, seen only with the Faro. Saved once taken (flag cristal_<i>). */
export const CRYSTALS: [number, number][] = [[21, -36.4], [31.8, -36.6], [20.4, -27]];

/** Hissui's snares: step on one and the paw gets stuck (a heart). Crouch next to it and press E to disarm. */
export const TRAPS: [number, number][] = [[-38.4, -7], [-35.6, -18.5], [-40.6, -29.5]];
export const TRAP = { trigger: 0.65, disarm: 1.5, stuck: 1.0 };

// ── Creatures ────────────────────────────────────────────────────────────────

export interface EnemySpawn { id: string; kind: EnemyKind; at: [number, number]; r: number; heading?: number; when?: Condition }
export const ENEMY_SPAWNS: EnemySpawn[] = [
  // the bandits' clearing
  { id: 'ourico_1', kind: 'ourico', at: [-16, -10], r: 4 },
  { id: 'ourico_2', kind: 'ourico', at: [-11, -15], r: 3 },
  { id: 'ourico_3', kind: 'ourico', at: [-21, -14], r: 3 },
  // the one guarding Bento's tree
  { id: 'ourico_bento', kind: 'ourico', at: [-34.5, 25], r: 2.5, when: { notStep: 'explorador.descer' } },
  { id: 'ourico_mata', kind: 'ourico', at: [-12, 13], r: 4 },
  // foxes: by the stepping stones, at the ruins, and the two outpost guards
  { id: 'raposa_pedras', kind: 'raposa', at: [-4, -16], r: 4 },
  { id: 'raposa_ruinas', kind: 'raposa', at: [36, -4], r: 3 },
  { id: 'raposa_posto_1', kind: 'raposa', at: [-37, -31], r: 3, heading: 0 },
  { id: 'raposa_posto_2', kind: 'raposa', at: [-31, -35], r: 2.5, heading: -Math.PI / 2 },
  // the cave
  { id: 'espirito_1', kind: 'espirito', at: [22, -31], r: 3 },
  { id: 'espirito_2', kind: 'espirito', at: [30, -32], r: 3 },
  // the guardian of the canyon, asleep in the middle of it (calmed or beaten for good: saved flags)
  { id: 'javali', kind: 'javali', at: [-37, -14], r: 0, heading: Math.PI, when: { notFlag: ['javali_calmo', 'javali_vencido'] } },
];
/** The tree is free once Bento's guard is this far from it (beaten, lured away or chased off). */
export const BENTO_GUARD_CLEAR = 6;
/** The kit in the thorn bush: free it when no hedgehog is this close. */
export const KIT_BUSH = { at: [-15.4, -11.6] as [number, number], clear: 5.5 };
/** Past this line (north end of the canyon) the cat has got by the boar. */
export const CANYON_PASSED_Z = -23;

// ── The ruins' puzzle ────────────────────────────────────────────────────────

export const SUN_PUZZLE: OrderPuzzle = {
  id: 'portao_sol',
  // as they stand in front of the gate, west to east
  pieces: ['lua', 'sol', 'estrela', 'nuvem'],
  rules: [
    { text: 'O sol nasce primeiro.', rule: { kind: 'first', a: 'sol' } },
    { text: 'A lua só aparece depois da nuvem, logo depois dela.', rule: { kind: 'rightAfter', a: 'lua', b: 'nuvem' } },
    { text: 'A estrela nunca fica para o fim.', rule: { kind: 'notLast', a: 'estrela' } },
  ],
};
export const SUN_STONES: Record<string, { name: string; of: string; icon: string; at: [number, number] }> = {
  lua: { name: 'Lua', of: 'da Lua', icon: '🌙', at: [26.5, -9] },
  sol: { name: 'Sol', of: 'do Sol', icon: '☀️', at: [29.5, -9] },
  estrela: { name: 'Estrela', of: 'da Estrela', icon: '⭐', at: [32.5, -9] },
  nuvem: { name: 'Nuvem', of: 'da Nuvem', icon: '☁️', at: [35.5, -9] },
};
export const SUN_GATE = { x: 31, z: -14.5 };
export const SUN_SOLVED = 'FLAG:portao_sol_aberto;STEP:ruinas.mecanismo;SFX:mechanism;SKILL:logica';

/** What the game code runs for the wild lands (validated with the data: systems/validateData.ts). */
export const WILD_CODE_ACTIONS: Record<string, string> = {
  /** Bento slides down the trunk once his guard has gone. */
  bento: 'STEP:explorador.descer;SFX:flop',
  /** The kit hops out of the thorn bush. */
  filhote: 'STEP:filhote.soltar;SFX:wish',
  sol: SUN_SOLVED,
  /** Past the boar, at the north end of the canyon. */
  desfiladeiro: 'STEP:posto.desfiladeiro',
  /** The boar takes the treat and lets the cat through for good. */
  javali_calmo: 'FLAG:javali_calmo;TAKE:petisco_atum;SFX:wish',
  javali_vencido: 'FLAG:javali_vencido;COINS:15',
  /** The Corda Ninja ties the broken rope bridge. */
  ponte: 'FLAG:ponte_consertada;SFX:mechanism',
  erva: 'GIVE:erva_luz;COUNT:ervas_colhidas',
  cristal: 'GIVE:cristal_nevoa;COUNT:cristais_colhidos',
  armadilha: 'COUNT:armadilhas_desarmadas;COINS:2;SFX:mechanism',
  bicho: 'COUNT:bichos_espantados',
};

// ── Items ────────────────────────────────────────────────────────────────────

export const WILD_ITEMS: Item[] = [
  {
    id: 'erva_luz', name: 'Erva de Luz', icon: '🌿', category: 'consumivel', rarity: 'comum', sellPrice: 1,
    description: 'Folhinhas que brilham de leve à noite. Crescem na Campina das Ervas.',
    effectText: 'Ingrediente: no caldeirão do acampamento, 2 ervas viram 1 Poção de Ervas.',
  },
  {
    id: 'pocao_cura', name: 'Poção de Ervas', icon: '🧉', category: 'consumivel', rarity: 'comum', sellPrice: 2,
    use: { kind: 'cura', hearts: 2 },
    description: 'Receita da Doutora Momo. Cheiro de mato, gosto de... mato.',
    effectText: 'Nas Terras Selvagens: recupera 2 corações. Pela mochila, ou tecla 3 quando falta coração.',
  },
  {
    id: 'cristal_nevoa', name: 'Cristal da Névoa', icon: '🔮', category: 'colecionavel', rarity: 'raro',
    description: 'Frio como gelo e cheio de névoa por dentro. Só aparece para quem usa o Faro.',
  },
  {
    id: 'disco_solar', name: 'Disco Solar', icon: '🌞', category: 'colecionavel', rarity: 'lendario',
    description: 'Um disco de bronze com o sol gravado, das Ruínas do Sol. Esquenta na mão quando aponta para a vila.',
  },
  {
    id: 'ordens_hissui', name: 'Ordens do General Hissui', icon: '📜',
    description: 'Um bilhete com a marca da garra. "Achem o Disco Solar antes da Vila das Patas."',
  },
];

// ── Challenge ────────────────────────────────────────────────────────────────

export const WILD_CHALLENGES: Challenge[] = [
  {
    id: 'receita_pocao',
    title: 'A Receita da Doutora Momo',
    skill: 'proporcoes',
    story: 'O caldeirão borbulha. A receita na tampa diz: "Para cada 2 Ervas de Luz, 3 conchas de água do rio."',
    question: 'Você colheu 4 ervas. Quantas conchas de água vão no caldeirão?',
    kind: 'number',
    answer: 6,
    observe: 'A receita é uma proporção: 2 ervas combinam com 3 conchas. Quantas vezes o "2 ervas" cabe em 4 ervas?',
    hint: '4 ervas são 2 grupos de 2. Cada grupo leva 3 conchas.',
    example: 'Se fossem 6 ervas: 6 ÷ 2 = 3 grupos; 3 × 3 = 9 conchas.',
    successText: 'Glub, glub... a poção ficou verde-clarinha, do jeito certo!',
    onSuccess: 'STEP:ervas.preparar;FLAG:receita_pocao;GIVE:pocao_cura:2;TAKE:erva_luz:4',
  },
];

// ── People ───────────────────────────────────────────────────────────────────

const say = (speaker: string, text: string, options: DialogueOption[] = [{ label: 'Ok', nextNodeId: null }], onEnter?: string): DialogueTree => ({
  start: { id: 'start', speaker, text, options, onEnter },
});

export const YUKI_CAMP: NPCDefinition = {
  id: 'yuki_campo',
  name: 'Conselheira Yuki',
  role: 'Chefe da expedição',
  position: w(31, 20.5),
  faceRotation: Math.PI / 2,
  look: { species: 'cat', fur: '#F2F0EC', belly: '#FFFFFF', scale: 0.95, mask: '#D8D4CC', eyes: 'round', accessory: 'explorer' },
  voice: 'meow',
  visibleWhen: { step: 'trilha.portao' },
  offers: [
    { mission: 'explorador', when: { done: 'trilha' } },
    { mission: 'posto', when: { done: 'explorador' } },
  ],
  barks: ['Bebam água, comam peixe seco, não cutuquem ouriços.', 'Um bom batedor volta para contar.'],
  routes: [
    { when: { active: 'trilha', step: 'trilha.portao', notStep: 'trilha.acampamento' }, tree: {
      start: {
        id: 'start', speaker: 'Conselheira Yuki', mood: 'happy',
        text: 'Chegou inteiro! Bem-vindo ao Acampamento da Expedição.\nAqui as regras são outras: tem bicho que não gosta de visita.',
        options: [{ label: 'O que eu preciso saber?', nextNodeId: 'regras' }],
      },
      regras: {
        id: 'regras', speaker: 'Conselheira Yuki',
        text: 'Os corações lá em cima mostram sua energia. Levou uma pancada, perdeu um.\nSe acabarem, você desmaia e acorda aqui na fogueira, com tudo na mochila. A fogueira também recupera os corações.',
        options: [{ label: 'E se um bicho vier atrás de mim?', nextNodeId: 'luta' }],
      },
      luta: {
        id: 'luta', speaker: 'Conselheira Yuki',
        text: 'Você escolhe. Agachado (C), eles quase não te veem. Uma shuriken nas pedras faz barulho longe e eles vão olhar.\nE se precisar, a patada (F) espanta. Ouriço com espinho em pé, nem tente: espere ele ficar tonto depois da investida.',
        options: [{ label: '🏕️ Entendido!', nextNodeId: null, action: 'STEP:trilha.acampamento' }],
      },
    } },
    { when: { notStarted: 'explorador', done: 'trilha' }, tree: {
      start: {
        id: 'start', speaker: 'Conselheira Yuki', mood: 'sad',
        text: 'Problema: o Bento, nosso cartógrafo, saiu ontem para desenhar a mata e não voltou.\nEle é ótimo com mapas... e péssimo em voltar pelo mesmo caminho.',
        options: [
          { label: '🔎 Eu acho ele!', nextNodeId: null, action: 'START:explorador;STEP:explorador.ouvir' },
          { label: 'Daqui a pouco', nextNodeId: null },
        ],
      },
    } },
    { when: { active: 'explorador' }, tree: say('Conselheira Yuki', 'Pegadas de tanuki atravessando a ponte para a mata, foi o que vi por último.\nUse o Faro (Q) se perder a trilha.') },
    { when: { notStarted: 'posto', done: 'explorador' }, tree: {
      start: {
        id: 'start', speaker: 'Conselheira Yuki',
        text: 'O mapa do Bento mostra uma paliçada no fim do Desfiladeiro das Pedras: o posto avançado do General Hissui.\nPreciso saber o que ele procura. Mas tem um Javali Rochoso dormindo bem no meio do desfiladeiro...',
        options: [
          { label: '🥷 Deixa comigo', nextNodeId: 'como' },
          { label: 'Depois', nextNodeId: null },
        ],
      },
      como: {
        id: 'como', speaker: 'Conselheira Yuki',
        text: 'Três jeitos: passar agachado sem acordá-lo, oferecer um Petisco de Atum (javalis adoram) ou... enfrentá-lo, se for preciso.\nNo posto, leia as ordens do Hissui. Se as raposas não te virem, melhor ainda.',
        options: [{ label: 'Partiu!', nextNodeId: null, action: 'START:posto;STEP:posto.ouvir' }],
      },
    } },
    { when: { active: 'posto', step: 'posto.ordens', notStep: 'posto.voltar' }, tree: {
      start: {
        id: 'start', speaker: 'Conselheira Yuki', mood: 'surprised',
        text: '"Achem o Disco Solar antes da Vila das Patas"... Então é isso que o Hissui quer!\nO disco das Ruínas do Sol. O Mikage precisa saber disso já.',
        options: [{ label: '📜 Entregar as ordens', nextNodeId: null, action: 'STEP:posto.voltar' }],
      },
    } },
    { when: { active: 'posto' }, tree: say('Conselheira Yuki', 'O desfiladeiro começa a oeste da Clareira dos Bandidos. Cuidado com as armadilhas: com o Faro, elas brilham.') },
    { when: { done: 'posto' }, tree: say('Conselheira Yuki', 'O Hissui quer o Disco Solar. Seja o que for que esse disco abre, ele não pode chegar primeiro.') },
    { tree: say('Conselheira Yuki', 'O acampamento é seguro. Lá fora, ande com calma e olhos abertos.') },
  ],
};

export const BENTO_TREE_NPC: NPCDefinition = {
  id: 'bento_arvore',
  name: 'Bento',
  role: 'Cartógrafo (pendurado)',
  position: w(BENTO_TREE.x + 0.95, BENTO_TREE.z + 0.2, 2.45),
  faceRotation: Math.PI / 2,
  look: { species: 'tanuki', fur: '#8C6B4F', belly: '#D9C3A0', scale: 0.9, mask: '#4A3A2E', eyes: 'round', accessory: 'explorer' },
  voice: 'chitter',
  visibleWhen: { active: 'explorador', notStep: 'explorador.descer' },
  barks: ['Psiu! Aqui em cima!', 'Esse ouriço não pisca?!'],
  routes: [
    { when: { notStep: 'explorador.achar' }, tree: say('Bento',
      'Psiu! Aqui em cima! Sou eu, o Bento!\nSubi para desenhar a mata vista de cima, e um ouriço bandido sentou bem embaixo da árvore. Faz UMA HORA.',
      [{ label: 'Como eu te ajudo?', nextNodeId: null, action: 'STEP:explorador.achar' }]) },
    { tree: say('Bento', 'Tira esse ouriço daqui! Pode espantar ele, ou jogar uma shuriken nas pedras para ele ir olhar.\nQuando ele sair, sacode o tronco que eu desço. Acho. Espero.') },
  ],
};

export const BENTO: NPCDefinition = {
  id: 'bento',
  name: 'Bento',
  role: 'Cartógrafo da expedição',
  position: w(33, 27),
  faceRotation: Math.PI,
  look: { species: 'tanuki', fur: '#8C6B4F', belly: '#D9C3A0', scale: 0.9, mask: '#4A3A2E', eyes: 'round', accessory: 'explorer' },
  voice: 'chitter',
  visibleWhen: { step: 'explorador.descer' },
  offers: [
    { mission: 'cristais', when: { done: 'explorador' } },
    { mission: 'ruinas', when: { done: 'explorador' } },
  ],
  barks: ['Norte é para cima. Quase sempre.', 'Meu mapa tem só três peixinhos desenhados. Melhorei!'],
  routes: [
    { when: { active: 'explorador', notStep: 'explorador.voltar' }, tree: say('Bento',
      'Salvo! Obrigado, Shinichi. Lá de cima eu desenhei tudo: o rio, a caverna, as ruínas... e uma paliçada no fim do desfiladeiro.\nVou mostrar para a Yuki. Toma: o resto do meu lanche de expedição.',
      [{ label: '🗺️ De nada!', nextNodeId: null, action: 'STEP:explorador.voltar' }]) },
    { when: { notStarted: 'cristais' }, tree: {
      start: {
        id: 'start', speaker: 'Bento',
        text: 'A Caverna da Névoa, ao norte! Dizem que tem cristais lá dentro que só aparecem para quem tem bom nariz.\nE espíritos de névoa que só dá para ver... do mesmo jeito. Traz 3 cristais para eu estudar?',
        options: [
          { label: '🔮 Trago!', nextNodeId: null, action: 'START:cristais;STEP:cristais.ouvir' },
          { label: 'Depois', nextNodeId: null },
        ],
      },
    } },
    { when: { active: 'cristais', step: 'cristais.coletar', notStep: 'cristais.voltar' }, tree: say('Bento',
      'Três Cristais da Névoa! Olha a névoa girando lá dentro...\nCom eles, o mapa da caverna fica completo. Toma, sua parte da descoberta.',
      [{ label: '🔮 Entregar os cristais', nextNodeId: null, action: 'STEP:cristais.voltar' }]) },
    { when: { active: 'ruinas', step: 'ruinas.artefato', notStep: 'ruinas.voltar' }, tree: say('Bento',
      'O DISCO SOLAR! Achei que fosse lenda!\nGuarda bem. Se alguém quisesse isso, seria... alguém com muitas garras.',
      [{ label: '🌞 Mostrar o disco', nextNodeId: null, action: 'STEP:ruinas.voltar' }]) },
    // offers before hints: with one mission running, Bento still offers the other (availableOffer agrees)
    { when: { notStarted: 'ruinas' }, tree: {
      start: {
        id: 'start', speaker: 'Bento',
        text: 'Nas Ruínas do Sol tem um portão que ninguém abre há cem anos. Quatro pedras na frente dele e uma inscrição.\nEu desenho, você decifra?',
        options: [
          { label: '🌞 Vamos!', nextNodeId: null, action: 'START:ruinas;STEP:ruinas.ouvir' },
          { label: 'Depois', nextNodeId: null },
        ],
      },
    } },
    { when: { active: 'cristais' }, tree: say('Bento', 'Os cristais só aparecem com o Faro (Q). Os espíritos também: com o Faro ligado, dá para espantá-los.') },
    { when: { active: 'ruinas' }, tree: say('Bento', 'As ruínas ficam a leste das pedras do rio. Leia a inscrição antes de mexer nas pedras!') },
    { tree: say('Bento', 'Desenhei você no canto do mapa. Ficou parecido. Mais ou menos.') },
  ],
};

export const MOMO: NPCDefinition = {
  id: 'momo',
  name: 'Doutora Momo',
  role: 'Herbalista da expedição',
  position: w(37.5, 15.0),
  faceRotation: 0,
  look: { species: 'cat', fur: '#F4EBDD', belly: '#FFFFFF', scale: 0.92, eyes: 'round', accessory: 'leaf' },
  voice: 'squeak',
  visibleWhen: { step: 'trilha.portao' },
  offers: [
    { mission: 'ervas', when: { done: 'trilha' } },
    { mission: 'filhote', when: { done: 'ervas' } },
  ],
  barks: ['Arranhão? Erva de Luz resolve.', 'Respire fundo. Cheira a hortelã, né?'],
  routes: [
    { when: { notStarted: 'ervas', done: 'trilha' }, tree: {
      start: {
        id: 'start', speaker: 'Doutora Momo',
        text: 'Oi, ninja! Sou a Momo, cuido dos machucados da expedição.\nPreciso de Ervas de Luz da campina aqui do lado para fazer poções. Me traz 4?',
        options: [
          { label: '🌿 Trago!', nextNodeId: null, action: 'START:ervas;STEP:ervas.ouvir' },
          { label: 'Depois', nextNodeId: null },
        ],
      },
    } },
    { when: { active: 'ervas', step: 'ervas.preparar', notStep: 'ervas.voltar' }, tree: say('Doutora Momo',
      'Poção verde-clarinha: perfeita! Uma você leva, uma fica... não, leva as duas.\nAgora você sabe a receita: o caldeirão faz 1 poção com 2 ervas, quando quiser.',
      [{ label: '🧉 Obrigado!', nextNodeId: null, action: 'STEP:ervas.voltar' }]) },
    { when: { active: 'ervas', step: 'ervas.colher' }, tree: say('Doutora Momo', 'Agora o caldeirão, aqui do lado. A receita está escrita na tampa.') },
    { when: { active: 'ervas' }, tree: say('Doutora Momo', 'As Ervas de Luz brilham na Campina, entre o acampamento e o rio. É só passar por cima.') },
    { when: { notStarted: 'filhote', done: 'ervas' }, tree: {
      start: {
        id: 'start', speaker: 'Doutora Momo', mood: 'sad',
        text: 'Um filhote de coelho ficou preso num arbusto de espinhos na Clareira dos Bandidos.\nO problema são os ouriços que rondam por lá. Ele está com tanto medo...',
        options: [
          { label: '🐇 Eu solto ele', nextNodeId: null, action: 'START:filhote;STEP:filhote.ouvir' },
          { label: 'Depois', nextNodeId: null },
        ],
      },
    } },
    { when: { active: 'filhote', step: 'filhote.soltar', notStep: 'filhote.voltar' }, tree: say('Doutora Momo',
      'Ele voltou para a toca saltitando! Você foi muito corajoso. E gentil, que é mais difícil.',
      [{ label: '🐇 Que bom!', nextNodeId: null, action: 'STEP:filhote.voltar' }]) },
    { when: { active: 'filhote' }, tree: say('Doutora Momo', 'Os ouriços não deixam ninguém chegar perto do arbusto. Afaste-os: com barulho, com paciência ou com a patada.') },
    { tree: say('Doutora Momo', 'Corações baixos? A fogueira recupera todos. A poção, dois, em qualquer lugar.') },
  ],
};

export const WILD_NPCS: NPCDefinition[] = [YUKI_CAMP, BENTO_TREE_NPC, BENTO, MOMO];

/** What Yuki says at the Sede once the expedition plan is done: the way to the gate. */
export const YUKI_TRAIL_ROUTES = [
  { when: { notStarted: 'trilha', done: 'expedicao' } as Condition, tree: {
    start: {
      id: 'start', speaker: 'Conselheira Yuki', mood: 'happy' as const,
      text: 'A expedição partiu! Montamos o acampamento nas terras selvagens.\nA Trilha da Expedição sai do Bambuzal, no portão da cerca oeste, entre a casa de banho e a cabana do pescador. Te espero lá do outro lado.',
      options: [
        { label: '🏕️ Estou indo!', nextNodeId: null, action: 'START:trilha;STEP:trilha.ouvir' },
        { label: 'Depois', nextNodeId: null },
      ],
    },
  } },
  { when: { active: 'trilha', notStep: 'trilha.portao' } as Condition, tree: say('Conselheira Yuki', 'O portão da trilha fica no Bambuzal, na cerca oeste, entre a casa de banho e a cabana do pescador.') },
];

// ── Objects ──────────────────────────────────────────────────────────────────

export const WILD_OBJECTS: WorldObject[] = [
  {
    id: 'portao_trilha', kind: 'examine', position: TRAIL_GATE.at, label: 'Seguir pela Trilha da Expedição', name: 'Trilha da Expedição', radius: 1.8,
    usableWhen: { step: 'trilha.ouvir' },
    actions: 'STEP:trilha.portao;TRAVEL:selvagem',
  },
  {
    id: 'portao_trilha_fechado', kind: 'examine', position: TRAIL_GATE.at, label: 'Olhar o portão da trilha', name: 'Trilha da Expedição', radius: 1.8,
    when: { notStep: 'trilha.ouvir' },
    dialogue: say('Trilha da Expedição', 'Um portão de troncos, trancado com corda. Uma placa: "Trilha da Expedição. Só com autorização da Sede."\nSó os batedores da Conselheira Yuki passam por aqui.'),
  },
  {
    id: 'trilha_volta', kind: 'examine', position: WILD_GATE.at, label: 'Voltar para a vila', name: 'Trilha da Expedição', radius: 1.8,
    actions: 'TRAVEL:vila',
  },
  {
    id: 'placa_selvagem', kind: 'sign', position: w(43, 19.4), label: 'Ler a placa', name: 'Placa do Acampamento',
    dialogue: say('Placa do Acampamento',
      '⬅ Oeste: Campina das Ervas, Rio Corredeira (ponte), Mata Fechada.\n⬉ Norte do rio: pedras para atravessar, Ruínas do Sol, Caverna da Névoa, Mirante do Vento.\n➡ Leste: volta para a vila.'),
  },
  // one cauldron, three uses as the story goes (only one shows at a time): look, the recipe, then brewing
  {
    id: 'caldeirao', kind: 'examine', position: w(40.4, 17.6), label: 'Mexer no caldeirão', name: 'Caldeirão', radius: 1.5,
    when: { step: 'trilha.portao', notStep: 'ervas.colher', notFlag: 'receita_pocao' },
    dialogue: say('Caldeirão', 'Um caldeirão de ferro em brasa baixa. Na tampa, a receita da Doutora Momo: 2 Ervas de Luz para cada 3 conchas de água.'),
  },
  {
    id: 'caldeirao_receita', kind: 'examine', position: w(40.4, 17.6), label: 'Preparar a poção', name: 'Caldeirão', radius: 1.5,
    when: { active: 'ervas', step: 'ervas.colher', notStep: 'ervas.preparar' },
    usableWhen: { item: { id: 'erva_luz', count: 4 } },
    actions: 'CHALLENGE:receita_pocao',
  },
  {
    id: 'caldeirao_pocao', kind: 'examine', position: w(40.4, 17.6), label: 'Fazer uma Poção de Ervas (2 🌿)', name: 'Caldeirão', radius: 1.5,
    when: { flag: 'receita_pocao' },
    usableWhen: { item: { id: 'erva_luz', count: 2 } },
    actions: 'TAKE:erva_luz:2;GIVE:pocao_cura;SFX:potion',
  },
  // the tracks that lead to Bento, through the forest
  ...[[-8, 16], [-17, 25.5], [-28, 26.5]].map(([x, z], i): WorldObject => ({
    id: `pegada_bento_${i + 1}`, kind: 'clue', position: w(x, z), label: 'Olhar as pegadas', name: 'Pegadas', radius: 1.5,
    when: { active: 'explorador', step: 'explorador.ouvir', notFlag: `pegada_bento_${i + 1}` },
    dialogue: say('Pegadas', [
      'Pegadas de tanuki, bem fundas. Quem passou aqui carregava uma mochila pesada... e um rolo de papel caiu e foi apanhado de novo.',
      'Mais pegadas, agora correndo! E ao lado delas... marquinhas pontudas, de patinhas pequenas. Alguém estava sendo seguido?',
      'As pegadas param no pé de uma cerejeira enorme. As de tanuki sobem pelo tronco. As pontudas ficam dando voltas embaixo.',
    ][i], [{ label: '🐾 Seguir', nextNodeId: null }], `FLAG:pegada_bento_${i + 1};COUNT:pegadas_bento`),
  })),
  {
    id: 'diario_abandonado', kind: 'examine', position: w(-21, 33.4), label: 'Ler o diário rasgado', name: 'Acampamento Abandonado', radius: 1.6,
    dialogue: say('Diário rasgado',
      '"Dia 12. O General diz que o disco está nas ruínas, mas ninguém lê aquelas pedras.\nDia 13. Choveu. A barraca caiu. O Javali Rochoso comeu nosso estoque de atum.\nDia 14. Voltamos para o posto. Este acampamento fica para os mosquitos."',
      [{ label: '📖 Hmm...', nextNodeId: null }], 'FLAG:diario_hissui'),
  },
  {
    id: 'bau_abandonado', kind: 'chest', position: w(-18.8, 34.6), label: 'Abrir o caixote esquecido',
    hideWhen: { flag: 'bau_abandonado' },
    actions: 'FLAG:bau_abandonado;GIVE:petisco_atum:2;COINS:10;SFX:chest',
  },
  {
    id: 'bau_cachoeira', kind: 'chest', position: w(10.2, -39.6), label: 'Abrir o baú escondido atrás da cachoeira',
    hideWhen: { flag: 'bau_cachoeira' },
    actions: 'FLAG:bau_cachoeira;GEMS:3;COINS:20;GIVE:pocao_cura;SECRET:cachoeira;SFX:chest',
  },
  {
    id: 'mirante_vento', kind: 'examine', position: w(44.6, -35, LOOKOUT.h), label: 'Olhar a paisagem', name: 'Mirante do Vento', radius: 1.8,
    dialogue: say('Mirante do Vento',
      'Daqui de cima dá para ver tudo: a fumaça do posto do Hissui no desfiladeiro, a névoa saindo da caverna, o rio brilhando até a cachoeira.\nE lá longe, pequenininha, a Vila das Patas.',
      [{ label: '🌄 Uau', nextNodeId: null }], 'FLAG:mirante_vento'),
  },
  {
    id: 'mirante_premio', kind: 'chest', position: w(41.6, -37.2, LOOKOUT.h), label: 'Abrir a caixa dos batedores',
    hideWhen: { flag: 'mirante_premio' },
    actions: 'FLAG:mirante_premio;GEMS:2;GIVE:peixe_grelhado:2;XP:30;SFX:chest',
  },
  {
    id: 'inscricao_sol', kind: 'examine', position: w(31, -11.6), label: 'Ler a inscrição', name: 'Inscrição do Portão',
    radius: 1.5,
    dialogue: say('Inscrição do Portão',
      'Letras antigas, quase apagadas:\n"O sol nasce primeiro.\nA lua só aparece depois da nuvem, logo depois dela.\nA estrela nunca fica para o fim."\nNa frente do portão, quatro pedras: lua, sol, estrela e nuvem.',
      [{ label: '🌞 Entendi', nextNodeId: null }], 'FLAG:inscricao_lida;STEP:ruinas.inscricao'),
  },
  {
    id: 'pedestal_disco', kind: 'examine', position: w(31, -16.6), label: 'Pegar o Disco Solar', name: 'Pedestal', radius: 1.4,
    when: { flag: 'portao_sol_aberto', notFlag: 'disco_pego' },
    dialogue: say('Pedestal', 'Um disco de bronze com um sol gravado, quente como se tivesse ficado ao sol o dia todo.',
      [{ label: '🌞 Guardar o disco', nextNodeId: null }], 'FLAG:disco_pego;GIVE:disco_solar;STEP:ruinas.artefato'),
  },
  {
    id: 'mesa_ordens', kind: 'clue', position: w(-43, -34), label: 'Ler os papéis na mesa', name: 'Ordens do General Hissui', radius: 1.5,
    when: { active: 'posto', notStep: 'posto.ordens' },
    dialogue: say('Ordens do General Hissui',
      'Um bilhete com a marca de uma garra:\n"Batedores: achem o Disco Solar das ruínas antes da Vila das Patas. Ele abre o que a vila esconde.\nSem barulho. — General Hissui"',
      [{ label: '📜 Levar as ordens', nextNodeId: null }], 'GIVE:ordens_hissui;STEP:posto.ordens'),
  },
];

// ── Missions (chapter 6) ─────────────────────────────────────────────────────

export const WILD_MISSIONS: Mission[] = [
  {
    id: 'trilha', chapter: 6, title: 'A Expedição Parte', category: 'principal', giver: 'yuki',
    description: 'A expedição montou acampamento nas terras selvagens. A Trilha da Expedição sai do Bambuzal, pela cerca oeste.',
    steps: [
      { id: 'ouvir', description: 'Fale com a Conselheira Yuki na Sede', target: { npc: 'yuki' } },
      { id: 'portao', description: 'Atravesse o portão da Trilha da Expedição (cerca oeste do Bambuzal)', target: { object: 'portao_trilha' } },
      { id: 'acampamento', description: 'Encontre a Yuki no acampamento', target: { npc: 'yuki_campo' } },
    ],
    rewards: { xp: 50, coins: 15 },
    lesson: 'Antes de explorar, conheça as regras do lugar: elas protegem você e quem mora lá.',
  },
  {
    id: 'explorador', chapter: 6, title: 'O Explorador Pendurado', category: 'cômica', giver: 'yuki_campo',
    description: 'O Bento, cartógrafo da expedição, sumiu na Mata Fechada. Siga as pegadas.',
    steps: [
      { id: 'ouvir', description: 'Ouça a Yuki', target: { npc: 'yuki_campo' } },
      { id: 'pegadas', description: 'Siga as pegadas pela mata (atravesse a ponte)', after: ['ouvir'], counter: { id: 'pegadas_bento', goal: 3 }, target: { object: 'pegada_bento_1' } },
      { id: 'achar', description: 'Ache o Bento', after: ['pegadas'], target: { npc: 'bento_arvore' } },
      { id: 'descer', description: 'Tire o ouriço de perto da árvore e ajude o Bento a descer', after: ['achar'], target: { position: w(BENTO_TREE.x + 1.6, BENTO_TREE.z) } },
      { id: 'voltar', description: 'Fale com o Bento no acampamento', after: ['descer'], target: { npc: 'bento' } },
    ],
    rewards: { xp: 80, coins: 25, gems: 2, items: { petisco_atum: 2 }, badges: ['Resgatador da Mata'] },
    lesson: 'Pegadas contam histórias: tamanho, profundidade e direção dizem quem passou, carregando o quê e com que pressa.',
  },
  {
    id: 'ervas', chapter: 6, title: 'Ervas de Luz', category: 'educativa', giver: 'momo',
    description: 'A Doutora Momo precisa de Ervas de Luz para fazer poções de cura.',
    steps: [
      { id: 'ouvir', description: 'Ouça a Doutora Momo', target: { npc: 'momo' } },
      { id: 'colher', description: 'Colha Ervas de Luz na campina', after: ['ouvir'], counter: { id: 'ervas_colhidas', goal: 4 }, target: { position: w(19, 30) } },
      { id: 'preparar', description: 'Prepare a poção no caldeirão (com 4 ervas na mochila)', after: ['colher'], target: { object: 'caldeirao_receita' } },
      { id: 'voltar', description: 'Mostre a poção à Doutora Momo', after: ['preparar'], target: { npc: 'momo' } },
    ],
    rewards: { xp: 60, coins: 15, gems: 2 },
    lesson: 'Uma receita é uma proporção: se as ervas dobram, a água dobra junto.',
  },
  {
    id: 'filhote', chapter: 6, title: 'O Filhote nos Espinhos', category: 'secundária', giver: 'momo',
    description: 'Um filhote de coelho está preso num arbusto de espinhos, e os ouriços bandidos rondam a clareira.',
    steps: [
      { id: 'ouvir', description: 'Ouça a Doutora Momo', target: { npc: 'momo' } },
      { id: 'soltar', description: 'Afaste os ouriços e solte o filhote (Clareira dos Bandidos)', after: ['ouvir'], target: { position: w(KIT_BUSH.at[0], KIT_BUSH.at[1]) } },
      { id: 'voltar', description: 'Conte à Doutora Momo', after: ['soltar'], target: { npc: 'momo' } },
    ],
    rewards: { xp: 60, coins: 20, badges: ['Protetor dos Bichos'] },
    lesson: 'Proteger alguém não exige vencer todo mundo: às vezes basta afastar o perigo pelo tempo certo.',
  },
  {
    id: 'cristais', chapter: 6, title: 'Cristais da Névoa', category: 'exploração', giver: 'bento',
    description: 'Na Caverna da Névoa há cristais que só aparecem com o Faro, guardados por espíritos da névoa.',
    steps: [
      { id: 'ouvir', description: 'Ouça o Bento', target: { npc: 'bento' } },
      { id: 'coletar', description: 'Ache 3 Cristais da Névoa na caverna (use o Faro)', after: ['ouvir'], counter: { id: 'cristais_colhidos', goal: 3 }, target: { position: w(26, -30) } },
      { id: 'voltar', description: 'Leve os cristais ao Bento', after: ['coletar'], target: { npc: 'bento' } },
    ],
    rewards: { xp: 70, coins: 30, gems: 3 },
    lesson: 'Alguns segredos só aparecem para quem muda o jeito de olhar.',
    onComplete: 'TAKE:cristal_nevoa:3',
  },
  {
    id: 'ruinas', chapter: 6, title: 'O Portão das Ruínas', category: 'investigação', giver: 'bento',
    description: 'Um portão antigo nas Ruínas do Sol, quatro pedras e uma inscrição que ninguém decifra há cem anos.',
    steps: [
      { id: 'ouvir', description: 'Ouça o Bento', target: { npc: 'bento' } },
      { id: 'inscricao', description: 'Leia a inscrição do portão', after: ['ouvir'], target: { object: 'inscricao_sol' } },
      { id: 'mecanismo', description: 'Toque as quatro pedras na ordem da inscrição', after: ['inscricao'], target: { position: w(31, -9) } },
      { id: 'artefato', description: 'Pegue o que o portão guardava', after: ['mecanismo'], target: { object: 'pedestal_disco' } },
      { id: 'voltar', description: 'Mostre ao Bento', after: ['artefato'], target: { npc: 'bento' } },
    ],
    rewards: { xp: 90, coins: 30, gems: 3, badges: ['Arqueólogo Ninja'] },
    lesson: 'Regras de ordem se resolvem uma de cada vez: comece pela que tem certeza (quem vem primeiro) e encaixe o resto.',
  },
  {
    id: 'posto', chapter: 6, title: 'O Posto do Hissui', category: 'principal', giver: 'yuki_campo',
    description: 'No fim do Desfiladeiro das Pedras fica o posto avançado do General Hissui. O que ele procura nas terras selvagens?',
    steps: [
      { id: 'ouvir', description: 'Ouça a Yuki', target: { npc: 'yuki_campo' } },
      { id: 'desfiladeiro', description: 'Passe pelo Javali Rochoso no desfiladeiro (agachado, com um petisco ou enfrentando)', after: ['ouvir'], target: { position: w(-37, CANYON_PASSED_Z - 1) } },
      { id: 'ordens', description: 'Leia as ordens na mesa do posto', after: ['desfiladeiro'], target: { object: 'mesa_ordens' } },
      { id: 'voltar', description: 'Leve as ordens à Yuki', after: ['ordens'], target: { npc: 'yuki_campo' } },
    ],
    rewards: { xp: 120, coins: 40, gems: 4, badges: ['Sombra do Desfiladeiro'] },
    lesson: 'Quem observa antes de agir descobre mais e se arrisca menos.',
    onComplete: 'FLAG:capitulo6_fim',
  },
];

/** Defeating a creature for the first time each visit pays a little; these counters feed the Jornada. */
export const WILD_COUNTERS = ['pegadas_bento', 'ervas_colhidas', 'cristais_colhidos', 'bichos_espantados', 'armadilhas_desarmadas'];
