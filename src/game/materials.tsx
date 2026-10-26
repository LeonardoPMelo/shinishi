import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Outlines } from '@react-three/drei';
import { getTexture, TEXTURE_SCALE, type TexName } from './textures';
import { detailFactor } from '../store/uiSettings';

let gradient: THREE.DataTexture | null = null;

/** Three-step toon ramp, bright enough for a sunny anime look. */
export function getGradient() {
  if (gradient) return gradient;
  // A soft "painted" terminator instead of three hard bands: shadow and light stay clearly separate
  // (still stylized), but the turn is a short smooth blend, the way animated films shade round forms.
  const N = 64;
  const data = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    const x = i / (N - 1);
    const turn = THREE.MathUtils.smoothstep(x, 0.3, 0.52); // shadow → light
    const sheen = THREE.MathUtils.smoothstep(x, 0.78, 0.98) * 0.06; // a hint of highlight on the lit side
    const t = Math.round(255 * Math.min(1, 0.6 + 0.34 * turn + sheen));
    data.set([t, t, t, 255], i * 4);
  }
  gradient = new THREE.DataTexture(data, N, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.LinearFilter;
  gradient.magFilter = THREE.LinearFilter;
  gradient.needsUpdate = true;
  return gradient;
}

/** Shared time for wind sway, updated once per frame by <WindClock />. */
export const windTime = { value: 0 };

/**
 * See-through foliage: the camera writes its position and the player's here every frame.
 * Leaves close to the line between them dissolve with a dither, so a tree canopy never
 * hides Shinichi (canopies have no colliders, so the camera cannot dodge them).
 */
export const foliageFade = { cam: { value: new THREE.Vector3(0, 1e4, 0) }, target: { value: new THREE.Vector3() } };

/** Transparent twin of an opaque foliage material (same shader hooks), created once per material. */
const fadeTwins = new WeakMap<THREE.Material, THREE.Material>();
function fadeTwin(m: THREE.Material) {
  let t = fadeTwins.get(m);
  if (!t) {
    t = m.clone();
    // Material.clone() does not copy shader hooks
    t.onBeforeCompile = m.onBeforeCompile;
    t.customProgramCacheKey = m.customProgramCacheKey;
    t.userData = { ...m.userData, fadeTwin: true };
    t.transparent = true;
    fadeTwins.set(m, t);
  }
  return t;
}

type FadeEntry = { mesh: THREE.Mesh; opaque: THREE.Material; center: THREE.Vector3; radius: number; faded: boolean };

/**
 * See-through foliage, cheaply: every canopy is drawn opaque, and only the clumps (merged chunks or single
 * trees) whose bounds come within reach of the camera→cat line get the transparent twin, where the shader's
 * smooth fade runs. The list is rebuilt every few seconds (StaticMerge replaces meshes after load).
 */
export function FoliageFade() {
  const scene = useThree((s) => s.scene);
  const st = useRef<{ list: FadeEntry[]; scanAt: number; frame: number }>({ list: [], scanAt: 0, frame: 0 });
  const tmp = useMemo(() => ({ ab: new THREE.Vector3(), ap: new THREE.Vector3(), q: new THREE.Vector3() }), []);
  useFrame((state) => {
    const s = st.current;
    const t = state.clock.elapsedTime;
    if (t > s.scanAt) {
      s.scanAt = t + 3;
      const keep = new Map(s.list.map((e) => [e.mesh, e]));
      const list: FadeEntry[] = [];
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh || Array.isArray(mesh.material)) return;
        const prev = keep.get(mesh);
        const mat = prev ? prev.opaque : (mesh.material as THREE.Material);
        if (!mat.userData?.wind || mat.userData.fadeTwin || mat.transparent) return;
        if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
        const bs = mesh.geometry.boundingSphere!;
        const center = bs.center.clone().applyMatrix4(mesh.matrixWorld);
        const radius = bs.radius * mesh.matrixWorld.getMaxScaleOnAxis();
        list.push(prev ? { ...prev, center, radius } : { mesh, opaque: mat, center, radius, faded: false });
      });
      // meshes that left the scene go back to their own material
      for (const e of s.list) if (!list.some((n) => n.mesh === e.mesh)) e.mesh.material = e.opaque;
      s.list = list;
    }
    if ((s.frame = (s.frame + 1) % 2) === 1) return;
    const a = foliageFade.cam.value;
    const b = foliageFade.target.value;
    tmp.ab.subVectors(b, a);
    const len2 = Math.max(tmp.ab.lengthSq(), 1e-4);
    for (const e of s.list) {
      tmp.ap.subVectors(e.center, a);
      const k = THREE.MathUtils.clamp(tmp.ap.dot(tmp.ab) / len2, 0, 1);
      tmp.q.copy(a).addScaledVector(tmp.ab, k);
      // same reach as the shader fade (1.6 m) plus the clump's own size
      const near = k < 0.97 && tmp.q.distanceTo(e.center) < e.radius + 1.7;
      if (near !== e.faded) {
        e.faded = near;
        e.mesh.material = near ? fadeTwin(e.opaque) : e.opaque;
      }
    }
  });
  return null;
}

/**
 * Small parts (radius under 35 cm: lantern caps, bottles, pebbles, ropes...) stop casting real shadows
 * (Etapa 1). Their shadow is a few pixels, but each one is an extra draw in the shadow pass, and draws are
 * what an integrated GPU pays for here. Characters keep theirs. Rescanned every few seconds.
 */
export function ShadowBudget() {
  const scene = useThree((s) => s.scene);
  const next = useRef(0);
  useFrame((state) => {
    if (state.clock.elapsedTime < next.current) return;
    next.current = state.clock.elapsedTime + 4;
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.castShadow || (mesh as THREE.SkinnedMesh).isSkinnedMesh || (mesh as THREE.InstancedMesh).isInstancedMesh) return;
      if (mesh.userData.keepShadow) return;
      let a: THREE.Object3D | null = mesh.parent;
      while (a && !(a as THREE.Bone).isBone) a = a.parent;
      if (a) return; // part of a rigged character
      const g = mesh.geometry;
      if (!g.boundingSphere) g.computeBoundingSphere();
      if (g.boundingSphere!.radius * mesh.matrixWorld.getMaxScaleOnAxis() < 0.35) mesh.castShadow = false;
    });
  });
  return null;
}

/** Layer no camera renders: where SmallCull parks the pieces too small to see. */
const PARKED_LAYER = 3;

/**
 * Screen-size culling for the loose pieces (Etapa 1b): fences, targets, torches, crates and their ink hulls
 * that are not merged (they move or toggle) were ~150 draw calls in the plaza view, many of them a few pixels
 * tall 20–30 m away. A piece is parked on an unseen layer while its bounding sphere is smaller than about
 * 10 px on a 700 px tall view (radius / distance < 0.0055 at full detail; larger on the cheaper rungs), with
 * a 25% hysteresis so it does not flicker. Layers, not `visible`, so components that toggle visibility
 * themselves keep working. Merged scenery, instanced vegetation and characters are left alone.
 */
export function SmallCull() {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const st = useRef({ list: [] as THREE.Mesh[], rescan: 0, frame: 0, c: new THREE.Vector3() });
  useFrame((state) => {
    const s = st.current;
    if (state.clock.elapsedTime >= s.rescan) {
      s.rescan = state.clock.elapsedTime + 3;
      s.list = [];
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || m.name || m.userData.merged || m.userData.keepVisible) return;
        if ((m as THREE.SkinnedMesh).isSkinnedMesh || (m as THREE.InstancedMesh).isInstancedMesh) return;
        let a: THREE.Object3D | null = m.parent;
        while (a && !(a as THREE.Bone).isBone) a = a.parent;
        if (a) return; // part of a rigged character
        s.list.push(m);
      });
    }
    // a slice of the list every frame: each piece is checked about every 6 frames
    const k = 0.0055 / detailFactor();
    const n = s.list.length;
    const slice = Math.ceil(n / 6);
    for (let i = 0; i < slice; i++) {
      const m = s.list[(s.frame + i) % Math.max(1, n)];
      if (!m) break;
      // geometry can be swapped after the scan (it then has no bounds yet)
      const g = m.geometry;
      if (!g?.attributes.position) continue;
      if (!g.boundingSphere) g.computeBoundingSphere();
      const bs = g.boundingSphere!;
      s.c.copy(bs.center).applyMatrix4(m.matrixWorld);
      const r = bs.radius * m.matrixWorld.getMaxScaleOnAxis();
      const ratio = r / Math.max(0.1, s.c.distanceTo(camera.position));
      const parked = m.userData.parkedMask !== undefined;
      if (!parked && ratio < k) {
        m.userData.parkedMask = m.layers.mask;
        m.layers.set(PARKED_LAYER);
      } else if (parked && ratio > k * 1.25) {
        m.layers.mask = m.userData.parkedMask;
        delete m.userData.parkedMask;
      }
    }
    s.frame = (s.frame + slice) % Math.max(1, n);
  });
  return null;
}

export function WindClock() {
  useFrame((_s, d) => {
    windTime.value += d;
  });
  return null;
}

/**
 * Adds an anime rim light (bright edge facing away from the camera) to toon materials,
 * and optional wind sway for foliage. Kept as a plain function so merged clones can reuse it.
 */
export function enhanceToon(material: THREE.Material, wind: boolean) {
  material.userData.wind = wind;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windTime;
    if (wind) {
      shader.uniforms.uFadeCam = foliageFade.cam;
      shader.uniforms.uFadeTarget = foliageFade.target;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uFadeCam;\nuniform vec3 uFadeTarget;\nvarying vec3 vFadeWorld;')
        .replace(
          '#include <clipping_planes_fragment>',
          `#include <clipping_planes_fragment>
           vec3 fadeAB = uFadeTarget - uFadeCam;
           float fadeT = clamp(dot(vFadeWorld - uFadeCam, fadeAB) / max(dot(fadeAB, fadeAB), 1e-4), 0.0, 1.0);
           float fadeD = length(vFadeWorld - (uFadeCam + fadeAB * fadeT));
           // smooth see-through instead of a random dither: the old per-pixel noise read as grain,
           // and it got worse once the image was drawn at a lower resolution and enlarged
           float fadeAlpha = fadeT < 0.93 ? (1.0 - smoothstep(0.7, 1.6, fadeD)) * 0.82 : 0.0;`
        );
    }
    if (wind) {
      shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\n diffuseColor.a *= 1.0 - fadeAlpha;');
    }
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `float rimDot = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
       float rim = smoothstep(0.7, 0.97, rimDot);
       // Scale the rim by the surface brightness so dark fur doesn't look like shiny plastic.
       float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
       outgoingLight += vec3(1.0, 0.96, 0.86) * rim * (0.05 + 0.2 * lum);
       // Anime palette: shadowed bands lean cool violet-blue, sunlit areas slightly warm.
       float litRatio = dot(outgoingLight, vec3(0.3, 0.59, 0.11)) / max(lum, 0.001);
       float shade = 1.0 - smoothstep(0.62, 0.92, litRatio);
       outgoingLight *= mix(vec3(1.03, 1.0, 0.95), vec3(0.84, 0.88, 1.1), shade);
       #include <opaque_fragment>`
    );
    if (wind) {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uWindTime;\nvarying vec3 vFadeWorld;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vec4 windWorld = modelMatrix * vec4(transformed, 1.0);
           vFadeWorld = windWorld.xyz;
           float sway = max(windWorld.y - 1.2, 0.0) * 0.045;
           transformed.x += sin(uWindTime * 1.6 + windWorld.x * 0.35 + windWorld.z * 0.2) * sway;
           transformed.z += cos(uWindTime * 1.3 + windWorld.z * 0.3) * sway * 0.6;`
        );
    }
  };
  material.customProgramCacheKey = () => (wind ? 'toon-rim-wind' : 'toon-rim');
}

/**
 * Stone surface for natural rocks (Etapa 2), on top of the toon rim light. In world space, so merged and
 * instanced rocks get it the same: broad mottling and fine speckle (granite-like), and a pale chipped line
 * along the creases where two chiseled faces meet (the normal changes sharply there, which fwidth sees).
 * Fades with distance like the dirt, so it doesn't shimmer.
 */
export function enhanceRock(material: THREE.Material) {
  enhanceToon(material, false);
  material.userData.shader = 'rock';
  const toonHook = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    toonHook.call(material, shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRockPos;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vec4 rockP = vec4(transformed, 1.0);
         #ifdef USE_INSTANCING
           rockP = instanceMatrix * rockP;
         #endif
         vRockPos = (modelMatrix * rockP).xyz;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vRockPos;
         float rHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
         float rNoise(vec3 x) {
           vec3 i = floor(x), f = fract(x);
           f = f * f * (3.0 - 2.0 * f);
           return mix(mix(mix(rHash(i), rHash(i + vec3(1,0,0)), f.x), mix(rHash(i + vec3(0,1,0)), rHash(i + vec3(1,1,0)), f.x), f.y),
                      mix(mix(rHash(i + vec3(0,0,1)), rHash(i + vec3(1,0,1)), f.x), mix(rHash(i + vec3(0,1,1)), rHash(i + vec3(1,1,1)), f.x), f.y), f.z);
         }`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         {
           float px = length(fwidth(vRockPos));
           float near = 1.0 - smoothstep(0.015, 0.06, px);
           float mott = rNoise(vRockPos * 2.3) * 0.6 + rNoise(vRockPos * 6.1) * 0.4;
           diffuseColor.rgb *= 0.86 + 0.26 * mott;
           float speck = rHash(floor(vRockPos * 38.0));
           diffuseColor.rgb *= 1.0 - near * (step(0.88, speck) * 0.14 - step(speck, 0.05) * 0.12);
           // chipped crease highlight
           float crease = smoothstep(0.25, 0.7, length(fwidth(normalize(vNormal))));
           diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.22 + 0.04, crease * near * 0.7);
         }`
      );
  };
  material.customProgramCacheKey = () => 'toon-rim-rock';
}

interface ToonProps {
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
  /** Foliage sways in the wind. */
  wind?: boolean;
  /** Procedural texture tinted by `color`. */
  tex?: TexName;
  /** Keep the geometry's own UVs instead of world-projected ones (e.g. roofs). */
  nativeUV?: boolean;
  /** Multiply by the geometry's vertex colors (baked occlusion on foliage puffs). */
  vertexColors?: boolean;
}

export function Toon({ color, emissive, emissiveIntensity, transparent, opacity, side, wind = false, tex, nativeUV, vertexColors }: ToonProps) {
  return (
    <meshToonMaterial
      color={color}
      vertexColors={vertexColors}
      gradientMap={getGradient()}
      emissive={emissive ?? '#000000'}
      emissiveIntensity={emissiveIntensity ?? 0}
      // foliage is opaque (depth-tested, merged and cheap); <FoliageFade /> swaps in a transparent twin only
      // for the clumps that stand between the camera and the cat (Etapa 1: the all-transparent canopies
      // cost ~10 ms of GPU in the plaza)
      transparent={transparent}
      opacity={opacity ?? 1}
      side={side}
      map={tex ? getTexture(tex) : null}
      onUpdate={(m) => {
        enhanceToon(m, wind);
        m.userData.worldUV = tex && !nativeUV ? TEXTURE_SCALE[tex] : 0;
      }}
    />
  );
}

/**
 * Anime ink line. drei's Outlines measures thickness in screen pixels (non-screenspace mode),
 * so the scene-scale values used around the code are mapped to a 1.5–3.5 px stroke.
 */
export function Ink({ thickness = 0.025, color = '#22182c' }: { thickness?: number; color?: string }) {
  const px = Math.min(3.5, Math.max(1, thickness * 70));
  return <Outlines thickness={px} color={color} />;
}
