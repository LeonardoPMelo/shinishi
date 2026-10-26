import { describe, expect, it } from 'vitest';
import { PILLAR_HEIGHTS, PILLAR_STEP, PILLAR_BELL, DEAL, DEAL_TOTAL, APPLES, KURO_CODE, KURO_WORD } from '../src/data/redesign';
import { PILLARS, OBJECTS_BY_ID } from '../src/data/world';
import { MISSIONS } from '../src/data/missions';
import { CHALLENGES } from '../src/data/challenges';
import { NPCS_BY_ID } from '../src/data/npcs';
import { ITEMS } from '../src/data/items';

/** The three thin chapter-1 missions, redesigned (§28): each has world activity, and the numbers match the scene. */

describe('missões reformuladas: estrutura', () => {
  it('passos antigos continuam existindo (saves antigos seguem válidos) e há passos novos com alvo', () => {
    const keep: Record<string, string[]> = { mei_coragem: ['conversar', 'floresta'], contas: ['preco', 'troco'], kuro: ['encontrar'] };
    for (const [id, old] of Object.entries(keep)) {
      const ids = MISSIONS[id].steps.map((s) => s.id);
      for (const o of old) expect(ids, `${id}.${o}`).toContain(o);
      expect(MISSIONS[id].steps.length, id).toBeGreaterThanOrEqual(4);
      for (const s of MISSIONS[id].steps) {
        const t = s.target;
        if (t && 'object' in t) expect(OBJECTS_BY_ID[t.object], `${id}.${s.id}`).toBeDefined();
        if (t && 'npc' in t) expect(NPCS_BY_ID[t.npc], `${id}.${s.id}`).toBeDefined();
        expect(t || s.counter, `${id}.${s.id} sem alvo`).toBeTruthy();
      }
    }
  });

  it('itens da entrega existem e o troco devolve a nota', () => {
    expect(ITEMS.sacola_macas).toBeDefined();
    expect(ITEMS.moedas_neko).toBeDefined();
    expect(CHALLENGES.kenzo_troco.onSuccess).toContain('TAKE:moedas_neko');
  });
});

describe('missões reformuladas: as contas batem com a cena', () => {
  it('Luna: os pilares do jogo sobem sempre 0,6 m e o sino está no topo do mais alto', () => {
    expect(PILLARS.map((p) => p.h)).toEqual(PILLAR_HEIGHTS);
    PILLAR_HEIGHTS.forEach((h, i) => i && expect(h - PILLAR_HEIGHTS[i - 1]).toBeCloseTo(PILLAR_STEP, 5));
    const top = PILLARS[PILLARS.length - 1];
    expect(Math.hypot(PILLAR_BELL[0] - top.pos[0], PILLAR_BELL[2] - top.pos[2])).toBeLessThan(0.75);
    expect(PILLAR_BELL[1]).toBe(top.h);
    const c = CHALLENGES.luna_pilares;
    expect(c.choices?.[c.answer]).toBe('0,6 m');
  });

  it('Boku: preço 3 × 4 = 12, troco 20 − 12 = 8, promoção leve 3 pague 2 em 6 maçãs = 16', () => {
    expect(CHALLENGES.kenzo_preco.answer).toBe(APPLES.count * APPLES.price);
    expect(CHALLENGES.kenzo_troco.answer).toBe(APPLES.paid - APPLES.count * APPLES.price);
    expect(DEAL_TOTAL).toBe(16);
    expect(CHALLENGES.kenzo_promocao.answer).toBe(DEAL_TOTAL);
    expect(DEAL_TOTAL).toBeLessThan(DEAL.wants * DEAL.price);
  });

  it('Kuro: o código da pedra, com A = 1, diz MESTRE', () => {
    expect(KURO_WORD).toBe('MESTRE');
    expect(KURO_CODE.every((n) => n >= 1 && n <= 26)).toBe(true);
    const c = CHALLENGES.kuro_codigo;
    expect(c.choices?.[c.answer]).toBe('MESTRE');
  });

  it('Kuro só aparece depois do código, e as 3 pistas somam o contador da missão', () => {
    expect(NPCS_BY_ID.kuro.visibleWhen?.step).toBe('kuro.decifrar');
    const clues = Object.values(OBJECTS_BY_ID).filter((o) => o.id.startsWith('kuro_pista_'));
    expect(clues).toHaveLength(MISSIONS.kuro.steps.find((s) => s.id === 'pistas')?.counter?.goal ?? -1);
    for (const c of clues) expect(JSON.stringify(c.dialogue)).toContain('COUNT:kuro_pistas');
  });
});
