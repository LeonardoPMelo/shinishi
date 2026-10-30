import { describe, expect, it, beforeEach } from 'vitest';
import { MISSIONS, MISSION_ORDER } from '../src/data/missions';
import { CHAPTERS, CHAPTER_RECAPS, STORY_EPILOGUE } from '../src/data/campaign';
import { NPC_DEFINITIONS, NPCS_BY_ID, availableOffer, resolveDialogue } from '../src/data/npcs';
import { OBJECTS_BY_ID, SHED_POS, WORLD_OBJECTS } from '../src/data/world';
import { ITEMS } from '../src/data/items';
import { CHALLENGES } from '../src/data/challenges';
import { ENEMY_SPAWNS } from '../src/data/wild';
import { SHED_AT, INTRO_PANELS, STORY_MISSIONS, STORY_REACTIONS } from '../src/data/story';
import { checkCondition, emptyProgress } from '../src/systems/progression';
import { validateData } from '../src/systems/validateData';
import { useGameStore } from '../src/store/gameStore';
import type { Progress } from '../src/types';

const allDoneExcept = (...ids: string[]): Progress => {
  const p = emptyProgress();
  for (const m of Object.values(MISSIONS)) if (!ids.includes(m.id)) p.missions[m.id] = { status: 'done', steps: m.steps.map((s) => s.id) };
  return p;
};

describe('critério da Etapa 8: toda missão é verificável', () => {
  const report = validateData();
  const allActions = [
    // missions that open when another one ends, or when a challenge is solved
    ...Object.values(MISSIONS).map((m) => m.onComplete),
    ...Object.values(CHALLENGES).map((c) => c.onSuccess),
    ...WORLD_OBJECTS.flatMap((o) => [o.actions, ...Object.values(o.dialogue ?? {}).flatMap((n) => [n.onEnter, ...(n.options ?? []).map((x) => x.action)])]),
    ...NPC_DEFINITIONS.flatMap((n) => n.routes.flatMap((r) => Object.values(r.tree ?? {}).flatMap((nd) => [nd.onEnter, ...(nd.options ?? []).map((x) => x.action)]))),
  ].join(';');

  it.each(MISSION_ORDER)('%s: pré-requisito, objetivos rastreáveis, conclusão e recompensa', (id) => {
    const m = MISSIONS[id];
    // context
    expect(m.title.length, 'título').toBeGreaterThan(3);
    expect(m.description.length, 'descrição').toBeGreaterThan(20);
    expect(m.lesson.length, 'lição').toBeGreaterThan(20);
    expect(CHAPTERS.some((c) => c.id === m.chapter), 'capítulo').toBe(true);
    // origin and prerequisites: a villager offers it (with a condition, except the very first ones), or data starts it
    const offers = NPC_DEFINITIONS.flatMap((n) => (n.offers ?? []).filter((o) => o.mission === id).map((o) => ({ npc: n.id, when: o.when })));
    const startedByData = allActions.includes(`START:${id}`);
    expect(offers.length > 0 || startedByData || m.category === 'exploração', 'quem começa').toBe(true);
    // trackable objectives: every step says what to do and where (a target or a counter)
    expect(m.steps.length, 'etapas').toBeGreaterThanOrEqual(2);
    for (const s of m.steps) {
      expect(s.description.length, `${s.id}: descrição`).toBeGreaterThan(5);
      expect(!!s.target || !!s.counter, `${s.id}: alvo ou contador`).toBe(true);
      if (s.target && 'npc' in s.target) expect(NPCS_BY_ID[s.target.npc], `${s.id}: NPC`).toBeDefined();
      if (s.target && 'object' in s.target) expect(OBJECTS_BY_ID[s.target.object], `${s.id}: objeto`).toBeDefined();
    }
    // unambiguous completion: some data action, registered code action or counter completes every step
    expect(report.errors.filter((e) => e.startsWith(`missão ${id}.`)), 'o que conclui cada etapa').toEqual([]);
    // verifiable rewards
    expect(m.rewards.xp, 'xp').toBeGreaterThan(0);
    for (const it of Object.keys(m.rewards.items ?? {})) expect(ITEMS[it], `item ${it}`).toBeDefined();
  });

  it('cada capítulo tem um resumo da história para a Jornada, e o fim tem um epílogo', () => {
    for (const c of CHAPTERS) expect(CHAPTER_RECAPS[c.id]?.length ?? 0, `capítulo ${c.id}`).toBeGreaterThan(40);
    expect(STORY_EPILOGUE).toMatch(/temporada/);
  });
});

describe('capítulo 7: O Pacto das Duas Margens', () => {
  const st = () => useGameStore.getState();
  beforeEach(() => {
    st().resetGame();
    useGameStore.setState({ phase: 'playing', celebrations: [] });
  });
  const talk = (npcId: string) => {
    const d = resolveDialogue(NPCS_BY_ID[npcId], st().progress);
    return d ? Object.values(d.tree).map((n) => n.text).join(' ') : '';
  };

  it('começa depois do posto do Hissui, com o Mikage; o celeiro espera o Disco Solar das ruínas', () => {
    expect(availableOffer(NPCS_BY_ID.mikage, allDoneExcept(...STORY_MISSIONS.map((m) => m.id), 'posto'))).not.toBe('conselho');
    expect(availableOffer(NPCS_BY_ID.mikage, allDoneExcept(...STORY_MISSIONS.map((m) => m.id)))).toBe('conselho');
    const noRuins = allDoneExcept('celeiro', 'hissui', 'cesto', 'tecnicas', 'ruinas');
    expect(availableOffer(NPCS_BY_ID.tsubaki, noRuins)).toBeNull();
    expect(availableOffer(NPCS_BY_ID.tsubaki, allDoneExcept('celeiro', 'hissui', 'cesto', 'tecnicas'))).toBe('celeiro');
  });

  it('a história inteira, do jeito que o jogo roda as ações', () => {
    const p = allDoneExcept(...STORY_MISSIONS.map((m) => m.id));
    p.inventory.disco_solar = 1;
    p.inventory.ordens_hissui = 1;
    useGameStore.setState({ progress: p });
    const run = (a: string) => {
      st().runActions(a);
      useGameStore.setState({ phase: 'playing', activeDialogue: null, activeChallenge: null, celebrations: [] });
    };
    run('START:conselho');
    run('STEP:conselho.ouvir;TAKE:ordens_hissui');
    run(OBJECTS_BY_ID.registro_cheia.dialogue!.start.onEnter!);
    run('STEP:conselho.mikage');
    expect(st().progress.missions.conselho.status).toBe('done');
    run('START:celeiro;STEP:celeiro.ouvir');
    // the pedestal needs the disc in the bag
    expect(checkCondition(OBJECTS_BY_ID.pedestal_sol.usableWhen, st().progress)).toBe(true);
    run(OBJECTS_BY_ID.pedestal_sol.dialogue!.start.onEnter!);
    run(OBJECTS_BY_ID.inscricao_celeiro.dialogue!.start.onEnter!);
    run('STEP:celeiro.mikage;GIVE:carta_mikage');
    expect(st().progress.missions.celeiro.status).toBe('done');
    expect(st().progress.inventory.carta_mikage).toBe(1);
    // Hissui: the letter, the three riddles, the pact
    run('START:hissui;STEP:hissui.ouvir');
    expect(checkCondition(NPCS_BY_ID.hissui.visibleWhen, st().progress)).toBe(true);
    expect(talk('hissui')).toMatch(/aprendiz/);
    run('STEP:hissui.encontrar;TAKE:carta_mikage');
    for (const c of ['duelo_1', 'duelo_2', 'duelo_3']) {
      st().openChallenge(c);
      expect(st().submitAnswer(CHALLENGES[c].answer)).toBe('correct');
      st().closeChallenge();
    }
    expect(st().progress.missions.hissui.steps).toEqual(expect.arrayContaining(['duelo1', 'duelo2', 'duelo3']));
    // without the jade ribbon he doesn't recognise anything
    expect(talk('hissui')).not.toMatch(/Junco/);
    run('STEP:hissui.acordo');
    expect(checkCondition(NPCS_BY_ID.hissui_sede.visibleWhen, st().progress)).toBe(true);
    expect(checkCondition(NPCS_BY_ID.hissui.visibleWhen, st().progress)).toBe(false);
    expect(talk('mikage')).toMatch(/Duas Margens/);
    run('STEP:hissui.pacto');
    expect(st().progress.missions.hissui.status).toBe('done');
    expect(st().progress.flags.hissui_aliado).toBe(true);
    expect(st().player.badges).toContain('Guardião do Pacto');
    expect(checkCondition(NPCS_BY_ID.hissui_aliado.visibleWhen, st().progress)).toBe(true);
    expect(checkCondition(NPCS_BY_ID.hissui_sede.visibleWhen, st().progress)).toBe(false);
  });

  it('a fita verde-jade, vestida, faz o Hissui reconhecer de onde o Shinichi veio', () => {
    const p = allDoneExcept('hissui');
    p.missions.hissui = { status: 'active', steps: ['ouvir', 'encontrar', 'duelo1', 'duelo2', 'duelo3'] };
    p.inventory.fita_jade = 1;
    useGameStore.setState({ progress: p });
    expect(talk('hissui')).not.toMatch(/Junco/);
    expect(st().equipItem('fita_jade')).toBe('ok');
    expect(talk('hissui')).toMatch(/Junco/);
  });

  it('o cesto da Vovó Mochi dá a fita, que é uma faixa de vestir', () => {
    expect(ITEMS.fita_jade.slot).toBe('faixa');
    expect(OBJECTS_BY_ID.cesto_antigo.dialogue!.start.onEnter).toMatch(/GIVE:fita_jade/);
    expect(SHED_AT).toEqual(SHED_POS);
  });

  it('as estelas: lidas durante a missão contam uma vez cada; fora dela, continuam legíveis', () => {
    const p = allDoneExcept('tecnicas');
    p.missions.tecnicas = { status: 'active', steps: ['ouvir'] };
    useGameStore.setState({ progress: p });
    for (const id of ['estela_faro', 'estela_miado', 'estela_salto']) {
      const o = OBJECTS_BY_ID[`${id}_missao`];
      expect(checkCondition(o.when, st().progress)).toBe(true);
      // the plain stele hides while the mission one is up (never two prompts on the same stone)
      expect(checkCondition(OBJECTS_BY_ID[id].hideWhen, st().progress)).toBe(true);
      st().runActions(o.dialogue!.start.onEnter!);
      expect(checkCondition(o.when, st().progress)).toBe(false);
    }
    expect(st().progress.missions.tecnicas.steps).toContain('estelas');
  });

  it('consequências: depois do pacto, o bando do Hissui não ataca mais e as armadilhas somem', () => {
    const band = ENEMY_SPAWNS.filter((s) => s.kind === 'ouriço' || s.kind === 'ourico' || s.kind === 'raposa');
    const p = allDoneExcept();
    p.flags.hissui_aliado = true;
    expect(band.filter((s) => checkCondition(s.when, p))).toEqual([]);
    // the cave spirits stay: they are not anyone's band
    expect(ENEMY_SPAWNS.filter((s) => s.kind === 'espirito').every((s) => checkCondition(s.when, p))).toBe(true);
  });

  it('os moradores comentam a história conforme ela anda', () => {
    for (const [id, list] of Object.entries(STORY_REACTIONS)) {
      expect(NPCS_BY_ID[id], id).toBeDefined();
      expect(NPCS_BY_ID[id].reactions).toBe(list);
    }
    const end = allDoneExcept();
    expect(NPCS_BY_ID.chef_tofu.reactions!.find((r) => checkCondition(r.when, end))!.barks.join(' ')).toMatch(/peixes por família/);
  });

  it('a introdução conta o começo em poucos quadros', () => {
    expect(INTRO_PANELS.length).toBeGreaterThanOrEqual(3);
    expect(INTRO_PANELS.length).toBeLessThanOrEqual(5);
    for (const p of INTRO_PANELS) expect(p.text.length).toBeLessThan(220);
  });
});
