import { describe, expect, it } from 'vitest';
import { CHALLENGES } from '../src/data/challenges';
import { SKILLS } from '../src/data/skills';
import { RIVER_LANTERNS } from '../src/data/world';

/**
 * Every challenge answer is recomputed here independently: from the arithmetic in the
 * question when there is one, or from first principles for the word/logic puzzles.
 */

/** "a × b = ?", "12 peixes ÷ 3 por cesto = ? cestos", "20 − 12 = ?" … → computed result. */
function evalQuestion(q: string): number | null {
  const m = q.match(/(\d+)\D*?([×÷+−-])\D*?(\d+)/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[3]);
  switch (m[2]) {
    case '×': return a * b;
    case '÷': return a / b;
    case '+': return a + b;
    default: return a - b;
  }
}

describe('desafios: respostas', () => {
  for (const c of Object.values(CHALLENGES)) {
    if (c.kind !== 'number') continue;
    const expected = evalQuestion(c.question);
    if (expected === null) continue;
    it(`${c.id}: ${c.question} → ${c.answer}`, () => {
      expect(Number.isInteger(expected)).toBe(true); // divisions in the story must be exact
      expect(c.answer).toBe(expected);
    });
  }

  it('peixes_divisao: 48 peixes para 8 famílias = 6 (e 6 caixotes × 8 = 48 bate com o estoque)', () => {
    expect(CHALLENGES.peixes_divisao.answer * 8).toBe(48);
    expect(CHALLENGES.estoque_caixotes.answer).toBe(6 * 8);
    expect(CHALLENGES.peixes_divisao.answer).toBe(CHALLENGES.estoque_caixotes.answer / 8);
  });

  it('cofre_codigo: patas de 2 gatos, metade de 10 e as lanternas de pedra que EXISTEM na margem', () => {
    const code = Number(`${2 * 4}${10 / 2}${RIVER_LANTERNS.length}`);
    expect(CHALLENGES.cofre_codigo.answer).toBe(code);
  });

  it('lanternas_sequencia: 2, 4, 8 dobra a cada passo → 16', () => {
    const c = CHALLENGES.lanternas_sequencia;
    expect(c.choices![c.answer]).toBe(String(8 * 2));
  });

  it('engrenagens: 24 dentes ÷ 8 dentes = 3 voltas', () => {
    const c = CHALLENGES.engrenagens;
    expect(c.choices![c.answer]).toBe(`${24 / 8} voltas`);
  });

  it('receita_ordem: misturar antes de modelar, modelar antes de assar', () => {
    const c = CHALLENGES.receita_ordem;
    const steps = c.choices![c.answer].split(' → ');
    expect(steps.indexOf('Misturar')).toBeLessThan(steps.indexOf('Modelar'));
    expect(steps.indexOf('Modelar')).toBeLessThan(steps.indexOf('Assar'));
  });

  it('tabuas: 6 degraus × 2 = 12 tábuas, e o preço usa essas 12 tábuas', () => {
    expect(CHALLENGES.tabuas_degraus.answer).toBe(12);
    expect(CHALLENGES.tabuas_preco.answer).toBe(CHALLENGES.tabuas_degraus.answer * 3);
    // the purchase action charges exactly the computed price
    expect(CHALLENGES.tabuas_preco.onSuccess).toContain(`COINS:-${CHALLENGES.tabuas_preco.answer}`);
  });

  it('contas do Boku: troco = pagamento − preço calculado no passo anterior', () => {
    expect(CHALLENGES.kenzo_troco.answer).toBe(20 - CHALLENGES.kenzo_preco.answer);
  });
});

describe('desafios: ajuda em três passos', () => {
  for (const c of Object.values(CHALLENGES)) {
    it(`${c.id}: observar, dica e exemplo existem e são diferentes`, () => {
      expect(c.observe.length).toBeGreaterThan(15);
      expect(c.example.length).toBeGreaterThan(20);
      expect(new Set([c.observe, c.hint, c.example]).size).toBe(3);
      // math examples are worked out with numbers (reading/logic ones may not need any)
      if (!['leitura', 'logica'].includes(c.skill) || c.kind === 'number') expect(c.example).toMatch(/\d/);
    });
    it(`${c.id}: o exemplo parecido não entrega a resposta`, () => {
      const answer = c.kind === 'choice' ? c.choices![c.answer] : String(c.answer);
      const giveaway = new RegExp(`(=|é|são|ganha|código)\\s*${answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\d)`);
      expect(c.example).not.toMatch(giveaway);
      expect(c.observe).not.toMatch(giveaway);
    });
  }
});

describe('desafios: forma', () => {
  for (const c of Object.values(CHALLENGES)) {
    it(`${c.id} tem habilidade, dica, texto de acerto e efeito`, () => {
      expect(SKILLS[c.skill]).toBeDefined();
      expect(c.hint.length).toBeGreaterThan(10);
      expect(c.successText.length).toBeGreaterThan(10);
      expect(c.onSuccess).toMatch(/STEP:|FLAG:/);
      if (c.kind === 'choice') {
        expect(c.choices!.length).toBeGreaterThanOrEqual(2);
        expect(new Set(c.choices).size).toBe(c.choices!.length); // no duplicated options
        expect(c.answer).toBeGreaterThanOrEqual(0);
        expect(c.answer).toBeLessThan(c.choices!.length);
      } else {
        expect(Number.isInteger(c.answer)).toBe(true);
        expect(c.answer).toBeGreaterThanOrEqual(0);
        expect(String(c.answer).length).toBeLessThanOrEqual(4); // fits the on-screen keypad
      }
    });
  }
});
