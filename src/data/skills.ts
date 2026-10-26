import type { Skill, SkillRecord } from '../types';

/**
 * School skills the game exercises. Every challenge (and every practice round at the
 * Alvo dos Números) is tagged with one, so the Saberes panel can show what the player
 * has been practising — and what to try next.
 */
export const SKILLS: Record<Skill, { name: string; icon: string; blurb: string }> = {
  adicao: { name: 'Adição', icon: '➕', blurb: 'Juntar quantidades.' },
  subtracao: { name: 'Subtração', icon: '➖', blurb: 'Descobrir quanto sobra ou quanto falta.' },
  multiplicacao: { name: 'Multiplicação', icon: '✖️', blurb: 'Somar grupos iguais bem rápido.' },
  divisao: { name: 'Divisão', icon: '➗', blurb: 'Repartir em partes iguais (e descobrir o resto).' },
  fracoes: { name: 'Frações', icon: '🥧', blurb: 'Partes de um inteiro.' },
  proporcoes: { name: 'Proporções', icon: '🍯', blurb: 'Manter a mesma relação quando tudo cresce.' },
  geometria: { name: 'Geometria', icon: '📐', blurb: 'Ângulos, contornos e áreas.' },
  algebra: { name: 'Álgebra', icon: '⚖️', blurb: 'Descobrir o número escondido.' },
  padroes: { name: 'Padrões', icon: '🔁', blurb: 'Perceber a regra e prever o próximo.' },
  logica: { name: 'Lógica', icon: '🧩', blurb: 'Juntar pistas e pensar passo a passo.' },
  leitura: { name: 'Leitura', icon: '📖', blurb: 'Entender instruções e textos com atenção.' },
};

export const SKILL_ORDER = Object.keys(SKILLS) as Skill[];

export const emptySkill = (): SkillRecord => ({ solved: 0, firstTry: 0, wrong: 0 });

/** 0 to 3 stars: practice counts more than speed, and mistakes never take stars away. */
export function skillStars(r: SkillRecord | undefined): number {
  if (!r) return 0;
  const points = r.solved + r.firstTry;
  if (points >= 10) return 3;
  if (points >= 5) return 2;
  if (points >= 1) return 1;
  return 0;
}

/** Points needed for the next star (for the progress bar), or null at 3 stars. */
export function nextStarAt(r: SkillRecord | undefined): { have: number; need: number } | null {
  const points = r ? r.solved + r.firstTry : 0;
  for (const need of [1, 5, 10]) if (points < need) return { have: points, need };
  return null;
}

/** Rewards for solving a challenge for the first time. */
export const CHALLENGE_REWARD = { xp: 15, coins: 5, gems: 1, firstTryBonusGems: 1 };
