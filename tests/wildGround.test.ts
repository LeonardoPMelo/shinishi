import { describe, expect, it } from 'vitest';
import { WILD, WILD_TRAILS, WILD_RIVER, CAVE } from '../src/data/wild';
import { CAMP_PATHS } from '../src/data/wild2';
import { buildWildMacro, dirtMask, grassAmount } from '../src/game/world/WildScenery';

/**
 * The wild lands' ground, made like the village's (§26): trails and camp paths are dirt painted by the shared
 * dirt shader through a macro texture, not flat strips; bare ground (river sand, cave) has no grass.
 */
const TERRAIN = { x0: WILD.minX - 34, z0: WILD.minZ - 34 };
const PPU = 5;

describe('o chão das terras selvagens', () => {
  it('o meio de cada trilha e de cada caminho do acampamento é terra batida', () => {
    for (const line of [...WILD_TRAILS, ...CAMP_PATHS]) {
      for (let i = 0; i < line.length - 1; i++) {
        const mx = (line[i][0] + line[i + 1][0]) / 2, mz = (line[i][1] + line[i + 1][1]) / 2;
        expect(dirtMask(mx, mz, 0.5)).toBeGreaterThan(0.95);
      }
    }
  });

  it('longe das trilhas e dos acampamentos o chão é grama', () => {
    // a meadow corner, several metres from any path
    expect(dirtMask(-46, 37, 0.5)).toBe(0);
    expect(grassAmount(-46, 37)).toBe(1);
  });

  it('a areia do rio e a caverna não têm grama', () => {
    expect(grassAmount((WILD_RIVER.x0 + WILD_RIVER.x1) / 2, 0)).toBe(0);
    expect(grassAmount((CAVE.x0 + CAVE.x1) / 2, (CAVE.z0 + CAVE.z1) / 2)).toBe(0);
  });

  it('a textura macro guarda a máscara de terra (b) e a grama (a) nos lugares certos', () => {
    const tex = buildWildMacro();
    const { data, width } = tex.image as { data: Uint8Array; width: number };
    const at = (x: number, z: number) => {
      const i = (Math.floor((z - TERRAIN.z0) * PPU) * width + Math.floor((x - TERRAIN.x0) * PPU)) * 4;
      return { b: data[i + 2], a: data[i + 3], r: data[i] };
    };
    const [a, b] = [WILD_TRAILS[0][0], WILD_TRAILS[0][1]];
    expect(at((a[0] + b[0]) / 2, (a[1] + b[1]) / 2).b).toBeGreaterThan(200);
    // the expedition camp's fire sits on trodden earth
    expect(at(34, 22).b).toBeGreaterThan(200);
    expect(at(-46, 37).b).toBe(0);
    // the river: no grass, but the brightness channel survives (a data texture, not a premultiplied canvas)
    const river = at((WILD_RIVER.x0 + WILD_RIVER.x1) / 2, 0);
    expect(river.a).toBe(0);
    expect(river.r).toBeGreaterThan(0);
    tex.dispose();
  });
});
