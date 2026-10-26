/**
 * Dev-only QA harness (loaded from main.tsx in development, never in the build).
 * Drives the REAL controller through the analog stick, like the touch joystick does,
 * so movement, collisions and the camera are tested the way a player meets them.
 *
 *   await __qa.walls()     → walks into every house from 4 sides, reports penetration
 *   await __qa.bridge()    → walks across the red bridge and along its rails
 *   await __qa.camera()    → camera vs walls: is the line to the cat ever blocked?
 *
 * Frames are advanced by hand (`__r3f.advance`), because the preview pane is often hidden.
 */
import * as THREE from 'three';
import { input } from '../game/systems/input';
import { playerPosition, playerBody, cameraAngle, playerGround } from '../game/systems/playerState';
import { useGameStore } from '../store/gameStore';

type R3F = { advance: (t: number) => void; camera: THREE.Camera; scene: THREE.Scene };
const r3f = () => (window as unknown as { __r3f: R3F }).__r3f;

let clock = performance.now();
export async function adv(frames: number) {
  for (let i = 0; i < frames; i++) {
    clock += 16;
    r3f().advance(clock / 1000);
    await new Promise((r) => setTimeout(r, 4));
  }
}

export async function place(x: number, z: number, y = 0.8) {
  const b = playerBody.current!;
  b.setTranslation({ x, y, z }, true);
  b.setLinvel({ x: 0, y: 0, z: 0 }, true);
  input.stickX = input.stickY = 0;
  await adv(20);
}

/** Pushes the stick toward a world point every frame (camera-relative, like a player would). */
export async function steer(
  x: number, z: number, frames = 120,
  opts: { stopAt?: number; run?: boolean; crouch?: boolean; stick?: number; onFrame?: () => void } = {},
) {
  let closest = Infinity;
  const path: [number, number][] = [];
  input.run = !!opts.run;
  input.crouch = !!opts.crouch;
  const tilt = opts.stick ?? 1;
  for (let i = 0; i < frames; i++) {
    const dx = x - playerPosition.x;
    const dz = z - playerPosition.z;
    const d = Math.hypot(dx, dz);
    closest = Math.min(closest, d);
    if (d < (opts.stopAt ?? 0.2)) break;
    // same camera-relative frame as the controller (Shinichi.tsx): forward and right from cameraAngle.theta
    const th = cameraAngle.theta;
    input.stickY = ((dx * -Math.sin(th) + dz * -Math.cos(th)) / d) * tilt;
    input.stickX = ((dx * Math.cos(th) + dz * -Math.sin(th)) / d) * tilt;
    if (i % 10 === 0) path.push([+playerPosition.x.toFixed(2), +playerPosition.z.toFixed(2)]);
    await adv(1);
    opts.onFrame?.();
  }
  input.stickX = input.stickY = 0;
  input.run = false;
  input.crouch = false;
  return { closest: +closest.toFixed(2), end: [+playerPosition.x.toFixed(2), +playerPosition.y.toFixed(2), +playerPosition.z.toFixed(2)], path };
}

/**
 * Real-time version of `steer`, for a visible window (Etapa 5): holds the stick toward (x, z) on every real
 * animation frame for `ms`, calling `onFrame(dt)` after each one. `steer` advances frames by itself, which
 * fights the real render loop when the window is visible (the clock jumps).
 */
export function drive(x: number, z: number, ms: number, opts: { run?: boolean; crouch?: boolean; stick?: number; onFrame?: (dt: number) => void } = {}) {
  input.run = !!opts.run;
  input.crouch = !!opts.crouch;
  const tilt = opts.stick ?? 1;
  return new Promise<void>((done) => {
    const t0 = performance.now();
    let last = t0;
    const tick = (now: number) => {
      const dx = x - playerPosition.x;
      const dz = z - playerPosition.z;
      const d = Math.max(1e-3, Math.hypot(dx, dz));
      const th = cameraAngle.theta;
      input.stickY = ((dx * -Math.sin(th) + dz * -Math.cos(th)) / d) * tilt;
      input.stickX = ((dx * Math.cos(th) + dz * -Math.sin(th)) / d) * tilt;
      opts.onFrame?.((now - last) / 1000);
      last = now;
      if (now - t0 < ms && d > 0.3) requestAnimationFrame(tick);
      else {
        input.stickX = input.stickY = 0;
        input.run = false;
        input.crouch = false;
        done();
      }
    };
    requestAnimationFrame(tick);
  });
}

/** Houses as built in Buildings.tsx / Outskirts.tsx (center, rotation, footprint w × d). */
const HOUSES: { name: string; c: [number, number]; rot: number; w: number; d: number }[] = [
  { name: 'cantina', c: [-8.5, -8.5], rot: 0.35, w: 5, d: 3.8 },
  { name: 'dojo', c: [9.5, -10], rot: -0.35, w: 4.8, d: 4 },
  { name: 'mercado', c: [11.5, -1.5], rot: -Math.PI / 2, w: 4, d: 3.2 },
  { name: 'casa_leste', c: [6.5, 12], rot: Math.PI + 0.3, w: 4, d: 3.2 },
  { name: 'casa_oeste', c: [-13.5, -2.5], rot: Math.PI / 2, w: 3.6, d: 3 },
  { name: 'casa_nordeste', c: [13.5, 7], rot: -Math.PI / 2 - 0.2, w: 3.4, d: 3 },
  { name: 'casa_sul', c: [-3, 14], rot: Math.PI, w: 3.8, d: 3 },
  { name: 'kiko', c: [15.6, 15.2], rot: -Math.PI / 2, w: 3.2, d: 2.6 },
];

/** How deep inside a house footprint a point is (m, > 0 means inside). */
function depthInside(h: (typeof HOUSES)[number], x: number, z: number) {
  const dx = x - h.c[0];
  const dz = z - h.c[1];
  // inverse of three.js rotation.y: world = (lx·cos + lz·sin, −lx·sin + lz·cos)
  const cos = Math.cos(h.rot);
  const sin = Math.sin(h.rot);
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;
  return Math.min(h.w / 2 - Math.abs(lx), h.d / 2 - Math.abs(lz));
}

export async function walls(only?: string[]) {
  const out: { house: string; side: number; maxDepth: number; stuck: boolean }[] = [];
  for (const h of HOUSES.filter((x) => !only || only.includes(x.name))) {
    for (let k = 0; k < 4; k++) {
      const a = h.rot + (k * Math.PI) / 2;
      const r = Math.max(h.w, h.d) / 2 + 2.2;
      await place(h.c[0] + Math.sin(a) * r, h.c[1] + Math.cos(a) * r);
      let maxDepth = -Infinity;
      for (let i = 0; i < 6; i++) {
        await steer(h.c[0], h.c[1], 15, { run: true });
        maxDepth = Math.max(maxDepth, depthInside(h, playerPosition.x, playerPosition.z));
      }
      // can it walk away again?
      const before = playerPosition.clone();
      await steer(h.c[0] + Math.sin(a) * (r + 3), h.c[1] + Math.cos(a) * (r + 3), 60);
      out.push({ house: h.name, side: k, maxDepth: +maxDepth.toFixed(2), stuck: playerPosition.distanceTo(before) < 0.5 });
    }
  }
  return out;
}

/** Across the bridge (it spans z = 23 along x = 0) and along both rails. */
export async function bridge() {
  const res: Record<string, unknown> = {};
  await place(0, 19.5);
  res.cross = await steer(0, 26.5, 220, { stopAt: 0.4 });
  await place(0, 19.5);
  res.crossRun = await steer(0, 26.5, 160, { stopAt: 0.4, run: true });
  // hug the rails: aim at points beside the deck, the cat must stay dry and on the bridge
  for (const side of [-1, 1]) {
    await place(0, 20.2);
    const r = await steer(side * 1.9, 25.8, 200, { stopAt: 0.4 });
    res[`rail${side}`] = { ...r, splashed: playerPosition.z < 21 && false };
  }
  return res;
}

/** Walk next to walls and check whether the camera sees the cat (ray camera → cat hits nothing solid). */
export async function camera() {
  const ray = new THREE.Raycaster();
  const results: { spot: string; blockedFrames: number; frames: number }[] = [];
  const spots: { spot: string; from: [number, number]; to: [number, number] }[] = [
    { spot: 'atrás da cantina', from: [-12.5, -10.5], to: [-6, -11.8] },
    { spot: 'beco mercado', from: [9.5, -6], to: [13.8, -5] },
    { spot: 'entre casas oeste', from: [-11, 1], to: [-15.5, -6] },
  ];
  for (const s of spots) {
    await place(s.from[0], s.from[1]);
    cameraAngle.theta = Math.atan2(s.from[0] - s.to[0], s.from[1] - s.to[1]);
    let blocked = 0;
    let frames = 0;
    for (let i = 0; i < 8; i++) {
      await steer(s.to[0], s.to[1], 10);
      const cam = r3f().camera.position;
      const target = playerPosition.clone().add(new THREE.Vector3(0, 0.4, 0));
      ray.set(cam, target.clone().sub(cam).normalize());
      ray.far = cam.distanceTo(target) - 0.6;
      const hits = ray.intersectObjects(r3f().scene.children, true).filter((h) => {
        const m = h.object as THREE.Mesh;
        const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.Material | undefined;
        return m.visible && mat && !mat.transparent && !mat.userData?.wind && m.type !== 'Points' && !(m as unknown as { isInstancedMesh?: boolean }).isInstancedMesh;
      });
      frames++;
      if (hits.length) blocked++;
    }
    results.push({ ...s, blockedFrames: blocked, frames } as never);
  }
  return results;
}

/** Low frame rate: one huge delta (tab was in the background) must not tunnel through the ground. */
export async function lowFps() {
  await place(0, 4);
  const y0 = playerPosition.y;
  clock += 1500; // a 1.5 s hitch
  r3f().advance(clock / 1000);
  await adv(30);
  return { before: +y0.toFixed(2), after: +playerPosition.y.toFixed(2), grounded: playerGround.grounded };
}

/**
 * Is this ground free? Counts solid colliders touching a box (w × d m, 0.15–1.35 m above the
 * ground, rotated rotY) — the ground itself and trigger sensors are not counted.
 */
export function space(cx: number, cz: number, w: number, d: number, rotY = 0) {
  type RapierNs = { Cuboid: new (x: number, y: number, z: number) => unknown };
  type World = { intersectionsWithShape: (pos: object, rot: object, shape: unknown, cb: (c: { isSensor: () => boolean; parent: () => unknown }) => boolean) => void };
  const { world, rapier } = (window as unknown as { __rapier: { world: World; rapier: RapierNs } }).__rapier;
  const shape = new rapier.Cuboid(w / 2, 0.6, d / 2);
  const q = { x: 0, y: Math.sin(rotY / 2), z: 0, w: Math.cos(rotY / 2) };
  let hits = 0;
  world.intersectionsWithShape({ x: cx, y: 0.75, z: cz }, q, shape, (c) => {
    if (!c.isSensor() && c.parent() !== playerBody.current) hits++;
    return true;
  });
  return hits;
}

/** Scans a grid around (cx, cz) for spots where a w × d box touches nothing. */
export function findSpace(cx: number, cz: number, w: number, d: number, radius = 6, step = 0.5) {
  const free: { x: number; z: number; dist: number }[] = [];
  for (let x = cx - radius; x <= cx + radius; x += step) {
    for (let z = cz - radius; z <= cz + radius; z += step) {
      if (space(x, z, w, d) === 0) free.push({ x: +x.toFixed(2), z: +z.toFixed(2), dist: +Math.hypot(x - cx, z - cz).toFixed(2) });
    }
  }
  return free.sort((a, b) => a.dist - b.dist).slice(0, 8);
}

export const qa = { adv, place, steer, drive, input, walls, bridge, camera, lowFps, space, findSpace, store: useGameStore };
(window as unknown as Record<string, unknown>).__qa = qa;
