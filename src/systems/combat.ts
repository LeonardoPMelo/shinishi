/**
 * Combat in the wild lands (Etapa 7 da expansão), as plain functions over plain objects: the creatures' minds,
 * the cat's hearts and the paw swipe. No three.js and no physics here: the game (game/world/Enemies.tsx) feeds
 * in the cat and two world checks, and draws what comes out. Everything is unit-tested (tests/combat.test.ts).
 *
 * Stylized and non-graphic, for an 11-year-old: a "defeated" creature gives up in a puff of smoke and runs
 * home; the cat that runs out of hearts faints and wakes at the camp with everything it carried.
 * Every fight has a way around it: crouch past (stealth), throw a shuriken somewhere else (distraction),
 * outrun the creature past its leash (escape), or, for the boar, a tuna treat (no fight at all).
 */

export type Rng = () => number;

/** The world as the creatures need it (the game answers with ray casts and the region's walkable area). */
export interface CombatEnv {
  /** Nothing solid between the two points (line of sight and movement). */
  free(ax: number, az: number, bx: number, bz: number): boolean;
  /** A creature may stand here (inside the region, not in water). */
  ground(x: number, z: number): boolean;
}

/** What the creatures see of the cat. */
export interface CombatCat {
  x: number;
  z: number;
  crouch: boolean;
  /** Horizontal speed, m/s (running is loud). */
  speed: number;
  /** The Faro is on: it shows the mist spirits. */
  faro: boolean;
  /** False while fainted or in a dialogue: nobody attacks then. */
  active: boolean;
}

// ── Difficulty ───────────────────────────────────────────────────────────────

export type CombatLevel = 'tranquilo' | 'normal' | 'desafio';

/**
 * Chosen in the settings. "Tranquilo" is for a younger brother or a first visit: more hearts, slower and
 * more readable creatures. None of them changes what is required to finish a mission.
 */
export const LEVELS: Record<CombatLevel, { name: string; hearts: number; invuln: number; speed: number; windup: number; sight: number; text: string }> = {
  tranquilo: { name: 'Tranquilo', hearts: 7, invuln: 1.6, speed: 0.8, windup: 1.4, sight: 0.8, text: 'Mais corações, bichos mais lentos e que avisam antes de atacar.' },
  normal: { name: 'Normal', hearts: 5, invuln: 1.2, speed: 1, windup: 1, sight: 1, text: 'O jeito pensado para a aventura.' },
  desafio: { name: 'Desafio', hearts: 4, invuln: 1.0, speed: 1.15, windup: 0.8, sight: 1.15, text: 'Menos corações, bichos mais rápidos e atentos.' },
};

// ── Creatures ────────────────────────────────────────────────────────────────

export type EnemyKind = 'ourico' | 'raposa' | 'espirito' | 'javali';

export type EnemyMode =
  | 'patrol' | 'sleep' | 'alert' | 'chase' | 'windup' | 'attack' | 'stunned'
  | 'retreat' | 'distracted' | 'calm' | 'defeated';

export interface EnemySpec {
  name: string;
  hp: number;
  /** Walking speed on patrol, and chasing speed (m/s). */
  walk: number;
  run: number;
  /** How far it sees in front (m), how wide (cosine of the half angle), how far it hears behind. */
  sight: number;
  fov: number;
  hear: number;
  /** It gives up the chase this far from home. */
  leash: number;
  /** Starts its attack at this distance. */
  reach: number;
  /** Telegraph (s): it stops and glows before every attack. The cat's window to get out of the way. */
  windup: number;
  /** The attack itself: a charge (melee) or a throw (ranged). */
  attack: { kind: 'charge'; speed: number; time: number } | { kind: 'throw'; keepAway: number };
  /** Dizzy after the attack (s): its open moment. */
  dizzy: number;
  cooldown: number;
  damage: number;
  /** Only takes damage while dizzy (the hedgehog's spines, the boar's rocky hide). */
  armored?: boolean;
  /** Only seen and only hurt while the Faro is on. */
  spirit?: boolean;
  /** Sleeps until something wakes it. */
  sleeper?: boolean;
  reward: { coins: number; item?: string };
}

export const ENEMIES: Record<EnemyKind, EnemySpec> = {
  ourico: {
    name: 'Ouriço Bandido', hp: 3, walk: 1.1, run: 2.6, sight: 7, fov: Math.cos(1.05), hear: 2.6, leash: 14,
    reach: 4.2, windup: 0.75, attack: { kind: 'charge', speed: 8, time: 0.6 }, dizzy: 1.8, cooldown: 0.6, damage: 1,
    armored: true, reward: { coins: 4 },
  },
  raposa: {
    name: 'Raposa Ninja', hp: 2, walk: 1.3, run: 3.4, sight: 9, fov: Math.cos(1.1), hear: 3, leash: 16,
    reach: 8, windup: 0.6, attack: { kind: 'throw', keepAway: 4.5 }, dizzy: 0, cooldown: 1.6, damage: 1,
    reward: { coins: 5 },
  },
  espirito: {
    name: 'Espírito da Névoa', hp: 2, walk: 0.8, run: 2.0, sight: 6, fov: Math.cos(1.4), hear: 3.5, leash: 10,
    reach: 2.6, windup: 0.9, attack: { kind: 'charge', speed: 5, time: 0.6 }, dizzy: 1.2, cooldown: 1.0, damage: 1,
    spirit: true, reward: { coins: 3, item: 'cristal_nevoa' },
  },
  javali: {
    name: 'Javali Rochoso', hp: 6, walk: 0, run: 3.0, sight: 6, fov: Math.cos(0.9), hear: 3.5, leash: 9,
    reach: 6, windup: 1.0, attack: { kind: 'charge', speed: 9, time: 0.8 }, dizzy: 2.4, cooldown: 0.8, damage: 2,
    armored: true, sleeper: true, reward: { coins: 15 },
  },
};

export interface Enemy {
  id: string;
  kind: EnemyKind;
  x: number;
  z: number;
  /** Facing: the direction is (sin h, cos h), the same convention as the cat. */
  heading: number;
  home: { x: number; z: number; r: number };
  mode: EnemyMode;
  /** Seconds left in the current mode (alert, windup, attack, dizzy, distracted, defeated). */
  timer: number;
  hp: number;
  /** Where it is walking to (patrol point, noise, home). */
  goal: { x: number; z: number } | null;
  /** Seconds since it last saw or heard the cat while chasing. */
  lost: number;
  /** Charge direction, fixed when the windup ends. */
  dir: { x: number; z: number };
  /** One hit per charge. */
  struck: boolean;
  cooldown: number;
  /** Seconds left of the white flash after a hit (drawn by the game). */
  flash: number;
  /** Pause between patrol walks. */
  rest: number;
}

export function makeEnemy(id: string, kind: EnemyKind, x: number, z: number, r = 4, heading = 0): Enemy {
  return {
    id, kind, x, z, heading, home: { x, z, r },
    mode: ENEMIES[kind].sleeper ? 'sleep' : 'patrol',
    timer: 0, hp: ENEMIES[kind].hp, goal: null, lost: 0, dir: { x: 0, z: 1 }, struck: false, cooldown: 0, flash: 0, rest: 0,
  };
}

/** Back home with full health, as if nothing happened (entering the region, or after the cat faints). */
export function resetEnemy(e: Enemy, keepDefeated = false) {
  if (keepDefeated && (e.mode === 'defeated' || e.mode === 'calm')) return;
  const spec = ENEMIES[e.kind];
  e.x = e.home.x;
  e.z = e.home.z;
  e.mode = spec.sleeper ? 'sleep' : 'patrol';
  e.timer = 0;
  e.hp = spec.hp;
  e.goal = null;
  e.lost = 0;
  e.struck = false;
  e.cooldown = 0;
  e.flash = 0;
}

/** Still in the fight (not defeated, not calmed). */
export const isActive = (e: Enemy) => e.mode !== 'defeated' && e.mode !== 'calm';

/** It is about to act on the cat: drawn with a mark over its head ("!") and the music changes. */
export const isHostile = (e: Enemy) => e.mode === 'chase' || e.mode === 'windup' || e.mode === 'attack';

// ── Detection ────────────────────────────────────────────────────────────────

/**
 * Does it notice the cat? In front, within sight (half as far when the cat crouches, farther when it runs);
 * anywhere around, within hearing (a crouching cat is nearly silent, a running one loud). Never through walls.
 */
export function notices(e: Enemy, cat: CombatCat, env: CombatEnv, level: CombatLevel = 'normal') {
  if (!cat.active || !isActive(e)) return false;
  const spec = ENEMIES[e.kind];
  const dx = cat.x - e.x;
  const dz = cat.z - e.z;
  const d = Math.hypot(dx, dz);
  const running = cat.speed > 4;
  const hear = spec.hear * (cat.crouch ? 0.35 : running ? 1.8 : 1);
  let sensed = d < hear;
  if (!sensed && e.mode !== 'sleep') {
    const sight = spec.sight * LEVELS[level].sight * (cat.crouch ? 0.5 : running ? 1.2 : 1);
    const facing = d > 1e-6 ? (Math.sin(e.heading) * dx + Math.cos(e.heading) * dz) / d : 1;
    sensed = d < sight && facing >= spec.fov;
  }
  return sensed && env.free(e.x, e.z, cat.x, cat.z);
}

/** A noise somewhere (a shuriken hitting a rock): the ones close enough and not busy fighting go and look. */
export const NOISE = { reach: 8, seconds: 4 };

export function hearNoise(e: Enemy, x: number, z: number) {
  if (e.mode !== 'patrol' && e.mode !== 'alert' && e.mode !== 'retreat' && e.mode !== 'distracted') return false;
  if (Math.hypot(x - e.x, z - e.z) > NOISE.reach) return false;
  e.mode = 'distracted';
  e.goal = { x, z };
  e.timer = NOISE.seconds;
  return true;
}

// ── One step of a creature's mind ────────────────────────────────────────────

export type EnemyEvent =
  | { type: 'alert' }
  | { type: 'windup' }
  | { type: 'throw'; x: number; z: number; dx: number; dz: number }
  | { type: 'hitCat'; damage: number; fromX: number; fromZ: number }
  | { type: 'bonk' }
  | { type: 'gaveUp' }
  | { type: 'wake' };

const turnTo = (e: Enemy, x: number, z: number) => {
  if (Math.hypot(x - e.x, z - e.z) > 1e-4) e.heading = Math.atan2(x - e.x, z - e.z);
};

/** Walks toward (x, z) at `speed`; false when the way is blocked. */
function walk(e: Enemy, x: number, z: number, speed: number, dt: number, env: CombatEnv) {
  const dx = x - e.x;
  const dz = z - e.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-3) return true;
  const step = Math.min(d, speed * dt);
  const nx = e.x + (dx / d) * step;
  const nz = e.z + (dz / d) * step;
  turnTo(e, x, z);
  if (!env.ground(nx, nz) || !env.free(e.x, e.z, nx, nz)) return false;
  e.x = nx;
  e.z = nz;
  return true;
}

const tooFarFromHome = (e: Enemy) => Math.hypot(e.x - e.home.x, e.z - e.home.z) > ENEMIES[e.kind].leash;

/**
 * The windup: it stops, glows and aims. A charge is aimed once, here, at where the cat is when the windup
 * starts: stepping aside during the warning makes it miss (the dodge the warning is for). A fox aims again
 * when it throws.
 */
function startWindup(e: Enemy, cat: CombatCat, seconds: number, out: EnemyEvent[]) {
  const len = Math.max(Math.hypot(cat.x - e.x, cat.z - e.z), 1e-3);
  e.dir = { x: (cat.x - e.x) / len, z: (cat.z - e.z) / len };
  e.mode = 'windup';
  e.timer = seconds;
  turnTo(e, cat.x, cat.z);
  out.push({ type: 'windup' });
}

export function enemyStep(e: Enemy, dt: number, cat: CombatCat, env: CombatEnv, rng: Rng, level: CombatLevel = 'normal'): EnemyEvent[] {
  const out: EnemyEvent[] = [];
  const spec = ENEMIES[e.kind];
  const lv = LEVELS[level];
  e.flash = Math.max(0, e.flash - dt);
  e.cooldown = Math.max(0, e.cooldown - dt);
  if (e.mode === 'defeated' || e.mode === 'calm') {
    e.timer = Math.max(0, e.timer - dt);
    return out;
  }
  const sees = notices(e, cat, env, level);
  const d = Math.hypot(cat.x - e.x, cat.z - e.z);

  switch (e.mode) {
    case 'sleep':
      if (sees) {
        e.mode = 'alert';
        e.timer = 1.0;
        turnTo(e, cat.x, cat.z);
        out.push({ type: 'wake' });
      }
      break;

    case 'patrol':
      if (sees) {
        e.mode = 'alert';
        e.timer = 0.7 * lv.windup;
        turnTo(e, cat.x, cat.z);
        out.push({ type: 'alert' });
        break;
      }
      if (e.rest > 0) {
        e.rest -= dt;
        break;
      }
      if (!e.goal) {
        const a = rng() * Math.PI * 2;
        const r = Math.sqrt(rng()) * e.home.r;
        e.goal = { x: e.home.x + Math.cos(a) * r, z: e.home.z + Math.sin(a) * r };
      }
      if (!walk(e, e.goal.x, e.goal.z, spec.walk, dt, env) || Math.hypot(e.goal.x - e.x, e.goal.z - e.z) < 0.2) {
        e.goal = null;
        e.rest = 1 + rng() * 2;
      }
      break;

    case 'alert':
      // it stops and stares ("!"): a moment to back off or hide
      e.timer -= dt;
      if (sees) turnTo(e, cat.x, cat.z);
      if (e.timer <= 0) {
        if (sees) {
          e.mode = 'chase';
          e.lost = 0;
        } else {
          e.mode = spec.sleeper ? 'sleep' : 'patrol';
          e.goal = null;
        }
      }
      break;

    case 'distracted':
      e.timer -= dt;
      if (sees) {
        e.mode = 'alert';
        e.timer = 0.5 * lv.windup;
        out.push({ type: 'alert' });
        break;
      }
      if (e.goal && Math.hypot(e.goal.x - e.x, e.goal.z - e.z) > 0.4) walk(e, e.goal.x, e.goal.z, spec.run * 0.6 * lv.speed, dt, env);
      if (e.timer <= 0) {
        e.mode = 'retreat';
        e.goal = null;
      }
      break;

    case 'chase': {
      e.lost = sees ? 0 : e.lost + dt;
      if (e.lost > 2.5 || tooFarFromHome(e) || !cat.active) {
        e.mode = 'retreat';
        out.push({ type: 'gaveUp' });
        break;
      }
      if (spec.attack.kind === 'throw') {
        // keeps its distance: backs off when the cat comes close, throws from afar
        if (d < spec.attack.keepAway) {
          const ax = e.x - (cat.x - e.x);
          const az = e.z - (cat.z - e.z);
          walk(e, ax, az, spec.run * lv.speed, dt, env);
          turnTo(e, cat.x, cat.z);
        } else if (d > spec.reach) walk(e, cat.x, cat.z, spec.run * lv.speed, dt, env);
        else turnTo(e, cat.x, cat.z);
        if (d <= spec.reach && e.cooldown <= 0 && sees) startWindup(e, cat, spec.windup * lv.windup, out);
        break;
      }
      if (d > spec.reach * 0.75 || e.cooldown > 0) walk(e, cat.x, cat.z, spec.run * lv.speed, dt, env);
      else turnTo(e, cat.x, cat.z);
      if (d <= spec.reach && e.cooldown <= 0 && sees) startWindup(e, cat, spec.windup * lv.windup, out);
      break;
    }

    case 'windup':
      e.timer -= dt;
      if (spec.attack.kind === 'throw') turnTo(e, cat.x, cat.z);
      if (e.timer <= 0) {
        e.struck = false;
        if (spec.attack.kind === 'throw') {
          const len = Math.max(d, 1e-3);
          e.dir = { x: (cat.x - e.x) / len, z: (cat.z - e.z) / len };
          out.push({ type: 'throw', x: e.x, z: e.z, dx: e.dir.x, dz: e.dir.z });
          e.mode = 'chase';
          e.cooldown = spec.cooldown;
        } else {
          e.mode = 'attack';
          e.timer = spec.attack.time;
        }
      }
      break;

    case 'attack': {
      // the charge: straight ahead, fast, along the direction fixed when the windup ended
      if (spec.attack.kind !== 'charge') break;
      e.timer -= dt;
      const step = spec.attack.speed * lv.speed * dt;
      const nx = e.x + e.dir.x * step;
      const nz = e.z + e.dir.z * step;
      const blocked = !env.ground(nx, nz) || !env.free(e.x, e.z, nx, nz);
      if (!blocked) {
        e.x = nx;
        e.z = nz;
      }
      if (!e.struck && cat.active && Math.hypot(cat.x - e.x, cat.z - e.z) < 0.9) {
        e.struck = true;
        out.push({ type: 'hitCat', damage: spec.damage, fromX: e.x, fromZ: e.z });
      }
      if (blocked || e.timer <= 0) {
        // dizzy: longer when it ran into a rock
        e.mode = 'stunned';
        e.timer = spec.dizzy * (blocked ? 1.4 : 1);
        e.cooldown = spec.cooldown;
        if (blocked) out.push({ type: 'bonk' });
      }
      break;
    }

    case 'stunned':
      e.timer -= dt;
      if (e.timer <= 0) {
        e.lost = 0;
        if (sees) e.mode = 'chase';
        else {
          e.mode = 'retreat';
          out.push({ type: 'gaveUp' });
        }
      }
      break;

    case 'retreat':
      if (sees && !tooFarFromHome(e) && cat.active) {
        e.mode = 'alert';
        e.timer = 0.6 * lv.windup;
        out.push({ type: 'alert' });
        break;
      }
      if (!walk(e, e.home.x, e.home.z, Math.max(1.5, spec.walk * 1.6), dt, env) || Math.hypot(e.home.x - e.x, e.home.z - e.z) < 0.3) {
        // home (or stuck on the way): back to its post, healed
        if (Math.hypot(e.home.x - e.x, e.home.z - e.z) >= 0.3) {
          e.x = e.home.x;
          e.z = e.home.z;
        }
        e.hp = spec.hp;
        e.mode = spec.sleeper ? 'sleep' : 'patrol';
        e.goal = null;
      }
      break;
  }
  return out;
}

// ── The cat hits a creature ──────────────────────────────────────────────────

export type HitResult = 'hit' | 'defeated' | 'blocked' | 'unseen' | 'none';

/**
 * One hit from the paw or a shuriken. The hedgehog and the boar shrug it off unless dizzy ("blocked": the
 * game says why), the mist spirit only feels it while the Faro shows it ("unseen").
 */
export function hitEnemy(e: Enemy, damage: number, cat: Pick<CombatCat, 'x' | 'z' | 'faro'>, env?: CombatEnv): HitResult {
  if (!isActive(e)) return 'none';
  const spec = ENEMIES[e.kind];
  if (spec.spirit && !cat.faro) return 'unseen';
  if (spec.armored && e.mode !== 'stunned') {
    // it still notices who hit it
    if (e.mode === 'sleep' || e.mode === 'patrol' || e.mode === 'distracted' || e.mode === 'retreat') {
      e.mode = 'alert';
      e.timer = 0.5;
      turnTo(e, cat.x, cat.z);
    }
    return 'blocked';
  }
  e.hp -= damage;
  e.flash = 0.25;
  // a small shove away from the cat
  const dx = e.x - cat.x;
  const dz = e.z - cat.z;
  const d = Math.max(Math.hypot(dx, dz), 1e-3);
  const nx = e.x + (dx / d) * 0.5;
  const nz = e.z + (dz / d) * 0.5;
  if (!env || (env.ground(nx, nz) && env.free(e.x, e.z, nx, nz))) {
    e.x = nx;
    e.z = nz;
  }
  if (e.hp <= 0) {
    e.hp = 0;
    e.mode = 'defeated';
    e.timer = 1.4;
    return 'defeated';
  }
  // a hit wakes it and makes it fight back; a dizzy one stays dizzy for a moment more
  if (e.mode === 'stunned') e.timer = Math.max(e.timer, 0.5);
  else {
    e.mode = 'stunned';
    e.timer = 0.4;
  }
  return 'hit';
}

/** The boar takes the tuna treat and lets the cat pass (saved as a flag by the game). */
export function calmEnemy(e: Enemy) {
  if (!isActive(e)) return false;
  e.mode = 'calm';
  e.timer = 0;
  return true;
}

// ── The paw swipe ────────────────────────────────────────────────────────────

/** Key F (gamepad: the interact button with nothing to interact with; touch: ⚔️). */
export const PAW = { reach: 1.7, arc: Math.cos((75 * Math.PI) / 180), cooldown: 0.45, damage: 1 };

/** The creatures the swipe reaches: close, in front of the cat (or right next to it). */
export function pawTargets(cat: { x: number; z: number; heading: number }, enemies: Enemy[]) {
  const fx = Math.sin(cat.heading);
  const fz = Math.cos(cat.heading);
  return enemies.filter((e) => {
    if (!isActive(e)) return false;
    const dx = e.x - cat.x;
    const dz = e.z - cat.z;
    const d = Math.hypot(dx, dz);
    if (d > PAW.reach) return false;
    return d < 0.6 || (dx * fx + dz * fz) / d >= PAW.arc;
  });
}

// ── The cat's hearts ─────────────────────────────────────────────────────────

export interface Hearts {
  hearts: number;
  max: number;
  /** No damage until this time (s), after a hit. */
  safeUntil: number;
}

export const fullHearts = (level: CombatLevel = 'normal'): Hearts => ({ hearts: LEVELS[level].hearts, max: LEVELS[level].hearts, safeUntil: 0 });

/** A hit on the cat. Ignored right after the last one (the blinking moment). */
export function hurtCat(h: Hearts, damage: number, now: number, level: CombatLevel = 'normal'): { hearts: Hearts; took: boolean; fainted: boolean } {
  if (now < h.safeUntil || h.hearts <= 0) return { hearts: h, took: false, fainted: false };
  const hearts = Math.max(0, h.hearts - damage);
  return { hearts: { ...h, hearts, safeUntil: now + LEVELS[level].invuln }, took: true, fainted: hearts === 0 };
}

export function healCat(h: Hearts, amount: number): Hearts {
  return { ...h, hearts: Math.min(h.max, h.hearts + amount) };
}

// ── Thrown pinecones (the fox) ───────────────────────────────────────────────

export interface Pinecone {
  x: number;
  z: number;
  dx: number;
  dz: number;
  age: number;
  alive: boolean;
}

/** Slow enough to see coming and step aside (or dash through). */
export const PINECONE = { speed: 7.5, life: 1.6, radius: 0.6, damage: 1 };

export function throwPinecone(list: Pinecone[], x: number, z: number, dx: number, dz: number) {
  const p = list.find((q) => !q.alive) ?? (list[list.length] = { x: 0, z: 0, dx: 0, dz: 0, age: 0, alive: false });
  Object.assign(p, { x: x + dx * 0.5, z: z + dz * 0.5, dx, dz, age: 0, alive: true });
  return p;
}

/** Moves the pinecones; returns the one that hit the cat, if any. */
export function stepPinecones(list: Pinecone[], dt: number, cat: CombatCat, env: CombatEnv): Pinecone | null {
  let hit: Pinecone | null = null;
  for (const p of list) {
    if (!p.alive) continue;
    p.age += dt;
    const nx = p.x + p.dx * PINECONE.speed * dt;
    const nz = p.z + p.dz * PINECONE.speed * dt;
    if (p.age > PINECONE.life || !env.free(p.x, p.z, nx, nz)) {
      p.alive = false;
      continue;
    }
    p.x = nx;
    p.z = nz;
    if (!hit && cat.active && Math.hypot(cat.x - p.x, cat.z - p.z) < PINECONE.radius) {
      p.alive = false;
      hit = p;
    }
  }
  return hit;
}
