import type { Skill, SkillRecord } from '../types';
import { skillStars } from '../data/skills';

/**
 * Free-practice rounds for the Alvo dos Números: one question, three numbered targets.
 * The skill is picked toward what was practised least, and the numbers grow with the
 * stars earned in that skill, so practice stays within reach but never stalls.
 */
export interface PracticeRound {
  skill: Skill;
  question: string;
  options: [number, number, number];
  answer: number;
  hint: string;
}

export const PRACTICE_SKILLS: Skill[] = ['adicao', 'subtracao', 'multiplicacao', 'divisao'];

const rand = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];

function shuffle3(xs: number[]): [number, number, number] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return [a[0], a[1], a[2]];
}

/** Two believable wrong answers (classic slips: off by one step, off by ten). */
function withDistractors(answer: number, steps: number[]): [number, number, number] {
  const wrong = new Set<number>();
  for (const s of [...steps].sort(() => Math.random() - 0.5)) {
    const v = answer + s;
    if (v >= 0 && v !== answer) wrong.add(v);
    if (wrong.size === 2) break;
  }
  let k = 2;
  while (wrong.size < 2) wrong.add(answer + k++);
  return shuffle3([answer, ...wrong]);
}

/** Times tables by tier: start with the friendly ones. */
const TABLES = [[2, 3, 4, 5, 10], [2, 3, 4, 5, 6, 10], [3, 4, 6, 7, 8, 9], [6, 7, 8, 9, 11, 12]];

export function makeRound(skill: Skill, tier: number): PracticeRound {
  const t = Math.max(0, Math.min(3, tier));
  switch (skill) {
    case 'adicao': {
      const [lo, hi] = [[2, 12], [8, 40], [20, 80], [45, 150]][t];
      const a = rand(lo, hi);
      const b = rand(lo, hi);
      return {
        skill, question: `${a} + ${b} = ?`, answer: a + b, options: withDistractors(a + b, [-1, 1, -10, 10, 2]),
        hint: b >= 10 ? `Some as dezenas primeiro: ${a} + ${b - (b % 10)} = ${a + b - (b % 10)}. Depois junte o ${b % 10}.` : `Comece no ${a} e conte mais ${b}.`,
      };
    }
    case 'subtracao': {
      const [lo, hi] = [[6, 20], [20, 60], [40, 100], [100, 300]][t];
      const a = rand(lo, hi);
      const b = rand(2, a - 1);
      return {
        skill, question: `${a} − ${b} = ?`, answer: a - b, options: withDistractors(a - b, [-1, 1, -10, 10, 2]),
        hint: `Comece no ${b} e conte quanto falta para chegar ao ${a}.`,
      };
    }
    case 'multiplicacao': {
      const a = pick(TABLES[t]);
      const b = rand(t < 2 ? 1 : 2, t < 3 ? 10 : 12);
      return {
        skill, question: `${a} × ${b} = ?`, answer: a * b, options: withDistractors(a * b, [a, -a, b, -b, 1]),
        hint: `${a} × ${b} são ${b} grupos de ${a}. Conte de ${a} em ${a}.`,
      };
    }
    case 'divisao':
    default: {
      const d = pick(TABLES[t]);
      const q = rand(2, t < 3 ? 10 : 12);
      return {
        skill: 'divisao', question: `${d * q} ÷ ${d} = ?`, answer: q, options: withDistractors(q, [-1, 1, 2, -2, d]),
        hint: `Quantos grupos de ${d} cabem em ${d * q}? Conte de ${d} em ${d}.`,
      };
    }
  }
}

/** Mostly the least-practised skill, sometimes a random one, never the same skill three times in a row. */
export function nextRound(learning: Record<string, SkillRecord>, recent: Skill[]): PracticeRound {
  const points = (s: Skill) => (learning[s]?.solved ?? 0) + (learning[s]?.firstTry ?? 0);
  let options = PRACTICE_SKILLS.filter((s) => !(recent.length >= 2 && recent[0] === s && recent[1] === s));
  if (options.length === 0) options = PRACTICE_SKILLS;
  const weakest = [...options].sort((a, b) => points(a) - points(b) || Math.random() - 0.5)[0];
  const skill = Math.random() < 0.6 ? weakest : pick(options);
  return makeRound(skill, skillStars(learning[skill]));
}
