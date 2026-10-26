/**
 * Dev-only gait measurement (Etapa 5): how fast does each locomotion clip move its planted feet?
 *
 *   await __gait.measure('/assets/characters/shinichi.glb', ['walk', 'run'], ['footL', 'footR', 'pawL', 'pawR'], 1.25)
 *
 * Loads the GLB on its own (the game's characters are untouched), plays one clip at a time at time scale 1
 * and samples the foot bones in model space. A foot is "planted" while it is near its lowest point; while
 * planted it slides backward at the speed the body would have to move for that foot not to skid. That speed
 * (times the model's scale in the game) is the clip's natural ground speed: the clip must play at
 * `speed / natural` for the feet to stay put. Also reports how much the planted foot still moves sideways
 * and up and down (a clip that slides on its own can't be fixed by timing alone).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { stretchStride } from '../game/entities/gait';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

export interface GaitResult {
  clip: string;
  duration: number;
  /** Ground speed (m/s at the given scale) at time scale 1, from the planted feet. */
  natural: number;
  /** Per foot: planted speed (m/s), the share of the cycle it is planted, and its drift across the step. */
  feet: Record<string, { speed: number; planted: number; drift: number }>;
  /** Forward speed of the hips at time scale 1 (non-zero means the clip carries root motion). */
  hips: number;
}

async function measure(url: string, clips: string[], feet: string[], scale = 1, samples = 240, stretch = 1, swing: string[] = []): Promise<GaitResult[]> {
  const gltf = await loader.loadAsync(url);
  const out: GaitResult[] = [];
  for (const name of clips) {
    const clip = gltf.animations.find((c) => c.name === name);
    if (!clip) continue;
    const root = clone(gltf.scene);
    const mixer = new THREE.AnimationMixer(root);
    const action = mixer.clipAction(clip);
    action.play();
    const bones = feet.map((n) => root.getObjectByName(n)).filter(Boolean) as THREE.Object3D[];
    const hips = root.getObjectByName('hips');
    const track: THREE.Vector3[][] = bones.map(() => []);
    const hipTrack: THREE.Vector3[] = [];
    const dt = clip.duration / samples;
    // optional stride stretch, exactly as the game applies it (to check how much stride it really adds)
    const swingBones = swing.map((n) => root.getObjectByName(n)).filter(Boolean).map((bone) => ({ bone: bone!, rest: bone!.quaternion.clone() }));
    for (let i = 0; i <= samples; i++) {
      mixer.setTime(i * dt);
      stretchStride(swingBones, stretch);
      root.updateMatrixWorld(true);
      bones.forEach((b, k) => track[k].push(new THREE.Vector3().setFromMatrixPosition(b.matrixWorld).multiplyScalar(scale)));
      if (hips) hipTrack.push(new THREE.Vector3().setFromMatrixPosition(hips.matrixWorld).multiplyScalar(scale));
    }
    const res: GaitResult = { clip: name, duration: clip.duration, natural: 0, feet: {}, hips: 0 };
    const speeds: number[] = [];
    bones.forEach((b, k) => {
      const ys = track[k].map((p) => p.y);
      const lo = Math.min(...ys);
      const hi = Math.max(...ys);
      // planted: within the lowest 12% of the foot's height range
      const planted = track[k].map((p) => p.y <= lo + (hi - lo) * 0.12);
      let dist = 0;
      let time = 0;
      let drift = 0;
      for (let i = 1; i < track[k].length; i++) {
        if (!planted[i] || !planted[i - 1]) continue;
        const d = track[k][i].clone().sub(track[k][i - 1]);
        dist += Math.hypot(d.x, d.z);
        drift += Math.abs(d.y);
        time += dt;
      }
      const speed = time > 0 ? dist / time : 0;
      speeds.push(speed);
      res.feet[b.name] = { speed: +speed.toFixed(3), planted: +(planted.filter(Boolean).length / planted.length).toFixed(2), drift: +drift.toFixed(3) };
    });
    res.natural = +(speeds.reduce((a, b) => a + b, 0) / Math.max(1, speeds.length)).toFixed(3);
    if (hipTrack.length > 1) {
      const a = hipTrack[0];
      const z = hipTrack[hipTrack.length - 1];
      res.hips = +(Math.hypot(z.x - a.x, z.z - a.z) / clip.duration).toFixed(3);
    }
    out.push(res);
  }
  return out;
}

/**
 * Foot slide in the running game: samples the world position of `feet` under `root` and of `root` itself
 * every frame while `drive` moves the character, then compares how fast the planted feet move with how
 * fast the body moves. 0 = feet locked to the ground, 1 = the body glides on still legs.
 */
export function sampler(root: THREE.Object3D, feet: string[]) {
  const bones = feet.map((n) => root.getObjectByName(n)).filter(Boolean) as THREE.Object3D[];
  const tracks: THREE.Vector3[][] = bones.map(() => []);
  const body: THREE.Vector3[] = [];
  const dts: number[] = [];
  const v = new THREE.Vector3();
  return {
    /** Call once per rendered frame, with the time since the previous one. */
    frame(dt = 0.016) {
      bones.forEach((b, k) => tracks[k].push(v.setFromMatrixPosition(b.matrixWorld).clone()));
      body.push(root.getWorldPosition(new THREE.Vector3()));
      dts.push(dt);
    },
    result() {
      if (body.length < 10) return null;
      const total = dts.slice(1).reduce((a, b) => a + b, 0);
      // path length (patrols turn), not just start-to-end
      let path = 0;
      for (let i = 1; i < body.length; i++) path += Math.hypot(body[i].x - body[i - 1].x, body[i].z - body[i - 1].z);
      const bodySpeed = path / total;
      // contact skate: at each foot's touch-down (a local minimum of its height, within 3 cm of the lowest
      // it gets), its horizontal speed by central difference, against the body's over the same frames
      let ratio = 0;
      let contacts = 0;
      let footSum = 0;
      for (const pts of tracks) {
        const lo = Math.min(...pts.map((p) => p.y));
        for (let i = 1; i < pts.length - 1; i++) {
          if (pts[i].y > lo + 0.03 || pts[i].y > pts[i - 1].y || pts[i].y > pts[i + 1].y) continue;
          const foot = Math.hypot(pts[i + 1].x - pts[i - 1].x, pts[i + 1].z - pts[i - 1].z);
          const move = Math.hypot(body[i + 1].x - body[i - 1].x, body[i + 1].z - body[i - 1].z);
          if (move < 1e-4) continue;
          ratio += foot / move;
          footSum += foot / (dts[i] + dts[i + 1]);
          contacts++;
        }
      }
      const footSpeed = contacts ? footSum / contacts : 0;
      const slide = contacts ? ratio / contacts : 0;
      return { bodySpeed: +bodySpeed.toFixed(2), contactFootSpeed: +footSpeed.toFixed(2), slide: +slide.toFixed(2), contacts };
    },
  };
}

type AnyWin = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * The foot-slide report (Etapa 5): drives the cat in a straight line (walk, run, sneak, slow) and watches
 * the patrolling villagers, with frames advanced synchronously (a busy wait gives each one a real ~16 ms,
 * and nothing from the real render loop can slip in between). Needs the game running.
 * `slide` = planted-foot speed / body speed: 0 = feet locked to the ground, 1 = gliding on still legs.
 */
function report() {
  const w = window as unknown as AnyWin;
  const R = w.__r3f;
  const inp = w.__qa.input;
  const P = w.__player.playerPosition as THREE.Vector3;
  const frame = () => {
    const t = performance.now();
    while (performance.now() - t < 16) { /* real time for the frame */ }
    R.advance(performance.now() / 1000);
  };
  const step = (n: number, fn?: (i: number) => void) => {
    for (let i = 0; i < n; i++) {
      frame();
      fn?.(i);
    }
  };
  const place = (x: number, z: number) => {
    const b = w.__player.playerBody.current;
    b.setTranslation({ x, y: 0.8, z }, true);
    b.setLinvel({ x: 0, y: 0, z: 0 }, true);
    inp.stickX = inp.stickY = 0;
    step(25);
  };
  const roots: THREE.Object3D[] = [];
  (R.scene as THREE.Scene).traverse((o) => {
    if (o.children.some((c) => (c as THREE.SkinnedMesh).isSkinnedMesh)) roots.push(o);
  });
  // one root per villager (two nested objects can both hold its meshes)
  const vills = roots.filter((o) => !o.getObjectByName('ribbonL1') && o.getObjectByName('footL') && !roots.includes(o.parent!));
  const out: [string, unknown][] = [];
  // what the game applies at the end of a straight run: clip time scales, stretch, and the slide left
  const one = (label: string, opts: { run?: boolean; crouch?: boolean; stick?: number }) => {
    place(2, 42);
    inp.run = !!opts.run;
    inp.crouch = !!opts.crouch;
    const tilt = opts.stick ?? 1;
    step(90, () => {
      const dx = 2 - P.x;
      const dz = 62 - P.z;
      const d = Math.max(1e-3, Math.hypot(dx, dz));
      const th = w.__cam.theta;
      inp.stickY = ((dx * -Math.sin(th) + dz * -Math.cos(th)) / d) * tilt;
      inp.stickX = ((dx * Math.cos(th) + dz * -Math.sin(th)) / d) * tilt;
    });
    out.push([label, w.__shinichi.gait()]);
    inp.stickX = inp.stickY = 0;
    inp.run = inp.crouch = false;
  };
  one('gato andar', {});
  one('gato correr', { run: true });
  one('gato agachado', { crouch: true });
  one('gato devagar (stick 0,3)', { stick: 0.3 });
  // villagers walking on screen: watch a few from 6 m away and read their gait
  place(0, 6);
  const p0 = vills.map((v) => v.getWorldPosition(new THREE.Vector3()));
  step(60);
  const walkers = vills.filter((v, i) => v.getWorldPosition(new THREE.Vector3()).distanceTo(p0[i]) > 0.4).slice(0, 3);
  for (const v of walkers) {
    const at = v.getWorldPosition(new THREE.Vector3());
    place(at.x + 6, at.z);
    w.__cam.theta = Math.PI / 2;
    w.__cam.distance = 4;
    w.__vgait = {};
    step(40);
    out.push([`morador ${vills.indexOf(v)}`, Object.entries(w.__vgait).filter(([, g]) => (g as { speed: number }).speed > 0.05)]);
  }
  return out;
}

(window as unknown as Record<string, unknown>).__gait = { measure, sampler, report };
