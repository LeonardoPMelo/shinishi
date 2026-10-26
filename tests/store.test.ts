import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '../src/store/gameStore';
import { CHALLENGE_REWARD, skillStars } from '../src/data/skills';

/** Challenge rewards, the learning record and the save migration. */

const st = () => useGameStore.getState();

beforeEach(() => {
  st().resetGame();
  useGameStore.setState({ phase: 'playing', activeChallenge: null, celebrations: [] });
});

describe('desafios no store', () => {
  it('acertar de primeira paga XP, moedas e 2 gemas; o registro conta o acerto de primeira', () => {
    st().openChallenge('kenzo_preco');
    expect(st().submitAnswer(12)).toBe('correct');
    const r = st().activeChallenge!.reward!;
    expect(r).toEqual({ xp: CHALLENGE_REWARD.xp, coins: CHALLENGE_REWARD.coins, gems: 2, firstTry: true });
    expect(st().player.gems).toBe(2);
    expect(st().progress.learning.multiplicacao).toEqual({ solved: 1, firstTry: 1, wrong: 0 });
  });

  it('errar antes não pune: paga 1 gema, registra o erro como prática', () => {
    st().openChallenge('kenzo_preco');
    expect(st().submitAnswer(7)).toBe('wrong');
    expect(st().activeChallenge!.showHint).toBe(false);
    expect(st().submitAnswer(11)).toBe('wrong');
    expect(st().activeChallenge!.showHint).toBe(true);
    expect(st().submitAnswer(12)).toBe('correct');
    expect(st().player.gems).toBe(1);
    expect(st().player.coins).toBe(CHALLENGE_REWARD.coins);
    expect(st().progress.learning.multiplicacao).toEqual({ solved: 1, firstTry: 0, wrong: 2 });
  });

  it('cada erro abre o próximo cartão de ajuda, até 3 (observar → dica → exemplo)', () => {
    st().openChallenge('kenzo_troco');
    expect(st().activeChallenge!.hintLevel).toBe(0);
    st().submitAnswer(1);
    expect(st().activeChallenge!.hintLevel).toBe(1);
    st().submitAnswer(2);
    expect(st().activeChallenge!.hintLevel).toBe(2);
    st().submitAnswer(3);
    st().submitAnswer(4);
    expect(st().activeChallenge!.hintLevel).toBe(3);
    expect(st().submitAnswer(8)).toBe('correct');
  });

  it('"Pedir ajuda" abre o próximo cartão sem contar como erro e sem perder a gema de primeira', () => {
    st().openChallenge('kenzo_preco');
    st().revealHint();
    st().revealHint();
    st().revealHint();
    st().revealHint(); // never beyond the worked example
    expect(st().activeChallenge!.hintLevel).toBe(3);
    expect(st().activeChallenge!.attempts).toBe(0);
    st().submitAnswer(12);
    expect(st().activeChallenge!.reward!.firstTry).toBe(true);
  });

  it('pedir ajuda e depois errar avança para o cartão seguinte (bug visto no navegador)', () => {
    st().openChallenge('tabuas_degraus');
    st().revealHint();
    expect(st().activeChallenge!.hintLevel).toBe(1);
    st().submitAnswer(10);
    expect(st().activeChallenge!.hintLevel).toBe(2);
  });

  it('a recompensa só é paga uma vez por desafio', () => {
    st().openChallenge('kenzo_preco');
    st().submitAnswer(12);
    st().closeChallenge();
    const gems = st().player.gems;
    st().openChallenge('kenzo_preco');
    st().submitAnswer(12);
    expect(st().activeChallenge!.reward).toBeNull();
    expect(st().player.gems).toBe(gems);
    expect(st().progress.learning.multiplicacao.solved).toBe(2); // practice still counts
  });

  it('estrelas só sobem: erros não tiram estrelas', () => {
    expect(skillStars({ solved: 3, firstTry: 2, wrong: 0 })).toBe(2);
    expect(skillStars({ solved: 3, firstTry: 2, wrong: 40 })).toBe(2);
    expect(skillStars({ solved: 0, firstTry: 0, wrong: 9 })).toBe(0);
  });

  it('o desafio do estoque marca a etapa e a pista dos 48 peixes', () => {
    st().runActions('START:peixes;STEP:peixes.talk_tofu');
    st().openChallenge('estoque_caixotes');
    st().submitAnswer(48);
    expect(st().progress.missions.peixes.steps).toContain('estoque');
    expect(st().progress.flags.pista_pelo).toBe(true);
  });
});

describe('save', () => {
  it('migra um save v3: cria gemas e aprendizado e completa a etapa nova dos peixes', () => {
    const migrate = useGameStore.persist.getOptions().migrate!;
    const old = {
      player: { xp: 120, level: 2, rank: 'Aprendiz', coins: 30, hp: 100, maxHp: 100, completedMissions: [], badges: [] },
      progress: { missions: { peixes: { status: 'active', steps: ['talk_tofu', 'talk_kenzo', 'talk_mei', 'solve_math'] } }, flags: {}, counters: {}, inventory: {}, abilities: ['faro', 'miado'], tracked: 'peixes' },
    };
    const out = migrate(old, 3) as { player: { gems: number }; progress: { learning: object; solved: string[]; missions: { peixes: { steps: string[] } } } };
    expect(out.player.gems).toBe(0);
    expect(out.progress.learning).toEqual({});
    expect(out.progress.solved).toEqual([]);
    expect(out.progress.missions.peixes.steps).toContain('estoque');
  });
});
