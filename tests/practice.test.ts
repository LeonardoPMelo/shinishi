import { describe, expect, it } from 'vitest';
import { makeRound, nextRound, PRACTICE_SKILLS } from '../src/systems/practice';
import type { Skill } from '../src/types';

/** The free-practice generator, run thousands of times per skill and tier. */

function solve(question: string): number {
  const m = question.match(/^(\d+) ([+−×÷]) (\d+) = \?$/);
  if (!m) throw new Error(`pergunta fora do formato: ${question}`);
  const a = Number(m[1]);
  const b = Number(m[3]);
  return m[2] === '+' ? a + b : m[2] === '−' ? a - b : m[2] === '×' ? a * b : a / b;
}

describe('treino livre: rodadas geradas', () => {
  for (const skill of PRACTICE_SKILLS) {
    for (const tier of [0, 1, 2, 3]) {
      it(`${skill}, nível ${tier}: resposta certa, inteira e entre 3 alvos diferentes`, () => {
        for (let i = 0; i < 1500; i++) {
          const r = makeRound(skill, tier);
          const truth = solve(r.question);
          expect(Number.isInteger(truth)).toBe(true);
          expect(truth).toBeGreaterThanOrEqual(0);
          expect(r.answer).toBe(truth);
          expect(r.options).toHaveLength(3);
          expect(new Set(r.options).size).toBe(3);
          expect(r.options.filter((o) => o === r.answer)).toHaveLength(1);
          r.options.forEach((o) => {
            expect(Number.isInteger(o)).toBe(true);
            expect(o).toBeGreaterThanOrEqual(0);
            expect(String(o).length).toBeLessThanOrEqual(3); // fits the target texture
          });
          expect(r.hint.length).toBeGreaterThan(10);
        }
      });
    }
  }

  it('a dificuldade cresce com as estrelas (números maiores no nível 3)', () => {
    const avg = (skill: Skill, tier: number) => {
      let s = 0;
      for (let i = 0; i < 800; i++) s += makeRound(skill, tier).answer;
      return s / 800;
    };
    for (const skill of ['adicao', 'subtracao', 'multiplicacao'] as Skill[]) expect(avg(skill, 3)).toBeGreaterThan(avg(skill, 0));
  });

  it('puxa para a habilidade menos treinada e nunca repete a mesma 3 vezes seguidas', () => {
    const learning = {
      adicao: { solved: 9, firstTry: 9, wrong: 0 },
      subtracao: { solved: 9, firstTry: 9, wrong: 0 },
      multiplicacao: { solved: 9, firstTry: 9, wrong: 0 },
      divisao: { solved: 0, firstTry: 0, wrong: 0 },
    };
    let weakest = 0;
    for (let i = 0; i < 1000; i++) if (nextRound(learning, []).skill === 'divisao') weakest++;
    expect(weakest / 1000).toBeGreaterThan(0.6); // 60% weakest + its share of the random 40%
    for (let i = 0; i < 300; i++) expect(nextRound(learning, ['divisao', 'divisao']).skill).not.toBe('divisao');
  });
});
