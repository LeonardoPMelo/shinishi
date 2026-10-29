/**
 * The techniques Shinichi learns (the faro and the miado he knows from the start are listed by the UI on
 * their own). One place for the name, the icon, what it does and where it is learned, so the reward notice,
 * the HUD and the Jornada panel always agree.
 */
export const ABILITY_INFO: Record<string, { icon: string; name: string; does: string; learn: string }> = {
  double_jump: { icon: '🌀', name: 'Salto Duplo', does: 'pule de novo no ar.', learn: 'aprenda com o Mestre Lótus.' },
  passo_leve: {
    icon: '🐾', name: 'Passo Leve',
    does: 'agachado (C), você anda quase tão rápido quanto em pé, e em silêncio.',
    learn: 'forme-se na Academia Ninja.',
  },
};
