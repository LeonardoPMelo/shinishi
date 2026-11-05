import { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { assetFileExists, assetUrl, type AssetName } from '../assets/catalog';
import { applyCharacterMaterials, buildCharacterMaterials } from '../entities/characterMaterials';

/**
 * The deer from their Blender models (tools/blender/build_fauna.py): a sika stag with branching antlers, a doe
 * and a spotted fawn, each one skinned mesh on a rig with two bones a leg, a neck and a head, and the clips
 * idle, graze, walk, run and alert. The herds (AncientGrove's clearing, WildFauna's meadow) own where each deer
 * is and what it does; this hands them the mixer.
 */

export const DEER_CLIPS = ['idle', 'graze', 'walk', 'run', 'alert'] as const;
export type DeerClip = (typeof DEER_CLIPS)[number];
export type DeerKind = 'cervo' | 'cerva' | 'filhote';

/** A deer stands well over the cat (the old ones were barely its height). */
export const DEER_SIZE = 1.12;

export interface DeerRig {
  mixer: THREE.AnimationMixer;
  actions: Partial<Record<DeerClip, THREE.AnimationAction>>;
  clip: DeerClip | null;
}

export const deerAsset = (kind: DeerKind) => `fauna_${kind}` as AssetName;
export const deerModelsReady = () => (['cervo', 'cerva', 'filhote'] as DeerKind[]).every((k) => assetFileExists(deerAsset(k)));

/** Which deer a herd member is: the fawns are the small ones, the stag the one that carries antlers. */
export function deerKind(scale: number, stag: boolean): DeerKind {
  if (scale < 0.75) return 'filhote';
  return stag ? 'cervo' : 'cerva';
}

/**
 * The clip for a wild deer (systems/wildlife.ts's mode): running off, walking, or at its spot, where it grazes
 * with now and then a look round, and lifts its head and stamps when the cat is getting close.
 */
export function deerClipFor(mode: string, catDist: number, reach: number, t: number, phase: number): DeerClip {
  if (mode === 'flee') return 'run';
  if (mode === 'walk' || mode === 'return') return 'walk';
  if (catDist < reach * 1.6) return 'alert';
  return (t * 0.12 + phase) % 1 < 0.72 ? 'graze' : 'idle';
}

export function DeerModel({ kind, onReady }: { kind: DeerKind; onReady: (rig: DeerRig) => void }) {
  const gltf = useGLTF(assetUrl(deerAsset(kind)));
  const built = useMemo(() => {
    const root = cloneSkinned(gltf.scene) as THREE.Group;
    const mats = buildCharacterMaterials();
    applyCharacterMaterials(root, mats, 0.008);
    root.traverse((o) => {
      const sk = o as THREE.SkinnedMesh;
      if (!sk.isSkinnedMesh) return;
      if (!sk.geometry.boundingSphere) sk.geometry.computeBoundingSphere();
      // the bind pose's bounds with room for the poses (head down, a leap): culled like any mesh
      sk.boundingSphere = sk.geometry.boundingSphere!.clone();
      sk.boundingSphere.radius *= 1.4;
      sk.frustumCulled = true;
    });
    const mixer = new THREE.AnimationMixer(root);
    const actions: DeerRig['actions'] = {};
    for (const c of gltf.animations) {
      if ((DEER_CLIPS as readonly string[]).includes(c.name)) actions[c.name as DeerClip] = mixer.clipAction(c);
    }
    return { root, rig: { mixer, actions, clip: null } as DeerRig, mats };
  }, [gltf]);

  useEffect(() => {
    onReady(built.rig);
    return () => {
      built.rig.mixer.stopAllAction();
      for (const m of Object.values(built.mats)) m.dispose();
    };
  }, [built, onReady]);

  return <primitive object={built.root} />;
}

/** Fades to `clip` over a moment (a startled deer snaps to running). `offset`: where a fresh loop starts. */
export function playDeerClip(rig: DeerRig, clip: DeerClip, timeScale = 1, offset = 0) {
  const next = rig.actions[clip];
  if (!next) return;
  next.timeScale = timeScale;
  if (rig.clip === clip) return;
  const prev = rig.clip ? rig.actions[rig.clip] : undefined;
  next.reset().setEffectiveWeight(1).play();
  next.time = offset * next.getClip().duration;
  if (prev) prev.crossFadeTo(next, clip === 'run' ? 0.12 : clip === 'graze' || rig.clip === 'graze' ? 0.45 : 0.3, false);
  rig.clip = clip;
}
