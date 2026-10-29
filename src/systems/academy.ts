/**
 * Rules of the academy's body tests (Etapa 5 da expansão), kept apart from the 3D so the tests can play them:
 *  - the Circuit of the Paws: checkpoints in order against the clock, with a medal by time;
 *  - the nightingale floor: boards that chirp under a careless step (crouch to cross in silence).
 * Positions here are in room coordinates (metres from the room centre, like data/interiors.ts).
 */

export interface CheckpointSpot {
  at: [number, number];
  /** How close (m, on the ground plane) the cat must come. */
  r: number;
  /** The cat's feet must be at least this high (on top of a platform, not under it). */
  minY: number;
}

export interface Checkpoint {
  name: string;
  /** Any of these counts: a checkpoint can be reached by more than one route. */
  options: CheckpointSpot[];
}

export interface CircuitDef {
  start: CheckpointSpot;
  /** In order; the last one is the finish. */
  checkpoints: Checkpoint[];
  /** Leaving this area during a run cancels it. */
  area: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Seconds: at or under → medal. */
  medals: { ouro: number; prata: number };
}

export interface CircuitRun {
  running: boolean;
  next: number;
  startedAt: number;
  splits: number[];
}

export const idleRun = (): CircuitRun => ({ running: false, next: 0, startedAt: 0, splits: [] });

export type Medal = 'ouro' | 'prata' | 'bronze';

export function medalFor(def: CircuitDef, seconds: number): Medal {
  return seconds <= def.medals.ouro ? 'ouro' : seconds <= def.medals.prata ? 'prata' : 'bronze';
}

const near = (s: CheckpointSpot, x: number, y: number, z: number) => Math.hypot(x - s.at[0], z - s.at[1]) <= s.r && y >= s.minY;

export type CircuitEvent = { kind: 'checkpoint'; index: number } | { kind: 'finish'; seconds: number; medal: Medal } | { kind: 'abort' };

/**
 * One frame of a run. `feetY` is the height of the cat's feet; `t` is seconds. Returns the new run and what
 * happened (nothing most frames).
 */
export function circuitTick(def: CircuitDef, run: CircuitRun, x: number, feetY: number, z: number, t: number): { run: CircuitRun; event: CircuitEvent | null } {
  if (!run.running) return { run, event: null };
  const a = def.area;
  if (x < a.minX || x > a.maxX || z < a.minZ || z > a.maxZ) return { run: idleRun(), event: { kind: 'abort' } };
  const cp = def.checkpoints[run.next];
  if (!cp || !cp.options.some((o) => near(o, x, feetY, z))) return { run, event: null };
  const splits = [...run.splits, t - run.startedAt];
  if (run.next === def.checkpoints.length - 1) {
    const seconds = Math.round((t - run.startedAt) * 10) / 10;
    return { run: idleRun(), event: { kind: 'finish', seconds, medal: medalFor(def, seconds) } };
  }
  return { run: { ...run, next: run.next + 1, splits }, event: { kind: 'checkpoint', index: run.next } };
}

export function startRun(t: number): CircuitRun {
  return { running: true, next: 0, startedAt: t, splits: [] };
}

// ── Nightingale floor (uguisubari) ─────────────────────────────────────────────
/** Metres walked upright on the boards for each chirp. */
export const SQUEAK_EVERY = 0.7;
/** The second chirp gives you away. */
export const CAUGHT_AT = 2;

export interface FloorState {
  /** Metres walked upright since the last chirp. */
  dist: number;
  squeaks: number;
  wasGrounded: boolean;
}

export const quietFloor = (): FloorState => ({ dist: 0, squeaks: 0, wasGrounded: true });

/**
 * One frame on (or off) the boards. Crouched steps are silent; upright steps chirp every SQUEAK_EVERY metres,
 * and landing upright on the boards chirps at once (so jumping across is not a way around the lesson).
 */
export function floorTick(s: FloorState, onBoards: boolean, grounded: boolean, crouched: boolean, moved: number): { state: FloorState; squeak: boolean; caught: boolean } {
  if (!onBoards) return { state: { ...s, wasGrounded: grounded }, squeak: false, caught: false };
  let { dist, squeaks } = s;
  let squeak = false;
  if (grounded && !s.wasGrounded && !crouched) {
    squeaks += 1;
    squeak = true;
  } else if (grounded && !crouched) {
    dist += moved;
    if (dist >= SQUEAK_EVERY) {
      dist -= SQUEAK_EVERY;
      squeaks += 1;
      squeak = true;
    }
  }
  return { state: { dist, squeaks, wasGrounded: grounded }, squeak, caught: squeaks >= CAUGHT_AT };
}
