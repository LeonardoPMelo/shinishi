/**
 * Dev-only tools for the vegetation and composition stage (Etapa 6). Frames are advanced synchronously
 * (a busy wait gives each one a real ~16 ms), so they work with the window visible or hidden.
 *
 *   await __compo.route('antes')   → the walk a child takes, 9 stops, saved to tools/art-staging/<prefix>_rota_<n>.png
 *   __compo.camera()               → tight spots: how often the camera is squeezed against the cat or loses sight of it
 */
import * as THREE from 'three';

type AnyWin = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const w = () => window as unknown as AnyWin;

function frame() {
  const t = performance.now();
  while (performance.now() - t < 16) { /* real time for the frame */ }
  w().__r3f.advance(performance.now() / 1000);
}
const step = (n: number, fn?: (i: number) => void) => {
  for (let i = 0; i < n; i++) {
    frame();
    fn?.(i);
  }
};
function place(x: number, z: number) {
  const b = w().__player.playerBody.current;
  b.setTranslation({ x, y: 0.8, z }, true);
  b.setLinvel({ x: 0, y: 0, z: 0 }, true);
  const inp = w().__qa.input;
  inp.stickX = inp.stickY = 0;
  step(20);
}

/**
 * The route: [name, x, z, heading the cat walks toward (radians, atan2(dx, dz))]. The camera sits behind
 * the cat at the game's default framing (distance 7, pitch 0.42), as a player sees it.
 */
export const ROUTE: [string, number, number, number][] = [
  ['praca', 0.8, 7.5, Math.PI],
  ['mercado', 6, 2, Math.PI * 0.75],
  ['beco_cantina', -12.5, -10.5, Math.PI / 2],
  ['casas_oeste', -11, 1, -Math.PI * 0.8],
  ['ponte', 0.4, 16, 0],
  ['floresta_treino', -6, 31, Math.PI / 2],
  ['bosque', -1.2, 45, 0],
  ['bairro_leste', 24, 4, Math.PI / 2],
  ['bambuzal', -22, 6, -Math.PI / 2],
];

async function route(prefix = 'antes') {
  const R = w().__r3f;
  const cam = w().__cam;
  const saved: string[] = [];
  for (const [name, x, z, heading] of ROUTE) {
    place(x, z);
    // camera behind the cat: its offset direction is opposite to where the cat looks
    cam.theta = heading + Math.PI;
    cam.phi = 0.42;
    cam.distance = 7;
    step(70, () => {
      cam.theta = heading + Math.PI;
    });
    const data = R.gl.domElement.toDataURL('image/png');
    await fetch(`/__studio/save?name=${prefix}_rota_${name}`, { method: 'POST', body: data });
    saved.push(name);
  }
  return saved;
}

/** Narrow spots: between houses, under eaves, along porches. [name, from x, z, to x, z] */
export const TIGHT: [string, number, number, number, number][] = [
  ['atras_cantina', -12.5, -10.5, -6, -11.8],
  ['beco_mercado', 9.5, -6, 13.8, -5],
  ['entre_casas_oeste', -11, 1, -15.5, -6],
  ['varanda_casa_sul', -5.6, 12.2, -0.4, 12.4],
  ['varanda_leste', 4.2, 10.4, 9.4, 13.6],
  ['beco_bairro_leste', 22.5, -2, 22.5, 8],
];

function camera() {
  const R = w().__r3f;
  const P = w().__player.playerPosition as THREE.Vector3;
  const inp = w().__qa.input;
  const cam = w().__cam;
  const { world, rapier } = w().__rapier;
  const body = w().__player.playerBody.current;
  const los = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
  const out: Record<string, unknown> = {};
  let allFrames = 0;
  let allCramped = 0;
  let allBlocked = 0;
  for (const [name, x0, z0, x1, z1] of TIGHT) {
    place(x0, z0);
    cam.theta = Math.atan2(x0 - x1, z0 - z1);
    cam.phi = 0.42;
    cam.distance = 7;
    step(20);
    let frames = 0;
    let cramped = 0;
    let blocked = 0;
    let sum = 0;
    step(110, () => {
      const dx = x1 - P.x;
      const dz = z1 - P.z;
      const d = Math.max(1e-3, Math.hypot(dx, dz));
      const th = cam.theta;
      // walking pace, not running: a child exploring a lane
      inp.stickY = ((dx * -Math.sin(th) + dz * -Math.cos(th)) / d) * 0.7;
      inp.stickX = ((dx * Math.cos(th) + dz * -Math.sin(th)) / d) * 0.7;
      if (d < 0.4) inp.stickX = inp.stickY = 0;
      const c = (R.camera as THREE.Camera).position;
      const pivot = new THREE.Vector3(P.x, P.y + 0.85, P.z);
      const dist = c.distanceTo(pivot);
      sum += dist;
      frames++;
      if (dist < 2.2) cramped++;
      // line of sight to the cat's body, against the physics colliders (the merged scenery drops its
      // CPU arrays after upload, so three's raycaster can't test it)
      const target = new THREE.Vector3(P.x, P.y + 0.4, P.z);
      const toCat = target.clone().sub(c);
      const len = toCat.length();
      los.origin = { x: c.x, y: c.y, z: c.z };
      los.dir = { x: toCat.x / len, y: toCat.y / len, z: toCat.z / len };
      const hit = world.castRay(los, Math.max(0, len - 0.6), true, rapier.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, body);
      const hits = hit ? [hit] : [];
      if (hits.length) blocked++;
    });
    inp.stickX = inp.stickY = 0;
    out[name] = { meanDist: +(sum / frames).toFixed(2), cramped: +(cramped / frames).toFixed(2), blocked: +(blocked / frames).toFixed(2) };
    allFrames += frames;
    allCramped += cramped;
    allBlocked += blocked;
  }
  out.total = { cramped: +(allCramped / allFrames).toFixed(3), blocked: +(allBlocked / allFrames).toFixed(3) };
  return out;
}

(window as unknown as Record<string, unknown>).__compo = { route, camera, ROUTE, TIGHT };
