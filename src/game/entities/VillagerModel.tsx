import { useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { assetUrl, type AssetName } from '../assets/catalog';
import { detailFactor } from '../../store/uiSettings';
import { applyCharacterMaterials, sharedCharacterMaterials, foldCharacter } from './characterMaterials';
import { measureGait, gaitFor, stretchStride, type Gait } from './gait';

/** Each cast model's walk gait (natural speed in model units/s, stride gain), measured once. */
const WALK_GAIT = new Map<string, Gait>();

/**
 * A villager from the cast GLBs (tools/blender/build_villager.py).
 * Contract: clips idle, walk, talk, wave, cheer; morphs lidL/lidR {blink, happy, ...}, mouth {smile, open, oh, ...}.
 * The NPC component owns position, facing and behaviour, and writes the mood each frame.
 */

/** Which NPC (by id) is drawn with which cast model. Roles were redistributed in stage 5. */
export const VILLAGER_ASSETS: Record<string, AssetName> = {
  chef_tofu: 'hana',
  kenzo: 'boku',
  mei: 'luna',
  mei_floresta: 'luna',
  lotus: 'mestre_lotus',
  kiko: 'kiko',
  sora: 'sora',
  taro: 'taro',
  // Prompt Mestre (P2): the rest of the village and the new faces
  mestre_kuma: 'mestre_kuma',
  roku: 'roku',
  neko: 'neko',
  tanuki: 'tanuki',
  kuro: 'kuro',
  kuro_mirante: 'kuro',
  kuro_praca: 'kuro',
  mochi: 'mochi',
  bigodes: 'bigodes',
  pipo: 'pipo',
  liria: 'liria',
  kaito: 'kaito',
  tsubaki: 'tsubaki',
  // Bairro das Glicínias (§25)
  fuji: 'fuji',
  // Bambuzal e Bosque Antigo (§26)
  goro: 'goro',
  hinoki: 'hinoki',
  // Cantina por dentro (Etapa 4 da expansão)
  mimi: 'mimi',
  // Academia e Sede de Mikage (Etapa 5 da expansão)
  mikage: 'mikage',
  sumi: 'sumi',
  haru: 'haru',
  toshi: 'toshi',
  yuki: 'yuki',
  fumi: 'fumi',
  // Terras Selvagens (Etapa 7 da expansão): Yuki leads the camp in her own model
  yuki_campo: 'yuki',
  bento: 'bento',
  bento_arvore: 'bento',
  momo: 'momo',
  // O Pacto das Duas Margens (Etapa 8 da expansão)
  hissui: 'general_hissui',
  hissui_sede: 'general_hissui',
  hissui_aliado: 'general_hissui',
};

/**
 * Per-model touches that the GLB can't carry: a bigger head for the kitten (kid proportions, scales the
 * head bone and everything on it) and eyelids that rest half closed (sleepy Neko, smiling Vovó Mochi).
 * Resting lids open while the villager talks or cheers.
 */
export const VILLAGER_STYLE: Partial<Record<AssetName, { head?: number; restLid?: { shape: 'sleepy' | 'happy'; amount: number } }>> = {
  pipo: { head: 1.22 },
  neko: { restLid: { shape: 'sleepy', amount: 0.75 } },
  mochi: { restLid: { shape: 'happy', amount: 0.8 } },
};

export interface VillagerMood {
  walking: boolean;
  /** Dialogue with this villager is open. */
  talking: boolean;
  /** Shinichi is close and the villager is free: wave hello. */
  greeting: boolean;
  /** 0..1 while hopping (reacting to a meow). */
  cheer: number;
  walkSpeed: number;
  /** Where the head looks, relative to the body (radians): + yaw turns left, + pitch looks up. */
  lookYaw: number;
  lookPitch: number;
}

const CLIP_NAMES = ['idle', 'walk', 'talk', 'wave', 'cheer'] as const;
type ClipName = (typeof CLIP_NAMES)[number];

function morphs(root: THREE.Object3D, name: string) {
  const o = root.getObjectByName(name);
  const mesh = (o && ((o as THREE.Mesh).isMesh ? o : o.children.find((c) => (c as THREE.Mesh).isMesh))) as THREE.Mesh | undefined;
  return { mesh, index: mesh?.morphTargetDictionary ?? {} };
}

/** Lighter copy of each cast GLB (tools/blender: simplify 25%), drawn past LOD_FAR. */
const lodUrl = (name: AssetName) => assetUrl(name).replace('/characters/', '/characters/lod/');
/**
 * Past this distance a villager swaps to the light geometry. The full meshes keep the painted
 * collar, obi and markings crisp up close (the simplified ones smear vertex colors), but drawing
 * every villager in full cost ~750k triangles and ~6 ms of GPU in the plaza.
 */
// 7 m (was 11): the villagers' skinning was ~8 ms of an integrated GPU in the plaza (Etapa 1)
const LOD_FAR = 7;

const near = (x: THREE.Matrix4, y: THREE.Matrix4) => x.elements.every((v, k) => Math.abs(v - y.elements[k]) < 1e-4);

/**
 * meshopt quantization folds a dequantize transform into the node matrix (rigid meshes) or into the
 * skin's inverse bind matrices (skinned ones), sized to each mesh's bounds. The simplified copy has
 * slightly different bounds, so its positions live in a slightly different space: returns the matrix
 * that maps the light mesh into the full mesh's space, or null when the two can't be matched.
 */
function lowToFull(full: THREE.Mesh, low: THREE.Mesh) {
  const sf = (full as THREE.SkinnedMesh).skeleton;
  const sl = (low as THREE.SkinnedMesh).skeleton;
  if (!sf !== !sl) return null;
  if (!sf || !sl) return full.matrix.clone().invert().multiply(low.matrix);
  if (sf.boneInverses.length !== sl.boneInverses.length || !near((full as THREE.SkinnedMesh).bindMatrix, (low as THREE.SkinnedMesh).bindMatrix)) return null;
  const m = sf.boneInverses[0].clone().invert().multiply(sl.boneInverses[0]);
  const check = new THREE.Matrix4();
  // the same dequantize transform has to explain every bone, or the skins don't match
  return sf.boneInverses.every((bi, k) => near(check.multiplyMatrices(bi, m), sl.boneInverses[k])) ? m : null;
}

/** The light geometry moved into the full mesh's space (positions widened to floats first). */
function inFullSpace(g: THREE.BufferGeometry, m: THREE.Matrix4) {
  if (near(m, new THREE.Matrix4())) return g;
  const out = g.clone();
  for (const key of ['position', 'normal'] as const) {
    const src = out.getAttribute(key);
    if (!src) continue;
    const f = new Float32Array(src.count * 3);
    for (let i = 0; i < src.count; i++) f.set([src.getX(i), src.getY(i), src.getZ(i)], i * 3);
    out.setAttribute(key, new THREE.BufferAttribute(f, 3));
  }
  out.applyMatrix4(m);
  return out;
}

/** Pairs each mesh of the full rig with the same mesh in the light copy (same names, same skin). */
function lodPairs(root: THREE.Object3D, low: THREE.Object3D) {
  const meshes = (r: THREE.Object3D) => {
    const out: THREE.Mesh[] = [];
    r.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh);
    });
    return out;
  };
  const a = meshes(root);
  const b = meshes(low);
  if (a.length !== b.length) return [];
  const pairs: { mesh: THREE.Mesh; full: THREE.BufferGeometry; low: THREE.BufferGeometry }[] = [];
  a.forEach((m, i) => {
    const g = b[i].geometry;
    // morphing face parts (lids, mouth) are tiny: keep them whole
    const morphing = Object.keys(m.geometry.morphAttributes).length > 0 || Object.keys(g.morphAttributes).length > 0;
    const fewer = (g.index?.count ?? 0) < (m.geometry.index?.count ?? 0) * 0.8;
    // the robe stays whole: simplifying it merges vertices across the painted seams (collar, obi, apron)
    // and smears the colours into blotches. Checked in the studio in Etapa 1: inflating the light robe
    // did not help, so the cause is the colour smear and not the body poking through.
    const space = m.name === b[i].name && m.name !== 'robe' && !morphing && fewer ? lowToFull(m, b[i]) : null;
    if (space) pairs.push({ mesh: m, full: m.geometry, low: inFullSpace(g, space) });
  });
  return pairs;
}

export function VillagerModel({ name, mood, scale = 1.3 }: { name: AssetName; mood: MutableRefObject<VillagerMood>; scale?: number }) {
  const gltf = useGLTF(assetUrl(name));
  const lowGltf = useGLTF(lodUrl(name));
  const rig = useMemo(() => {
    const root = cloneSkinned(gltf.scene) as THREE.Group;
    // pair before the ink hulls are added (they share the full geometry and switch off where the LOD swap starts)
    // then fold everything into one skinned mesh per material (fewer draw calls; Etapa 1b), keeping a full
    // and a light geometry for each merged mesh
    const lod = foldCharacter(root, lodPairs(root, lowGltf.scene));
    const ink = applyCharacterMaterials(root, sharedCharacterMaterials());
    // three sorts skinned meshes by a bounding sphere it computes from the vertex arrays the first time the
    // mesh is drawn; the merged arrays are dropped after upload (foldCharacter), so give every skinned mesh
    // (and its ink hull, which shares the geometry and first shows up near the camera) its sphere now
    root.traverse((o) => {
      const sk = o as THREE.SkinnedMesh;
      if (!sk.isSkinnedMesh) return;
      if (!sk.geometry.boundingSphere) sk.geometry.computeBoundingSphere();
      sk.boundingSphere = sk.geometry.boundingSphere!.clone();
    });
    // meshes that cast a real shadow up close (far away the NPC's ground blob is enough)
    const casters: THREE.Mesh[] = [];
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o.castShadow) casters.push(o as THREE.Mesh);
    });
    // the walk clip's own ground speed (model units/s), measured once per cast model (Etapa 5); and the
    // thighs' rest pose, from which the stride is stretched when the clip alone would cycle too fast
    const walkClip = gltf.animations.find((c) => c.name === 'walk');
    const thighs = ['thighL', 'thighR'].map((n) => root.getObjectByName(n)).filter(Boolean).map((bone) => ({ bone: bone!, rest: bone!.quaternion.clone() }));
    let walkGait = WALK_GAIT.get(name);
    if (!walkGait && walkClip) {
      walkGait = measureGait(root, walkClip, ['footL', 'footR'], thighs);
      WALK_GAIT.set(name, walkGait);
    }
    const mixer = new THREE.AnimationMixer(root);
    const actions = {} as Record<ClipName, THREE.AnimationAction>;
    for (const n of CLIP_NAMES) {
      const clip = gltf.animations.find((c) => c.name === n);
      if (!clip) continue;
      actions[n] = mixer.clipAction(clip);
      actions[n].play();
      actions[n].setEffectiveWeight(n === 'idle' ? 1 : 0);
    }
    // start each villager at a different point of its loops so a crowd never moves in sync
    mixer.update(Math.random() * 3);
    // head and neck get a look-at offset on top of the clips; they go back to rest before
    // each mixer update so the offset never piles up on clips that don't key them
    const look = ['neck', 'head'].map((n) => root.getObjectByName(n)).filter(Boolean) as THREE.Object3D[];
    const headBone = root.getObjectByName('head');
    const headScale = VILLAGER_STYLE[name]?.head ?? 1;
    const lookRest = look.map((b) => b.quaternion.clone());
    return { root, mixer, actions, ink, inkOn: true, lod, lodOn: false, casters, castOn: true, look, lookRest, headBone, headScale, lids: [morphs(root, 'lidL'), morphs(root, 'lidR')], mouth: morphs(root, 'mouth'), walkGait: walkGait ?? { natural: 0, gain: 0 }, thighs, stretch: 1 };
  }, [gltf, lowGltf, name]);
  const restLid = VILLAGER_STYLE[name]?.restLid;

  const camera = useThree((st3) => st3.camera);
  const cull = useMemo(() => ({ frustum: new THREE.Frustum(), m: new THREE.Matrix4(), pos: new THREE.Vector3(), sphere: new THREE.Sphere(new THREE.Vector3(), 2.6), skip: 0, acc: 0, reach: 32 }), []);
  const st = useRef({ weights: { idle: 1, walk: 0, talk: 0, wave: 0, cheer: 0 } as Record<ClipName, number>, blinkIn: 1 + Math.random() * 3, blink: 0, t: 0, smile: 0, yaw: 0, pitch: 0 });

  useFrame((_s, raw) => {
    // Villagers were ~30% of the frame: skip the ones off screen or far away, and animate
    // the mid-distance ones at half rate (the time is accumulated, so loops stay in step).
    rig.root.getWorldPosition(cull.pos);
    const far = cull.pos.distanceTo(camera.position);
    cull.m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    cull.frustum.setFromProjectionMatrix(cull.m);
    cull.sphere.center.copy(cull.pos).y += 0.8;
    // skinned meshes have frustum culling off (bind-pose bounds lie), so cull the whole villager here;
    // the generous sphere keeps a shadow from popping when the villager is just off screen
    // 32 m: past that a villager is a few pixels tall (and was ~20 draw calls + its shadow) (Etapa 1)
    // (shortened further by the auto quality's detail factor on weak GPUs)
    if ((cull.skip & 15) === 0) cull.reach = 32 * detailFactor();
    rig.root.visible = far < cull.reach && cull.frustum.intersectsSphere(cull.sphere);
    cull.acc += Math.min(raw, 0.05);
    if (!rig.root.visible) return;
    // the ink outline doubles the big meshes and is built on the full geometry: it goes off where the
    // light LOD comes in (was 14 m; ~2 ms of GPU in the plaza on an integrated GPU, Etapa 1)
    const inkOn = far < LOD_FAR;
    if (inkOn !== rig.inkOn) {
      rig.inkOn = inkOn;
      for (const l of rig.ink) l.visible = inkOn;
    }
    // a skinned villager in the shadow map is skinned (and drawn) a second time: only the ones near the
    // camera cast a real shadow. Toggling castShadow needs no shader recompile.
    const lodOn = far > LOD_FAR;
    if (lodOn !== rig.lodOn) {
      rig.lodOn = lodOn;
      for (const p of rig.lod) p.mesh.geometry = lodOn ? p.low : p.full;
    }
    // 8 m (was 12): farther villagers keep their ground blob, the real shadow cost ~2 ms in the plaza
    const castOn = far < 8;
    if (castOn !== rig.castOn) {
      rig.castOn = castOn;
      for (const m of rig.casters) m.castShadow = castOn;
    }
    if (far > 16 && (cull.skip = (cull.skip + 1) % 2) === 1) return;
    const dt = Math.min(cull.acc, 0.1);
    cull.acc = 0;
    const s = st.current;
    const m = mood.current;
    s.t += dt;
    const target: Record<ClipName, number> = { idle: 0, walk: 0, talk: 0, wave: 0, cheer: 0 };
    if (m.cheer > 0.05) target.cheer = 1;
    else if (m.talking) target.talk = 1;
    else if (m.walking) target.walk = 1;
    else if (m.greeting) target.wave = 1;
    else target.idle = 1;
    const k = 1 - Math.exp(-dt * 8);
    for (const n of CLIP_NAMES) {
      s.weights[n] += (target[n] - s.weights[n]) * k;
      rig.actions[n]?.setEffectiveWeight(s.weights[n]);
    }
    // Feet locked to the ground (Etapa 5): the walk plays at pace / (its natural speed × this model's
    // scale). The cast's clips are short-legged (~0.55 m/s); past 1.9× the steps would turn into a
    // shuffle, so the stride lengthens instead (up to 35%). Was a clamp around pace / 1.3, which had
    // the body moving at more than twice the speed of the feet.
    // villagers who hurry (Pipo runs at 2.4 m/s on the walk clip) get a quicker cadence and a longer reach
    const hurry = m.walkSpeed > 2;
    const gait = gaitFor(m.walkSpeed, { natural: rig.walkGait.natural * scale, gain: rig.walkGait.gain }, hurry ? 3 : 1.9, hurry ? 1.5 : 1.35);
    if (rig.actions.walk && m.walkSpeed > 0.01) rig.actions.walk.timeScale = gait.timeScale;
    rig.stretch += ((m.walkSpeed > 0.01 ? gait.stretch : 1) - rig.stretch) * k;
    rig.look.forEach((b, i) => b.quaternion.copy(rig.lookRest[i]));
    rig.mixer.update(dt);
    // the stretch only applies to the walk's share of the pose
    stretchStride(rig.thighs, 1 + (rig.stretch - 1) * s.weights.walk);
    if (import.meta.env.DEV) {
      const w = window as unknown as { __vgait?: Record<string, unknown> };
      (w.__vgait ??= {})[name] = { speed: m.walkSpeed, scale, gait: rig.walkGait, timeScale: rig.actions.walk?.timeScale, stretch: rig.stretch, slide: m.walkSpeed > 0.01 ? gait.slide : 0, weight: s.weights.walk };
    }
    if (rig.headBone && rig.headScale !== 1) rig.headBone.scale.setScalar(rig.headScale);

    // head leads, neck follows: 40% of the turn on the neck, 60% on the head
    const lk = 1 - Math.exp(-dt * 6);
    s.yaw += (m.lookYaw - s.yaw) * lk;
    s.pitch += (m.lookPitch - s.pitch) * lk;
    rig.look.forEach((b, i) => {
      const share = rig.look.length === 2 ? (i === 0 ? 0.4 : 0.6) : 1;
      b.rotateY(s.yaw * share);
      b.rotateX(-s.pitch * share);
    });

    // face: blink, smile when greeting or cheering, mouth moves while talking
    s.blinkIn -= dt;
    if (s.blinkIn <= 0) {
      s.blink = 0.15;
      s.blinkIn = 2.2 + Math.random() * 3.5;
    }
    s.blink = Math.max(0, s.blink - dt);
    const blinkK = s.blink > 0 ? Math.sin((s.blink / 0.15) * Math.PI) : 0;
    const happy = m.cheer > 0.05 ? 1 : 0;
    s.smile += ((m.greeting || m.talking || happy ? 1 : 0) - s.smile) * k;
    for (const lid of rig.lids) {
      const inf = lid.mesh?.morphTargetInfluences;
      if (!inf) continue;
      if (lid.index.blink !== undefined) inf[lid.index.blink] = blinkK;
      if (lid.index.happy !== undefined) inf[lid.index.happy] = happy * 0.9;
      if (restLid && lid.index[restLid.shape] !== undefined) {
        // resting lids lift while the villager talks, greets or cheers
        const awake = m.talking || m.greeting || happy ? 0.25 : 1;
        if (restLid.shape !== 'happy' || !happy) inf[lid.index[restLid.shape]] = restLid.amount * awake * (1 - blinkK);
      }
    }
    const mi = rig.mouth.mesh?.morphTargetInfluences;
    if (mi) {
      const talk = m.talking ? Math.max(0, Math.sin(s.t * 11)) * 0.7 : 0;
      if (rig.mouth.index.open !== undefined) mi[rig.mouth.index.open] = Math.max(talk, happy);
      if (rig.mouth.index.smile !== undefined) mi[rig.mouth.index.smile] = s.smile * (1 - Math.max(talk, happy));
    }
  });

  return <primitive object={rig.root} scale={scale} />;
}
