import { describe, expect, it } from 'vitest';
import { pickView, PROBES, type Probe } from '../src/game/systems/cameraProbe';
import { treeLineSpots, distanceToWalkable } from '../src/game/world/TreeLine';
import { lushness } from '../src/game/world/Foliage';

/** Etapa 6: the camera in tight spots, the forest band in the middle distance, the lawn's density field. */

describe('câmera nas áreas apertadas', () => {
  const wanted = 7.4;
  const all = (free: (p: [number, number]) => number): Probe[] => [
    { dTheta: 0, dPhi: 0, free: free([0, 0]) },
    ...PROBES.map(([dTheta, dPhi]) => ({ dTheta, dPhi, free: free([dTheta, dPhi]) })),
  ];

  it('com a vista livre, fica na vista que o jogador escolheu', () => {
    const best = pickView(all(() => wanted), wanted);
    expect(best.dTheta).toBe(0);
    expect(best.dPhi).toBe(0);
  });

  it('bloqueada por um beiral, prefere girar um pouco a se espremer contra o gato', () => {
    // only the views turned aside have room (a porch roof above, a wall behind)
    const best = pickView(all(([t]) => (Math.abs(t) >= 0.35 ? wanted : 1.2)), wanted);
    expect(Math.abs(best.dTheta)).toBe(0.35);
    expect(best.dPhi).toBe(0);
  });

  it('entre girar e inclinar com o mesmo espaço, gira (a vista inclinada achata a cena)', () => {
    const best = pickView(all(([t, p]) => (t === 0 && p === 0 ? 1.5 : wanted)), wanted);
    expect(best.dPhi).toBe(0);
    expect(Math.abs(best.dTheta)).toBeGreaterThan(0);
  });

  it('não troca de vista por uma diferença mínima (sem tremer)', () => {
    const probes = all(([t]) => (t === 0.35 ? 6.0 : t === -0.35 ? 6.1 : 1.2));
    expect(pickView(probes, wanted, { dTheta: 0.35, dPhi: 0 }).dTheta).toBe(0.35);
  });
});

describe('linha de mata ao fundo', () => {
  const spots = treeLineSpots();

  it('tem árvores suficientes para formar uma parede e nenhuma onde o gato anda', () => {
    expect(spots.length).toBeGreaterThan(250);
    for (const t of spots) expect(distanceToWalkable(t.x, t.z), `${t.x},${t.z}`).toBeGreaterThanOrEqual(4);
  });

  it('fica dentro do plano do terreno', () => {
    for (const t of spots) {
      expect(Math.abs(t.x)).toBeLessThanOrEqual(55);
      expect(t.z).toBeGreaterThanOrEqual(-39);
      expect(t.z).toBeLessThanOrEqual(71);
    }
  });
});

describe('campo de densidade da grama', () => {
  it('varia entre manchas ralas e viçosas, sempre entre 0 e 1', () => {
    let lo = 1, hi = 0;
    for (let x = -18; x <= 18; x += 0.7) for (let z = -18; z <= 38; z += 0.7) {
      const v = lushness(x, z);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    // real patches, not a near-constant field
    expect(lo).toBeLessThan(0.25);
    expect(hi).toBeGreaterThan(0.7);
  });
});
