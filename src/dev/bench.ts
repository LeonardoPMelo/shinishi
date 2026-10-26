/**
 * Dev-only performance bench (loaded from main.tsx in development, never in the build).
 * The same fixed camera spots every time, so "before" and "after" numbers are comparable:
 *
 *   await __bench.run()            → table: GPU ms (timer query), triangles, draw calls per spot
 *   await __bench.fps(4000)        → real frame times (needs the Browser pane visible)
 *   __bench.scene()                → meshes, materials, geometries, textures, programs, JS heap
 *
 * Quality is pinned to the full auto rung (level 0) while measuring and restored after.
 */
import { cameraAngle, playerBody } from '../game/systems/playerState';
import { useUiSettings } from '../store/uiSettings';
import type * as THREE from 'three';

type R3F = { gl: THREE.WebGLRenderer; scene: THREE.Scene; advance: (t: number) => void };
const r3f = () => (window as unknown as { __r3f: R3F }).__r3f;

/** Spots: [name, x, z, camera theta]. Village, the three districts outside the fence, the temple. */
export const SPOTS: [string, number, number, number][] = [
  ['praca', 1.5, 6, 0.3],
  ['mercado', 6, -1, 2.2],
  ['rio_ponte', -4, 20.5, 3.1],
  ['floresta', -2, 31, 3.1],
  ['bairro_leste', 27, 4, Math.PI / 2],
  ['bambuzal', -24, 6, -Math.PI / 2],
  ['bosque', -1.2, 43.4, Math.PI],
  ['templo', -6, -24, 0],
];

async function gpuMs(frames = 16) {
  const R = r3f();
  const gl = R.gl.getContext() as WebGL2RenderingContext;
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  if (!ext) return -1;
  const qs: WebGLQuery[] = [];
  for (let i = 0; i < frames; i++) {
    const q = gl.createQuery()!;
    gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
    R.advance(performance.now());
    gl.endQuery(ext.TIME_ELAPSED_EXT);
    qs.push(q);
  }
  gl.finish();
  const v: number[] = [];
  for (const q of qs) {
    // after finish() the results are normally ready; only yield (throttled timers!) if one is not
    for (let k = 0; k < 20 && !gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE); k++) await new Promise((r) => setTimeout(r, 20));
    if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) v.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
    gl.deleteQuery(q);
  }
  v.sort((a, b) => a - b);
  return v.length ? +v[v.length >> 1].toFixed(2) : -1;
}

function drawStats() {
  const R = r3f();
  R.gl.info.autoReset = false;
  R.gl.info.reset();
  R.advance(performance.now());
  const out = { triK: Math.round(R.gl.info.render.triangles / 1000), calls: R.gl.info.render.calls };
  R.gl.info.autoReset = true;
  return out;
}

/**
 * Frames are advanced synchronously: when the app window is not in view the browser throttles timers to
 * 1 s, which made a run with `await` between frames take minutes (qa.adv waits 4 ms per frame).
 */
let clock = performance.now();
function syncAdv(frames: number) {
  for (let i = 0; i < frames; i++) {
    clock += 16;
    r3f().advance(clock / 1000);
  }
}
function placeSync(x: number, z: number) {
  const b = playerBody.current;
  if (!b) throw new Error('jogador ainda não carregou');
  b.setTranslation({ x, y: 0.8, z }, true);
  b.setLinvel({ x: 0, y: 0, z: 0 }, true);
  syncAdv(20);
}

/** Which spot a run is on (for polling a slow run). */
const progress = { spot: '', t: 0 };

async function run(spots = SPOTS) {
  const ui = useUiSettings.getState();
  const prevLevel = ui.autoLevel;
  ui.setAutoLevel(0);
  const rows: Record<string, { gpu: number; triK: number; calls: number }> = {};
  for (const [name, x, z, theta] of spots) {
    progress.spot = name;
    progress.t = Math.round(performance.now());
    placeSync(x, z);
    cameraAngle.theta = theta;
    cameraAngle.phi = 0.38;
    cameraAngle.distance = 7;
    syncAdv(40);
    // best of two medians: the NPCs wander, so a single sample can catch one walking into view
    const gpu = Math.min(await gpuMs(), await gpuMs());
    rows[name] = { gpu, ...drawStats() };
  }
  useUiSettings.getState().setAutoLevel(prevLevel);
  return rows;
}

async function fps(ms = 4000) {
  const dts: number[] = [];
  let last = performance.now();
  const t0 = last;
  await new Promise<void>((res) => {
    const f = (t: number) => {
      dts.push(t - last);
      last = t;
      if (t - t0 < ms) requestAnimationFrame(f);
      else res();
    };
    requestAnimationFrame(f);
  });
  dts.sort((a, b) => a - b);
  return { fps: Math.round(dts.length / (ms / 1000)), p50: +dts[dts.length >> 1].toFixed(1), p95: +dts[Math.floor(dts.length * 0.95)].toFixed(1) };
}

function scene() {
  const R = r3f();
  let meshes = 0;
  const mats = new Set<string>();
  R.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    meshes++;
    (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => mats.add(x.uuid));
  });
  const perf = performance as Performance & { memory?: { usedJSHeapSize: number } };
  return {
    meshes,
    materials: mats.size,
    geometries: R.gl.info.memory.geometries,
    textures: R.gl.info.memory.textures,
    programs: (R.gl.info as unknown as { programs?: unknown[] }).programs?.length ?? -1,
    heapMB: perf.memory ? Math.round(perf.memory.usedJSHeapSize / 1048576) : -1,
  };
}

/**
 * Starts a full run without blocking the caller (a run takes longer than one devtools call allows):
 * poll `__bench.last` until `done` is true. Only one run at a time; a second start is refused.
 */
const state: { running: boolean; last: unknown } = { running: false, last: null };
function start(spots = SPOTS) {
  if (state.running) return 'já existe uma medição rodando';
  state.running = true;
  state.last = { done: false };
  run(spots)
    .then((rows) => { state.last = { done: true, rows, scene: scene() }; })
    .catch((e) => { state.last = { done: true, error: String(e) }; })
    .finally(() => { state.running = false; });
  return 'iniciado';
}

/**
 * Close-ups for the surfaces stage (Etapa 2): the same framing every time, saved through the dev server to
 * tools/art-staging/<prefix>_<name>.png. [name, x, z, theta, phi, distance]
 */
export const SHOTS: [string, number, number, number, number, number][] = [
  ['terra_trilha', 0.5, 11, 0, 0.3, 4.5],
  ['terra_borda', -6.5, 5.8, 1.2, 0.5, 3.2],
  ['pedras_passagem', 1.4, 6.6, 0.3, 0.6, 3],
  ['praca_media', 1.5, 6, 0.3, 0.38, 7],
  ['rochas_bosque', 12.2, 50.2, 2.6, 0.32, 5],
  ['rochas_lago', 31, 6.6, 0, 0.42, 4.5],
  // Etapa 3: the cat up close (is a character readable in this light?)
  ['gato_perto', 1.5, 6, 2.8, 0.18, 2.6],
];

async function shots(prefix = 'antes', only?: string[]) {
  const R = r3f();
  const ui = useUiSettings.getState();
  const prevLevel = ui.autoLevel;
  ui.setAutoLevel(0);
  const saved: string[] = [];
  for (const [name, x, z, theta, phi, distance] of SHOTS) {
    if (only && !only.includes(name)) continue;
    placeSync(x, z);
    cameraAngle.theta = theta;
    cameraAngle.phi = phi;
    cameraAngle.distance = distance;
    syncAdv(60);
    // read the canvas right after a frame, in the same task (the drawing buffer is not preserved)
    R.advance((clock += 16) / 1000);
    const data = R.gl.domElement.toDataURL('image/png');
    await fetch(`/__studio/save?name=${prefix}_${name}`, { method: 'POST', body: data });
    saved.push(name);
  }
  useUiSettings.getState().setAutoLevel(prevLevel);
  return saved;
}

/** Saves the current view as it is (no camera move), e.g. after framing an animal by hand. */
async function snap(name: string) {
  const R = r3f();
  R.advance((clock += 16) / 1000);
  const data = R.gl.domElement.toDataURL('image/png');
  await fetch(`/__studio/save?name=${name}`, { method: 'POST', body: data });
  return name;
}

(window as unknown as Record<string, unknown>).__bench = {
  run, start, fps, scene, gpuMs, SPOTS, progress, shots, snap,
  get last() { return state.last; },
};
