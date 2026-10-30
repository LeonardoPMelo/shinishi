import type { Condition, DialogueTree } from '../types';
import { MISSIONS } from '../data/missions';
import { CHALLENGES } from '../data/challenges';
import { ITEMS } from '../data/items';
import { NPC_DEFINITIONS, NPCS_BY_ID } from '../data/npcs';
import { WORLD_OBJECTS, OBJECTS_BY_ID } from '../data/world';
import { CHAPTERS } from '../data/campaign';
import { SKILLS } from '../data/skills';
import { TEMPLE_SOLVE_ACTIONS } from '../data/temple';
import { ACADEMY_CODE_ACTIONS } from '../data/academy';
import { SEDE_CODE_ACTIONS } from '../data/mikage';
import { WILD_CODE_ACTIONS } from '../data/wild';
import { SHOPS, SHOPS_BY_ID } from '../data/shops';
import { parseActions } from './progression';

/**
 * Dev check of the game data: every id a mission, dialogue, object or challenge points to
 * must exist. Runs once on load in development and prints what is broken; `__validate()`
 * returns the full report. Missing references are the bugs that only show up hours into play.
 */

const KNOWN_CMDS = new Set(['START', 'STEP', 'FLAG', 'UNFLAG', 'GIVE', 'TAKE', 'COINS', 'XP', 'GEMS', 'COUNT', 'ABILITY', 'TRACK', 'SFX', 'SECRET', 'CHALLENGE', 'CLOSE', 'SKILL', 'SHOP', 'TRAVEL']);
const ABILITIES = new Set(['faro', 'miado', 'double_jump', 'passo_leve']);
/** Flags the game code sets directly (not through data actions). */
const CODE_FLAGS = new Set(['alvo_numeros']);
/** Steps completed by world components rather than by data actions. */
const CODE_STEPS = new Set(['peixe_fujao.pegar']);
/** Counters bumped by world components (rings, leaves, goal) rather than by data. */
const CODE_COUNTERS = new Set(['argolas', 'folhas', 'gols', 'compras_sora', 'coelhos_alimentados', 'circuito_recorde', 'ervas_colhidas', 'cristais_colhidos', 'bichos_espantados', 'armadilhas_desarmadas']);

export interface DataReport {
  errors: string[];
  /** Flags read by conditions but never set by any data action (check the code sets them). */
  flagsOnlyRead: string[];
  /** Counters read but never bumped. */
  countersOnlyRead: string[];
  /** First data action that completes each step ("mission.step" → action string), for test runs. */
  stepActions: Record<string, string>;
  stats: Record<string, number>;
}

export function validateData(): DataReport {
  const errors: string[] = [];
  const flagsSet = new Set<string>(CODE_FLAGS);
  const flagsRead = new Set<string>();
  const countersSet = new Set<string>(CODE_COUNTERS);
  const countersRead = new Set<string>();
  const stepsDone = new Set<string>(CODE_STEPS);
  const stepActions: Record<string, string> = {};
  let trees = 0;
  let actions = 0;

  const stepRef = (ref: string, where: string) => {
    const [m, s] = ref.split('.');
    if (!MISSIONS[m]) errors.push(`${where}: missão inexistente "${m}" em "${ref}"`);
    else if (!MISSIONS[m].steps.some((st) => st.id === s)) errors.push(`${where}: etapa inexistente "${ref}"`);
  };
  const missionRef = (id: string, where: string) => {
    if (!MISSIONS[id]) errors.push(`${where}: missão inexistente "${id}"`);
  };
  const list = (v?: string | string[]) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

  const cond = (c: Condition | undefined, where: string) => {
    if (!c) return;
    if (c.active) missionRef(c.active, where);
    list(c.done).forEach((m) => missionRef(m, where));
    if (c.notStarted) missionRef(c.notStarted, where);
    if (c.notDone) missionRef(c.notDone, where);
    [...list(c.step), ...list(c.notStep)].forEach((r) => stepRef(r, where));
    [...list(c.flag), ...list(c.notFlag)].forEach((f) => flagsRead.add(f));
    if (c.item && !ITEMS[c.item.id]) errors.push(`${where}: item inexistente "${c.item.id}"`);
    if (c.counter) countersRead.add(c.counter.id);
    if (c.ability && !ABILITIES.has(c.ability)) errors.push(`${where}: técnica desconhecida "${c.ability}"`);
  };

  const act = (s: string | undefined, where: string) => {
    for (const { cmd, arg } of parseActions(s)) {
      actions++;
      if (!KNOWN_CMDS.has(cmd)) errors.push(`${where}: ação desconhecida "${cmd}"`);
      if (cmd === 'START' || cmd === 'TRACK') missionRef(arg, where);
      if (cmd === 'STEP') {
        stepRef(arg, where);
        stepsDone.add(arg);
        stepActions[arg] ??= s!;
      }
      if (cmd === 'FLAG') flagsSet.add(arg);
      if ((cmd === 'GIVE' || cmd === 'TAKE') && !ITEMS[arg]) errors.push(`${where}: item inexistente "${arg}"`);
      if (cmd === 'CHALLENGE' && !CHALLENGES[arg]) errors.push(`${where}: desafio inexistente "${arg}"`);
      if (cmd === 'ABILITY' && !ABILITIES.has(arg)) errors.push(`${where}: técnica desconhecida "${arg}"`);
      if (cmd === 'COUNT') countersSet.add(arg);
      if (cmd === 'SKILL' && !SKILLS[arg as keyof typeof SKILLS]) errors.push(`${where}: habilidade desconhecida "${arg}"`);
      if (cmd === 'SHOP' && arg && !SHOPS_BY_ID[arg]) errors.push(`${where}: loja inexistente "${arg}"`);
      if (['COINS', 'XP', 'GEMS'].includes(cmd) && Number.isNaN(Number(arg))) errors.push(`${where}: valor inválido em "${cmd}:${arg}"`);
    }
  };

  const tree = (t: DialogueTree, where: string) => {
    trees++;
    if (!t.start) errors.push(`${where}: diálogo sem nó "start"`);
    for (const [id, node] of Object.entries(t)) {
      if (node.id !== id) errors.push(`${where}: nó "${id}" com id "${node.id}"`);
      act(node.onEnter, `${where}/${id}`);
      for (const o of node.options ?? []) {
        if (o.nextNodeId !== null && !t[o.nextNodeId]) errors.push(`${where}/${id}: opção "${o.label}" leva a nó inexistente "${o.nextNodeId}"`);
        act(o.action, `${where}/${id}`);
        cond(o.when, `${where}/${id}`);
      }
    }
  };

  // missions
  for (const m of Object.values(MISSIONS)) {
    const where = `missão ${m.id}`;
    if (!CHAPTERS.some((c) => c.id === m.chapter)) errors.push(`${where}: capítulo ${m.chapter} não existe`);
    if (m.giver && !NPCS_BY_ID[m.giver]) errors.push(`${where}: quem dá a missão não existe ("${m.giver}")`);
    const ids = m.steps.map((s) => s.id);
    if (new Set(ids).size !== ids.length) errors.push(`${where}: etapas com id repetido`);
    for (const st of m.steps) {
      for (const a of st.after ?? []) if (!ids.includes(a)) errors.push(`${where}.${st.id}: "after" aponta para etapa inexistente "${a}"`);
      if (st.target && 'npc' in st.target && !NPCS_BY_ID[st.target.npc]) errors.push(`${where}.${st.id}: alvo NPC inexistente "${st.target.npc}"`);
      if (st.target && 'object' in st.target && !OBJECTS_BY_ID[st.target.object] && !/^paw_\d+$/.test(st.target.object)) errors.push(`${where}.${st.id}: alvo objeto inexistente "${st.target.object}"`);
      if (st.counter) countersRead.add(st.counter.id);
    }
    for (const it of Object.keys(m.rewards.items ?? {})) if (!ITEMS[it]) errors.push(`${where}: recompensa com item inexistente "${it}"`);
    if (m.rewards.ability && !ABILITIES.has(m.rewards.ability)) errors.push(`${where}: técnica desconhecida`);
    act(m.onComplete, where);
  }

  // challenges
  for (const c of Object.values(CHALLENGES)) {
    const where = `desafio ${c.id}`;
    if (!SKILLS[c.skill]) errors.push(`${where}: habilidade desconhecida "${c.skill}"`);
    if (c.kind === 'choice' && (!c.choices || c.answer < 0 || c.answer >= c.choices.length)) errors.push(`${where}: resposta fora das opções`);
    act(c.onSuccess, where);
  }

  // actions run by world components (temple puzzles)
  for (const [k, a] of Object.entries(TEMPLE_SOLVE_ACTIONS)) act(a, `templo ${k}`);
  for (const [k, a] of Object.entries(ACADEMY_CODE_ACTIONS)) act(a, `academia ${k}`);
  for (const [k, a] of Object.entries(SEDE_CODE_ACTIONS)) act(a, `sede ${k}`);
  for (const [k, a] of Object.entries(WILD_CODE_ACTIONS)) act(a, `selvagem ${k}`);

  // NPCs
  const npcIds = new Set<string>();
  for (const n of NPC_DEFINITIONS) {
    if (npcIds.has(n.id)) errors.push(`NPC repetido: ${n.id}`);
    npcIds.add(n.id);
    cond(n.visibleWhen, `npc ${n.id}`);
    for (const o of n.offers ?? []) {
      missionRef(o.mission, `npc ${n.id} (oferta)`);
      cond(o.when, `npc ${n.id} (oferta)`);
    }
    n.routes.forEach((r, i) => {
      cond(r.when, `npc ${n.id} rota ${i}`);
      const lazy = (r as { make?: () => DialogueTree }).make;
      tree(lazy ? lazy() : r.tree, `npc ${n.id} rota ${i}`);
    });
  }

  // world objects
  const objIds = new Set<string>();
  for (const o of WORLD_OBJECTS) {
    const where = `objeto ${o.id}`;
    if (objIds.has(o.id)) errors.push(`objeto repetido: ${o.id}`);
    objIds.add(o.id);
    [o.when, o.hideWhen, o.usableWhen].forEach((c) => cond(c, where));
    act(o.actions, where);
    if (o.dialogue) tree(o.dialogue, where);
  }

  // every step needs a way to be completed: a STEP action, a counter goal or game code
  for (const m of Object.values(MISSIONS)) {
    for (const st of m.steps) {
      if (!st.counter && !stepsDone.has(`${m.id}.${st.id}`)) errors.push(`missão ${m.id}.${st.id}: nada completa esta etapa`);
    }
  }

  // shops (Etapa 6): every offer sells a real item, ids are unique, locked offers say why
  const offerIds = new Set<string>();
  for (const shop of SHOPS) {
    for (const o of shop.offers) {
      const where = `loja ${shop.id}/${o.id}`;
      if (offerIds.has(o.id)) errors.push(`${where}: oferta repetida`);
      offerIds.add(o.id);
      if (!ITEMS[o.item]) errors.push(`${where}: item inexistente "${o.item}"`);
      cond(o.when, where);
      if (o.when && !o.lockedText) errors.push(`${where}: bloqueada sem dizer por quê`);
    }
  }

  // items
  for (const i of Object.values(ITEMS)) if (!i.name || !i.icon) errors.push(`item ${i.id}: sem nome ou ícone`);

  return {
    errors,
    flagsOnlyRead: [...flagsRead].filter((f) => !flagsSet.has(f) && !f.startsWith('veste_')).sort(),
    countersOnlyRead: [...countersRead].filter((c) => !countersSet.has(c)).sort(),
    stepActions,
    stats: {
      missoes: Object.keys(MISSIONS).length,
      desafios: Object.keys(CHALLENGES).length,
      npcs: NPC_DEFINITIONS.length,
      objetos: WORLD_OBJECTS.length,
      itens: Object.keys(ITEMS).length,
      dialogos: trees,
      acoes: actions,
    },
  };
}

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__validate = validateData;
  const r = validateData();
  if (r.errors.length) console.warn(`[dados] ${r.errors.length} problema(s):\n` + r.errors.join('\n'));
}
