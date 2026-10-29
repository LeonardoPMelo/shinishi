/**
 * Walls that drop out of the way (Etapa 5 da expansão). Rooms are seen from above and behind the cat; a wall
 * between the camera and Shinichi hid him (measured in play: at the map table, just past an inner wall). Each
 * frame, every wall whose line crosses the line of sight below its top is drawn low; its collider never
 * changes. Pure geometry here (tests/academy.test.ts); Interiors.tsx does the drawing.
 */

export interface WallLine {
  /** Ends of the wall's centre line, room coordinates. */
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** Height of its top. */
  top: number;
}

type P3 = { x: number; y: number; z: number };

/** Ends are stretched by this much, so a cat standing at a wall's end is still seen past it. */
const END_MARGIN = 0.35;

/**
 * True when the line from the camera to the cat crosses the wall below its top (in the camera's half of the
 * segment: a wall behind the cat never hides it).
 */
export function wallHides(cam: P3, cat: P3, wall: WallLine): boolean {
  const len = Math.hypot(wall.x1 - wall.x0, wall.z1 - wall.z0) || 1;
  const ux = (wall.x1 - wall.x0) / len;
  const uz = (wall.z1 - wall.z0) / len;
  const ax = wall.x0 - ux * END_MARGIN;
  const az = wall.z0 - uz * END_MARGIN;
  const bx = wall.x1 + ux * END_MARGIN;
  const bz = wall.z1 + uz * END_MARGIN;
  // segment-segment intersection in the ground plane: cam + t (cat - cam) = a + s (b - a)
  const rx = cat.x - cam.x;
  const rz = cat.z - cam.z;
  const sx = bx - ax;
  const sz = bz - az;
  const denom = rx * sz - rz * sx;
  if (Math.abs(denom) < 1e-9) return false;
  const qx = ax - cam.x;
  const qz = az - cam.z;
  const t = (qx * sz - qz * sx) / denom;
  const s = (qx * rz - qz * rx) / denom;
  if (t <= 0 || t >= 1 || s < 0 || s > 1) return false;
  const y = cam.y + (cat.y - cam.y) * t;
  return y < wall.top + 0.05;
}
