import { describe, expect, it } from 'vitest';
import { sanitizeSave, type SanitizeDefaults } from '../src/store/saveSanitize';
import { emptyProgress } from '../src/systems/progression';
import { levelForXp } from '../src/systems/leveling';
import type { PlayerStats } from '../src/types';

/** A broken or incomplete save must never crash the game (Etapa 1 da expansão). */

const player: PlayerStats = { xp: 0, level: 1, rank: 'Aprendiz', coins: 0, gems: 0, hp: 100, maxHp: 100, completedMissions: [], badges: [] };
const defaults: SanitizeDefaults = {
  player,
  baseAbilities: ['faro', 'miado'],
  rankFor: (level) => (level >= 3 ? 'Explorador' : 'Aprendiz'),
};

describe('reparo do save', () => {
  it('um save incompleto (o que derrubava o jogo) ganha todos os campos que faltam', () => {
    const out = sanitizeSave({ player: { xp: 30, coins: 5 }, progress: { missions: { peixes: { status: 'active', steps: [] } } } }, defaults);
    expect(out.progress.flags).toEqual({});
    expect(out.progress.counters).toEqual({});
    expect(out.progress.inventory).toEqual({});
    expect(out.progress.learning).toEqual({});
    expect(out.progress.solved).toEqual([]);
    expect(out.progress.abilities).toEqual(expect.arrayContaining(['faro', 'miado']));
    expect(out.progress.missions.peixes).toEqual({ status: 'active', steps: [] });
    expect(out.player.coins).toBe(5);
    expect(out.player.gems).toBe(0);
    expect(out.player.level).toBe(levelForXp(30));
  });

  it('nada salvo, ou lixo no lugar do save, vira um jogo novo', () => {
    for (const raw of [undefined, null, 42, 'texto', [], { player: 'x', progress: 7 }]) {
      const out = sanitizeSave(raw, defaults);
      expect(out.player.xp).toBe(0);
      expect(out.progress.missions).toEqual({});
      expect(out.progress.abilities).toEqual(['faro', 'miado']);
    }
  });

  it('descarta valores inválidos sem perder os bons', () => {
    const out = sanitizeSave({
      player: { xp: -5, coins: 'muitas', gems: 3.7, hp: 999, maxHp: 100, badges: ['Detetive Ninja', 7, 'Detetive Ninja'] },
      progress: {
        flags: { porta_aberta: true, quebrado: 'sim' },
        counters: { patas: 3, ruim: Number.NaN, negativo: -2 },
        inventory: { pocao_energia: 2, zero: 0, peixe: 1.8 },
        learning: { fracoes: { solved: 2, firstTry: 1, wrong: 'x' } },
      },
    }, defaults);
    expect(out.player.xp).toBe(0);
    expect(out.player.coins).toBe(0);
    expect(out.player.gems).toBe(3);
    expect(out.player.hp).toBe(100);
    expect(out.player.badges).toEqual(['Detetive Ninja']);
    expect(out.progress.flags).toEqual({ porta_aberta: true });
    expect(out.progress.counters).toEqual({ patas: 3 });
    expect(out.progress.inventory).toEqual({ pocao_energia: 2, peixe: 1 });
    expect(out.progress.learning).toEqual({ fracoes: { solved: 2, firstTry: 1, wrong: 0 } });
  });

  it('missões e etapas que não existem mais no jogo são removidas; a missão seguida precisa estar ativa', () => {
    const out = sanitizeSave({
      progress: {
        missions: {
          peixes: { status: 'done', steps: ['talk_tofu', 'etapa_que_sumiu'] },
          missao_apagada: { status: 'active', steps: [] },
          treino: { status: 'perdida', steps: [] },
        },
        tracked: 'peixes',
      },
    }, defaults);
    expect(Object.keys(out.progress.missions)).toEqual(['peixes']);
    expect(out.progress.missions.peixes.steps).toEqual(['talk_tofu']);
    expect(out.progress.tracked).toBeNull();
  });

  it('um save válido sai igual', () => {
    const progress = {
      ...emptyProgress(),
      missions: { peixes: { status: 'active' as const, steps: ['talk_tofu'] } },
      flags: { a: true },
      counters: { patas: 2 },
      inventory: { pocao_energia: 1 },
      abilities: ['faro', 'miado', 'double_jump'],
      tracked: 'peixes',
      learning: { fracoes: { solved: 1, firstTry: 1, wrong: 0 } },
      solved: ['x'],
    };
    const p = { ...player, xp: 120, level: levelForXp(120), rank: defaults.rankFor(levelForXp(120)), coins: 10, gems: 2, badges: ['Detetive Ninja'] };
    const out = sanitizeSave({ player: p, progress }, defaults);
    expect(out.progress).toEqual(progress);
    expect(out.player).toEqual(p);
  });
});
