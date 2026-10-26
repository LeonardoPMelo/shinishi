import * as THREE from 'three';

/**
 * Training shuriken: flying projectiles and the targets they can hit.
 * Non-violent by design: shuriken pass through villagers and only react with
 * training targets, mechanisms and the scenery (where they stick for a moment).
 */

export interface ShurikenTarget {
  id: string;
  /** World-space center of the hit zone. */
  position: THREE.Vector3;
  radius: number;
  onHit: () => void;
}

export interface Projectile {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  /** Seconds left stuck in a wall (0 while flying). */
  stuck: number;
  alive: boolean;
}

export const SHURIKEN_SPEED = 22;
export const SHURIKEN_RANGE_TIME = 1.1;
const AIM_RANGE = 22;
const AIM_CONE = Math.cos(THREE.MathUtils.degToRad(32));

const targets = new Map<string, ShurikenTarget>();
export const projectiles: Projectile[] = [];

export function registerTarget(t: ShurikenTarget) {
  targets.set(t.id, t);
  return () => {
    if (targets.get(t.id) === t) targets.delete(t.id);
  };
}

export function allTargets() {
  return targets.values();
}

/** Throws from `origin` along the horizontal `facing`, bending toward a target in front if there is one. */
export function throwShuriken(origin: THREE.Vector3, facing: THREE.Vector3) {
  const dir = facing.clone().setY(0.03).normalize();
  let best: ShurikenTarget | null = null;
  let bestScore = -Infinity;
  for (const t of targets.values()) {
    const to = t.position.clone().sub(origin);
    const dist = to.length();
    if (dist > AIM_RANGE || dist < 0.5) continue;
    const flat = to.clone().setY(0).normalize();
    const cos = flat.dot(facing.clone().setY(0).normalize());
    if (cos < AIM_CONE) continue;
    const score = cos * 2 - dist / AIM_RANGE;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  if (best) dir.copy(best.position).sub(origin).normalize();
  const spawn = origin.clone().addScaledVector(dir, 0.6);
  const slot = projectiles.find((p) => !p.alive);
  const p = slot ?? { pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 0, stuck: 0, alive: false };
  p.pos.copy(spawn);
  p.vel.copy(dir).multiplyScalar(SHURIKEN_SPEED);
  p.age = 0;
  p.stuck = 0;
  p.alive = true;
  if (!slot) projectiles.push(p);
  if (projectiles.length > 12) projectiles.splice(0, projectiles.length - 12);
}

/** Segment (a→b) against a sphere: true when the shuriken passes through the hit zone. */
export function segmentHitsSphere(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, r: number) {
  const ab = b.clone().sub(a);
  const t = THREE.MathUtils.clamp(c.clone().sub(a).dot(ab) / Math.max(ab.lengthSq(), 1e-6), 0, 1);
  return a.clone().addScaledVector(ab, t).distanceTo(c) <= r;
}

if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__shurikens = { projectiles, targets };
