import { describe, expect, it } from 'vitest';
import {
  WEST, WEST_GATE, WEST_PATHS, WEST_TREES, WEST_HOUSES, HILL, JIZO_PEBBLES, JIZO_NEXT, ONSEN, ONSEN_MIX, ONSEN_HOT,
  BOARDWALK, PIER, GORO, bambooClumps, westPathDistance, inOnsen,
} from '../src/data/west';
import {
  SOUTH, SOUTH_GATE, STREAM, LOG_BRIDGE, STREAM_STONES, ANCIENT, HUG, HUG_CATS, MEADOW, LEDGES, MOSS, HINOKI,
  cedarSpots, southPathDistance, inStream,
} from '../src/data/south';
import { WALK_RECTS, clampToRegions } from '../src/data/regions';
import { EAST_GATE } from '../src/data/east';
import { RIVER, WORLD_BOUNDS, OBJECTS_BY_ID } from '../src/data/world';
import { MISSIONS } from '../src/data/missions';
import { CHALLENGES } from '../src/data/challenges';
import { NPCS_BY_ID } from '../src/data/npcs';

/** Bambuzal das Águas Quentes and Bosque Antigo (art audit §26), plus the walkable regions. */

/** Footprint of a house with eaves and veranda: rotY 0 → door toward +z; ±90° → door toward ±x. */
function inWestHouse(x: number, z: number, margin: number) {
  return WEST_HOUSES.some((h) => {
    const [w, , d] = h.size;
    const along = h.rotY === 0;
    const hx = (along ? w : d) / 2 + 0.65 + margin;
    const hz = (along ? d : w) / 2 + 0.65 + margin;
    const front = 0.85;
    const x0 = h.pos[0] - hx - (!along && h.rotY < 0 ? front : 0);
    const x1 = h.pos[0] + hx + (!along && h.rotY > 0 ? front : 0);
    const z1 = h.pos[2] + hz + (along ? front : 0);
    return x > x0 && x < x1 && z > h.pos[2] - hz && z < z1;
  });
}

describe('regiões onde o gato pode andar', () => {
  it('cada portão está dentro de alguma região dos dois lados da cerca', () => {
    const gates: [number, number, number, number][] = [
      [EAST_GATE.x - 0.6, EAST_GATE.z, EAST_GATE.x + 0.6, EAST_GATE.z],
      [WEST_GATE.x + 0.6, WEST_GATE.z, WEST_GATE.x - 0.6, WEST_GATE.z],
      [SOUTH_GATE.x, SOUTH_GATE.z - 0.6, SOUTH_GATE.x, SOUTH_GATE.z + 0.6],
    ];
    for (const [ax, az, bx, bz] of gates) {
      for (let t = 0; t <= 1; t += 0.1) expect(clampToRegions(ax + (bx - ax) * t, az + (bz - az) * t)).toBeNull();
    }
  });

  it('fora de tudo, o gato volta para o ponto mais próximo de uma região', () => {
    expect(clampToRegions(0, 4)).toBeNull();
    expect(clampToRegions(-60, 5)).toEqual({ x: WEST.minX, z: 5 });
    expect(clampToRegions(0, 80)).toEqual({ x: 0, z: SOUTH.maxZ });
    expect(WALK_RECTS[0]).toBe(WORLD_BOUNDS);
  });
});

describe('Bambuzal das Águas Quentes', () => {
  it('bambus e árvores longe da trilha, das casas, da fonte e da colina', () => {
    for (const [x, , z] of bambooClumps()) {
      expect(westPathDistance(x, z), `bambu ${x.toFixed(1)},${z.toFixed(1)}`).toBeGreaterThan(2);
      expect(x > HILL.levels[0].x1 + 1 || z > HILL.z1 + 1, `bambu na colina ${x},${z}`).toBe(true);
    }
    for (const t of WEST_TREES) {
      const [x, y, z] = t.pos;
      const where = `${t.kind} em ${x},${z}`;
      if (y > 0) {
        const lv = HILL.levels.find((l) => Math.abs(l.h - y) < 0.01);
        expect(lv && x < lv.x1 && z > HILL.z0 && z < HILL.z1, where).toBeTruthy();
        continue;
      }
      expect(westPathDistance(x, z), where).toBeGreaterThan(1.2);
      expect(inWestHouse(x, z, 0.2), where).toBe(false);
      const ox = (x - ONSEN.x) / (ONSEN.rx + 1), oz = (z - ONSEN.z) / (ONSEN.rz + 1);
      expect(ox * ox + oz * oz, where).toBeGreaterThan(1);
      expect(z < RIVER.z - RIVER.halfWidth - 0.5, where).toBe(true);
      expect(x > WEST.minX && x < WEST.maxX, where).toBe(true);
    }
  });

  it('a trilha não passa por casas nem pela água quente', () => {
    for (const p of WEST_PATHS) {
      for (let i = 0; i < p.length - 1; i++) {
        for (let t = 0; t <= 1; t += 0.05) {
          const x = p[i][0] + (p[i + 1][0] - p[i][0]) * t;
          const z = p[i][1] + (p[i + 1][1] - p[i][1]) * t;
          if (x > WORLD_BOUNDS.minX) continue;
          expect(inWestHouse(x, z, -0.3), `${x.toFixed(1)},${z.toFixed(1)}`).toBe(false);
          expect(inOnsen(x, z), `${x.toFixed(1)},${z.toFixed(1)}`).toBe(false);
        }
      }
    }
  });

  it('a colina sobe de meio em meio metro e o píer entra no rio por cima da água', () => {
    HILL.levels.forEach((lv, i) => expect(lv.h - (i ? HILL.levels[i - 1].h : 0)).toBeCloseTo(0.5, 5));
    expect(PIER.z0).toBeCloseTo(BOARDWALK.z1, 5);
    expect(PIER.z1).toBeGreaterThan(RIVER.z);
    expect(PIER.z1).toBeLessThanOrEqual(WEST.maxZ);
  });

  it('as contas batem com a cena: receita 2:3 em 15 baldes, pedrinhas 1, 3, 6, 10 → 15', () => {
    expect(ONSEN_HOT).toBe(6);
    expect(ONSEN_HOT / (ONSEN_MIX.tub - ONSEN_HOT)).toBeCloseTo(ONSEN_MIX.hot / ONSEN_MIX.cold, 5);
    expect(CHALLENGES.onsen_proporcao.answer).toBe(ONSEN_HOT);
    expect(JIZO_PEBBLES).toEqual([1, 3, 6, 10]);
    expect(JIZO_NEXT).toBe(15);
    expect(CHALLENGES.jizo_padrao.answer).toBe(15);
  });
});

describe('Bosque Antigo', () => {
  it('cedros fora da trilha, do riacho, do monte, da clareira e das pedras', () => {
    const spots = cedarSpots();
    expect(spots.length).toBeGreaterThan(25);
    for (const s of spots) {
      const where = `cedro ${s.x.toFixed(1)},${s.z.toFixed(1)}`;
      expect(southPathDistance(s.x, s.z), where).toBeGreaterThan(1.8);
      expect(Math.abs(s.z - STREAM.z), where).toBeGreaterThan(STREAM.halfWidth + 0.4);
      expect(Math.hypot(s.x - ANCIENT.x, s.z - ANCIENT.z), where).toBeGreaterThan(ANCIENT.mound + 1.5);
      expect(Math.hypot(s.x - MEADOW.x, s.z - MEADOW.z), where).toBeGreaterThan(MEADOW.r + 1);
      expect(Math.abs(s.x) < SOUTH.maxX && s.z > SOUTH.minZ && s.z < SOUTH.maxZ, where).toBe(true);
    }
  });

  it('o riacho se atravessa pelo tronco ou pelas pedras (que não contam como água)', () => {
    expect(LOG_BRIDGE.z0).toBeLessThan(STREAM.z - STREAM.halfWidth);
    expect(LOG_BRIDGE.z1).toBeGreaterThan(STREAM.z + STREAM.halfWidth);
    expect(inStream(LOG_BRIDGE.x, STREAM.z)).toBe(false);
    for (const [x, , z] of STREAM_STONES) expect(inStream(x, z)).toBe(false);
    expect(inStream(-14, STREAM.z)).toBe(true);
  });

  it('as pedras do leste sobem um pulo por vez (até 0,7 m) e o último musgo fica no topo', () => {
    LEDGES.forEach((l, i) => {
      const rise = l.h - (i ? LEDGES[i - 1].h : 0);
      expect(rise).toBeLessThanOrEqual(0.71);
      if (i) expect(Math.hypot(l.x - LEDGES[i - 1].x, l.z - LEDGES[i - 1].z) - l.r - LEDGES[i - 1].r).toBeLessThan(0.8);
    });
    expect(MOSS[2][1]).toBeCloseTo(LEDGES[3].h + 0.45, 5);
  });

  it('a conta do abraço bate com a história (18 passos ÷ 2 = 9)', () => {
    expect(HUG_CATS).toBe(HUG.around / HUG.perCat);
    expect(CHALLENGES.arvore_abraco.answer).toBe(9);
  });
});

describe('missões e moradores novos', () => {
  it('Águas Quentes e Árvore Anciã: passos com alvos reais, moradores no lugar', () => {
    for (const [mid, npc] of [['aguas', GORO], ['arvore', HINOKI]] as const) {
      const m = MISSIONS[mid];
      expect(m, mid).toBeDefined();
      for (const s of m.steps) {
        const t = s.target;
        if (t && 'object' in t) expect(OBJECTS_BY_ID[t.object], `${mid}.${s.id}`).toBeDefined();
        if (t && 'npc' in t) expect(NPCS_BY_ID[t.npc], `${mid}.${s.id}`).toBeDefined();
      }
      expect(NPCS_BY_ID[npc.id]).toBe(npc);
      expect(clampToRegions(npc.position[0], npc.position[2]), npc.id).toBeNull();
      for (const [x, , z] of npc.patrol ?? []) expect(clampToRegions(x, z), `${npc.id} patrulha`).toBeNull();
    }
    for (const [x, , z] of GORO.patrol ?? []) {
      expect(inOnsen(x, z)).toBe(false);
      expect(inWestHouse(x, z, 0)).toBe(false);
    }
    expect(MISSIONS.arvore.steps.find((s) => s.id === 'musgo')?.counter?.goal).toBe(MOSS.length);
  });
});
