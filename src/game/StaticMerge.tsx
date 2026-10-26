import { useLayoutEffect, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { addMeshContact } from './groundContact';

/**
 * Performance helper: after mount, bakes every static mesh below it into a few large meshes.
 * Plain-colored materials of the same kind share one vertex-colored material, so a whole area
 * of the village becomes a handful of draw calls. Subtrees with userData.dynamic are skipped.
 */

type AnyMaterial = THREE.Material & {
  color?: THREE.Color;
  emissive?: THREE.Color;
  emissiveIntensity?: number;
  map?: THREE.Texture | null;
  gradientMap?: THREE.Texture | null;
  metalness?: number;
  roughness?: number;
  vertexColors?: boolean;
  uniforms?: Record<string, { value: unknown }>;
};

const sharedMaterials = new Map<string, THREE.Material>();

function isOutline(m: AnyMaterial) {
  return !!m.uniforms?.thickness;
}

/** Can this material's color live in a vertex attribute instead? */
function bakeable(m: AnyMaterial) {
  // textured materials too (Etapa 1b): the shader multiplies map × vertex color, so pieces that share a
  // texture but are tinted differently (31 textures were ~300 merged meshes) fall into one bucket
  if (isOutline(m) || !m.color || m.transparent) return false;
  const glowing = m.emissive && m.emissiveIntensity && m.emissive.getHex() !== 0;
  return !glowing;
}

function bucketKey(m: AnyMaterial): string {
  if (isOutline(m)) {
    const c = m.uniforms!.color?.value as THREE.Color | undefined;
    return `outline|${m.uniforms!.thickness.value}|${c?.getHexString()}|${m.side}`;
  }
  if (bakeable(m)) return `vc|${m.type}|${m.side}|${m.map?.uuid}|${m.userData.worldUV ?? 0}|${m.gradientMap?.uuid}|${m.metalness}|${m.roughness}|${m.userData.wind ? 'wind' : ''}|${m.userData.shader ?? ''}`;
  return [
    m.type, m.color?.getHexString(), m.emissive?.getHexString(), m.emissiveIntensity,
    m.transparent, m.opacity, m.side, m.map?.uuid, m.gradientMap?.uuid, m.depthWrite,
  ].join('|');
}

function sharedVertexColorMaterial(key: string, source: AnyMaterial) {
  let mat = sharedMaterials.get(key);
  if (!mat) {
    const clone = source.clone() as AnyMaterial;
    // Material.clone() does not copy shader hooks (rim light / wind), so carry them over.
    clone.onBeforeCompile = source.onBeforeCompile;
    clone.customProgramCacheKey = source.customProgramCacheKey;
    clone.userData = { ...source.userData };
    clone.color!.set('#ffffff');
    clone.vertexColors = true;
    mat = clone;
    sharedMaterials.set(key, mat);
  }
  return mat;
}

/** Box-projected UVs from world positions so textures tile evenly whatever the mesh size. */
function worldUVs(g: THREE.BufferGeometry, scale: number) {
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    const nz = Math.abs(nor.getZ(i));
    const x = pos.getX(i) / scale;
    const y = pos.getY(i) / scale;
    const z = pos.getZ(i) / scale;
    if (nx >= ny && nx >= nz) uv.setXY(i, z, y);
    else if (ny >= nz) uv.setXY(i, x, z);
    else uv.setXY(i, x, y);
  }
  uv.needsUpdate = true;
}

/**
 * keepVertexColors: the source material multiplies its own vertex colors (e.g. the occlusion baked
 * into foliage puffs), so they are kept and tinted by the material color instead of being replaced.
 */
function normalize(geo: THREE.BufferGeometry, matrix: THREE.Matrix4, color: THREE.Color | null, uvScale = 0, keepVertexColors = false) {
  // keep the index (or make a trivial one): the merged meshes stay indexed, so shared vertices are shaded
  // once instead of once per triangle (up to ~6x fewer vertex-shader runs on spheres, Etapa 1)
  const g = geo.clone();
  if (!g.index) {
    const n = g.attributes.position.count;
    const idx = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    g.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  const own = keepVertexColors ? (g.attributes.color as THREE.BufferAttribute | undefined) : undefined;
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv' && !(own && name === 'color')) g.deleteAttribute(name);
  }
  const count = g.attributes.position.count;
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
  if (color || own) {
    const arr = new Float32Array(count * 3);
    const tint = color ?? new THREE.Color(1, 1, 1);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = tint.r * (own ? own.getX(i) : 1);
      arr[i * 3 + 1] = tint.g * (own ? own.getY(i) : 1);
      arr[i * 3 + 2] = tint.b * (own ? own.getZ(i) : 1);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3));
  }
  g.morphAttributes = {};
  g.clearGroups();
  g.applyMatrix4(matrix);
  if (uvScale > 0) worldUVs(g, uvScale);
  return g;
}

function releaseArray(this: THREE.BufferAttribute) {
  (this as unknown as { array: ArrayLike<number> | null }).array = null;
}

/** Layer seen only by the sun's shadow camera (GameScene enables it there): holds the shadow proxies. */
export const SHADOW_LAYER = 1;

const proxyMaterials = new Map<string, THREE.Material>();
function proxyMaterial(side: THREE.Side, shadowSide: THREE.Side | null) {
  const key = `${side}|${shadowSide}`;
  let m = proxyMaterials.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ side, colorWrite: false });
    m.shadowSide = shadowSide;
    proxyMaterials.set(key, m);
  }
  return m;
}

interface Bucket {
  material: THREE.Material;
  cast: boolean;
  receive: boolean;
  geos: THREE.BufferGeometry[];
}

/**
 * chunk: world-space cell size for splitting big areas (0 = one cell).
 * castAll: treat every mesh as a shadow caster, so small models (characters) end up
 * in fewer buckets instead of being split by their castShadow flags.
 */
export function StaticMerge({ children, chunk = 22, castAll = false }: { children: ReactNode; chunk?: number; castAll?: boolean }) {
  const root = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    const group = root.current;
    if (!group) return;
    group.updateWorldMatrix(true, true);
    const inverse = group.matrixWorld.clone().invert();
    const buckets = new Map<string, Bucket>();
    const removed: { obj: THREE.Object3D; parent: THREE.Object3D }[] = [];
    const center = new THREE.Vector3();

    const visit = (obj: THREE.Object3D) => {
      if (obj !== group && obj.userData?.dynamic) return;
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && !(mesh as THREE.InstancedMesh).isInstancedMesh && !(mesh as THREE.SkinnedMesh).isSkinnedMesh && obj.visible && !Array.isArray(mesh.material)) {
        const material = mesh.material as AnyMaterial;
        center.setFromMatrixPosition(mesh.matrixWorld);
        const cell = chunk > 0 ? `${Math.floor(center.x / chunk)},${Math.floor(center.z / chunk)}` : '0';
        const base = bucketKey(material);
        const cast = (castAll && bakeable(material) && material.type !== 'MeshBasicMaterial') || mesh.castShadow;
        const key = `${base}|${cast}|${mesh.receiveShadow}|${cell}`;
        const vc = bakeable(material);
        let bucket = buckets.get(key);
        if (!bucket) {
          bucket = { material: vc ? sharedVertexColorMaterial(base, material) : material, cast, receive: mesh.receiveShadow, geos: [] };
          buckets.set(key, bucket);
        }
        const keepVC = !!(material as THREE.Material & { vertexColors?: boolean }).vertexColors && !!mesh.geometry.attributes.color;
        bucket.geos.push(normalize(mesh.geometry, inverse.clone().multiply(mesh.matrixWorld), vc ? material.color! : null, (material.userData.worldUV as number) || 0, keepVC));
        if (mesh.parent) removed.push({ obj: mesh, parent: mesh.parent });
        // solid things standing on the ground darken it where they touch (Etapa 3: baked contact, no SSAO)
        if (cast && !material.transparent) addMeshContact(mesh);
      }
      [...obj.children].forEach(visit);
    };
    visit(group);

    const merged: THREE.Mesh[] = [];
    // Shadow proxies (Etapa 1b): the depth pass ignores colors and textures, so every caster of a cell
    // goes into one position-only mesh drawn only by the shadow camera. The shadow pass was one draw per
    // material bucket (~185 in the plaza) for the same depth image.
    const proxies = new Map<string, { side: THREE.Side; shadowSide: THREE.Side | null; geos: THREE.BufferGeometry[] }>();
    for (const [key, b] of buckets) {
      if (!b.cast) continue;
      const cell = key.slice(key.lastIndexOf('|') + 1);
      const pk = `${cell}|${b.material.side}|${b.material.shadowSide}`;
      const p = proxies.get(pk) ?? { side: b.material.side, shadowSide: b.material.shadowSide, geos: [] };
      for (const g of b.geos) {
        const pg = new THREE.BufferGeometry();
        pg.setAttribute('position', g.attributes.position);
        pg.setIndex(g.index);
        p.geos.push(pg);
      }
      proxies.set(pk, p);
    }
    for (const p of proxies.values()) {
      const geo = mergeGeometries(p.geos, false);
      if (!geo) continue;
      geo.computeBoundingSphere();
      for (const attr of Object.values(geo.attributes)) (attr as THREE.BufferAttribute).onUpload(releaseArray);
      geo.index?.onUpload(releaseArray);
      const mesh = new THREE.Mesh(geo, proxyMaterial(p.side, p.shadowSide));
      mesh.layers.set(SHADOW_LAYER);
      mesh.castShadow = true;
      mesh.userData.merged = true;
      mesh.userData.shadowProxy = true;
      merged.push(mesh);
    }
    for (const b of buckets.values()) {
      const geo = mergeGeometries(b.geos, false);
      b.geos.forEach((g) => g.dispose());
      if (!geo) continue;
      geo.computeBoundingSphere();
      // Once on the GPU, the merged arrays are never read again (collisions are Rapier's, culling uses the
      // bounding sphere computed above), so the CPU copy is dropped after upload: ~125 MB of JS heap
      // (Etapa 1). Trade-off: after a WebGL context loss these meshes would not be re-uploaded.
      for (const attr of Object.values(geo.attributes)) (attr as THREE.BufferAttribute).onUpload(releaseArray);
      const mesh = new THREE.Mesh(geo, b.material);
      // the shadow comes from the proxy above
      mesh.castShadow = false;
      mesh.receiveShadow = b.receive;
      mesh.userData.merged = true;
      merged.push(mesh);
    }
    removed.forEach(({ obj }) => obj.removeFromParent());
    merged.forEach((m) => group.add(m));

    return () => {
      merged.forEach((m) => {
        group.remove(m);
        m.geometry.dispose();
      });
      removed.forEach(({ obj, parent }) => parent.add(obj));
    };
  }, [chunk, castAll]);

  return <group ref={root}>{children}</group>;
}
