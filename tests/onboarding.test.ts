import { describe, expect, it } from 'vitest';
import { currentObjective, isFirstSteps } from '../src/systems/objective';
import { emptyProgress } from '../src/systems/progression';
import { TOUR, tourCamera, STOP_SECONDS } from '../src/game/systems/tour';
import { distanceToWalkable } from '../src/game/world/TreeLine';
import { reducedMotion, useUiSettings } from '../src/store/uiSettings';
import type { Progress } from '../src/types';

/** Etapa 7: the first minute, the demonstration route and the accessibility settings. */

describe('objetivo do primeiro minuto', () => {
  it('num jogo novo, aponta a Chef Hana e o lugar dela', () => {
    const p = emptyProgress();
    const goal = currentObjective(p)!;
    expect(goal.kind).toBe('offer');
    expect(goal.missionId).toBe('peixes');
    expect(goal.text).toContain('Chef Hana');
    expect(goal.position).not.toBeNull();
    expect(isFirstSteps(p)).toBe(true);
  });

  it('com a missão aceita, passa a mostrar a etapa da missão', () => {
    const p: Progress = { ...emptyProgress(), missions: { peixes: { status: 'active', steps: [] } }, tracked: 'peixes' };
    const goal = currentObjective(p)!;
    expect(goal.kind).toBe('step');
    expect(goal.text).toBe('Fale com a Chef Hana na cantina');
    expect(isFirstSteps(p)).toBe(false);
  });

  it('entre missões, aponta a próxima pessoa com pedido (nunca fica vazio enquanto houver um)', () => {
    const p: Progress = { ...emptyProgress(), missions: { peixes: { status: 'completed', steps: [] } } };
    const goal = currentObjective(p);
    expect(goal).not.toBeNull();
    expect(goal!.missionId).not.toBe('peixes');
  });
});

describe('passeio pela vila', () => {
  it('tem paradas com título e legenda curta, todas em lugares onde o gato pode estar', () => {
    expect(TOUR.length).toBeGreaterThanOrEqual(6);
    for (const stop of TOUR) {
      expect(stop.title.length).toBeGreaterThan(0);
      expect(stop.caption.length).toBeLessThanOrEqual(60);
      expect(distanceToWalkable(stop.x, stop.z), stop.title).toBeLessThanOrEqual(0.5);
    }
  });

  it('com movimento reduzido, a câmera fica parada em cada parada', () => {
    const a = tourCamera(TOUR[0], 0, true).clone();
    const b = tourCamera(TOUR[0], STOP_SECONDS, true).clone();
    expect(a.distanceTo(b)).toBe(0);
    const c = tourCamera(TOUR[0], 0, false).clone();
    const d = tourCamera(TOUR[0], STOP_SECONDS, false).clone();
    expect(c.distanceTo(d)).toBeGreaterThan(1);
  });
});

describe('acessibilidade', () => {
  it('movimento reduzido segue a escolha explícita', () => {
    expect(reducedMotion('on')).toBe(true);
    expect(reducedMotion('off')).toBe(false);
  });

  it('o tamanho do texto fica entre normal e muito grande', () => {
    const s = useUiSettings.getState();
    s.setTextScale(2);
    expect(useUiSettings.getState().textScale).toBe(1.3);
    s.setTextScale(0.5);
    expect(useUiSettings.getState().textScale).toBe(1);
  });
});
