import { describe, expect, it } from 'vitest';
import {
  traceBeam, MIRROR_SOLUTION, MIRROR_START, MIRRORS, PLATES, FRACTION_ROUNDS, litEighths, fractionSolved,
  GONG_ROUNDS, strikeGong, gongSpot, inTemple, TEMPLE, GATE, cellToWorld, CRYSTAL_CELL, BEAM_SOURCE,
} from '../src/systems/temple';
import { MISSIONS } from '../src/data/missions';
import { OBJECTS_BY_ID } from '../src/data/world';
import { TEMPLE_SOLVE_ACTIONS } from '../src/data/temple';
import { useGameStore } from '../src/store/gameStore';

/** Templo dos Enigmas: each puzzle is solvable, has the intended answer, and rejects wrong ones. */

describe('Espelhos da Luz (ângulos)', () => {
  it('de 64 combinações de espelhos, só uma leva a luz ao cristal', () => {
    const wins: number[][] = [];
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 4; c++) {
      if (traceBeam([a, b, c]).end === 'crystal') wins.push([a, b, c]);
    }
    expect(wins).toEqual([MIRROR_SOLUTION]);
  });

  it('na solução, cada espelho fica inclinado (45° ou 135°) e vira o raio 90°', () => {
    for (const k of MIRROR_SOLUTION) expect([45, 135]).toContain(k * 45);
    const { path } = traceBeam(MIRROR_SOLUTION);
    // every mirror is on the path, and the beam changes direction exactly there
    for (const m of MIRRORS) {
      const at = path.findIndex(([i, j]) => i === m[0] && j === m[1]);
      expect(at).toBeGreaterThan(0);
      const [a, b, c] = [path[at - 1], path[at], path[at + 1]];
      const d1 = [b[0] - a[0], b[1] - a[1]];
      const d2 = [c[0] - b[0], c[1] - b[1]];
      expect(d1[0] * d2[0] + d1[1] * d2[1]).toBe(0); // perpendicular = 90° turn
    }
  });

  it('no começo o enigma não está resolvido, e a luz não volta para a lanterna', () => {
    expect(traceBeam(MIRROR_START).end).not.toBe('crystal');
    expect(cellToWorld(...CRYSTAL_CELL)).not.toEqual(cellToWorld(...BEAM_SOURCE.cell));
  });

  it('o raio nunca fica preso num laço, qualquer que seja a posição dos espelhos', () => {
    for (let n = 0; n < 64; n++) {
      const r = traceBeam([n & 3, (n >> 2) & 3, (n >> 4) & 3]);
      expect(r.path.length).toBeLessThan(40);
    }
  });
});

describe('Porta das Frações (frações equivalentes)', () => {
  it('as placas valem o que dizem: ½=4/8, ¼=2/8, ⅛=1/8, ⅜=3/8', () => {
    const value = (label: string) => ({ '½': 1 / 2, '¼': 1 / 4, '⅛': 1 / 8, '⅜': 3 / 8 }[label]!);
    for (const p of PLATES) expect(p.eighths / 8).toBe(value(p.label));
    expect(FRACTION_ROUNDS.map((r) => r.eighths / 8)).toEqual([3 / 4, 5 / 8]);
  });

  it('cada rodada tem mais de um jeito certo (frações diferentes, mesmo valor) e nenhuma é trivial', () => {
    FRACTION_ROUNDS.forEach((_, round) => {
      const ways: boolean[][] = [];
      for (let n = 0; n < 16; n++) {
        const on = PLATES.map((_, k) => !!(n & (1 << k)));
        if (fractionSolved(round, on)) ways.push(on);
      }
      expect(ways.length).toBeGreaterThanOrEqual(2);
      expect(ways.every((on) => on.filter(Boolean).length >= 2)).toBe(true); // never a single plate
    });
  });

  it('passar do valor ou faltar não abre a porta', () => {
    expect(litEighths([true, true, true, true])).toBe(10);
    expect(fractionSolved(0, [true, true, true, true])).toBe(false);
    expect(fractionSolved(0, [true, false, false, false])).toBe(false);
  });
});

describe('Gongos da Sequência (padrões)', () => {
  it('a resposta segue a regra da tábua', () => {
    const [soma, dobra] = GONG_ROUNDS;
    const step = soma.shown[1] - soma.shown[0];
    soma.shown.forEach((v, k) => k && expect(v - soma.shown[k - 1]).toBe(step));
    expect(soma.answer).toEqual([soma.shown[3] + step, soma.shown[3] + 2 * step]);
    dobra.shown.forEach((v, k) => k && expect(v).toBe(dobra.shown[k - 1] * 2));
    expect(dobra.answer).toEqual([dobra.shown[3] * 2]);
  });

  it('as respostas estão entre os gongos, e cada gongo tem um número diferente', () => {
    for (const r of GONG_ROUNDS) {
      for (const a of r.answer) expect(r.gongs).toContain(a);
      expect(new Set(r.gongs).size).toBe(r.gongs.length);
    }
  });

  it('tocar na ordem certa termina; um gongo errado recomeça', () => {
    expect(strikeGong(0, 0, 14)).toBe(1);
    expect(strikeGong(0, 1, 17)).toBe('done');
    expect(strikeGong(0, 0, 17)).toBe('wrong'); // right number, wrong order
    expect(strikeGong(0, 1, 15)).toBe('wrong');
    expect(strikeGong(1, 0, 16)).toBe('done');
  });

  it('os gongos ficam de frente para a tábua (rosto virado para o centro do arco)', () => {
    for (let k = 0; k < 5; k++) {
      const [x, z, rotY] = gongSpot(k, 5);
      const face = [Math.sin(rotY), Math.cos(rotY)];
      const toCentre = [0 - x, -29.2 - z];
      expect(face[0] * toCentre[0] + face[1] * toCentre[1]).toBeGreaterThan(0);
    }
  });
});

describe('a região e a missão', () => {
  it('o portão fica dentro da passagem e a região é fechada por muros (dentro dos limites)', () => {
    expect(inTemple(GATE.x, GATE.z - 0.5)).toBe(true);
    expect(inTemple(GATE.x, -30)).toBe(true);
    expect(inTemple(TEMPLE.maxX + 1, -30)).toBe(false);
    expect(inTemple(0, TEMPLE.minZ - 1)).toBe(false);
  });

  it('a missão do templo é do capítulo 4, e cada enigma marca a sua etapa e a sua habilidade', () => {
    const m = MISSIONS.templo;
    expect(m.chapter).toBe(4);
    expect(m.steps.find((s) => s.id === 'santuario')?.after).toEqual(['espelhos', 'fracoes', 'gongos']);
    expect(TEMPLE_SOLVE_ACTIONS.espelhos).toContain('SKILL:geometria');
    expect(TEMPLE_SOLVE_ACTIONS.fracoes).toContain('SKILL:fracoes');
    expect(TEMPLE_SOLVE_ACTIONS.gongos).toContain('SKILL:padroes');
    for (const id of ['placa_espelhos', 'placa_fracoes', 'placa_gongos', 'altar_enigmas']) expect(OBJECTS_BY_ID[id]).toBeDefined();
  });

  it('resolver um enigma registra a prática da habilidade no Saberes', () => {
    const st = useGameStore.getState;
    st().resetGame();
    const before = st().progress.learning.geometria?.solved ?? 0;
    st().startMission('templo');
    st().runActions('STEP:templo.portao');
    st().runActions(TEMPLE_SOLVE_ACTIONS.espelhos);
    expect(st().progress.missions.templo.steps).toContain('espelhos');
    expect(st().progress.learning.geometria?.solved ?? 0).toBe(before + 1);
    st().resetGame();
  });
});
