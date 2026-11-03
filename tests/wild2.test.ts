import { describe, expect, it } from 'vitest';
import { makeEnemy, enemyStep, rallyAllies, rage, idleMode, hitEnemy, ENEMIES, type CombatEnv, type CombatCat } from '../src/systems/combat';
import { checkTune } from '../src/systems/tune';
import { deerStep, makeDeer, CAMPINA, DEER } from '../src/systems/wildlife';
import { ENEMY_SPAWNS, WILD, WILD_WALLS, inWall, inWildRiver, distToTrail, w } from '../src/data/wild';
import {
  WILD2_SPAWNS, CAGES, ESPINHO_CAMP, TUNES, SINGING, CHAMBER, ECHO_STONE, WILD2_MISSIONS, WILD2_OBJECTS, ESPINHO_LOOKOUT, FORT_TOWERS,
} from '../src/data/wild2';
import { MISSIONS } from '../src/data/missions';
import { NPCS_BY_ID, availableOffer } from '../src/data/npcs';
import { emptyProgress } from '../src/systems/progression';
import type { Progress } from '../src/types';

/**
 * As Terras Selvagens, segunda parte (after Etapa 10): the new creatures' habits, the singing crystals' game,
 * the deer, and where everything stands. The scenes are drawn by WildScenery/WildCamps/WildCave/WildFauna.
 */

const open: CombatEnv = { free: () => true, ground: () => true };
const far: CombatCat = { x: 999, z: 999, crouch: false, speed: 0, faro: false, active: true };
const rng = () => 0.5;

describe('os novos inimigos', () => {
  it('cada classe tem seu jeito: o texugo tem escudo, a doninha é rápida, a arqueira atira de longe, o chefe aguenta mais', () => {
    expect(ENEMIES.texugo.armored).toBe(true);
    expect(ENEMIES.doninha.run).toBeGreaterThan(ENEMIES.ourico.run);
    expect(ENEMIES.doninha.windup).toBeLessThan(ENEMIES.ourico.windup);
    expect(ENEMIES.arqueira.attack.kind).toBe('throw');
    expect(ENEMIES.arqueira.reach).toBeGreaterThan(ENEMIES.raposa.reach);
    expect(ENEMIES.chefe.hp).toBeGreaterThan(ENEMIES.javali.hp);
    // child-friendly: nobody takes more than one heart a hit, except the boar as before
    for (const k of ['texugo', 'doninha', 'arqueira', 'chefe'] as const) expect(ENEMIES[k].damage).toBe(1);
  });

  it('a ronda: a doninha anda pelos pontos, em ordem', () => {
    const route = [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 4 }];
    const e = makeEnemy('d', 'doninha', 0, 0, 0, 0, { route });
    const visited: string[] = [];
    for (let i = 0; i < 2000 && visited.length < 4; i++) {
      enemyStep(e, 0.05, far, open, rng);
      const at = route.findIndex((p) => Math.hypot(p.x - e.x, p.z - e.z) < 0.25);
      if (at >= 0 && visited[visited.length - 1] !== String(at)) visited.push(String(at));
    }
    expect(visited.slice(0, 4)).toEqual(['0', '1', '2', '0']);
  });

  it('quem descansa perto da fogueira dorme até ouvir algo, e volta a dormir depois', () => {
    const e = makeEnemy('o', 'ourico', 0, 0, 2, 0, { rest: true });
    expect(e.mode).toBe('sleep');
    expect(idleMode(e)).toBe('sleep');
  });

  it('a arqueira na torre não sai do posto: vira e atira', () => {
    const e = makeEnemy('a', 'arqueira', 0, 0, 0, 0, { post: true });
    const cat: CombatCat = { x: 0, z: 3, crouch: false, speed: 1, faro: false, active: true };
    let threw = false;
    for (let i = 0; i < 200; i++) threw = enemyStep(e, 0.05, cat, open, rng).some((ev) => ev.type === 'throw') || threw;
    expect(threw).toBe(true);
    expect(Math.hypot(e.x, e.z)).toBeLessThan(1e-6);
  });

  it('o alarme: quem vê o gato chama os do bando que estão perto (o javali segue dormindo)', () => {
    const a = makeEnemy('a', 'ourico', 0, 0);
    const b = makeEnemy('b', 'texugo', 5, 0);
    const c = makeEnemy('c', 'ourico', 30, 0);
    const boar = makeEnemy('j', 'javali', 3, 3);
    expect(rallyAllies(a, [a, b, c, boar], 1, 1)).toBe(1);
    expect(b.mode).toBe('distracted');
    expect(c.mode).toBe('patrol');
    expect(boar.mode).toBe('sleep');
  });

  it('o chefe fica mais rápido depois de perder metade da força, e só leva dano quando tonto', () => {
    const e = makeEnemy('c', 'chefe', 0, 0);
    expect(rage(e)).toBe(1);
    expect(hitEnemy(e, 1, { x: 1, z: 0, faro: false })).toBe('blocked');
    e.mode = 'stunned';
    e.timer = 2;
    for (let i = 0; i < 4; i++) {
      hitEnemy(e, 1, { x: 1, z: 0, faro: false });
      e.mode = 'stunned';
    }
    expect(e.hp).toBe(ENEMIES.chefe.hp - 4);
    expect(rage(e)).toBeGreaterThan(1);
  });
});

describe('os cristais cantores', () => {
  it('três melodias, cada uma mais longa, só com os quatro cristais', () => {
    expect(TUNES.map((t) => t.length)).toEqual([3, 4, 5]);
    for (const t of TUNES) for (const n of t) expect(n >= 0 && n < SINGING.length).toBe(true);
  });

  it('acertar tudo passa de rodada; errar uma nota recomeça a rodada; a última abre a câmara', () => {
    let st = { round: 0, entered: [] as number[] };
    for (const n of TUNES[0].slice(0, -1)) {
      const r = checkTune(st, n);
      expect(r.result).toBe('progress');
      st = r;
    }
    expect(checkTune(st, (TUNES[0][2] + 1) % 4).result).toBe('wrong');
    const r1 = checkTune(st, TUNES[0][2]);
    expect(r1.result).toBe('round');
    expect(r1.round).toBe(1);
    st = { round: 2, entered: [] };
    for (const n of TUNES[2].slice(0, -1)) st = checkTune(st, n);
    expect(checkTune(st, TUNES[2][4]).result).toBe('done');
  });

  it('a câmara fica na rocha norte, atrás de um vão no paredão, e o baú está dentro da área andável', () => {
    const mid = (CHAMBER.x0 + CHAMBER.x1) / 2;
    expect(inWall(mid, (CHAMBER.z0 + CHAMBER.z1) / 2 + 0.3)).toBe(false);
    expect(inWall(mid, CHAMBER.z0 - 0.5)).toBe(true);
    const chest = WILD2_OBJECTS.find((o) => o.id === 'bau_camara')!;
    expect(chest.position[2] - w(0, 0)[2]).toBeGreaterThan(WILD.minZ);
    // the cristals and the echo stone stand in the cave, clear of each other
    for (const s of SINGING) expect(Math.hypot(s.x - ECHO_STONE.x, s.z - ECHO_STONE.z)).toBeGreaterThan(2);
  });
});

describe('os cervos da campina', () => {
  it('fogem quando o gato chega perto, voltam com calma, e nunca saem da campina', () => {
    const d = makeDeer(18, 20, 0);
    deerStep(d, 0.05, { x: 18 + DEER.notice - 1, z: 20, crouch: false });
    expect(d.mode).toBe('flee');
    for (let i = 0; i < 400; i++) deerStep(d, 0.05, { x: 18 + DEER.notice - 1, z: 20, crouch: false });
    expect(d.x).toBeGreaterThanOrEqual(CAMPINA.x0);
    expect(d.x).toBeLessThan(18);
    for (let i = 0; i < 2000; i++) deerStep(d, 0.05, { x: 100, z: 100, crouch: false });
    expect(Math.hypot(d.x - 18, d.z - 20)).toBeLessThan(4);
  });

  it('agachado, o gato chega bem mais perto sem assustar', () => {
    const d = makeDeer(18, 20, 1);
    deerStep(d, 0.05, { x: 18 + DEER.noticeCrouch + 0.5, z: 20, crouch: true });
    expect(d.mode).not.toBe('flee');
  });
});

describe('onde tudo fica', () => {
  const spawns = [...ENEMY_SPAWNS, ...WILD2_SPAWNS];
  it('nenhum inimigo nasce dentro de um paredão ou do rio, e as rondas também não passam por eles', () => {
    for (const s of spawns) {
      if (s.post) continue; // on a lookout, drawn up on its platform
      expect(inWall(s.at[0], s.at[1], 0.3), s.id).toBe(false);
      expect(inWildRiver(s.at[0], s.at[1], false), s.id).toBe(false);
      for (const [x, z] of s.route ?? []) expect(inWall(x, z, 0.3) || inWildRiver(x, z, false), `${s.id} ${x},${z}`).toBe(false);
    }
    expect(new Set(spawns.map((s) => s.id)).size).toBe(spawns.length);
  });

  it('as arqueiras ficam nas torres', () => {
    const towers = [ESPINHO_LOOKOUT, ...FORT_TOWERS];
    for (const s of WILD2_SPAWNS.filter((x) => x.kind === 'arqueira')) {
      expect(towers.some((t) => Math.hypot(t.x - s.at[0], t.z - s.at[1]) < 0.01 && t.h === s.y), s.id).toBe(true);
    }
  });

  it('as jaulas ficam no acampamento, fora das trilhas e dos paredões', () => {
    for (const c of CAGES) {
      expect(Math.hypot(c.x - ESPINHO_CAMP.x, c.z - ESPINHO_CAMP.z)).toBeLessThan(ESPINHO_CAMP.r);
      expect(distToTrail(c.x, c.z)).toBeGreaterThan(1.2);
      expect(inWall(c.x, c.z, 0.6)).toBe(false);
    }
    expect(MISSIONS.animais_sumidos.steps.find((s) => s.id === 'jaulas')!.counter!.goal).toBe(CAGES.length);
  });

  it('o paredão norte tem só o vão da câmara (o resto continua fechado)', () => {
    const north = WILD_WALLS.filter((wl) => wl.z0 <= -43 + 1e-6);
    expect(north.length).toBe(5);
  });
});

describe('as missões novas são oferecidas por quem conta a história', () => {
  const done = (...ids: string[]): Progress => {
    const p = emptyProgress();
    for (const id of ids) p.missions[id] = { status: 'done', steps: MISSIONS[id].steps.map((s) => s.id) } as Progress['missions'][string];
    return p;
  };
  it('Momo, Yuki e Bento oferecem a missão certa quando chega a hora', () => {
    expect(WILD2_MISSIONS.map((m) => m.giver)).toEqual(['momo', 'yuki_campo', 'bento']);
    expect(availableOffer(NPCS_BY_ID.momo, done('trilha', 'ervas', 'filhote'))).toBe('animais_sumidos');
    expect(availableOffer(NPCS_BY_ID.yuki_campo, done('trilha', 'explorador', 'ervas', 'filhote', 'animais_sumidos', 'posto', 'expedicao'))).toBe('chefe_espinho');
    expect(availableOffer(NPCS_BY_ID.bento, done('trilha', 'explorador', 'cristais', 'ruinas'))).toBe('cristais_cantores');
  });
});
