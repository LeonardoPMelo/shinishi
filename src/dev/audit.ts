/**
 * Dev-only world audit (loaded from main.tsx in development, never in the build). Asks the physics world,
 * not the data, whether the places the game sends the cat and the villagers are really open:
 *
 *   __audit.run()  → { paths, npcs, patrols, enemies, objects, doors }: every spot where a solid collider sits
 *
 * - paths: every path and trail, sampled every 0.5 m (but its destination); a cat-sized ball must touch nothing solid
 * - npcs / patrols / enemies: where they stand and every point they walk to
 * - objects: something the cat can stand next to must exist within the object's reach
 * - doors: the spot outside each door and the one inside it must be open
 * All outdoor and indoor colliders are mounted at once (zones only hide what is drawn), so one pass sees all.
 */
import { PATHS } from '../game/world/Ground';
import { EAST_PATHS } from '../data/east';
import { WEST_PATHS } from '../data/west';
import { SOUTH_PATHS } from '../data/south';
import { PRECINCT_PATHS } from '../data/precinct';
import { WILD_TRAILS, ENEMY_SPAWNS, WILD_ORIGIN } from '../data/wild';
import { WILD2_SPAWNS } from '../data/wild2';
import { NPC_DEFINITIONS } from '../data/npcs';
import { WORLD_OBJECTS } from '../data/world';
import { INTERIORS, outsideDoor, insideDoor } from '../data/interiors';

type Collider = {
  isSensor: () => boolean;
  translation: () => { x: number; y: number; z: number };
  shape: { type: number; halfExtents?: { x: number; y: number; z: number }; radius?: number; halfHeight?: number };
};
type World = {
  intersectionsWithShape: (pos: object, rot: object, shape: unknown, cb: (c: Collider) => boolean, flags?: number) => void;
  castRay: (ray: unknown, maxToi: number, solid: boolean, flags?: number) => { timeOfImpact?: number; toi?: number } | null;
};
type Rapier = { Ball: new (r: number) => unknown; Ray: new (o: object, d: object) => unknown };
const phys = () => (window as unknown as { __rapier: { world: World; rapier: Rapier } }).__rapier;

// rapier's QueryFilterFlags: ONLY_FIXED (EXCLUDE_KINEMATIC | EXCLUDE_DYNAMIC) | EXCLUDE_SENSORS
const FIXED_SOLIDS = 2 | 4 | 8;
const SHAPES = ['ball', 'cuboid', 'capsule', 'segment', 'polyline', 'triangle', 'trimesh', 'heightfield', '?', 'convex', 'cylinder', 'cone', 'roundCuboid'];
const UP = { x: 0, y: 0, z: 0, w: 1 };

/** Height of the ground under (x, z): the highest solid surface below `from` m (a ray that starts inside
 *  something, like a gate's beam, starts again a little lower). */
export function groundAt(x: number, z: number, from = 2.4) {
  const { world, rapier } = phys();
  for (let y = from; y > 0.2; y -= 0.25) {
    const hit = world.castRay(new rapier.Ray({ x, y, z }, { x: 0, y: -1, z: 0 }), y + 2, true, FIXED_SOLIDS);
    if (!hit) return 0;
    const toi = hit.timeOfImpact ?? hit.toi ?? y;
    if (toi > 0.01) return y - toi;
  }
  return 0;
}

/** Solid colliders touching a cat-sized ball standing at (x, z). */
export function blockers(x: number, z: number, r = 0.3, y?: number) {
  const { world, rapier } = phys();
  const g = y ?? groundAt(x, z);
  const out: string[] = [];
  world.intersectionsWithShape({ x, y: g + 0.36 + r, z }, UP, new rapier.Ball(r), (c) => {
    const t = c.translation();
    const s = c.shape;
    const size = s.halfExtents ? `${(s.halfExtents.x * 2).toFixed(1)}×${(s.halfExtents.z * 2).toFixed(1)}` : s.radius ? `r${s.radius.toFixed(2)}` : '';
    out.push(`${SHAPES[s.type] ?? s.type} ${size} @ ${t.x.toFixed(1)},${t.y.toFixed(1)},${t.z.toFixed(1)}`);
    return true;
  }, FIXED_SOLIDS);
  return out;
}

const r1 = (n: number) => +n.toFixed(1);

function walkLines(name: string, lines: [number, number][][], ox = 0, oz = 0) {
  const bad: { path: string; at: [number, number]; hits: string[] }[] = [];
  lines.forEach((line, li) => {
    for (let i = 0; i < line.length - 1; i++) {
      const [ax, az] = line[i];
      const [bx, bz] = line[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.5));
      // (a path's very end is its destination — a door, a gate, a fountain — and touches it on purpose)
      const last = i === line.length - 2 ? n - 1 : n;
      for (let k = 0; k <= last; k++) {
        const x = ox + ax + ((bx - ax) * k) / n;
        const z = oz + az + ((bz - az) * k) / n;
        const hits = blockers(x, z);
        if (hits.length) bad.push({ path: `${name}[${li}]`, at: [r1(x), r1(z)], hits });
      }
    }
  });
  // one report per blocking collider per path (a wall across a path shows up at several samples)
  const seen = new Set<string>();
  return bad.filter((b) => {
    const key = b.path + b.hits.join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function run() {
  const [wx, wz] = WILD_ORIGIN;
  const paths = [
    ...walkLines('PATHS', PATHS), ...walkLines('EAST', EAST_PATHS), ...walkLines('WEST', WEST_PATHS),
    ...walkLines('SOUTH', SOUTH_PATHS), ...walkLines('PRECINCT', PRECINCT_PATHS), ...walkLines('WILD', WILD_TRAILS, wx, wz),
  ];
  const npcs: { id: string; at: number[]; hits: string[] }[] = [];
  const patrols: { id: string; at: number[]; hits: string[] }[] = [];
  for (const n of NPC_DEFINITIONS) {
    const [x, y, z] = n.position;
    // NPCs are about cat-sized; their own bodies are kinematic, so they are not counted
    const hits = blockers(x, z, 0.28, y > 0.3 ? y : undefined);
    if (hits.length) npcs.push({ id: n.id, at: [x, y, z], hits });
    // the walk between patrol points as well as the points themselves
    if (n.patrol) {
      const loop = [...n.patrol, n.patrol[0]];
      for (let i = 0; i < loop.length - 1; i++) {
        const [ax, , az] = loop[i];
        const [bx, , bz] = loop[i + 1];
        const k = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.5));
        for (let j = 0; j <= k; j++) {
          const px = ax + ((bx - ax) * j) / k;
          const pz = az + ((bz - az) * j) / k;
          const h = blockers(px, pz, 0.28);
          if (h.length) { patrols.push({ id: n.id, at: [r1(px), r1(pz)], hits: h }); break; }
        }
      }
    }
  }
  const enemies: { id: string; at: number[]; hits: string[] }[] = [];
  for (const s of [...ENEMY_SPAWNS, ...WILD2_SPAWNS]) {
    if (s.post) continue; // lookouts stand on their platform
    for (const [lx, lz] of [s.at, ...(s.route ?? [])]) {
      const h = blockers(wx + lx, wz + lz, 0.4);
      if (h.length) enemies.push({ id: s.id, at: [lx, lz], hits: h });
    }
  }
  // an object is reachable if some open cat spot lies within its reach
  const objects: { id: string; at: number[] }[] = [];
  for (const o of WORLD_OBJECTS) {
    const [x, y, z] = o.position;
    const reach = (o.radius ?? 1.6) + 0.1;
    let ok = false;
    for (let a = 0; a < 16 && !ok; a++) {
      for (const d of [0, reach * 0.45, reach * 0.8]) {
        const px = x + Math.cos((a / 16) * Math.PI * 2) * d;
        const pz = z + Math.sin((a / 16) * Math.PI * 2) * d;
        const g = groundAt(px, pz, Math.max(2.4, y + 2.4));
        // the interaction reaches 2.2 m up or down from the cat's middle (~0.7 m over its feet)
        if (Math.abs(g + 0.7 - y) <= 2.2 && blockers(px, pz, 0.3, g).length === 0) { ok = true; break; }
      }
    }
    if (!ok) objects.push({ id: o.id, at: [x, y, z] });
  }
  const doors: { id: string; side: string; at: number[]; hits: string[] }[] = [];
  for (const def of INTERIORS) {
    const o = outsideDoor(def);
    const h = blockers(o.spot[0], o.spot[2], 0.3, o.spot[1]);
    if (h.length) doors.push({ id: def.id, side: 'fora', at: o.spot, hits: h });
    const [ix, , iz] = insideDoor(def).spot;
    const hi = blockers(ix, iz, 0.3);
    if (hi.length) doors.push({ id: def.id, side: 'dentro', at: [ix, iz], hits: hi });
  }
  return { paths, npcs, patrols, enemies, objects, doors };
}

(window as unknown as Record<string, unknown>).__audit = { run, blockers, groundAt };
