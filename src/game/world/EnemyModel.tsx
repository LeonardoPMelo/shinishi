import { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { assetUrl, type AssetName } from '../assets/catalog';
import { applyCharacterMaterials, buildCharacterMaterials } from '../entities/characterMaterials';
import type { EnemyKind } from '../../systems/combat';

/**
 * A creature of the wild lands from its Blender model (tools/blender/build_enemies.py): one skinned mesh on a
 * small rig (body, head, four legs, tail) with the clips idle, walk, run, windup, attack, stunned and sleep.
 * Enemies.tsx still owns where it is and what it does; this hands it the mixer and the materials, which are
 * the creature's own (the hit flash and the windup glow light one creature, not every fox).
 */

export const ENEMY_CLIPS = ['idle', 'walk', 'run', 'windup', 'attack', 'stunned', 'sleep'] as const;
export type EnemyClip = (typeof ENEMY_CLIPS)[number];

export interface EnemyRig {
  mixer: THREE.AnimationMixer;
  actions: Partial<Record<EnemyClip, THREE.AnimationAction>>;
  /** The materials that take the flash and the glow (the toon ones). */
  lit: THREE.MeshToonMaterial[];
  /** Every material (the spirit fades all of them). */
  all: THREE.Material[];
  clip: EnemyClip | null;
}

export const enemyAsset = (kind: EnemyKind) => `enemy_${kind}` as AssetName;

/** Which clip a creature in this state plays (moving: how fast it really went this frame, m/s). */
export function clipFor(mode: string, moving: number, walk: number, run: number): EnemyClip {
  if (mode === 'sleep' || mode === 'calm') return 'sleep';
  if (mode === 'stunned' || mode === 'defeated') return 'stunned';
  if (mode === 'windup') return 'windup';
  if (mode === 'attack') return 'attack';
  if (moving > 0.15) return moving > (Math.max(walk, 0.5) + run) / 2 ? 'run' : 'walk';
  return 'idle';
}

export function EnemyModel({ kind, onReady }: { kind: EnemyKind; onReady: (rig: EnemyRig) => void }) {
  const gltf = useGLTF(assetUrl(enemyAsset(kind)));
  const built = useMemo(() => {
    const root = cloneSkinned(gltf.scene) as THREE.Group;
    const mats = buildCharacterMaterials();
    const ink = applyCharacterMaterials(root, mats, kind === 'javali' || kind === 'chefe' ? 0.012 : 0.009);
    const spirit = kind === 'espirito';
    if (spirit) {
      // a drop of mist: no ink line, everything see-through (the faro makes it solid; Enemies sets the opacity)
      ink.forEach((l) => l.removeFromParent());
      for (const m of Object.values(mats)) {
        m.transparent = true;
        m.depthWrite = false;
      }
    }
    root.traverse((o) => {
      const sk = o as THREE.SkinnedMesh;
      if (!sk.isSkinnedMesh) return;
      if (!sk.geometry.boundingSphere) sk.geometry.computeBoundingSphere();
      // the bind pose's bounds with room for the poses (a lunge, lying down): culled like any mesh, and never
      // recomputed from the vertex arrays
      sk.boundingSphere = sk.geometry.boundingSphere!.clone();
      sk.boundingSphere.radius *= 1.5;
      sk.frustumCulled = true;
    });
    const mixer = new THREE.AnimationMixer(root);
    const actions: EnemyRig['actions'] = {};
    for (const c of gltf.animations) {
      if (!(ENEMY_CLIPS as readonly string[]).includes(c.name)) continue;
      const a = mixer.clipAction(c);
      actions[c.name as EnemyClip] = a;
    }
    const lit = Object.values(mats).filter((m): m is THREE.MeshToonMaterial => (m as THREE.MeshToonMaterial).isMeshToonMaterial);
    const rig: EnemyRig = { mixer, actions, lit, all: Object.values(mats), clip: null };
    return { root, rig, mats };
  }, [gltf, kind]);

  useEffect(() => {
    onReady(built.rig);
    return () => {
      built.rig.mixer.stopAllAction();
      for (const m of Object.values(built.mats)) m.dispose();
    };
  }, [built, onReady]);

  return <primitive object={built.root} />;
}

/** Fades to `clip` (attack starts over each time; the others keep their place). */
export function playClip(rig: EnemyRig, clip: EnemyClip, timeScale = 1) {
  const next = rig.actions[clip];
  if (!next) return;
  next.timeScale = timeScale;
  if (rig.clip === clip) return;
  const prev = rig.clip ? rig.actions[rig.clip] : undefined;
  next.reset().setEffectiveWeight(1).play();
  if (prev) prev.crossFadeTo(next, clip === 'attack' || clip === 'windup' ? 0.1 : 0.2, false);
  rig.clip = clip;
}
