import { describe, expect, it } from 'vitest';
import { sheetGeometry } from '../src/game/world/Cascade';

/** The waterfalls' sheet of water (world/Cascade.tsx). */
describe('a cachoeira', () => {
  it('a lâmina vai da borda (y 0) até o pé (y -altura), abre para fora ao cair e alarga um pouco embaixo', () => {
    const g = sheetGeometry(5, 8, 0.9);
    g.computeBoundingBox();
    const b = g.boundingBox!;
    expect(b.max.y).toBeCloseTo(0, 5);
    expect(b.min.y).toBeCloseTo(-8, 5);
    const pos = g.attributes.position;
    let topZ = 0, footZ = 0, topW = 0, footW = 0;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > -0.01) { topZ = Math.max(topZ, Math.abs(pos.getZ(i))); topW = Math.max(topW, Math.abs(pos.getX(i))); }
      if (y < -7.99) { footZ = Math.max(footZ, pos.getZ(i)); footW = Math.max(footW, Math.abs(pos.getX(i))); }
    }
    // starts against the cliff and arcs out by about the bulge at the foot
    expect(topZ).toBeLessThan(0.1);
    expect(footZ).toBeGreaterThan(0.8);
    expect(footZ).toBeLessThan(1.0);
    expect(footW).toBeGreaterThan(topW);
    expect(footW).toBeLessThan(topW * 1.2);
  });
});
