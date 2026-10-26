/**
 * Templo dos Enigmas: the rules of the three puzzles, kept free of React/three so tests can play them.
 *
 *   Espelhos da Luz (ângulos)     - turn mirror statues 45° at a time until the lantern's beam reaches the crystal.
 *   Porta das Frações (frações)   - stand on plates worth ½, ¼, ⅛ and ⅜ so the door disk lights exactly the target.
 *   Gongos da Sequência (padrões) - strike the gongs that continue the number pattern on the tablet.
 */
import type { Vec3 } from '../types';

// ── Layout (world units) ─────────────────────────────────────────────────────────
/** The region north of the village fence. The gate is a gap in the fence at GATE.x. */
export const TEMPLE = { minX: -13, maxX: 13, minZ: -37, maxZ: -19.2 };
export const GATE = { x: -6, z: -19.2, halfWidth: 1.5 };
export const SHRINE: Vec3 = [0, 0, -35.4];

// ── Espelhos da Luz ──────────────────────────────────────────────────────────────
/** Grid cells (i east, j south), CELL metres apart, starting at MIRROR_GRID.origin. */
export const MIRROR_GRID = { origin: [-11.4, -33.4] as [number, number], cell: 1.6, size: 5 };
export const BEAM_SOURCE = { cell: [0, 3] as [number, number], dir: [1, 0] as [number, number] };
export const CRYSTAL_CELL: [number, number] = [4, 4];
export const MIRRORS: [number, number][] = [[2, 3], [2, 0], [4, 0]];
/** The only orientations that bring the light to the crystal (checked by the tests over all 64). */
export const MIRROR_SOLUTION = [3, 3, 1];
/** Each statue starts edge-on (0°), so the beam first runs straight past it. */
export const MIRROR_START = [0, 0, 0];
/** Orientation k means the mirror line is at k × 45° (0° lies along the east-west axis). */
export const angleOf = (k: number) => ((k % 4) + 4) % 4 * 45;

export function cellToWorld(i: number, j: number): [number, number] {
  return [MIRROR_GRID.origin[0] + i * MIRROR_GRID.cell, MIRROR_GRID.origin[1] + j * MIRROR_GRID.cell];
}

export interface BeamResult {
  /** Cells the beam passes through, starting at the source. */
  path: [number, number][];
  end: 'crystal' | 'wall' | 'back' | 'loop';
}

/**
 * Follows the light: straight through empty cells; at a mirror it reflects off the mirror line
 * (45°/135° turn it 90°, 0° lets it pass along the edge, 90° sends it straight back).
 */
export function traceBeam(orient: number[]): BeamResult {
  let [i, j] = BEAM_SOURCE.cell;
  let [di, dj] = BEAM_SOURCE.dir;
  const path: [number, number][] = [[i, j]];
  const seen = new Set<string>();
  for (let n = 0; n < 64; n++) {
    i += di;
    j += dj;
    if (i < 0 || j < 0 || i >= MIRROR_GRID.size || j >= MIRROR_GRID.size) return { path, end: 'wall' };
    path.push([i, j]);
    if (i === CRYSTAL_CELL[0] && j === CRYSTAL_CELL[1]) return { path, end: 'crystal' };
    if (i === BEAM_SOURCE.cell[0] && j === BEAM_SOURCE.cell[1]) return { path, end: 'back' };
    const m = MIRRORS.findIndex(([mi, mj]) => mi === i && mj === j);
    if (m >= 0) {
      const a = (angleOf(orient[m]) * Math.PI) / 180;
      const lx = Math.cos(a);
      const lz = Math.sin(a);
      const dot = di * lx + dj * lz;
      [di, dj] = [Math.round(2 * dot * lx - di), Math.round(2 * dot * lz - dj)];
    }
    const key = `${i},${j},${di},${dj}`;
    if (seen.has(key)) return { path, end: 'loop' };
    seen.add(key);
  }
  return { path, end: 'loop' };
}

// ── Porta das Frações ────────────────────────────────────────────────────────────
/** Plate values in eighths (the door disk has 8 slices). */
export const PLATES = [
  { label: '½', eighths: 4 },
  { label: '¼', eighths: 2 },
  { label: '⅛', eighths: 1 },
  { label: '⅜', eighths: 3 },
];
export const FRACTION_ROUNDS = [
  { label: '¾', eighths: 6 },
  { label: '⅝', eighths: 5 },
];
export const FRACTION_DOOR: Vec3 = [8.2, 0, -33.2];
export const PLATE_SPOTS: [number, number][] = [[5.4, -29.6], [7.4, -29.6], [9.4, -29.6], [11.0, -29.6]];
export const FRACTION_LEVER: Vec3 = [5.6, 0, -32.4];

export const litEighths = (on: boolean[]) => PLATES.reduce((sum, p, k) => sum + (on[k] ? p.eighths : 0), 0);
export const fractionSolved = (round: number, on: boolean[]) => litEighths(on) === FRACTION_ROUNDS[round]?.eighths;

// ── Gongos da Sequência ──────────────────────────────────────────────────────────
export const GONG_ROUNDS = [
  { shown: [2, 5, 8, 11], gongs: [12, 14, 15, 16, 17], answer: [14, 17], rule: 'soma 3 a cada passo' },
  { shown: [1, 2, 4, 8], gongs: [10, 12, 16, 18, 24], answer: [16], rule: 'dobra a cada passo' },
];
export const GONG_ARC = { center: [0, -29.2] as [number, number], radius: 3.6 };
export const GONG_TABLET: Vec3 = [0, 0, -26.4];

/** Gong k stands on an arc that opens toward the tablet (south). */
export function gongSpot(k: number, count: number): [number, number, number] {
  // spread wide enough to leave ~1 m between gongs (the cat is ~0.7 m wide): the shrine lies behind the arc
  const a = Math.PI * (0.12 + (0.76 * k) / (count - 1));
  // rotation.y turns the gong's face (+z) toward the arc centre
  return [GONG_ARC.center[0] - Math.cos(a) * GONG_ARC.radius, GONG_ARC.center[1] - Math.sin(a) * GONG_ARC.radius, Math.PI / 2 - a];
}

/** One strike: returns the new progress (how many answers hit in order), 'wrong' or 'done'. */
export function strikeGong(round: number, progress: number, value: number): number | 'wrong' | 'done' {
  const r = GONG_ROUNDS[round];
  if (!r || value !== r.answer[progress]) return 'wrong';
  return progress + 1 === r.answer.length ? 'done' : progress + 1;
}

// ── Region bounds (used by the player's safety net) ──────────────────────────────
/** True when (x, z) lies inside the temple region or its gate corridor. */
export const inTemple = (x: number, z: number) =>
  (x >= TEMPLE.minX && x <= TEMPLE.maxX && z >= TEMPLE.minZ && z < TEMPLE.maxZ) ||
  (Math.abs(x - GATE.x) <= GATE.halfWidth && z >= TEMPLE.maxZ - 1 && z <= TEMPLE.maxZ + 1);
