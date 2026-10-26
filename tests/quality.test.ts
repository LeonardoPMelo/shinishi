import { describe, expect, it } from 'vitest';
import { AUTO_LADDER, renderProfile } from '../src/store/uiSettings';

/**
 * Automatic quality: it may trade resolution, bloom, MSAA and shadow-map size, but never the lighting
 * look (shadows and the color grade). Losing those mid-game read as a freeze plus "the lights went out".
 */
describe('qualidade automática', () => {
  it('em todos os degraus as sombras e a gradação de cor continuam ligadas', () => {
    AUTO_LADDER.forEach((_, level) => {
      const p = renderProfile('auto', level);
      expect(p.shadows, `degrau ${level}`).toBe(true);
      expect(p.postfx, `degrau ${level}`).toBe(true);
    });
  });

  it('cada degrau é igual ou mais leve que o anterior (nunca troca uma coisa cara por outra)', () => {
    for (let i = 1; i < AUTO_LADDER.length; i++) {
      const a = AUTO_LADDER[i - 1];
      const b = AUTO_LADDER[i];
      expect(b.scale).toBeLessThanOrEqual(a.scale);
      expect(b.msaa).toBeLessThanOrEqual(a.msaa);
      expect(b.shadowMap).toBeLessThanOrEqual(a.shadowMap);
      expect(b.shadowEvery).toBeGreaterThanOrEqual(a.shadowEvery);
      expect(b.detail).toBeLessThanOrEqual(a.detail);
      if (!a.bloom) expect(b.bloom).toBe(false);
    }
  });

  it('o primeiro degrau é o visual completo, e o último ainda tem antialiasing e resolução decente', () => {
    expect(AUTO_LADDER[0]).toMatchObject({ scale: 1, bloom: true, msaa: 4, shadowMap: 2048, shadowEvery: 1 });
    const last = AUTO_LADDER[AUTO_LADDER.length - 1];
    expect(last.scale).toBeGreaterThanOrEqual(0.6);
    expect(last.msaa).toBeGreaterThan(0);
    // the detail distance never drops below 60% (objects and villagers keep popping in far enough away)
    expect(last.detail).toBeGreaterThanOrEqual(0.6);
  });

  it('as pedrinhas da terra saem a partir do degrau 4 e, uma vez desligadas, não voltam mais abaixo', () => {
    AUTO_LADDER.forEach((r, i) => expect(r.pebbles, `degrau ${i}`).toBe(i < 4));
    expect(renderProfile('baixa', 0).pebbles).toBe(false);
    expect(renderProfile('alta', 0).pebbles).toBe(true);
  });

  it('um nível fora da escada (save antigo) cai no degrau válido mais próximo', () => {
    expect(renderProfile('auto', 99).scale).toBe(AUTO_LADDER[AUTO_LADDER.length - 1].scale);
    expect(renderProfile('auto', -3).scale).toBe(1);
  });

  it('só a qualidade Baixa, escolhida à mão, desliga sombras e pós-processamento', () => {
    expect(renderProfile('baixa', 0)).toMatchObject({ shadows: false, postfx: false });
    expect(renderProfile('media', 0)).toMatchObject({ shadows: true, postfx: true });
    expect(renderProfile('alta', 0)).toMatchObject({ shadows: true, postfx: true, bloom: true });
  });
});
