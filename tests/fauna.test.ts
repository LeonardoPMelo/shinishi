import { describe, expect, it } from 'vitest';
import {
  makeRabbit, rabbitStep, makeBird, birdStep, makeButterfly, butterflyStep, threatRadius, RABBIT,
  type Env, type Cat, type Spot, type Flower,
} from '../src/game/fauna/brains';

/** Etapa 4: behaviour of the rabbits, birds and butterflies (pure logic, deterministic random). */

function rng(seed = 7) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const open: Env = { ground: () => true, free: () => true };
const far: Cat = { x: 100, z: 100, crouch: false, speed: 0 };
const dt = 1 / 30;

/** A wall along x = 2 (from z = -10 to 10) and a pond around (-3, 0). */
const walled: Env = {
  ground: (x, z) => Math.hypot(x + 3, z) > 1.2 && Math.abs(x - 2) > 0.2,
  free: (ax, _az, bx) => (ax - 2) * (bx - 2) > 0,
};

describe('coelhos', () => {
  it('passeiam, descansam e se limpam sozinhos, sem sair muito de casa', () => {
    const r = rng();
    const home = { x: 0, z: 0, r: 3 };
    const b = makeRabbit(0, 0, home, r);
    const seen = new Set<string>();
    let maxD = 0;
    for (let i = 0; i < 30 * 240; i++) {
      rabbitStep(b, dt, far, open, r);
      seen.add(b.mode);
      maxD = Math.max(maxD, Math.hypot(b.x, b.z));
    }
    for (const m of ['sniff', 'hop', 'rest', 'groom']) expect(seen, m).toContain(m);
    expect(maxD).toBeLessThan(home.r + 2);
  });

  it('fogem do gato que se aproxima andando, para longe dele', () => {
    const r = rng(3);
    const b = makeRabbit(0, 0, { x: 0, z: 0, r: 3 }, r);
    const cat: Cat = { x: -2, z: 0, crouch: false, speed: 2 };
    rabbitStep(b, dt, cat, open, r);
    expect(b.fleeing).toBe(true);
    for (let i = 0; i < 60; i++) rabbitStep(b, dt, cat, open, r);
    expect(Math.hypot(b.x - cat.x, b.z - cat.z)).toBeGreaterThan(2 + RABBIT.fleeHop);
  });

  it('deixam o gato agachado chegar perto (ensina a se aproximar devagar)', () => {
    const r = rng(5);
    const b = makeRabbit(0, 0, { x: 0, z: 0, r: 3 }, r);
    rabbitStep(b, dt, { x: -2, z: 0, crouch: true, speed: 0.8 }, open, r);
    expect(b.fleeing).toBe(false);
    expect(threatRadius(RABBIT.threat, { x: 0, z: 0, crouch: true, speed: 0 })).toBeLessThan(1.5);
  });

  it('nunca pulam para dentro da água nem atravessam uma parede', () => {
    const r = rng(11);
    const b = makeRabbit(0.8, 0, { x: 0, z: 0, r: 4 }, r);
    for (let i = 0; i < 30 * 300; i++) {
      // the cat keeps chasing from the left, pushing it toward the wall
      rabbitStep(b, dt, { x: b.x - 1.5, z: b.z, crouch: false, speed: 3 }, walled, r);
      expect(b.x, 'atravessou a parede').toBeLessThan(2);
      if (b.mode !== 'hop') expect(walled.ground(b.x, b.z), 'parou na água').toBe(true);
    }
  });
});

describe('pássaros', () => {
  const spots: Spot[] = [
    { x: 0, y: 1.1, z: 0, ground: false },
    { x: 8, y: 1.1, z: 0, ground: false },
    { x: 0, y: 0, z: 9, ground: true },
    { x: 12, y: 0, z: 9, ground: true },
  ];

  it('voam assustados para um ponto longe do gato e pousam nele', () => {
    const r = rng(2);
    const taken = new Set([0]);
    const b = makeBird(0, spots, r);
    birdStep(b, dt, { x: 0.5, z: 0.5, crouch: false, speed: 1 }, spots, taken, open, r);
    expect(b.mode).toBe('fly');
    const dest = spots[b.spot];
    expect(Math.hypot(dest.x - 0.5, dest.z - 0.5)).toBeGreaterThan(6);
    let maxY = 0;
    for (let i = 0; i < 30 * 6 && b.mode === 'fly'; i++) {
      birdStep(b, dt, far, spots, taken, open, r);
      maxY = Math.max(maxY, b.y);
    }
    expect(b.mode).toBe('sit');
    expect(b.x).toBeCloseTo(dest.x, 5);
    expect(b.y).toBeCloseTo(dest.y, 5);
    // the flight arcs above both ends
    expect(maxY).toBeGreaterThan(1.1 + 0.5);
  });

  it('dois pássaros nunca escolhem o mesmo pouso', () => {
    const r = rng(9);
    const taken = new Set<number>();
    const birds = [0, 1, 2].map((i) => {
      taken.add(i);
      return makeBird(i, spots, r);
    });
    for (let i = 0; i < 30 * 120; i++) {
      for (const b of birds) birdStep(b, dt, far, spots, taken, open, r);
      const used = birds.map((b) => b.spot);
      expect(new Set(used).size).toBe(used.length);
    }
  });
});

describe('borboletas', () => {
  const flowers: Flower[] = [
    { x: 1, y: 0.3, z: 0 },
    { x: -1, y: 0.3, z: 1 },
    { x: 0, y: 0.3, z: -1.5 },
  ];

  it('vão de flor em flor e pousam nelas', () => {
    const r = rng(4);
    const b = makeButterfly({ x: 0, z: 0, r: 5 }, r);
    const landedOn = new Set<number>();
    for (let i = 0; i < 30 * 120; i++) {
      butterflyStep(b, dt, i * dt, far, flowers, r);
      if (b.mode === 'land') {
        landedOn.add(b.target);
        expect(b.y).toBeCloseTo(flowers[b.target].y + 0.05, 5);
      }
    }
    expect(landedOn.size).toBeGreaterThanOrEqual(2);
  });

  it('levantam voo quando o gato chega perto', () => {
    const r = rng(8);
    const b = makeButterfly({ x: 0, z: 0, r: 5 }, r);
    let i = 0;
    while (b.mode !== 'land' && i++ < 30 * 60) butterflyStep(b, dt, i * dt, far, flowers, r);
    expect(b.mode).toBe('land');
    butterflyStep(b, dt, i * dt, { x: b.x + 0.3, z: b.z, crouch: false, speed: 1 }, flowers, r);
    expect(b.mode).toBe('flutter');
  });
});
