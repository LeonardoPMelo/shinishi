import { describe, expect, it } from 'vitest';
import { CAMP_PATHS, CAMP_PROPS, CAGES, ESPINHO_CAMP, ESPINHO_FIRE, ESPINHO_LOOT, ESPINHO_TENTS, WILD2_SPAWNS } from '../src/data/wild2';

/** O Acampamento dos Espinhos: the worn paths and the clutter (world/WildCamps.tsx). */
type P = [number, number];
function segDist([x, z]: P, [ax, az]: P, [bx, bz]: P) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}
const lineDist = (p: P, pts: P[]) => Math.min(...pts.slice(1).map((b, i) => segDist(p, pts[i], b)));
const props = (): P[] => [CAMP_PROPS.firewood, ...CAMP_PROPS.sacks, CAMP_PROPS.pinecones, CAMP_PROPS.rack, CAMP_PROPS.table].map((p) => [p.x, p.z]);

describe('o Acampamento dos Espinhos', () => {
  it('os caminhos gastos ligam a entrada à fogueira, e a fogueira a cada barraca, ao saque e às jaulas', () => {
    const fire: P = [ESPINHO_FIRE.x, ESPINHO_FIRE.z];
    const ends = CAMP_PATHS.map((p) => p[p.length - 1]);
    expect(CAMP_PATHS[0][CAMP_PATHS[0].length - 1]).toEqual(fire);
    for (const t of ESPINHO_TENTS) expect(ends.some(([x, z]) => x === t.x && z === t.z)).toBe(true);
    expect(ends.some(([x, z]) => x === ESPINHO_LOOT.x && z === ESPINHO_LOOT.z)).toBe(true);
    expect(CAGES.every((c) => CAMP_PATHS.some((l) => lineDist([c.x, c.z], l) < 3))).toBe(true);
  });

  it('as coisas do acampamento ficam fora dos caminhos e dentro da cerca', () => {
    for (const p of props()) {
      for (const line of CAMP_PATHS) expect(lineDist(p, line), `${p}`).toBeGreaterThan(0.9);
      // inside the stakes (west x -26.4, south z -23.8) and short of the east entrance (x -6.6)
      expect(p[0] > -26.4 && p[0] < -6.6 && p[1] > -23.8 && p[1] < ESPINHO_CAMP.z + ESPINHO_CAMP.r, `${p}`).toBe(true);
    }
  });

  it('nenhuma coisa no lugar de um bicho do bando, na ronda da doninha, ou colada numa jaula', () => {
    for (const p of props()) {
      for (const s of WILD2_SPAWNS) {
        expect(Math.hypot(p[0] - s.at[0], p[1] - s.at[1]), `${s.id} @ ${p}`).toBeGreaterThan(1.5);
        if (s.route) expect(lineDist(p, s.route), `${s.id} route @ ${p}`).toBeGreaterThan(1.2);
      }
      for (const c of CAGES) expect(Math.hypot(p[0] - c.x, p[1] - c.z), `${c.id} @ ${p}`).toBeGreaterThan(1.6);
    }
  });
});
