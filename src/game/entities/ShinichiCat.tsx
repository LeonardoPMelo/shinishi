import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { getGradient, windTime } from '../materials';
import { buildCharacterMaterials as buildMaterials, inkMaterial, OUTLINED, mergeRigidParts } from './characterMaterials';
import { measureGait, gaitFor, stretchStride } from './gait';
import { useGameStore } from '../../store/gameStore';
import { useEffectiveQuality } from '../../store/uiSettings';
import { ITEMS } from '../../data/items';
import { onGameEvent, type GameEvent } from '../../systems/events';
import { asset } from '../../assetPath';

/**
 * Shinichi as a rigged quadruped cat (GLB built by tools/blender/build_shinichi.py).
 *
 * Contract with the asset (an artist's model can replace it if it keeps these names):
 *  - clips: idle, walk, run, jump, fall, land, sit, meow, crouch, attack, victory
 *  - bones: head, earL/earR, tail1..tail5, ribbonL1..3, ribbonR1..3 (three.js strips the dots)
 *  - morph targets: lidL/lidR {blink, angry, sad, happy, sleepy}, mouth {smile, open, oh, frown, angry}
 *  - pupilL/pupilR are scaled for dilation
 *  - materials: fur, eye, pupil, gloss, mouth, cloth, metal, leather, pad
 */

/** Physics state the controller shares with the model every frame. */
export interface AnimState {
  speed: number;
  airborne: boolean;
  /** 0..1, set to 1 on landing and decays. */
  squash: number;
  /** Vertical speed. */
  vy: number;
  /** Sneaking low (C / Ctrl). */
  crouch?: boolean;
}

const URL = asset('assets/characters/shinichi.glb');
/** Bump when prepare() changes, so a hot reload does not reuse a scene prepared the old way. */
// 4: rigid parts fused per bone and material (Etapa 1)
// 5: measured gait, additive crouch (Etapa 5); 6: the additive crouch on a cloned clip
const RIG_VERSION = 6;
const SCALE = 1.25;
const FEET_Y = -0.66;
/** Fur shells: count per quality and strand length (model units). */
const FUR_SHELLS = { alta: 10, media: 5, baixa: 0 } as const;
const FUR_LENGTH = 0.014;

type LidKey = 'blink' | 'angry' | 'sad' | 'happy' | 'sleepy';
type MouthKey = 'smile' | 'open' | 'oh' | 'frown' | 'angry';

export type Emotion =
  | 'neutral' | 'joy' | 'curious' | 'surprise' | 'shy' | 'frustrated' | 'focus'
  | 'fear' | 'proud' | 'excited' | 'angry' | 'sad' | 'funny' | 'sleepy';

interface Expression {
  lids: Partial<Record<LidKey, number>>;
  mouth: Partial<Record<MouthKey, number>>;
  /** only the right eye uses `lids` (a wink); the left stays open */
  wink?: boolean;
  pupil: number; // pupil size multiplier
  ears: number; // + perked forward, - flattened back
  tilt: number; // head tilt (rad)
  tail: number; // + raised, - tucked
}

/** The face sheet (reference 13): Feliz, Surpreso, Bravo, Triste, Curioso, Engraçado... */
const EXPRESSIONS: Record<Emotion, Expression> = {
  neutral: { lids: {}, mouth: {}, pupil: 1, ears: 0, tilt: 0, tail: 0 },
  joy: { lids: { happy: 1 }, mouth: { open: 1 }, pupil: 1.1, ears: 0.15, tilt: 0.1, tail: 0.3 },
  curious: { lids: {}, mouth: { smile: 0.45 }, pupil: 1.25, ears: 0.35, tilt: 0.28, tail: 0.15 },
  surprise: { lids: {}, mouth: { oh: 1 }, pupil: 0.62, ears: 0.45, tilt: 0, tail: 0.4 },
  shy: { lids: { sad: 0.45 }, mouth: { smile: 0.35 }, pupil: 1.15, ears: -0.5, tilt: -0.18, tail: -0.35 },
  frustrated: { lids: { angry: 0.55 }, mouth: { frown: 1 }, pupil: 0.85, ears: -0.35, tilt: 0, tail: -0.15 },
  focus: { lids: { angry: 0.35 }, mouth: {}, pupil: 0.8, ears: 0.3, tilt: 0, tail: 0 },
  fear: { lids: { sad: 0.4 }, mouth: { oh: 0.55 }, pupil: 1.5, ears: -0.75, tilt: 0, tail: -0.6 },
  proud: { lids: { happy: 0.65 }, mouth: { smile: 1 }, pupil: 1, ears: 0.2, tilt: -0.1, tail: 0.5 },
  excited: { lids: {}, mouth: { open: 1 }, pupil: 1.4, ears: 0.4, tilt: 0.1, tail: 0.45 },
  angry: { lids: { angry: 1 }, mouth: { angry: 1 }, pupil: 0.75, ears: -0.4, tilt: 0, tail: 0.1 },
  sad: { lids: { sad: 1 }, mouth: { frown: 1 }, pupil: 1.2, ears: -0.6, tilt: -0.12, tail: -0.45 },
  funny: { lids: { happy: 1 }, wink: true, mouth: { smile: 1 }, pupil: 1.05, ears: 0.2, tilt: 0.15, tail: 0.3 },
  sleepy: { lids: { sleepy: 1 }, mouth: {}, pupil: 0.9, ears: -0.2, tilt: 0.08, tail: -0.1 },
};

/** Which feeling a game event shows on Shinichi's face, and for how long. */
function emotionFor(e: GameEvent): [Emotion, number] | null {
  switch (e.type) {
    case 'coins':
    case 'item':
      return ['joy', 1.4];
    case 'challenge':
      return e.result === 'correct' ? ['proud', 2.4] : ['frustrated', 1.8];
    case 'missionStart':
      return ['excited', 2];
    case 'missionComplete':
    case 'levelUp':
      return ['joy', 3];
    case 'secret':
      return ['surprise', 1.2];
    case 'dialogueOpen':
      return ['curious', 1.6];
    case 'sfx':
      return e.name === 'splash' ? ['surprise', 1.5] : null;
    default:
      return null;
  }
}

// ── Materials ────────────────────────────────────────────────────────────────
function furShellMaterial(level: number) {
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: getGradient() });
  const rimSrc = { level };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uShell = { value: rimSrc.level };
    shader.uniforms.uFurLen = { value: FUR_LENGTH };
    shader.uniforms.uWind = windTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uShell;\nuniform float uFurLen;\nuniform float uWind;\nvarying vec3 vFurPos;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vFurPos = position;
         float h = uShell * uFurLen;
         vec3 comb = vec3(0.0, -0.55, -0.35) + vec3(sin(uWind * 2.0 + position.x * 30.0) * 0.08, 0.0, 0.0);
         transformed += normal * h + comb * h * uShell;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uShell;\nvarying vec3 vFurPos;\nfloat furHash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }')
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
         vec3 cell = vFurPos * 260.0;
         vec3 id = floor(cell);
         float r = furHash(id);
         float d = length(fract(cell) - 0.5);
         float radius = 0.48 * (1.0 - uShell * 0.85) * (0.55 + 0.45 * r);
         if (d > radius || r < uShell * 0.55) discard;`
      )
      .replace(
        '#include <opaque_fragment>',
        `outgoingLight *= mix(0.72, 1.06, uShell);
         #include <opaque_fragment>`
      );
  };
  m.customProgramCacheKey = () => 'shinichi-fur';
  return m;
}

type Morphs = { mesh: THREE.Mesh; index: Record<string, number> };

export function ShinichiCat({ anim }: { anim: MutableRefObject<AnimState> }) {
  const gltf = useGLTF(URL);
  const quality = useEffectiveQuality();
  const worn = useGameStore((s) => Object.keys(s.progress.flags).find((f) => f.startsWith('veste_') && s.progress.flags[f]));
  const bandColor = (worn && ITEMS[worn.replace('veste_', '')]?.band) || null;

  const rig = useMemo(() => {
    const root = gltf.scene;
    // useGLTF caches the scene: prepare it once even if this component remounts (HMR, StrictMode).
    if (root.userData.rig && root.userData.rigVersion === RIG_VERSION) return root.userData.rig as ReturnType<typeof prepare>;
    if (root.userData.rig && import.meta.env.DEV) {
      // The cached scene was prepared by an older version of this file (hot reload): start clean.
      window.location.reload();
    }
    const prepared = prepare(root);
    root.userData.rig = prepared;
    root.userData.rigVersion = RIG_VERSION;
    return prepared;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf]);

  function prepare(root: THREE.Group) {
    // the pupils are scaled one by one (they dilate), so they keep their own nodes
    mergeRigidParts(root, (n) => n.startsWith('pupil'));
    const mats = buildMaterials();
    const furLift = FUR_LENGTH * 0.6;
    const ink = { skinned: inkMaterial(0.008 + furLift), rigid: inkMaterial(0.008) };
    let body: THREE.SkinnedMesh | null = null;
    const meshes: THREE.Mesh[] = [];
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
    });
    for (const mesh of meshes) {
      const name = (mesh.material as THREE.Material).name;
      const morphing = !!mesh.morphTargetDictionary && Object.keys(mesh.morphTargetDictionary).length > 0;
      mesh.material = morphing && name === 'fur' ? mats.lid : mats[name] ?? mats.fur;
      mesh.castShadow = !['eye', 'gloss', 'pupil', 'mouth'].includes(name) && !morphing;
      mesh.frustumCulled = false;
      if ((mesh as THREE.SkinnedMesh).isSkinnedMesh && mesh.name === 'body') body = mesh as THREE.SkinnedMesh;
      if (!OUTLINED.has(name) || morphing) continue;
      let line: THREE.Mesh;
      if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
        const sk = mesh as THREE.SkinnedMesh;
        const s = new THREE.SkinnedMesh(sk.geometry, mesh.name === 'body' ? ink.skinned : ink.rigid);
        s.bind(sk.skeleton, sk.bindMatrix);
        line = s;
      } else {
        line = new THREE.Mesh(mesh.geometry, ink.rigid);
      }
      line.frustumCulled = false;
      line.position.copy(mesh.position);
      line.quaternion.copy(mesh.quaternion);
      line.scale.copy(mesh.scale);
      (mesh.parent ?? root).add(line);
    }

    // Fur shells on the body (count follows the quality setting).
    const shells: THREE.SkinnedMesh[] = [];
    const maxShells = FUR_SHELLS.alta;
    if (body) {
      const b = body as THREE.SkinnedMesh;
      for (let i = 1; i <= maxShells; i++) {
        const shell = new THREE.SkinnedMesh(b.geometry, furShellMaterial(i / maxShells));
        shell.bind(b.skeleton, b.bindMatrix);
        shell.frustumCulled = false;
        shell.renderOrder = i;
        shell.position.copy(b.position);
        shell.quaternion.copy(b.quaternion);
        shell.scale.copy(b.scale);
        (b.parent ?? root).add(shell);
        shells.push(shell);
      }
    }

    const node = (n: string) => root.getObjectByName(n) as THREE.Object3D;
    const morphs = (n: string): Morphs => {
      const o = node(n);
      const mesh = ((o as THREE.Mesh).isMesh ? o : o.children.find((c) => (c as THREE.Mesh).isMesh)) as THREE.Mesh;
      return { mesh, index: mesh.morphTargetDictionary ?? {} };
    };
    // Gait (Etapa 5): the clips' real ground speeds, measured from the planted paws (the hand-set strides
    // were 16–30% off), and the swing bones' rest pose, from which a stride is stretched.
    const clip = (n: string) => gltf.animations.find((c) => c.name === n)!;
    const PAWS = ['footL', 'footR', 'pawL', 'pawR'];
    const swing = ['thighL', 'thighR', 'upperarmL', 'upperarmR'].map((n) => root.getObjectByName(n)).filter(Boolean).map((bone) => ({ bone: bone!, rest: bone!.quaternion.clone() }));
    const natural = { walk: measureGait(root, clip('walk'), PAWS, swing, SCALE), run: measureGait(root, clip('run'), PAWS, swing, SCALE) };
    // Crouch is a pose layered on top (additive): sneaking plays the whole walk under it, so the paws
    // really step (the crouch clip on its own barely moves its feet: the cat glided along while sneaking).
    // On a clone: the GLB's clips share keyframe arrays (identical accessors are stored once), and making the
    // shared crouch tracks additive in place zeroed the idle's scale tracks too (the cat shrank to a point).
    const crouchAdditive = THREE.AnimationUtils.makeClipAdditive(clip('crouch').clone(), 0, clip('idle'));
    const mixer = new THREE.AnimationMixer(root);
    const actions = Object.fromEntries(gltf.animations.map((c) => [c.name, mixer.clipAction(c === clip('crouch') ? crouchAdditive : c)])) as Record<string, THREE.AnimationAction>;
    actions.crouch.blendMode = THREE.AdditiveAnimationBlendMode;
    for (const n of ['jump', 'land', 'meow', 'attack']) {
      actions[n].setLoop(THREE.LoopOnce, 1);
      actions[n].clampWhenFinished = true;
    }
    for (const n of ['idle', 'walk', 'run', 'fall', 'sit', 'crouch']) {
      actions[n].play();
      actions[n].setEffectiveWeight(n === 'idle' ? 1 : 0);
    }
    const face = {
      lids: [morphs('lidL'), morphs('lidR')],
      mouth: morphs('mouth'),
      pupils: [node('pupilL'), node('pupilR')],
      ears: [node('earL'), node('earR')],
      head: node('head'),
      tail: [1, 2, 3, 4, 5].map((i) => node(`tail${i}`)),
      ribbons: ['L', 'R'].map((S) => [1, 2, 3].map((k) => node(`ribbon${S}${k}`))),
    };
    // Bones that get procedural offsets on top of the clips (head tilt, ears, tail, ribbons).
    // Clips that do not key them (sit, victory...) would let the offsets pile up every frame,
    // so they go back to their rest pose before the mixer runs.
    const procBones = [face.head, ...face.ears, ...face.tail, ...face.ribbons.flat()].filter(Boolean) as THREE.Object3D[];
    const rest = { pupil: face.pupils.map((p) => p.scale.clone()), bones: procBones.map((b) => [b, b.quaternion.clone()] as const) };
    return { root, mats, shells, mixer, actions, face, rest, natural, swing };
  }

  // Fur shells visible according to quality.
  useEffect(() => {
    const n = FUR_SHELLS[quality];
    rig.shells.forEach((s, i) => {
      // with fewer shells, keep an even spread across the strand length
      const step = n > 0 ? Math.round(rig.shells.length / n) : Infinity;
      s.visible = n > 0 && (i + 1) % step === 0;
    });
  }, [quality, rig]);

  // Band color from the worn sash item.
  useEffect(() => {
    const cloth = rig.mats.cloth as THREE.MeshToonMaterial;
    cloth.vertexColors = !bandColor;
    cloth.color.set(bandColor ?? '#ffffff');
    cloth.needsUpdate = true;
  }, [bandColor, rig]);

  const st = useRef({
    weights: { idle: 1, walk: 0, run: 0, fall: 0, sit: 0, crouch: 0 } as Record<string, number>,
    wasAirborne: false,
    lastSquash: 0,
    oneShot: null as null | { name: string; until: number; weight: number },
    still: 0,
    /** Stride stretch in use, and how much the paws still slide (dev readout, Etapa 5). */
    stretch: 1,
    slide: 0,
    t: 0,
    blinkIn: 2,
    blink: 0,
    emotion: 'neutral' as Emotion,
    emotionUntil: 0,
    lidW: [{} as Record<string, number>, {} as Record<string, number>],
    mouthW: {} as Record<string, number>,
    pupil: 1,
    ears: 0,
    tilt: 0,
    tail: 0,
    earTwitch: { side: 0, time: 0 },
    nextTwitch: 3,
    ribbonLift: 0,
    /** Dev portraits: a locomotion loop held at full weight (see __shinichi.pose). */
    forceLoop: null as string | null,
  });

  function feel(e: Emotion, seconds: number) {
    st.current.emotion = e;
    st.current.emotionUntil = st.current.t + seconds;
  }

  function playOnce(name: string, duration: number, fade = 0.12, weight = 1) {
    const a = rig.actions[name];
    if (!a) return;
    a.reset();
    a.setEffectiveWeight(weight);
    a.fadeIn(fade).play();
    st.current.oneShot = { name, until: st.current.t + duration, weight };
  }

  // Feelings and gestures from game events.
  useEffect(
    () =>
      onGameEvent((e) => {
        if (e.type === 'sfx' && e.name === 'player_meow') {
          playOnce('meow', 0.8, 0.12, 0.85);
          feel('joy', 0.8);
          return;
        }
        if (e.type === 'sfx' && e.name === 'shuriken') playOnce('attack', 0.55, 0.06);
        if (e.type === 'sfx' && e.name === 'dash') feel('focus', 0.6);
        if (e.type === 'ability') feel('excited', 2);
        if (e.type === 'missionComplete' || e.type === 'levelUp') playOnce('victory', 2.2, 0.2);
        const r = emotionFor(e);
        if (r) feel(r[0], r[1]);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rig]
  );

  // Dev handle for testing expressions and clips from the console.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).__shinichi = {
      feel: (e: Emotion, seconds = 3) => feel(e, seconds),
      play: (name: string, seconds = 1.2) => playOnce(name, seconds),
      /** Holds a clip at `time` seconds with a feeling, for portraits (?studio). */
      pose: (name: string, time: number, emotion?: Emotion) => {
        const loop = name in st.current.weights;
        st.current.forceLoop = loop ? name : null;
        // drop whatever one-shot an earlier pose left behind
        for (const [n, act] of Object.entries(rig.actions)) if (!(n in st.current.weights)) act.stop();
        if (loop) {
          st.current.oneShot = null;
          for (const n of Object.keys(st.current.weights)) st.current.weights[n] = n === name ? 1 : 0;
        } else playOnce(name, 1e6, 0);
        rig.actions[name].time = time;
        rig.actions[name].paused = true;
        if (emotion) feel(emotion, 1e6);
      },
      /** 0 freezes every clip (the face keeps updating), 1 is normal speed. */
      timeScale: (k: number) => { rig.mixer.timeScale = k; },
      emotions: Object.keys(EXPRESSIONS),
      /** Gait readout (Etapa 5): what the paws are doing right now. */
      gait: () => ({
        speed: +anim.current.speed.toFixed(2),
        walk: { gait: rig.natural.walk, timeScale: +rig.actions.walk.timeScale.toFixed(2), weight: +st.current.weights.walk.toFixed(2) },
        run: { gait: rig.natural.run, timeScale: +rig.actions.run.timeScale.toFixed(2), weight: +st.current.weights.run.toFixed(2) },
        crouch: +st.current.weights.crouch.toFixed(2),
        stretch: +st.current.stretch.toFixed(2),
        slide: +st.current.slide.toFixed(3),
      }),
    };
  });

  useFrame((_s, raw) => {
    const dt = Math.min(raw, 0.05);
    const s = st.current;
    const a = anim.current;
    s.t += dt;
    const { actions, face, rest } = rig;

    // ── Locomotion state from physics ─────────────────────────────────────────
    const landed = a.squash > 0.5 && s.lastSquash < 0.5 && !a.airborne;
    s.lastSquash = a.squash;
    if (a.airborne && !s.wasAirborne && a.vy > 1) playOnce('jump', 0.45, 0.08);
    if (landed && s.wasAirborne) playOnce('land', 0.33, 0.05);
    s.wasAirborne = a.airborne;

    s.still = a.speed < 0.3 && !a.airborne ? s.still + dt : 0;
    const target: Record<string, number> = { idle: 0, walk: 0, run: 0, fall: 0, sit: 0, crouch: 0 };
    if (s.forceLoop) target[s.forceLoop] = 1;
    else if (a.airborne) target.fall = 1;
    else if (a.crouch) {
      // the crouch pose layered (additive) over a full walk, or over the idle when standing still
      const moving = THREE.MathUtils.smoothstep(a.speed, 0.15, 0.6);
      target.crouch = 1;
      target.walk = moving;
      target.idle = 1 - moving;
    }
    else if (a.speed < 0.3) target[s.still > 9 ? 'sit' : 'idle'] = 1;
    else {
      // the walk is a slow stroll (~0.33 m/s per cycle): the trot/run takes over early
      const k = THREE.MathUtils.smoothstep(a.speed, 0.8, 1.6);
      target.walk = 1 - k;
      target.run = k;
    }
    const blend = 1 - Math.exp(-dt * (a.airborne ? 14 : 9));
    for (const n of Object.keys(target)) s.weights[n] += (target[n] - s.weights[n]) * blend;

    // One-shots sit on top of the loops while they play.
    let over = 0;
    if (s.oneShot) {
      if (s.t > s.oneShot.until || (s.oneShot.name === 'victory' && (a.speed > 1 || a.airborne))) {
        actions[s.oneShot.name].fadeOut(0.18);
        s.oneShot = null;
      } else over = s.oneShot.weight;
    }
    for (const n of Object.keys(s.weights)) actions[n].setEffectiveWeight(s.weights[n] * (1 - over));
    // Paws locked to the ground (Etapa 5): each clip plays at speed / its measured natural speed; when that
    // would cycle the legs too fast, the stride lengthens instead (up to 35%). Was a clamp around
    // hand-set strides: the paws skated at top speed and while sneaking.
    const moving = a.speed > 0.05;
    // sneaking is fast for the slow stroll clip: a quicker cadence and a longer reach
    const walkGait = gaitFor(a.speed, rig.natural.walk, a.crouch ? 4.4 : 3.2, a.crouch ? 1.5 : 1.35);
    const runGait = gaitFor(a.speed, rig.natural.run, 3.6, 1.35);
    if (moving) {
      actions.walk.timeScale = walkGait.timeScale;
      actions.run.timeScale = runGait.timeScale;
    }
    const stretchGoal = moving ? 1 + (walkGait.stretch - 1) * s.weights.walk + (runGait.stretch - 1) * s.weights.run : 1;
    s.stretch += (stretchGoal - s.stretch) * blend;
    s.slide = moving ? walkGait.slide * s.weights.walk + runGait.slide * s.weights.run : 0;
    for (const [bone, q] of rest.bones) bone.quaternion.copy(q);
    rig.mixer.update(dt);
    stretchStride(rig.swing, s.stretch);

    // ── Face (morph targets) ──────────────────────────────────────────────────
    // idle long enough (already sitting, purring) and the eyes start to droop
    if (s.t > s.emotionUntil) s.emotion = a.airborne && a.vy < -6 ? 'surprise' : s.still > 24 ? 'sleepy' : 'neutral';
    const goal = EXPRESSIONS[s.emotion];
    const ek = 1 - Math.exp(-dt * 12);

    s.blinkIn -= dt;
    if (s.blinkIn <= 0) {
      s.blink = 0.16;
      s.blinkIn = Math.random() < 0.2 ? 0.35 : 2.4 + Math.random() * 3;
    }
    s.blink = Math.max(0, s.blink - dt);
    const blinkK = s.blink > 0 ? Math.sin((s.blink / 0.16) * Math.PI) : 0;

    face.lids.forEach((lid, i) => {
      const w = s.lidW[i];
      // i = 0 is the left eye; a wink closes only the right one
      const keys = goal.wink && i === 0 ? {} : goal.lids;
      for (const k of ['blink', 'angry', 'sad', 'happy', 'sleepy'] as LidKey[]) {
        const want = k === 'blink' ? Math.max(keys.blink ?? 0, blinkK) : keys[k] ?? 0;
        w[k] = (w[k] ?? 0) + (want - (w[k] ?? 0)) * (k === 'blink' ? 1 : ek);
        const idx = lid.index[k];
        if (idx !== undefined && lid.mesh.morphTargetInfluences) lid.mesh.morphTargetInfluences[idx] = w[k];
      }
    });
    const meowOpen = s.oneShot?.name === 'meow' ? Math.sin(Math.min(1, (s.oneShot.until - s.t) / 0.8) * Math.PI) : 0;
    for (const k of ['smile', 'open', 'oh', 'frown', 'angry'] as MouthKey[]) {
      const want = k === 'open' ? Math.max(goal.mouth.open ?? 0, meowOpen) : goal.mouth[k] ?? 0;
      s.mouthW[k] = (s.mouthW[k] ?? 0) + (want - (s.mouthW[k] ?? 0)) * ek;
      const idx = face.mouth.index[k];
      if (idx !== undefined && face.mouth.mesh.morphTargetInfluences) face.mouth.mesh.morphTargetInfluences[idx] = s.mouthW[k];
    }
    s.pupil += (goal.pupil - s.pupil) * ek;
    s.ears += (goal.ears - s.ears) * ek;
    s.tilt += (goal.tilt - s.tilt) * ek;
    s.tail += (goal.tail - s.tail) * ek;
    face.pupils.forEach((p, i) => {
      p.scale.copy(rest.pupil[i]);
      p.scale.x *= s.pupil;
      p.scale.y *= 0.85 + s.pupil * 0.15;
    });

    // ears: feeling + occasional twitch + flattened in the air
    s.nextTwitch -= dt;
    if (s.nextTwitch <= 0) {
      s.earTwitch = { side: Math.random() < 0.5 ? 0 : 1, time: 0.25 };
      s.nextTwitch = 3 + Math.random() * 5;
    }
    s.earTwitch.time = Math.max(0, s.earTwitch.time - dt);
    face.ears.forEach((ear, i) => {
      const flick = i === s.earTwitch.side && s.earTwitch.time > 0 ? Math.sin(s.earTwitch.time * 40) * 0.3 : 0;
      const back = a.airborne ? -0.3 : 0;
      ear.rotateX(-(s.ears + back) * 0.6 + flick);
      ear.rotateZ((i === 0 ? 1 : -1) * Math.min(0, s.ears) * 0.5);
    });
    face.head.rotateZ(s.tilt);
    face.tail.forEach((b, i) => b.rotateX(-s.tail * 0.18 * (i + 1) * 0.5));

    // headband tails stream back with speed and flutter
    const liftGoal = THREE.MathUtils.clamp(a.speed / 8, 0, 1) + (a.airborne ? 0.35 : 0);
    s.ribbonLift += (liftGoal - s.ribbonLift) * (1 - Math.exp(-dt * 5));
    face.ribbons.forEach((chain, sideIdx) =>
      chain.forEach((bone, k) => {
        if (!bone) return;
        const flutter = Math.sin(s.t * (6 + s.ribbonLift * 10) + k * 0.9 + sideIdx * 1.7) * (0.08 + 0.22 * s.ribbonLift) * (k + 1) * 0.5;
        bone.rotateX(-s.ribbonLift * (k === 0 ? 0.9 : 0.25) + flutter);
      })
    );
  });

  return (
    // Shifted back a little so the body (nose to rump) is centered in the round collider.
    <group position={[0, FEET_Y, -0.11]} scale={SCALE}>
      <primitive object={rig.root} />
    </group>
  );
}

useGLTF.preload(URL);
