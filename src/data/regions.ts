import { WORLD_BOUNDS } from './world';
import { EAST, LOOKOUT, TEA } from './east';
import { WEST } from './west';
import { SOUTH } from './south';
import { INTERIORS, interiorRect } from './interiors';
import { WILD_RECT } from './wild';

/**
 * Where the cat may stand, as a union of rectangles: the village and the districts outside its fence.
 * Each district rectangle overlaps the village one up to its fence line, so walking through a gate never
 * leaves every rectangle (the fences' colliders are what keep the cat out elsewhere). The temple
 * courtyard has its own polygon test in systems/temple.ts.
 */
export type Rect = { minX: number; maxX: number; minZ: number; maxZ: number };

export const WALK_RECTS: Rect[] = [
  WORLD_BOUNDS,
  { minX: WORLD_BOUNDS.maxX, maxX: EAST.maxX, minZ: EAST.minZ, maxZ: EAST.maxZ },
  // the top tea terrace and the lookout on the ridge
  { minX: TEA.x0, maxX: EAST.maxX, minZ: EAST.maxZ, maxZ: LOOKOUT.z1 },
  { minX: WEST.minX, maxX: WORLD_BOUNDS.minX, minZ: WEST.minZ, maxZ: WEST.maxZ },
  { minX: SOUTH.minX, maxX: SOUTH.maxX, minZ: WORLD_BOUNDS.maxZ, maxZ: SOUTH.maxZ },
  // the rooms of the houses you can walk into (data/interiors.ts), far east of the map
  ...INTERIORS.map(interiorRect),
  // the wild lands past the Trilha da Expedição (data/wild.ts), far west... at x 500, out of everyone's way
  WILD_RECT,
];

const inside = (r: Rect, x: number, z: number) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;

/** null when (x, z) is inside some rectangle; otherwise the nearest point that is. */
export function clampToRegions(x: number, z: number): { x: number; z: number } | null {
  if (WALK_RECTS.some((r) => inside(r, x, z))) return null;
  let best = { x, z };
  let bestD = Infinity;
  for (const r of WALK_RECTS) {
    const cx = Math.min(r.maxX, Math.max(r.minX, x));
    const cz = Math.min(r.maxZ, Math.max(r.minZ, z));
    const d = (cx - x) ** 2 + (cz - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = { x: cx, z: cz };
    }
  }
  return best;
}
