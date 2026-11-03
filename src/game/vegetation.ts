import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { detailFactor } from '../store/uiSettings';

/**
 * Small plants (grass tufts, flowers, ferns, reeds) fade out with distance. A tuft is a few pixels past
 * ~30 m and the fog starts at 42 m, but every one of them was still drawn to the edge of the map (the wild
 * lands' plants as one mesh per kind over 96 × 96 m, always drawn in full). Now:
 *  - in the vertex shader each plant shrinks to its root between NEAR and FAR from the camera (no pop);
 *  - whole cells (chunkInstanced) past FAR are not drawn at all.
 * Both distances follow the quality rung (detailFactor), like the other distance culls.
 */
const NEAR = 30;
const FAR = 40;

/** Shared by every faded material: (near, far) in metres, updated once per frame. */
export const vegFade = { value: new THREE.Vector2(NEAR, FAR) };

/**
 * Adds the distance shrink to a material that already has its own onBeforeCompile (it runs after it).
 * Instanced meshes only: the distance is measured at each instance's root.
 */
export function addDistanceFade(material: THREE.Material) {
  const prev = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    prev.call(material, shader, renderer);
    shader.uniforms.uVegFade = vegFade;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uVegFade;')
      .replace(
        '#include <project_vertex>',
        `#ifdef USE_INSTANCING
           vec3 vegRoot = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
           transformed *= 1.0 - smoothstep(uVegFade.x, uVegFade.y, distance(vegRoot.xz, cameraPosition.xz));
         #endif
         #include <project_vertex>`
      );
  };
  material.customProgramCacheKey = () => `${prevKey.call(material)}-vegfade`;
  return material;
}

/**
 * Splits one big InstancedMesh into spatial cells (same geometry and material), each with its own
 * bounding sphere and frustum culling on (Etapa 1), and registers them for the distance cull. As a single
 * mesh the whole field was drawn every frame, including everything behind the camera.
 */
export function chunkInstanced(src: THREE.InstancedMesh, cell = 30, distanceCull = true): THREE.Group {
  const group = new THREE.Group();
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const c = new THREE.Color();
  const byCell = new Map<string, number[]>();
  for (let i = 0; i < src.count; i++) {
    src.getMatrixAt(i, m);
    p.setFromMatrixPosition(m);
    const key = `${Math.floor(p.x / cell)},${Math.floor(p.z / cell)}`;
    const list = byCell.get(key) ?? [];
    list.push(i);
    byCell.set(key, list);
  }
  for (const list of byCell.values()) {
    const part = new THREE.InstancedMesh(src.geometry, src.material, list.length);
    list.forEach((idx, k) => {
      src.getMatrixAt(idx, m);
      part.setMatrixAt(k, m);
      if (src.instanceColor) {
        src.getColorAt(idx, c);
        part.setColorAt(k, c);
      }
    });
    part.computeBoundingSphere();
    // room for the wind sway and the blade tips
    if (part.boundingSphere) part.boundingSphere.radius += 1;
    part.castShadow = src.castShadow;
    part.receiveShadow = src.receiveShadow;
    part.userData.dynamic = true;
    // found by VegetationCull's scan of the scene
    if (distanceCull) part.userData.vegCell = true;
    group.add(part);
  }
  group.userData.dynamic = true;
  return group;
}

/** Updates the fade distances and hides the cells wholly past them (a few cells a frame). */
export function VegetationCull() {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const st = useRef({ i: 0, c: new THREE.Vector3(), list: [] as THREE.InstancedMesh[], rescan: 0 });
  useFrame((state) => {
    // dev: `__vegOff = true` draws every plant at any distance (before/after comparisons)
    const k = import.meta.env.DEV && (window as unknown as { __vegOff?: boolean }).__vegOff ? 1e3 : detailFactor();
    vegFade.value.set(NEAR * k, FAR * k);
    const far = FAR * k;
    const s = st.current;
    // the cells in the scene now (regions and zones mount and unmount theirs)
    if (state.clock.elapsedTime >= s.rescan) {
      s.rescan = state.clock.elapsedTime + 3;
      s.list = [];
      scene.traverse((o) => {
        if (o.userData.vegCell) s.list.push(o as THREE.InstancedMesh);
      });
    }
    const list = s.list;
    const n = list.length;
    if (!n) return;
    // every cell is checked about every 4 frames
    const slice = Math.ceil(n / 4);
    for (let j = 0; j < slice; j++) {
      const part = list[(s.i + j) % n];
      const bs = part.boundingSphere;
      if (!bs) continue;
      s.c.copy(bs.center).applyMatrix4(part.matrixWorld);
      const dx = s.c.x - camera.position.x;
      const dz = s.c.z - camera.position.z;
      part.visible = Math.hypot(dx, dz) - bs.radius < far;
    }
    s.i = (s.i + slice) % n;
  });
  return null;
}
