/**
 * Camera in tight spots (Etapa 6). When the view behind the cat is blocked (a porch roof, the wall of the
 * next house), the old camera could only slide in along the same line, down to 1.2 m: under the eaves it
 * sat on the cat's back. Now a few other views are probed (higher, and turned to either side) and the
 * camera eases toward the one that keeps the most room for the least change, like a camera operator
 * stepping aside instead of walking into the actor.
 */

export interface Probe {
  /** Offsets from the view the player chose (radians). */
  dTheta: number;
  dPhi: number;
  /** Free distance along that view before something solid (m). */
  free: number;
}

/** The views tried when the chosen one is blocked: turned either way, and raised. */
export const PROBES: [number, number][] = [
  [0, 0.22], [0, 0.42],
  [0.35, 0], [-0.35, 0], [0.7, 0], [-0.7, 0], [1.1, 0], [-1.1, 0],
  [0.35, 0.22], [-0.35, 0.22], [0.7, 0.22], [-0.7, 0.22],
];

/**
 * Picks the view with the best room for the least deviation. `wanted` is the distance the player chose.
 * Room counts up to the wanted distance; turning costs less than tilting (a turned view still shows the
 * path ahead, a steep one flattens the scene). The current view keeps a small bonus, so it doesn't flicker.
 */
export function pickView(probes: Probe[], wanted: number, current?: { dTheta: number; dPhi: number }) {
  let best = probes[0];
  let bestScore = -Infinity;
  for (const p of probes) {
    const room = Math.min(p.free, wanted) / wanted;
    let score = room - 0.18 * Math.abs(p.dTheta) - 0.3 * Math.abs(p.dPhi);
    if (current && Math.abs(p.dTheta - current.dTheta) < 0.01 && Math.abs(p.dPhi - current.dPhi) < 0.01) score += 0.06;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}
