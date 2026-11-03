import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { enhanceToon, getGradient } from '../materials';

/** Materials shared by every rigged character GLB (Shinichi and the villagers). */

export function toon(opts: THREE.MeshToonMaterialParameters = {}) {
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: getGradient(), ...opts });
  enhanceToon(m, false);
  return m;
}

export function inkMaterial(thickness: number) {
  const m = new THREE.MeshBasicMaterial({ color: '#22182c', side: THREE.BackSide });
  m.onBeforeCompile = (shader) => {
    // Inverted hull pushed along the (skinned) normal: an ink line that follows the rig.
    shader.vertexShader = shader.vertexShader.replace(
      '#include <skinning_vertex>',
      `#include <skinning_vertex>
       #ifdef USE_SKINNING
         transformed += normalize(objectNormal) * ${thickness.toFixed(4)};
       #else
         transformed += normalize(normal) * ${thickness.toFixed(4)};
       #endif`
    );
  };
  m.customProgramCacheKey = () => `shinichi-ink-${thickness}`;
  return m;
}

/**
 * One fur shell: the body pushed out along its normal (before skinning, so it follows the rig),
 * combed back and down, with strands cut out by a 3D cell noise in bind-pose space.
 * Inner shells are darker (fake self-shadowing at the roots); strands thin toward the tips.
 */
export function buildCharacterMaterials() {
  return {
    fur: toon(),
    lid: toon({ side: THREE.DoubleSide }),
    cloth: toon({ side: THREE.DoubleSide }),
    leather: toon(),
    metal: toon(),
    pad: toon(),
    wood: toon(),
    glass: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 }),
    eye: new THREE.MeshBasicMaterial({ vertexColors: true }),
    pupil: new THREE.MeshBasicMaterial({ color: '#0b0910' }),
    gloss: new THREE.MeshBasicMaterial({ vertexColors: true }),
    mouth: new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  } as Record<string, THREE.Material>;
}

/**
 * One material set shared by every villager (Etapa 1): all of them take their colors from the vertices,
 * so 22 identical sets only meant more state changes between draws.
 */
let villagerSet: Record<string, THREE.Material> | null = null;
export function sharedCharacterMaterials() {
  return (villagerSet ??= buildCharacterMaterials());
}

const inkCache = new Map<string, THREE.Material>();
function sharedInk(kind: 'skinned' | 'rigid', thickness: number) {
  const key = `${kind}|${thickness}`;
  let m = inkCache.get(key);
  if (!m) {
    m = inkMaterial(thickness);
    inkCache.set(key, m);
  }
  return m;
}

/** Parts that get an ink outline (small details and morphing face parts stay clean). */
export const OUTLINED = new Set(['fur', 'cloth', 'leather']);


/** Swaps a loaded character's materials (by name) for the game's toon set and adds ink outlines (returned, so callers can drop them at a distance). */
export function applyCharacterMaterials(root: THREE.Object3D, mats: Record<string, THREE.Material>, inkThickness = 0.008): THREE.Mesh[] {
  const lines: THREE.Mesh[] = [];
  const ink = { skinned: sharedInk('skinned', inkThickness), rigid: sharedInk('rigid', inkThickness) };
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  for (const mesh of meshes) {
    const name = (mesh.material as THREE.Material).name;
    const morphing = !!mesh.morphTargetDictionary && Object.keys(mesh.morphTargetDictionary).length > 0;
    mesh.material = morphing && name === 'fur' ? mats.lid : mats[name] ?? mats.fur;
    // only the big shapes cast shadows: small parts (eyes, whiskers, buttons) cost a shadow pass each for nothing
    if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
    const big = (mesh.geometry.boundingSphere?.radius ?? 0) * Math.max(mesh.scale.x, mesh.scale.y, mesh.scale.z) > 0.1;
    mesh.castShadow = big && !['eye', 'gloss', 'pupil', 'mouth', 'glass'].includes(name) && !morphing;
    mesh.frustumCulled = false;
    if (!OUTLINED.has(name) || morphing) continue;
    let line: THREE.Mesh;
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
      const sk = mesh as THREE.SkinnedMesh;
      const s = new THREE.SkinnedMesh(sk.geometry, ink.skinned);
      s.bind(sk.skeleton, sk.bindMatrix);
      // the hull shares a geometry whose arrays may be dropped after upload (foldCharacter): never let three
      // recompute the skinned bounds from them
      if (sk.boundingSphere) s.boundingSphere = sk.boundingSphere.clone();
      line = s;
    } else {
      line = new THREE.Mesh(mesh.geometry, ink.rigid);
    }
    line.frustumCulled = false;
    line.position.copy(mesh.position);
    line.quaternion.copy(mesh.quaternion);
    line.scale.copy(mesh.scale);
    (mesh.parent ?? root).add(line);
    lines.push(line);
  }
  return lines;
}

function dropArray(this: THREE.BufferAttribute) {
  (this as unknown as { array: ArrayLike<number> | null }).array = null;
}

type LodPair = { mesh: THREE.Mesh; full: THREE.BufferGeometry; low: THREE.BufferGeometry };

const close = (a: THREE.Matrix4, b: THREE.Matrix4) => a.elements.every((v, k) => Math.abs(v - b.elements[k]) < 1e-4);

/** A geometry's attributes as plain floats (the GLBs are quantized), with white vertex colors when it has none. */
function widened(src: THREE.BufferGeometry) {
  const g = new THREE.BufferGeometry();
  const n = src.attributes.position.count;
  for (const name of ['position', 'normal', 'color', 'skinIndex', 'skinWeight'] as const) {
    const a = src.getAttribute(name);
    if (!a) continue;
    const size = name === 'color' ? 3 : a.itemSize;
    const f = new Float32Array(n * size);
    for (let i = 0; i < n; i++) {
      f[i * size] = a.getX(i);
      if (size > 1) f[i * size + 1] = a.getY(i);
      if (size > 2) f[i * size + 2] = a.getZ(i);
      if (size > 3) f[i * size + 3] = a.getW(i);
    }
    g.setAttribute(name, new THREE.BufferAttribute(f, size));
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  g.setIndex(src.index ? Array.from(src.index.array as ArrayLike<number>) : [...Array(n).keys()]);
  return g;
}

/**
 * Folds a villager into one skinned mesh per material (Etapa 1b): the body, robe and sleeves, plus every
 * rigid part (ears, hat, hand props, eyes) re-expressed as skinned to the bone that carries it. A villager
 * was ~20 draw calls (each part, its ink hull, its shadow); now it is one per material plus the morphing
 * face parts, which stay separate. Run before the materials and ink hulls are applied, on the rest pose.
 * The light LOD survives: each merged mesh gets a full and a light geometry (the light one uses the
 * simplified copy of the parts that have one). Returns the new LOD pairs. `keepApart`: meshes left as they are
 * (Shinichi's furred body and his dilating pupils).
 */
export function foldCharacter(root: THREE.Object3D, lod: LodPair[], keepApart: (m: THREE.Mesh) => boolean = () => false): LodPair[] {
  root.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  const target = meshes.find((m) => (m as THREE.SkinnedMesh).isSkinnedMesh) as THREE.SkinnedMesh | undefined;
  if (!target) return lod;
  const skel = target.skeleton;
  const boneIndex = new Map(skel.bones.map((b, i) => [b.uuid, i]));
  const lowOf = new Map(lod.map((p) => [p.mesh, p.low]));
  const tmp = new THREE.Matrix4();

  /** Geometry of `m` (full or light) in the target's bind space, skinned to the target skeleton; null if it can't be. */
  const express = (m: THREE.Mesh, geo: THREE.BufferGeometry): THREE.BufferGeometry | null => {
    const g = widened(geo);
    const sk = m as THREE.SkinnedMesh;
    if (sk.isSkinnedMesh) {
      // the same skin up to the dequantize transform folded into each mesh's inverse bind matrices
      if (!close(sk.bindMatrix, target.bindMatrix) || !close(sk.matrixWorld, target.matrixWorld)) return null;
      const map = sk.skeleton.bones.map((b) => boneIndex.get(b.uuid) ?? -1);
      if (map.some((k) => k < 0)) return null;
      const x = skel.boneInverses[map[0]].clone().invert().multiply(sk.skeleton.boneInverses[0]);
      if (!sk.skeleton.boneInverses.every((bi, k) => close(tmp.multiplyMatrices(skel.boneInverses[map[k]], x), bi))) return null;
      g.applyMatrix4(x);
      const si = g.attributes.skinIndex as THREE.BufferAttribute;
      for (let i = 0; i < si.array.length; i++) (si.array as Float32Array)[i] = map[si.array[i]];
      return g;
    }
    // rigid part: skinned with full weight to the nearest bone above it
    let bone = m.parent;
    while (bone && !boneIndex.has(bone.uuid)) bone = bone.parent;
    if (!bone) return null;
    const b = boneIndex.get(bone.uuid)!;
    // world = targetWorld · bindInv · boneWorld · boneInverse · bind · v  must equal  partWorld · p
    const skin = target.matrixWorld.clone().multiply(target.bindMatrixInverse).multiply(bone.matrixWorld).multiply(skel.boneInverses[b]).multiply(target.bindMatrix);
    g.applyMatrix4(skin.invert().multiply(m.matrixWorld));
    const n = g.attributes.position.count;
    const si = new Float32Array(n * 4);
    const sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      si[i * 4] = b;
      sw[i * 4] = 1;
    }
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    return g;
  };

  const groups = new Map<string, THREE.Mesh[]>();
  for (const m of meshes) {
    if (Array.isArray(m.material) || Object.keys(m.geometry.morphAttributes).length || keepApart(m)) continue;
    const key = (m.material as THREE.Material).name;
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  const pairs: LodPair[] = [];
  for (const [name, list] of groups) {
    const full: THREE.BufferGeometry[] = [];
    const low: THREE.BufferGeometry[] = [];
    let ok = true;
    for (const m of list) {
      const f = express(m, m.geometry);
      const l = lowOf.has(m) ? express(m, lowOf.get(m)!) : f;
      if (!f || !l) {
        ok = false;
        break;
      }
      full.push(f);
      low.push(l);
    }
    if (!ok || list.length < 2) {
      // left as it was (keeps its own LOD pair, if any)
      for (const m of list) if (lowOf.has(m)) pairs.push({ mesh: m, full: m.geometry, low: lowOf.get(m)! });
      continue;
    }
    const mergedFull = mergeGeometries(full, false);
    const hasLow = list.some((m) => lowOf.has(m));
    const mergedLow = hasLow ? mergeGeometries(low, false) : null;
    if (!mergedFull || (hasLow && !mergedLow)) {
      for (const m of list) if (lowOf.has(m)) pairs.push({ mesh: m, full: m.geometry, low: lowOf.get(m)! });
      continue;
    }
    // bounds first (the ink and shadow setup reads them), then the CPU copies go once on the GPU: the
    // widened float arrays of 22 villagers × (full + light) were ~150 MB of JS heap
    for (const g of [mergedFull, mergedLow]) {
      if (!g) continue;
      g.computeBoundingSphere();
      for (const a of Object.values(g.attributes)) (a as THREE.BufferAttribute).onUpload(dropArray);
      g.index?.onUpload(dropArray);
    }
    const mesh = new THREE.SkinnedMesh(mergedFull, list[0].material);
    // bounds now, from the arrays that are about to be dropped (three sorts skinned meshes by these, and
    // clones copy them); a little margin for the poses
    mesh.boundingSphere = mergedFull.boundingSphere!.clone();
    mesh.boundingSphere.radius *= 1.3;
    mesh.name = `${name}_unido`;
    mesh.position.copy(target.position);
    mesh.quaternion.copy(target.quaternion);
    mesh.scale.copy(target.scale);
    (target.parent ?? root).add(mesh);
    mesh.updateMatrixWorld(true);
    mesh.bind(skel, target.bindMatrix);
    for (const m of list) m.removeFromParent();
    if (mergedLow) pairs.push({ mesh, full: mergedFull, low: mergedLow });
  }
  return pairs;
}
