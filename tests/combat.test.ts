import { describe, expect, it } from 'vitest';
import {
  ENEMIES, LEVELS, NOISE, PAW, PINECONE, calmEnemy, enemyStep, fullHearts, healCat, hearNoise, hitEnemy, hurtCat, isActive,
  makeEnemy, notices, pawTargets, resetEnemy, stepPinecones, throwPinecone,
  type CombatCat, type CombatEnv, type Enemy, type Pinecone,
} from '../src/systems/combat';
import {
  BENTO_GUARD_CLEAR, CANYON, CAVE, LOOKOUT, CRYSTALS, ENEMY_SPAWNS, HERB_SPOTS, KIT_BUSH, OUTPOST, ROPE_BRIDGE, SUN_PUZZLE, SUN_STONES, TRAPS,
  WILD, WILD_AREAS, WILD_GATE, WILD_NPCS, WILD_OBJECTS, WILD_RECT, WILD_RESPAWN, WILD_RIVER, WILD_STONES, WILD_STONE_R, WILD_WALLS,
  inWall, inWildRiver, toLocal, wildAreaAt, w,
} from '../src/data/wild';
import { solutions } from '../src/systems/orderPuzzle';
import { clampToRegions } from '../src/data/regions';
import { ITEMS } from '../src/data/items';
import { MISSIONS } from '../src/data/missions';
import { SHOPS_BY_ID } from '../src/data/shops';
import { NPC_DEFINITIONS, availableOffer, resolveDialogue } from '../src/data/npcs';
import { checkCondition } from '../src/systems/progression';
import type { Progress } from '../src/types';

const emptyProgress = (): Progress => ({ missions: {}, flags: {}, counters: {}, inventory: {}, abilities: [], tracked: null, learning: {}, solved: [], equipped: {} });

const open: CombatEnv = { free: () => true, ground: () => true };
const cat = (x: number, z: number, more: Partial<CombatCat> = {}): CombatCat => ({ x, z, crouch: false, speed: 2, faro: false, active: true, ...more });
const rng = () => 0.5;
/** Runs the creature for `s` seconds in 1/30 s steps; returns every event. */
function run(e: Enemy, s: number, c: CombatCat | (() => CombatCat), env = open, level: Parameters<typeof enemyStep>[5] = 'normal') {
  const out: ReturnType<typeof enemyStep> = [];
  for (let t = 0; t < s; t += 1 / 30) out.push(...enemyStep(e, 1 / 30, typeof c === 'function' ? c() : c, env, rng, level));
  return out;
}

describe('combate: os bichos percebem o gato', () => {
  it('vê na frente, até a distância de visão; agachado, só pela metade', () => {
    const e = makeEnemy('o', 'ourico', 0, 0, 3, 0); // looking +z
    expect(notices(e, cat(0, 6), open)).toBe(true);
    expect(notices(e, cat(0, 6, { crouch: true }), open)).toBe(false);
    expect(notices(e, cat(0, 3, { crouch: true }), open)).toBe(true);
    expect(notices(e, cat(0, ENEMIES.ourico.sight + 0.5), open)).toBe(false);
  });

  it('pelas costas, só escuta de perto; agachado, quase nada; correndo, de longe', () => {
    const e = makeEnemy('o', 'ourico', 0, 0, 3, 0);
    expect(notices(e, cat(0, -2), open)).toBe(true);
    expect(notices(e, cat(0, -4), open)).toBe(false);
    expect(notices(e, cat(0, -2, { crouch: true }), open)).toBe(false);
    expect(notices(e, cat(0, -4, { speed: 6 }), open)).toBe(true);
  });

  it('nunca através de paredes', () => {
    const e = makeEnemy('o', 'ourico', 0, 0, 3, 0);
    expect(notices(e, cat(0, 4), { free: () => false, ground: () => true })).toBe(false);
  });

  it('o javali dorme: só acorda com barulho (nem vendo o gato bem na frente)', () => {
    const j = makeEnemy('j', 'javali', 0, 0, 0, 0);
    expect(j.mode).toBe('sleep');
    expect(notices(j, cat(0, 5), open)).toBe(false);
    expect(notices(j, cat(0, 3), open)).toBe(true);
    expect(notices(j, cat(0, 2, { crouch: true }), open)).toBe(false);
  });

  it('o desfiladeiro: andando sempre acorda o javali; agachado dá para passar pelo canto', () => {
    const boar = ENEMY_SPAWNS.find((s) => s.id === 'javali')!;
    const j = makeEnemy('j', 'javali', boar.at[0], boar.at[1], 0, Math.PI);
    // walking by the corridor's far wall still passes within hearing
    const farX = boar.at[0] - CANYON.x0 > CANYON.x1 - boar.at[0] ? CANYON.x0 + 0.35 : CANYON.x1 - 0.35;
    expect(notices(j, cat(farX, boar.at[1]), open)).toBe(true);
    for (let z = CANYON.z1; z > CANYON.z0; z -= 0.25) expect(notices(j, cat(farX, z, { crouch: true }), open)).toBe(false);
  });
});

describe('combate: o ciclo do ouriço', () => {
  it('patrulha → alerta → persegue → avisa → investe → fica tonto', () => {
    const e = makeEnemy('o', 'ourico', 0, 0, 3, 0);
    const ev = run(e, 0.1, cat(0, 5));
    expect(e.mode).toBe('alert');
    expect(ev.some((x) => x.type === 'alert')).toBe(true);
    run(e, 0.8, cat(0, 5));
    expect(['chase', 'windup']).toContain(e.mode);
    const all = run(e, 3, cat(0, 3.5));
    expect(all.some((x) => x.type === 'windup')).toBe(true);
    expect(all.some((x) => x.type === 'hitCat')).toBe(true);
    expect(e.mode === 'stunned' || e.mode === 'chase' || e.mode === 'windup' || e.mode === 'attack').toBe(true);
  });

  it('a investida tem aviso: quem sai do caminho durante o aviso não é atingido', () => {
    const e = makeEnemy('o', 'ourico', 0, 0, 3, 0);
    let c = cat(0, 3.5);
    run(e, 1.0, c);
    // wait for the windup, then step 2 m to the side while it lasts
    for (let i = 0; i < 300 && e.mode !== 'windup'; i++) enemyStep(e, 1 / 30, c, open, rng);
    expect(e.mode).toBe('windup');
    c = cat(2.2, 3.5);
    const ev = run(e, ENEMIES.ourico.windup + ENEMIES.ourico.attack.time + 0.1, () => c);
    expect(ev.filter((x) => x.type === 'hitCat')).toHaveLength(0);
    expect(e.mode).toBe('stunned');
  });

  it('com espinhos em pé, a patada não entra; tonto, entra. Três patadas e ele desiste', () => {
    const e = makeEnemy('o', 'ourico', 0, 0, 3, 0);
    expect(hitEnemy(e, 1, cat(0, 1))).toBe('blocked');
    e.mode = 'stunned';
    e.timer = 2;
    expect(hitEnemy(e, 1, cat(0, 1))).toBe('hit');
    expect(hitEnemy(e, 1, cat(0, 1))).toBe('hit');
    expect(hitEnemy(e, 1, cat(0, 1))).toBe('defeated');
    expect(isActive(e)).toBe(false);
    expect(hitEnemy(e, 1, cat(0, 1))).toBe('none');
  });

  it('fugir funciona: longe demais de casa ele desiste e volta curado', () => {
    const e = makeEnemy('o', 'ourico', 0, 0, 3, 0);
    e.mode = 'chase';
    e.hp = 1;
    let cz = 3;
    const ev = run(e, 12, () => cat(0, (cz += 0.2)));
    expect(ev.some((x) => x.type === 'gaveUp')).toBe(true);
    run(e, 20, cat(0, 200));
    expect(e.mode).toBe('patrol');
    expect(e.hp).toBe(ENEMIES.ourico.hp);
    expect(Math.hypot(e.x - e.home.x, e.z - e.home.z)).toBeLessThan(e.home.r + 0.5);
  });

  it('distração: uma shuriken nas pedras atrai quem patrulha, não quem já está brigando', () => {
    const calm = makeEnemy('a', 'ourico', 0, 0, 3, 0);
    expect(hearNoise(calm, 6, 0)).toBe(true);
    expect(calm.mode).toBe('distracted');
    run(calm, 3.8, cat(40, 40));
    expect(Math.hypot(calm.x - 6, calm.z)).toBeLessThan(1);
    const busy = makeEnemy('b', 'ourico', 0, 0, 3, 0);
    busy.mode = 'chase';
    expect(hearNoise(busy, 6, 0)).toBe(false);
    expect(hearNoise(makeEnemy('c', 'ourico', 0, 0), NOISE.reach + 1, 0)).toBe(false);
  });
});

describe('combate: raposa, espírito e javali', () => {
  it('a raposa mantém distância e joga pinhas; a pinha acerta quem fica parado e para na parede', () => {
    const f = makeEnemy('f', 'raposa', 0, 0, 3, 0);
    f.mode = 'chase';
    const ev = run(f, 3, cat(0, 7));
    const t = ev.find((x) => x.type === 'throw');
    expect(t).toBeDefined();
    // it backs away from a cat that comes close
    const before = Math.hypot(f.x, f.z - 2);
    run(f, 0.5, cat(0, 2));
    expect(Math.hypot(f.x, f.z - 2)).toBeGreaterThan(before);
    const list: Pinecone[] = [];
    throwPinecone(list, 0, 0, 0, 1);
    let hit = null;
    for (let i = 0; i < 60 && !hit; i++) hit = stepPinecones(list, 1 / 30, cat(0, 5), open);
    expect(hit).not.toBeNull();
    const list2: Pinecone[] = [];
    throwPinecone(list2, 0, 0, 0, 1);
    for (let i = 0; i < 60; i++) stepPinecones(list2, 1 / 30, cat(0, 5), { free: () => false, ground: () => true });
    expect(list2.every((p) => !p.alive)).toBe(true);
    // slow enough to see it coming: more than half a second to cross the fox's attack distance
    expect(ENEMIES.raposa.reach / PINECONE.speed).toBeGreaterThan(0.5);
  });

  it('o espírito da névoa só sente a patada com o Faro ligado', () => {
    const s = makeEnemy('s', 'espirito', 0, 0, 3, 0);
    expect(hitEnemy(s, 1, cat(0, 1))).toBe('unseen');
    expect(hitEnemy(s, 1, cat(0, 1, { faro: true }))).toBe('hit');
  });

  it('o javali aceita o petisco e sai do caminho para sempre', () => {
    const j = makeEnemy('j', 'javali', 0, 0, 0, 0);
    expect(calmEnemy(j)).toBe(true);
    expect(isActive(j)).toBe(false);
    expect(run(j, 5, cat(0, 1))).toEqual([]);
    resetEnemy(j, true);
    expect(j.mode).toBe('calm');
  });

  it('voltar à região traz os bichos de volta, inteiros, em casa', () => {
    const e = makeEnemy('o', 'ourico', 2, 3, 3, 0);
    e.mode = 'defeated';
    e.hp = 0;
    e.x = 9;
    resetEnemy(e);
    expect(e.mode).toBe('patrol');
    expect(e.hp).toBe(ENEMIES.ourico.hp);
    expect([e.x, e.z]).toEqual([2, 3]);
  });
});

describe('combate: a patada e os corações', () => {
  it('a patada pega quem está na frente e perto, não quem está atrás', () => {
    const front = makeEnemy('a', 'raposa', 0, 1.2);
    const behind = makeEnemy('b', 'raposa', 0, -1.2);
    const far = makeEnemy('c', 'raposa', 0, PAW.reach + 0.3);
    expect(pawTargets({ x: 0, z: 0, heading: 0 }, [front, behind, far]).map((e) => e.id)).toEqual(['a']);
  });

  it('corações: uma pancada por vez (piscando), desmaia no zero, cura até o máximo', () => {
    let h = fullHearts('normal');
    expect(h.hearts).toBe(LEVELS.normal.hearts);
    let r = hurtCat(h, 1, 10);
    expect(r.took).toBe(true);
    h = r.hearts;
    expect(hurtCat(h, 1, 10.5).took).toBe(false);
    r = hurtCat(h, 10, 12);
    expect(r.fainted).toBe(true);
    expect(r.hearts.hearts).toBe(0);
    expect(healCat(r.hearts, 99).hearts).toBe(h.max);
  });

  it('as dificuldades mudam corações e ritmo, nunca o que a missão pede', () => {
    expect(LEVELS.tranquilo.hearts).toBeGreaterThan(LEVELS.normal.hearts);
    expect(LEVELS.desafio.hearts).toBeLessThan(LEVELS.normal.hearts);
    expect(LEVELS.tranquilo.windup).toBeGreaterThan(LEVELS.desafio.windup);
    // easy: the same hedgehog takes longer to strike
    const slow = makeEnemy('a', 'ourico', 0, 0, 3, 0);
    const fast = makeEnemy('b', 'ourico', 0, 0, 3, 0);
    for (const [e, lv] of [[slow, 'tranquilo'], [fast, 'desafio']] as const) {
      e.mode = 'chase';
      run(e, 0.1, cat(0, 3), open, lv);
    }
    expect(slow.timer).toBeGreaterThan(fast.timer);
  });
});

describe('Terras Selvagens: o mapa', () => {
  const walkable = (x: number, z: number) => x >= WILD.minX && x <= WILD.maxX && z >= WILD.minZ && z <= WILD.maxZ && !inWall(x, z);

  it('a região está nas áreas onde o gato pode andar, longe da vila e das casas', () => {
    expect(clampToRegions(w(0, 0)[0], w(0, 0)[2])).toBeNull();
    expect(WILD_RECT.minX).toBeGreaterThan(400);
    for (const p of [WILD_GATE.arrive, WILD_RESPAWN]) {
      const l = toLocal(p[0], p[2]);
      expect(walkable(l.x, l.z)).toBe(true);
      expect(inWildRiver(l.x, l.z, false)).toBe(false);
    }
  });

  it('bichos, ervas, cristais, armadilhas, moradores e objetos ficam em chão firme, fora das pedras e do rio', () => {
    const spots: [string, number, number][] = [
      ...ENEMY_SPAWNS.map((s): [string, number, number] => [s.id, s.at[0], s.at[1]]),
      ...HERB_SPOTS.map(([x, z], i): [string, number, number] => [`erva ${i}`, x, z]),
      ...CRYSTALS.map(([x, z], i): [string, number, number] => [`cristal ${i}`, x, z]),
      ...TRAPS.map(([x, z], i): [string, number, number] => [`armadilha ${i}`, x, z]),
      ...WILD_NPCS.map((n): [string, number, number] => [n.id, toLocal(n.position[0], n.position[2]).x, toLocal(n.position[0], n.position[2]).z]),
      ...WILD_OBJECTS.filter((o) => o.position[0] > 400).map((o): [string, number, number] => [o.id, toLocal(o.position[0], o.position[2]).x, toLocal(o.position[0], o.position[2]).z]),
    ];
    for (const [id, x, z] of spots) {
      expect(walkable(x, z), id).toBe(true);
      expect(inWildRiver(x, z, false), id).toBe(false);
    }
  });

  it('o que fica no alto do mirante está na altura do mirante (a interação só alcança 2,2 m acima ou abaixo)', () => {
    for (const o of WILD_OBJECTS) {
      const l = toLocal(o.position[0], o.position[2]);
      const onTop = l.x > LOOKOUT.x0 && l.x < LOOKOUT.x1 && l.z > LOOKOUT.z0 && l.z < LOOKOUT.z1;
      if (onTop) expect(o.position[1], o.id).toBe(LOOKOUT.h);
    }
  });

  it('os moradores ficam a 1,8 m ou mais dos objetos (a conversa não rouba a vez)', () => {
    for (const n of WILD_NPCS) {
      for (const o of WILD_OBJECTS) {
        expect(Math.hypot(n.position[0] - o.position[0], n.position[2] - o.position[2]), `${n.id} × ${o.id}`).toBeGreaterThanOrEqual(1.8);
      }
    }
  });

  it('o rio: a ponte só segura depois de consertada; as pedras dão para pular uma por uma', () => {
    const mid = (WILD_RIVER.x0 + WILD_RIVER.x1) / 2;
    expect(inWildRiver(mid, ROPE_BRIDGE.z, false)).toBe(true);
    expect(inWildRiver(mid, ROPE_BRIDGE.z, true)).toBe(false);
    expect(ROPE_BRIDGE.x0).toBeLessThan(WILD_RIVER.x0);
    expect(ROPE_BRIDGE.x1).toBeGreaterThan(WILD_RIVER.x1);
    const xs = [WILD_RIVER.x0, ...WILD_STONES.map(([x]) => x), WILD_RIVER.x1];
    for (let i = 0; i < xs.length - 1; i++) {
      // edge to edge, the water gap is far below a walking jump (~2 m)
      const gap = xs[i + 1] - xs[i] - (i === 0 || i === xs.length - 2 ? WILD_STONE_R : 2 * WILD_STONE_R);
      expect(gap).toBeLessThan(0.8);
    }
  });

  it('o posto só tem uma entrada, o desfiladeiro, e as paredes não se pulam', () => {
    // walk the outpost's border: every way out is a wall, except the canyon's mouth
    const openings: number[] = [];
    for (let x = OUTPOST.x0 + 0.5; x < OUTPOST.x1; x += 0.5) if (!inWall(x, OUTPOST.z1 + 0.5)) openings.push(x);
    expect(openings.every((x) => x >= CANYON.x0 && x <= CANYON.x1)).toBe(true);
    expect(openings.length).toBeGreaterThan(0);
    for (let z = OUTPOST.z0 + 0.5; z < OUTPOST.z1; z += 0.5) expect(inWall(OUTPOST.x1 + 0.5, z)).toBe(true);
    // a double jump reaches ~3 m: no wall around the outpost is lower than 3.4
    for (const wl of WILD_WALLS) expect(wl.h).toBeGreaterThanOrEqual(3.4);
  });

  it('a caverna guarda os três cristais; o arbusto do filhote fica na clareira dos ouriços', () => {
    for (const [x, z] of CRYSTALS) expect(x > CAVE.x0 && x < CAVE.x1 && z > CAVE.z0 && z < CAVE.z1).toBe(true);
    const nearKit = ENEMY_SPAWNS.filter((s) => s.kind === 'ourico' && Math.hypot(s.at[0] - KIT_BUSH.at[0], s.at[1] - KIT_BUSH.at[1]) < KIT_BUSH.clear);
    expect(nearKit.length).toBeGreaterThan(0);
    const guard = ENEMY_SPAWNS.find((s) => s.id === 'ourico_bento')!;
    expect(guard.r).toBeLessThan(BENTO_GUARD_CLEAR);
  });

  it('cada lugar tem nome no HUD', () => {
    expect(wildAreaAt(...([WILD_RESPAWN[0], WILD_RESPAWN[2]] as const))).toBe('Acampamento da Expedição');
    const [cx, , cz] = w(CRYSTALS[0][0], CRYSTALS[0][1]);
    expect(wildAreaAt(cx, cz)).toBe('Caverna da Névoa');
    expect(WILD_AREAS.length).toBeGreaterThanOrEqual(12);
  });

  it('o portão das ruínas tem uma única ordem certa', () => {
    expect(solutions(SUN_PUZZLE)).toEqual([['sol', 'estrela', 'nuvem', 'lua']]);
    expect(Object.keys(SUN_STONES).sort()).toEqual([...SUN_PUZZLE.pieces].sort());
  });
});

describe('Terras Selvagens: itens e missões', () => {
  it('a Poção de Ervas cura, o Armazém vende, e a corda e a capa existem para as duas rotas', () => {
    expect(ITEMS.pocao_cura.use).toEqual({ kind: 'cura', hearts: 2 });
    const arm = SHOPS_BY_ID.armazem.offers.map((o) => o.item);
    expect(arm).toEqual(expect.arrayContaining(['pocao_cura', 'corda_ninja', 'capa_vento']));
  });

  it('sete missões no capítulo 6, e o posto do Hissui aceita passar sem lutar', () => {
    const six = Object.values(MISSIONS).filter((m) => m.chapter === 6);
    expect(six).toHaveLength(7);
    expect(MISSIONS.posto.steps.find((s) => s.id === 'desfiladeiro')!.description).toMatch(/agachado/);
  });
});

describe('moradores com várias missões', () => {
  it('com uma missão dele em andamento, a próxima que ele oferece aparece mesmo na conversa (todos os NPCs)', () => {
    const problems: string[] = [];
    // (found in Etapa 7 for Chef Hana, Taro, Vovó Mochi and Seu Bigodes; fixed in Etapa 8 in availableOffer)
    for (const npc of NPC_DEFINITIONS) {
      const offers = (npc.offers ?? []).map((o) => o.mission).filter((id) => MISSIONS[id]?.giver === npc.id);
      if (offers.length < 2) continue;
      offers.forEach((running, k) => {
        // everyone else's missions done; this NPC's earlier ones done, this one just started, the later ones not yet
        const p = emptyProgress();
        for (const m of Object.values(MISSIONS)) {
          const idx = offers.indexOf(m.id);
          if (idx === -1 || idx < k) p.missions[m.id] = { status: 'done', steps: m.steps.map((s) => s.id) };
        }
        p.missions[running] = { status: 'active', steps: [MISSIONS[running].steps[0].id] };
        const offer = availableOffer(npc, p);
        if (!offer || !checkCondition(npc.visibleWhen, p)) return;
        const d = resolveDialogue(npc, p);
        const starts = d ? Object.values(d.tree).flatMap((n) => [n.onEnter, ...(n.options ?? []).map((o) => o.action)]).join(';') : '';
        if (!starts.includes(`START:${offer}`)) problems.push(`${npc.id}: com ${running} em andamento, o registro diz ${offer} mas a conversa não oferece`);
      });
    }
    expect(problems).toEqual([]);
  });
});
