import { describe, expect, it } from 'vitest';
import { FOREST_TREES } from '../src/game/world/WildForest';
import { WILD, WILD_RIVER, distToTrail, inWall } from '../src/data/wild';

/** The wild lands' redrawn forest (after Etapa 10): varied, and never in the way. */
describe('a floresta das Terras Selvagens', () => {
  const inside = FOREST_TREES.filter((t) => t.x > WILD.minX && t.x < WILD.maxX && t.z > WILD.minZ && t.z < WILD.maxZ);

  it('tem três tipos de árvore, misturados', () => {
    for (const k of ['cedro', 'carvalho', 'betula'] as const) expect(inside.filter((t) => t.kind === k).length, k).toBeGreaterThan(8);
  });

  it('nenhum tronco numa trilha, num paredão ou no rio', () => {
    const bad = inside.filter((t) => distToTrail(t.x, t.z) < 1.2 || inWall(t.x, t.z, 0.3) || (t.x > WILD_RIVER.x0 - 0.5 && t.x < WILD_RIVER.x1 + 0.5));
    expect(bad.map((t) => `${t.kind} ${t.x.toFixed(1)},${t.z.toFixed(1)}`)).toEqual([]);
  });

  it('perto das trilhas, só árvores de copa alta (a câmera vê o caminho)', () => {
    const lowNearTrail = inside.filter((t) => t.kind === 'cedro' && distToTrail(t.x, t.z) < 2.5 && t.x > WILD.minX + 3 && t.z < WILD.maxZ - 3);
    expect(lowNearTrail.length).toBe(0);
  });
});
