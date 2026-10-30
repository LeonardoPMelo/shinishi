import { describe, expect, it } from 'vitest';
import { CHALLENGES } from '../src/data/challenges';
import { MISSIONS, MISSION_ORDER } from '../src/data/missions';
import { HORTA } from '../src/data/chapter3';

/** Capítulo 3: every answer recomputed from the story's own numbers (6th-grade content). */

const ans = (id: string) => {
  const c = CHALLENGES[id];
  return c.kind === 'choice' ? c.choices![c.answer] : c.answer;
};

describe('capítulo 3: respostas', () => {
  it('banquete: 50 bolinhos para 8 gatos → 6 cada, resto 2', () => {
    expect(ans('banquete_divisao')).toBe(Math.floor(50 / 8));
    expect(ans('banquete_resto')).toBe(50 % 8);
    expect(ans('banquete_resto')).toBe(50 - 8 * (ans('banquete_divisao') as number));
    // the 2 leftovers are exactly what is handed to Dona Neko
    expect(CHALLENGES.banquete_resto.onSuccess).toContain(`GIVE:bolinho:${50 % 8}`);
  });

  it('poção: 3 xícaras para 2 colheres → 9 xícaras pedem 6; 8 colheres pedem 12 xícaras', () => {
    expect(ans('pocao_proporcao')).toBe((9 / 3) * 2);
    expect(ans('pocao_total')).toBe((8 / 2) * 3);
    // same ratio both ways
    expect((ans('pocao_proporcao') as number) / 9).toBeCloseTo(2 / 3);
    expect(8 / (ans('pocao_total') as number)).toBeCloseTo(2 / 3);
  });

  it('máquina: de 30° para 45° sobe 15°, e com 5° por clique são 3 cliques', () => {
    expect(ans('maquina_giro')).toBe(45 - 30);
    expect(ans('maquina_cliques')).toBe((45 - 30) / 5);
  });

  it('torta: 8 fatias, 3 comidas → sobram 5/8; metade de 8 fatias = 4/8 = 1/2', () => {
    expect(ans('fatias_sobra')).toBe(`${8 - 3}/8`);
    const [n, d] = String(ans('fatias_metade')).split('/').map(Number);
    expect(n / d).toBe(1 / 2);
    // no other option is also worth one half (only one right answer)
    const halves = CHALLENGES.fatias_metade.choices!.filter((c) => { const [a, b] = c.split('/').map(Number); return a / b === 0.5; });
    expect(halves).toHaveLength(1);
  });

  it('horta: retângulo do jogo (6 × 4) → perímetro 20 m, área 24 m²', () => {
    expect(ans('horta_perimetro')).toBe(2 * (HORTA.w + HORTA.d));
    expect(ans('horta_area')).toBe(HORTA.w * HORTA.d);
  });

  it('balança: 3p + 4 = 19 → p = 5; 2n + 3 = 11 → n = 4', () => {
    const p = ans('balanca_pedra') as number;
    expect(3 * p + 4).toBe(19);
    const n = ans('balanca_mista') as number;
    expect(2 * n + 3).toBe(11);
  });
});

describe('capítulo 3: missões', () => {
  it('a campanha tem 51 missões (31 + 2 dos interiores + 5 da Academia e da Sede + 1 das lojas + 7 das Terras Selvagens + 5 do capítulo 7), 7 delas no capítulo 3 (e 1 no 4); as dos bairros novos ficam no cap. 2', () => {
    expect(MISSION_ORDER).toHaveLength(51);
    expect(MISSIONS.coelhos.chapter).toBe(2);
    expect(MISSION_ORDER.filter((id) => MISSIONS[id].chapter === 5)).toEqual(['academia', 'audiencia', 'documentos', 'expedicao', 'pergaminho']);
    for (const id of ['glicinias', 'aguas', 'arvore']) expect(MISSIONS[id].chapter).toBe(2);
    expect(MISSION_ORDER.filter((id) => MISSIONS[id].chapter === 4)).toEqual(['templo']);
    expect(MISSION_ORDER.filter((id) => MISSIONS[id].chapter === 3)).toHaveLength(7);
  });

  it('cada missão nova dá recompensa e lição', () => {
    for (const id of MISSION_ORDER.filter((m) => MISSIONS[m].chapter === 3)) {
      const m = MISSIONS[id];
      expect(m.rewards.xp).toBeGreaterThan(0);
      expect(m.rewards.gems ?? 0).toBeGreaterThan(0);
      expect(m.lesson.length).toBeGreaterThan(30);
    }
  });
});
