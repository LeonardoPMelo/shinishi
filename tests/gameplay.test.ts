import { describe, expect, it } from 'vitest';
import { makeRabbit, rabbitStep, canPet, petRabbit, PET, RABBIT, type Cat, type Env } from '../src/game/fauna/brains';
import { TALL_ROCK } from '../src/data/world';

/** Etapa 3 da expansão: petting rabbits, and the rock the double jump is for. */

const env: Env = { ground: () => true, free: () => true };
let seed = 1;
const rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const calm = () => {
  const r = makeRabbit(0, 0, { x: 0, z: 0, r: 4 }, rng);
  r.mode = 'sniff';
  r.timer = 5;
  return r;
};
const cat = (x: number, over: Partial<Cat> = {}): Cat => ({ x, z: 0, crouch: false, speed: 0, ...over });

describe('carinho nos coelhos', () => {
  it('só dá para fazer carinho chegando agachado e perto', () => {
    const r = calm();
    expect(canPet(r, cat(1, { crouch: true }))).toBe(true);
    expect(canPet(r, cat(1))).toBe(false);
    expect(canPet(r, cat(PET.reach + 0.3, { crouch: true }))).toBe(false);
  });

  it('não dá para fazer carinho num coelho fugindo ou no meio do pulo', () => {
    const r = calm();
    r.fleeing = true;
    expect(canPet(r, cat(1, { crouch: true }))).toBe(false);
  });

  it('depois do carinho, o coelho confia: não foge do gato em pé andando ao lado', () => {
    const r = calm();
    petRabbit(r);
    expect(r.mode).toBe('petted');
    for (let i = 0; i < 60; i++) rabbitStep(r, 1 / 30, cat(1.2, { speed: 1.5 }), env, rng);
    expect(r.fleeing).toBe(false);
  });

  it('mas um gato chegando em disparada ainda o assusta', () => {
    const r = calm();
    petRabbit(r);
    rabbitStep(r, 1 / 30, cat(RABBIT.threat * 0.4, { speed: 7 }), env, rng);
    expect(r.fleeing).toBe(true);
  });

  it('a confiança passa com o tempo', () => {
    const r = calm();
    petRabbit(r);
    for (let t = 0; t < PET.trust + 1; t += 0.5) rabbitStep(r, 0.5, cat(30), env, rng);
    expect(r.trust).toBe(0);
  });
});

describe('pedra alta (salto duplo)', () => {
  // Shinichi.tsx: pulo 7,4 m/s, poção ×1,12, salto duplo 6,8 m/s, gravidade 18; a cápsula sobe ~0,38 m numa quina
  const g = 18;
  const apex = (v: number) => (v * v) / (2 * g);
  const RIDE = 0.38;

  it('o pulo simples e o pulo com poção não alcançam o topo', () => {
    expect(apex(7.4) + RIDE).toBeLessThan(TALL_ROCK.h);
    expect(apex(7.4 * 1.12) + RIDE).toBeLessThan(TALL_ROCK.h);
  });

  it('o salto duplo no tempo certo alcança com folga', () => {
    expect(apex(7.4) + apex(6.8) + RIDE).toBeGreaterThan(TALL_ROCK.h + 0.5);
  });
});
