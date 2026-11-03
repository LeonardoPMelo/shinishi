/**
 * The deer of the Campina das Ervas (As Terras Selvagens, after Etapa 10), as plain logic over plain objects
 * (local coordinates). A deer grazes, takes a few steps, grazes again; when the cat comes close it lifts its head
 * and runs off, away from the cat, and once it feels safe it walks slowly back to its spot. A crouching cat can
 * come much closer before they notice. They stay in the meadow. Unit-tested (tests/wild2.test.ts).
 */

/** The meadow the herd keeps to (local x0, z0, x1, z1). */
export const CAMPINA = { x0: 11.2, z0: 1.0, x1: 26.4, z1: 36.6 };
export const DEER = { notice: 5.5, noticeCrouch: 2.6, flee: 4.2, walk: 0.8, safe: 9, calm: 3 };

export type DeerMode = 'graze' | 'walk' | 'flee' | 'return';

export interface Deer {
  x: number;
  z: number;
  heading: number;
  home: { x: number; z: number };
  mode: DeerMode;
  timer: number;
  goal: { x: number; z: number } | null;
  /** Its own little random sequence, so each deer moves on its own. */
  seed: number;
}

export function makeDeer(x: number, z: number, i: number): Deer {
  return { x, z, heading: i * 1.3, home: { x, z }, mode: 'graze', timer: 1 + (i % 3), goal: null, seed: 977 + i * 131 };
}

function rand(d: Deer) {
  d.seed = (d.seed * 16807) % 2147483647;
  return (d.seed - 1) / 2147483646;
}

const clampIn = (x: number, z: number) => ({
  x: Math.min(CAMPINA.x1, Math.max(CAMPINA.x0, x)),
  z: Math.min(CAMPINA.z1, Math.max(CAMPINA.z0, z)),
});

function moveTo(d: Deer, gx: number, gz: number, speed: number, dt: number) {
  const dx = gx - d.x;
  const dz = gz - d.z;
  const len = Math.hypot(dx, dz);
  if (len < 0.05) return true;
  const step = Math.min(len, speed * dt);
  const p = clampIn(d.x + (dx / len) * step, d.z + (dz / len) * step);
  d.x = p.x;
  d.z = p.z;
  d.heading = Math.atan2(dx, dz);
  return len - step < 0.05;
}

/** One step of a deer's day. `cat` in local coordinates. */
export function deerStep(d: Deer, dt: number, cat: { x: number; z: number; crouch: boolean }) {
  const dist = Math.hypot(cat.x - d.x, cat.z - d.z);
  const reach = cat.crouch ? DEER.noticeCrouch : DEER.notice;
  if (dist < reach && d.mode !== 'flee') {
    // away from the cat, as far as the meadow allows
    const ax = d.x - cat.x;
    const az = d.z - cat.z;
    const len = Math.max(Math.hypot(ax, az), 1e-3);
    d.goal = clampIn(d.x + (ax / len) * 7, d.z + (az / len) * 7);
    d.mode = 'flee';
    d.timer = DEER.calm;
  }
  switch (d.mode) {
    case 'flee':
      if (d.goal && moveTo(d, d.goal.x, d.goal.z, DEER.flee, dt)) d.goal = null;
      if (dist > reach + 1) d.timer -= dt;
      if (d.timer <= 0 && dist > DEER.safe * 0.6) {
        d.mode = 'return';
        d.goal = { ...d.home };
      }
      break;
    case 'return':
      if (!d.goal || moveTo(d, d.goal.x, d.goal.z, DEER.walk, dt)) {
        d.mode = 'graze';
        d.timer = 2 + rand(d) * 3;
        d.goal = null;
      }
      break;
    case 'walk':
      if (!d.goal || moveTo(d, d.goal.x, d.goal.z, DEER.walk, dt)) {
        d.mode = 'graze';
        d.timer = 3 + rand(d) * 4;
        d.goal = null;
      }
      break;
    case 'graze':
      d.timer -= dt;
      if (d.timer <= 0) {
        const a = rand(d) * Math.PI * 2;
        const r = 0.8 + rand(d) * 2.2;
        d.goal = clampIn(d.home.x + Math.cos(a) * r, d.home.z + Math.sin(a) * r);
        d.mode = 'walk';
      }
      break;
  }
}
