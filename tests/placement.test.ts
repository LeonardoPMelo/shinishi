import { describe, expect, it } from 'vitest';
import { PIE } from '../src/data/chapter3';
import { NPCS_BY_ID } from '../src/data/npcs';
import { WILD_TRAILS, SUN_STONES } from '../src/data/wild';
import { ECHO_STONE } from '../src/data/wild2';
import { PRECINCT_PATHS, ARCH_BRIDGE } from '../src/data/precinct';
import { OBJECTS_BY_ID } from '../src/data/world';

/**
 * Found by the physics audit (dev/audit.ts: `__audit.run()` in the dev build), which asks the physics world
 * whether the paths, the villagers' rounds and the doors are really open. These keep the fixes in place.
 */
type P = [number, number];
function segDist([x, z]: P, [ax, az]: P, [bx, bz]: P) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}
const loopDist = (p: P, pts: P[]) => Math.min(...pts.map((a, i) => segDist(p, a, pts[(i + 1) % pts.length])));
const lineDist = (p: P, pts: P[]) => Math.min(...pts.slice(1).map((b, i) => segDist(p, pts[i], b)));
const flat = (v: number[]): P => [v[0], v[2]];

describe('auditoria de posicionamento', () => {
  it('a mesa da torta fica fora da ronda do Roku e do passeio do Pipo', () => {
    const pie = flat(PIE);
    // the table is 0.84 m square (half diagonal ~0.6) and a villager ~0.3 m wide
    for (const id of ['roku', 'pipo']) expect(loopDist(pie, NPCS_BY_ID[id].patrol!.map(flat)), id).toBeGreaterThan(0.9);
  });

  it('as trilhas das terras selvagens passam ao lado das pedras do sol e da pedra do eco, não por cima', () => {
    for (const s of Object.values(SUN_STONES)) {
      for (const line of WILD_TRAILS) expect(lineDist(s.at, line)).toBeGreaterThan(0.8);
    }
    for (const line of WILD_TRAILS) expect(lineDist([ECHO_STONE.x, ECHO_STONE.z], line)).toBeGreaterThan(1.0);
    // but the echo stone is still reachable from its trail (its reach is 1.5 m)
    expect(Math.min(...WILD_TRAILS.map((l) => lineDist([ECHO_STONE.x, ECHO_STONE.z], l)))).toBeLessThan(1.5);
  });

  it('o caminho da ponte em arco entra pela ponta da ponte (vindo do norte batia no corrimão)', () => {
    const bridge = PRECINCT_PATHS.find((p) => p[p.length - 1][0] === ARCH_BRIDGE.x0)!;
    const [a, b] = bridge.slice(-2);
    expect(a[1]).toBe(ARCH_BRIDGE.z);
    expect(b[1]).toBe(ARCH_BRIDGE.z);
    expect(a[0]).toBeLessThan(ARCH_BRIDGE.x0);
  });

  it('a placa do circuito das argolas fica ao lado do cruzamento', () => {
    const sign = flat(OBJECTS_BY_ID.placa_argolas.position);
    expect(lineDist(sign, [[0, 25.8], [0, 27.2], [-2.4, 28.6]])).toBeGreaterThan(0.9);
  });
});
