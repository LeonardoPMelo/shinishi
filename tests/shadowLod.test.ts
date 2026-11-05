import { describe, expect, it } from 'vitest';
import { getPuffGeometry } from '../src/game/foliageGeometry';

/** The tree crowns cast their shadow from a lighter copy (StaticMerge's shadow proxies). */
const tris = (g: { index: { count: number } | null; attributes: { position: { count: number } } }) => (g.index ? g.index.count : g.attributes.position.count) / 3;

describe('sombra das copas', () => {
  it('as copas normais têm uma cópia leve para a sombra, com menos da metade dos triângulos', () => {
    for (let v = 0; v < 4; v++) {
      for (const detail of ['low', 'high'] as const) {
        const g = getPuffGeometry(v, detail);
        const lod = g.userData.shadowLod;
        expect(lod, `${v} ${detail}`).toBe(getPuffGeometry(v, 'tiny'));
        expect(tris(lod)).toBeLessThan(tris(g) * 0.55);
      }
      // the light one has none (it is already the light one)
      expect(getPuffGeometry(v, 'tiny').userData.shadowLod).toBeUndefined();
    }
  });

  it('a cópia leve ocupa quase o mesmo lugar (6 tufos em vez de 8: até ~11% do raio; na tela a sombra fica igual)', () => {
    const g = getPuffGeometry(1, 'low');
    const lod = g.userData.shadowLod;
    g.computeBoundingBox();
    lod.computeBoundingBox();
    for (const k of ['x', 'y', 'z'] as const) {
      expect(Math.abs(g.boundingBox!.max[k] - lod.boundingBox!.max[k])).toBeLessThan(0.15);
      expect(Math.abs(g.boundingBox!.min[k] - lod.boundingBox!.min[k])).toBeLessThan(0.15);
    }
  });
});
