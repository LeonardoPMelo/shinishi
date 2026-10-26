import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  EAST, EAST_GATE, EAST_HOUSES, EAST_PATHS, EAST_TREES, EAST_PLAZA, POND, POND_STONES, KOI, KOI_TOTAL, TEA, TEA_TOTAL,
  LOOKOUT, WIND_BELL, RIDGE, FUJI, EAST_CHALLENGES, inPond,
} from '../src/data/east';
import { MISSIONS } from '../src/data/missions';
import { CHALLENGES } from '../src/data/challenges';
import { OBJECTS_BY_ID, WORLD_BOUNDS } from '../src/data/world';
import { NPCS_BY_ID } from '../src/data/npcs';

/** Bairro das Glicínias (art audit §25): layout sanity and the counts the challenges rely on. */

function segDist(x: number, z: number, [ax, az]: [number, number], [bx, bz]: [number, number]) {
  const vx = bx - ax, vz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
  return Math.hypot(x - ax - vx * t, z - az - vz * t);
}
const pathDist = (x: number, z: number) => Math.min(...EAST_PATHS.flatMap((p) => p.slice(1).map((b, i) => segDist(x, z, p[i], b))));

/** Footprint of a house with its veranda and roof eaves (rotY is ±90°, so w runs along z). */
function inHouse(x: number, z: number, margin: number) {
  return EAST_HOUSES.some((h) => {
    const [w, , d] = h.size;
    const front = h.rotY > 0 ? 1 : -1;
    const x0 = h.pos[0] - d / 2 - 0.65 - (front < 0 ? 0.85 : 0);
    const x1 = h.pos[0] + d / 2 + 0.65 + (front > 0 ? 0.85 : 0);
    return x > x0 - margin && x < x1 + margin && Math.abs(z - h.pos[2]) < w / 2 + 0.65 + margin;
  });
}

describe('Bairro das Glicínias: traçado', () => {
  it('o portão fica na cerca leste da vila e o bairro começa logo depois dela', () => {
    expect(EAST_GATE.x).toBeCloseTo(WORLD_BOUNDS.maxX + 0.6, 1);
    expect(EAST.minX).toBeGreaterThanOrEqual(WORLD_BOUNDS.maxX);
    expect(EAST_PATHS[0].some(([x, z]) => Math.abs(x - EAST_GATE.x) < 0.01 && Math.abs(z - EAST_GATE.z) < 0.01)).toBe(true);
  });

  it('nenhuma árvore em cima de caminho, casa, lago, praça ou terraço', () => {
    for (const t of EAST_TREES) {
      const [x, y, z] = t.pos;
      if (y > 0) {
        // ridge-top trees stand on a ridge segment at its height
        const seg = RIDGE.find((r) => x > r.x0 && x < r.x1);
        expect(seg && Math.abs(seg.h - y) < 0.01 && z > seg.z0 + 0.5, `árvore no topo da crista ${x},${z}`).toBeTruthy();
        continue;
      }
      const where = `${t.kind} em ${x},${z}`;
      expect(pathDist(x, z), where).toBeGreaterThan(1.2);
      expect(inHouse(x, z, 0.2), where).toBe(false);
      const px = (x - POND.x) / (POND.rx + 1), pz = (z - POND.z) / (POND.rz + 1);
      expect(px * px + pz * pz, where).toBeGreaterThan(1);
      expect(Math.hypot(x - EAST_PLAZA.x, z - EAST_PLAZA.z), where).toBeGreaterThan(EAST_PLAZA.r + 1);
      expect(x > TEA.x0 - 0.3 && z > TEA.levels[0].z0 - 0.3, where).toBe(false);
      expect(x > EAST.minX && x < EAST.maxX + 0.2 && z > EAST.minZ - 0.5 && z < EAST.maxZ, where).toBe(true);
    }
  });

  it('os caminhos não atravessam casas nem o lago', () => {
    for (const p of EAST_PATHS) {
      for (let i = 0; i < p.length - 1; i++) {
        for (let t = 0; t <= 1; t += 0.05) {
          const x = p[i][0] + (p[i + 1][0] - p[i][0]) * t;
          const z = p[i][1] + (p[i + 1][1] - p[i][1]) * t;
          if (x < EAST.minX) continue; // the village part was traced on the physics grid in game
          expect(inHouse(x, z, -0.3), `caminho em ${x.toFixed(1)},${z.toFixed(1)}`).toBe(false);
          expect(inPond(x, z), `caminho em ${x.toFixed(1)},${z.toFixed(1)}`).toBe(false);
        }
      }
    }
  });

  it('as pedras atravessam o lago com passos curtos e não contam como água', () => {
    for (let i = 1; i < POND_STONES.length; i++) {
      const [ax, , az] = POND_STONES[i - 1];
      const [bx, , bz] = POND_STONES[i];
      expect(Math.hypot(bx - ax, bz - az)).toBeLessThan(1.7);
    }
    for (const [x, , z] of POND_STONES) expect(inPond(x, z)).toBe(false);
    expect(inPond(POND.x - 1.6, POND.z + 0.9)).toBe(true);
  });

  it('terraços sobem em degraus de meio metro (um pulo simples) e o mirante fica a meio metro do último', () => {
    TEA.levels.forEach((lv, i) => expect(lv.h - (i ? TEA.levels[i - 1].h : 0)).toBeCloseTo(0.5, 5));
    expect(LOOKOUT.h - TEA.levels[TEA.levels.length - 1].h).toBeCloseTo(0.5, 5);
    expect(LOOKOUT.z0).toBeCloseTo(TEA.z1, 5);
    expect(WIND_BELL[0]).toBeGreaterThan(LOOKOUT.x0);
    expect(WIND_BELL[2]).toBeGreaterThan(LOOKOUT.z0);
    expect(WIND_BELL[2]).toBeLessThan(LOOKOUT.z1);
  });
});

describe('Bairro das Glicínias: missão', () => {
  it('as contas dos desafios batem com o que está desenhado na cena', () => {
    expect(KOI_TOTAL).toBe(12);
    const koi = CHALLENGES.carpas_fracao;
    expect(koi.choices?.[koi.answer]).toBe('1/4');
    expect(KOI.white / KOI_TOTAL).toBeCloseTo(1 / 4, 5);
    const tea = CHALLENGES.cha_terracos;
    expect(tea.answer).toBe(TEA_TOTAL);
    expect(TEA_TOTAL).toBe(3 * 2 * 7);
    for (const c of EAST_CHALLENGES) {
      expect(c.observe && c.hint && c.example, c.id).toBeTruthy();
      expect(CHALLENGES[c.id]).toBe(c);
    }
  });

  it('a missão existe, os alvos existem e cada passo é alcançável', () => {
    const m = MISSIONS.glicinias;
    expect(m).toBeDefined();
    for (const s of m.steps) {
      const t = s.target;
      if (t && 'object' in t) expect(OBJECTS_BY_ID[t.object], s.id).toBeDefined();
      if (t && 'npc' in t) expect(NPCS_BY_ID[t.npc], s.id).toBeDefined();
    }
    expect(NPCS_BY_ID.fuji).toBe(FUJI);
    expect(FUJI.offers?.[0].mission).toBe('glicinias');
    const [fx, , fz] = FUJI.position;
    expect(fx > EAST.minX && fx < EAST.maxX && fz > EAST.minZ && fz < EAST.maxZ).toBe(true);
    for (const [px, , pz] of FUJI.patrol ?? []) {
      expect(inHouse(px, pz, 0.3)).toBe(false);
      expect(inPond(px, pz)).toBe(false);
    }
  });
});

describe('modelos leves (LOD) dos moradores', () => {
  it('todo modelo de morador tem a cópia leve usada de longe', () => {
    const dir = resolve(__dirname, '../public/assets/models/characters');
    const full = readdirSync(dir).filter((f) => f.endsWith('.glb'));
    for (const f of full) expect(existsSync(resolve(dir, 'lod', f)), f).toBe(true);
  });
});
