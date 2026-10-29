/**
 * Behaviour of the small animals (Etapa 4): rabbits, birds, butterflies. Pure and deterministic given the
 * random source, so it is unit-tested; the scene only feeds in the cat and the world checks and draws the
 * result. Everything is in meters and seconds on the flat ground (y = 0).
 *
 * The world checks are injected (`Env`): in the game they are Rapier ray casts against the fixed colliders
 * plus the water and region data, done only when an animal picks a new destination, never per frame.
 */

export type Rng = () => number;

export interface Env {
  /** Can an animal stand at (x, z)? (inside the walkable regions, not in water, not inside a collider) */
  ground(x: number, z: number): boolean;
  /** Is the straight line from a to b free of walls, fences, rocks...? */
  free(ax: number, az: number, bx: number, bz: number): boolean;
}

export interface Cat {
  x: number;
  z: number;
  /** Sneaking low (C): animals let it come much closer. */
  crouch: boolean;
  /** Horizontal speed (m/s): a running cat scares from farther away. */
  speed: number;
}

const TAU = Math.PI * 2;
const dist = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const approach = (v: number, target: number, rate: number, dt: number) => v + (target - v) * Math.min(1, rate * dt);

/** How close the cat may come before an animal reacts: sneaking lets it get much closer, running much less. */
export function threatRadius(base: number, cat: Cat) {
  if (cat.crouch) return base * 0.38;
  if (cat.speed > 4) return base * 1.45;
  return base;
}

// ── Rabbit ──────────────────────────────────────────────────────────────────

export type RabbitMode = 'sniff' | 'hop' | 'rest' | 'groom' | 'alert' | 'flee' | 'petted';

export interface Rabbit {
  x: number;
  z: number;
  heading: number;
  mode: RabbitMode;
  /** Seconds left in the current mode (not used while hopping). */
  timer: number;
  /** Hops left in the current run (wandering or fleeing). */
  hopsLeft: number;
  fleeing: boolean;
  hop: { fx: number; fz: number; tx: number; tz: number; t: number; dur: number; h: number } | null;
  home: { x: number; z: number; r: number };
  // pose, eased toward the mode's target every step (read by the renderer)
  ears: number; // 0 upright … 1 laid back
  sit: number; // 0 crouched on all fours … 1 sitting up
  groom: number; // 0 … 1 paws to the face
  /** Current height of the body above the ground (the hop arc). */
  y: number;
  /** Nose twitch phase. */
  sniff: number;
  /** Seconds left trusting the cat after being petted: it does not flee from it, even standing (Etapa 3). */
  trust: number;
}

export const RABBIT = { threat: 3.2, hop: 0.48, fleeHop: 0.95, hopTime: 0.34, fleeHopTime: 0.24 };

export function makeRabbit(x: number, z: number, home: Rabbit['home'], rng: Rng): Rabbit {
  return { x, z, heading: rng() * TAU, mode: 'sniff', timer: 0.5 + rng() * 2, hopsLeft: 0, fleeing: false, hop: null, home, ears: 0, sit: 0, groom: 0, y: 0, sniff: rng() * 10, trust: 0 };
}

/** reach 1.6: a sneaking cat startles a rabbit inside ~1.22 m (threat 3.2 × 0.38), so the tag shows a step earlier. */
export const PET = { reach: 1.6, seconds: 2.4, trust: 14 };

/** A calm rabbit (not fleeing, not mid-hop) the cat can reach while sneaking. */
export function canPet(r: Rabbit, cat: Cat) {
  return cat.crouch && !r.fleeing && r.mode !== 'hop' && r.mode !== 'petted' && dist(r.x, r.z, cat.x, cat.z) <= PET.reach;
}

/** Petting: the rabbit sits, ears relaxed, and trusts the cat for a while. */
export function petRabbit(r: Rabbit) {
  r.mode = 'petted';
  r.timer = PET.seconds;
  r.trust = PET.trust;
  r.hop = null;
  r.hopsLeft = 0;
}

/** Tries a few headings around `angle` (widening) for a hop of `len` the world allows. */
function pickHop(r: Rabbit, angle: number, len: number, env: Env, rng: Rng) {
  for (let k = 0; k < 7; k++) {
    const a = angle + (k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.55) + (rng() - 0.5) * 0.2;
    const tx = r.x + Math.cos(a) * len;
    const tz = r.z + Math.sin(a) * len;
    if (env.ground(tx, tz) && env.free(r.x, r.z, tx, tz)) return { tx, tz, a };
  }
  return null;
}

function startHop(r: Rabbit, cat: Cat, env: Env, rng: Rng) {
  let angle: number;
  if (r.fleeing) angle = Math.atan2(r.z - cat.z, r.x - cat.x) + (rng() - 0.5) * 0.7;
  else if (dist(r.x, r.z, r.home.x, r.home.z) > r.home.r) angle = Math.atan2(r.home.z - r.z, r.home.x - r.x) + (rng() - 0.5) * 0.8;
  else angle = r.heading + (rng() - 0.5) * 1.8;
  const len = r.fleeing ? RABBIT.fleeHop * (0.85 + rng() * 0.3) : RABBIT.hop * (0.7 + rng() * 0.6);
  const hop = pickHop(r, angle, len, env, rng);
  if (!hop) {
    // boxed in: stay put and look around
    r.hopsLeft = 0;
    r.fleeing = false;
    r.mode = 'alert';
    r.timer = 1 + rng();
    return;
  }
  r.mode = 'hop';
  r.heading = hop.a;
  r.hop = { fx: r.x, fz: r.z, tx: hop.tx, tz: hop.tz, t: 0, dur: r.fleeing ? RABBIT.fleeHopTime : RABBIT.hopTime, h: r.fleeing ? 0.22 : 0.12 + rng() * 0.06 };
}

export function rabbitStep(r: Rabbit, dt: number, cat: Cat, env: Env, rng: Rng) {
  const d = dist(r.x, r.z, cat.x, cat.z);
  r.trust = Math.max(0, r.trust - dt);
  // a rabbit that trusts the cat only startles if it comes running
  const threat = r.trust > 0 ? (cat.speed > 4 ? RABBIT.threat * 0.5 : 0) : threatRadius(RABBIT.threat, cat);
  if (!r.fleeing && d < threat) {
    // startled: ears up and a run of long hops away from the cat
    r.fleeing = true;
    r.hopsLeft = 4 + Math.floor(rng() * 3);
    if (r.mode !== 'hop') startHop(r, cat, env, rng);
  }
  r.sniff += dt * (r.mode === 'sniff' || r.mode === 'alert' ? 9 : 2);

  if (r.mode === 'hop' && r.hop) {
    const h = r.hop;
    h.t = Math.min(1, h.t + dt / h.dur);
    r.x = lerp(h.fx, h.tx, h.t);
    r.z = lerp(h.fz, h.tz, h.t);
    r.y = Math.sin(h.t * Math.PI) * h.h;
    if (h.t >= 1) {
      r.hop = null;
      r.y = 0;
      r.hopsLeft--;
      if (r.hopsLeft > 0) startHop(r, cat, env, rng);
      else if (r.fleeing) {
        // stop at a safe distance, sit up and watch
        r.fleeing = false;
        r.mode = 'alert';
        r.timer = 1.5 + rng() * 1.5;
      } else {
        r.mode = 'sniff';
        r.timer = 1 + rng() * 2.5;
      }
    }
  } else {
    r.timer -= dt;
    if (r.timer <= 0) {
      const roll = rng();
      if (r.mode === 'alert' || roll < 0.55) {
        r.hopsLeft = 1 + Math.floor(rng() * 4);
        startHop(r, cat, env, rng);
      } else if (roll < 0.75) {
        r.mode = 'rest';
        r.timer = 4 + rng() * 5;
      } else if (roll < 0.9) {
        r.mode = 'groom';
        r.timer = 2 + rng() * 1.5;
      } else {
        r.mode = 'sniff';
        r.timer = 1.5 + rng() * 2;
      }
    }
  }
  // pose targets
  const ears = r.mode === 'rest' || r.mode === 'petted' ? 0.75 : r.mode === 'groom' ? 0.4 : r.mode === 'hop' && !r.fleeing ? 0.3 : 0;
  const sit = r.mode === 'alert' ? 1 : r.mode === 'groom' ? 0.7 : r.mode === 'petted' ? 0.45 : 0;
  r.ears = approach(r.ears, ears, 6, dt);
  r.sit = approach(r.sit, sit, 7, dt);
  r.groom = approach(r.groom, r.mode === 'groom' ? 1 : 0, 6, dt);
}

// ── Bird ────────────────────────────────────────────────────────────────────

export interface Spot {
  x: number;
  y: number;
  z: number;
  /** On the ground (pecks and hops) or a perch (looks around). */
  ground: boolean;
}

export type BirdMode = 'sit' | 'fly';

export interface Bird {
  x: number;
  y: number;
  z: number;
  heading: number;
  mode: BirdMode;
  spot: number;
  timer: number;
  flight: { fx: number; fy: number; fz: number; tx: number; ty: number; tz: number; t: number; dur: number; apex: number } | null;
  /** Wing beat phase and how open the wings are (0 folded … 1 spread). */
  flap: number;
  wings: number;
  /** 0 … 1 head down pecking. */
  peck: number;
  /** Head turn while perched (radians). */
  look: number;
  hopT: number;
}

export const BIRD = { threat: 2.4, speed: 4.2, minFlee: 6 };

export function makeBird(spot: number, spots: Spot[], rng: Rng): Bird {
  const s = spots[spot];
  return { x: s.x, y: s.y, z: s.z, heading: rng() * TAU, mode: 'sit', spot, timer: 3 + rng() * 10, flight: null, flap: rng() * 10, wings: 0, peck: 0, look: 0, hopT: 0 };
}

/** A free spot (not taken by another bird), far from the cat when fleeing. */
export function pickSpot(b: Bird, spots: Spot[], taken: Set<number>, cat: Cat, fleeing: boolean, rng: Rng) {
  const options: number[] = [];
  spots.forEach((s, i) => {
    if (i === b.spot || taken.has(i)) return;
    const far = dist(s.x, s.z, b.x, b.z);
    if (far < 3 || far > 28) return;
    if (fleeing && dist(s.x, s.z, cat.x, cat.z) < BIRD.minFlee) return;
    options.push(i);
  });
  if (!options.length) return -1;
  return options[Math.floor(rng() * options.length)];
}

function takeOff(b: Bird, to: number, spots: Spot[]) {
  const s = spots[to];
  const len = Math.hypot(s.x - b.x, s.y - b.y, s.z - b.z);
  b.mode = 'fly';
  b.flight = { fx: b.x, fy: b.y, fz: b.z, tx: s.x, ty: s.y, tz: s.z, t: 0, dur: Math.max(0.8, len / BIRD.speed), apex: Math.max(b.y, s.y) + 1.2 + len * 0.12 };
  b.spot = to;
  b.heading = Math.atan2(s.z - b.z, s.x - b.x);
}

export function birdStep(b: Bird, dt: number, cat: Cat, spots: Spot[], taken: Set<number>, env: Env, rng: Rng) {
  b.flap += dt * (b.mode === 'fly' ? 26 : 4);
  if (b.mode === 'fly' && b.flight) {
    const f = b.flight;
    f.t = Math.min(1, f.t + dt / f.dur);
    // a smooth arc: rises to the apex mid-flight, glides in to land
    const e = f.t * f.t * (3 - 2 * f.t);
    b.x = lerp(f.fx, f.tx, e);
    b.z = lerp(f.fz, f.tz, e);
    const base = lerp(f.fy, f.ty, e);
    b.y = base + Math.sin(f.t * Math.PI) * (f.apex - Math.max(f.fy, f.ty));
    b.wings = approach(b.wings, f.t > 0.85 ? 0.7 : 1, 10, dt);
    if (f.t >= 1) {
      b.mode = 'sit';
      b.flight = null;
      b.timer = 6 + rng() * 18;
    }
    return;
  }
  b.wings = approach(b.wings, 0, 8, dt);
  const spot = spots[b.spot];
  const d = dist(b.x, b.z, cat.x, cat.z) + Math.max(0, b.y - 0.3) * 0.8;
  const scared = d < threatRadius(BIRD.threat, cat);
  b.timer -= dt;
  if (scared || b.timer <= 0) {
    const to = pickSpot(b, spots, taken, cat, scared, rng);
    if (to >= 0) {
      taken.delete(b.spot);
      taken.add(to);
      takeOff(b, to, spots);
      return;
    }
    b.timer = 2 + rng() * 3;
  }
  // idle: pecking and little hops on the ground, looking around on a perch
  if (spot.ground) {
    b.peck = approach(b.peck, Math.sin(b.flap * 1.7) > 0.55 ? 1 : 0, 14, dt);
    b.hopT -= dt;
    if (b.hopT <= 0) {
      b.hopT = 0.8 + rng() * 2.2;
      const a = rng() * TAU;
      const tx = b.x + Math.cos(a) * 0.18;
      const tz = b.z + Math.sin(a) * 0.18;
      // stays near its spot, on free ground
      if (dist(tx, tz, spot.x, spot.z) < 0.9 && env.ground(tx, tz) && env.free(b.x, b.z, tx, tz)) {
        b.x = tx;
        b.z = tz;
        b.heading = a;
      }
    }
  } else {
    b.peck = approach(b.peck, 0, 8, dt);
    b.look = Math.sin(b.flap * 0.45) * 0.9;
  }
}

// ── Butterfly ───────────────────────────────────────────────────────────────

export interface Flower {
  x: number;
  y: number;
  z: number;
}

export type ButterflyMode = 'flutter' | 'land';

export interface Butterfly {
  x: number;
  y: number;
  z: number;
  heading: number;
  mode: ButterflyMode;
  target: number;
  timer: number;
  /** Wing angle phase. */
  flap: number;
  /** Wing beat rate (fast in flight, slow open-and-close when resting). */
  rate: number;
  home: { x: number; z: number; r: number };
  seed: number;
}

export const BUTTERFLY = { speed: 0.95, threat: 0.9, landAt: 0.12 };

export function makeButterfly(home: Butterfly['home'], rng: Rng): Butterfly {
  return { x: home.x + (rng() - 0.5) * 2, y: 0.8 + rng() * 0.4, z: home.z + (rng() - 0.5) * 2, heading: rng() * TAU, mode: 'flutter', target: -1, timer: 0, flap: rng() * 10, rate: 16, home, seed: rng() * 100 };
}

function nextFlower(b: Butterfly, flowers: Flower[], rng: Rng) {
  const near: number[] = [];
  flowers.forEach((f, i) => {
    if (i !== b.target && dist(f.x, f.z, b.home.x, b.home.z) < b.home.r) near.push(i);
  });
  return near.length ? near[Math.floor(rng() * near.length)] : -1;
}

export function butterflyStep(b: Butterfly, dt: number, t: number, cat: Cat, flowers: Flower[], rng: Rng) {
  b.flap += dt * b.rate;
  const scared = dist(b.x, b.z, cat.x, cat.z) < BUTTERFLY.threat * (cat.crouch ? 0.5 : 1) + (cat.speed > 4 ? 0.6 : 0);
  if (b.mode === 'land') {
    b.rate = approach(b.rate, 3, 4, dt);
    b.timer -= dt;
    if (b.timer <= 0 || scared) {
      b.mode = 'flutter';
      b.target = nextFlower(b, flowers, rng);
      b.y += 0.05;
    }
    return;
  }
  b.rate = approach(b.rate, 17, 6, dt);
  if (b.target < 0) b.target = nextFlower(b, flowers, rng);
  // a wandering point when there is no flower around
  const f = b.target >= 0 ? flowers[b.target] : { x: b.home.x + Math.cos(t * 0.3 + b.seed) * 2, y: 0.9, z: b.home.z + Math.sin(t * 0.37 + b.seed) * 2 };
  const dx = f.x - b.x;
  const dz = f.z - b.z;
  const dh = Math.hypot(dx, dz);
  // erratic flight: heading wobbles around the direction to the flower
  const want = Math.atan2(dz, dx) + Math.sin(t * 2.3 + b.seed) * 0.9 * Math.min(1, dh);
  let turn = want - b.heading;
  turn = Math.atan2(Math.sin(turn), Math.cos(turn));
  b.heading += turn * Math.min(1, dt * 4);
  const step = Math.min(dh, BUTTERFLY.speed * dt);
  b.x += Math.cos(b.heading) * step;
  b.z += Math.sin(b.heading) * step;
  // bobbing up and down, settling onto the flower in the last half meter
  const cruise = 0.75 + Math.sin(t * 3.1 + b.seed) * 0.25 + Math.sin(t * 1.3 + b.seed * 2) * 0.2;
  const settle = Math.min(1, dh / 0.6);
  b.y = approach(b.y, lerp(f.y + 0.06, cruise, settle), 5, dt);
  if (b.target >= 0 && dh < BUTTERFLY.landAt) {
    b.mode = 'land';
    b.x = f.x;
    b.z = f.z;
    b.y = f.y + 0.05;
    b.timer = 2 + rng() * 4;
  }
}
