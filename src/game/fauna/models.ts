import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { enhanceToon, getGradient } from '../materials';

/**
 * Low-poly models of the small animals (Etapa 4), each species one geometry for one InstancedMesh: a single
 * draw call for every rabbit, one for every bird, one for every butterfly. Each vertex knows which part it
 * belongs to (`aPart`), and the per-instance `aAnim` drives the pose in the vertex shader (ears, head,
 * sitting up, wings), so a whole flock costs one draw and a few floats per animal per frame.
 *
 * Forward is +x, up is +y; sizes are in meters. Vertex colors carry the fixed markings (inner ears, eyes,
 * beak, wing patterns); the instance color tints the fur or feathers.
 */

export const PART = { body: 0, left: 1, right: 2, head: 3, tail: 4, feet: 5 } as const;

function blob(r: [number, number, number], at: [number, number, number], color: [number, number, number], part: number, seg: [number, number] = [8, 6]) {
  const g = new THREE.SphereGeometry(1, seg[0], seg[1]);
  g.deleteAttribute('uv');
  g.scale(r[0], r[1], r[2]);
  g.translate(at[0], at[1], at[2]);
  return paint(g, color, part);
}

function paint(g: THREE.BufferGeometry, color: [number, number, number], part: number) {
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set(color, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(n).fill(part), 1));
  return g.index ? g.toNonIndexed() : g;
}

/** A flat polygon (fan from the first point) in the xz plane at height y, both faces. */
function flat(points: [number, number][], y: number, color: (k: number) => [number, number, number], part: number) {
  const pos: number[] = [];
  const col: number[] = [];
  for (let k = 1; k < points.length - 1; k++) {
    for (const j of [0, k, k + 1]) {
      pos.push(points[j][0], y, points[j][1]);
      col.push(...color(j));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(pos.length / 3).fill(part), 1));
  g.computeVertexNormals();
  return g;
}

const FUR: [number, number, number] = [1, 1, 1];

let rabbitGeo: THREE.BufferGeometry | null = null;
/** ~32 cm long cottontail. */
export function rabbitGeometry() {
  if (rabbitGeo) return rabbitGeo;
  const belly: [number, number, number] = [1.18, 1.16, 1.12];
  const pink: [number, number, number] = [1.25, 0.82, 0.86];
  const dark: [number, number, number] = [0.08, 0.06, 0.07];
  const parts = [
    blob([0.15, 0.115, 0.105], [0, 0.125, 0], FUR, PART.body),
    blob([0.12, 0.105, 0.115], [-0.075, 0.11, 0], FUR, PART.body),
    blob([0.1, 0.06, 0.08], [0.02, 0.075, 0], belly, PART.body),
    blob([0.045, 0.045, 0.045], [-0.175, 0.15, 0], [1.35, 1.35, 1.35], PART.tail, [6, 5]),
    blob([0.085, 0.078, 0.074], [0.13, 0.205, 0], FUR, PART.head),
    blob([0.05, 0.04, 0.05], [0.18, 0.18, 0], belly, PART.head, [6, 5]),
    blob([0.013, 0.013, 0.013], [0.196, 0.228, 0.046], dark, PART.head, [5, 4]),
    blob([0.013, 0.013, 0.013], [0.196, 0.228, -0.046], dark, PART.head, [5, 4]),
    blob([0.012, 0.01, 0.014], [0.218, 0.198, 0], pink, PART.head, [5, 4]),
  ];
  for (const [side, part] of [[1, PART.left], [-1, PART.right]] as const) {
    parts.push(blob([0.024, 0.085, 0.036], [0.105, 0.31, side * 0.036], FUR, part, [6, 6]));
    parts.push(blob([0.012, 0.065, 0.024], [0.116, 0.31, side * 0.036], pink, part, [5, 5]));
    parts.push(blob([0.05, 0.022, 0.03], [-0.07, 0.022, side * 0.065], FUR, PART.feet, [6, 4]));
    parts.push(blob([0.028, 0.02, 0.022], [0.09, 0.02, side * 0.04], FUR, PART.feet, [5, 4]));
  }
  rabbitGeo = mergeGeometries(parts, false)!;
  rabbitGeo.computeBoundingSphere();
  return rabbitGeo;
}

let birdGeo: THREE.BufferGeometry | null = null;
/** ~14 cm songbird. */
export function birdGeometry() {
  if (birdGeo) return birdGeo;
  const belly: [number, number, number] = [1.35, 1.25, 1.1];
  const beak: [number, number, number] = [1.6, 1.0, 0.3];
  const dark: [number, number, number] = [0.06, 0.05, 0.06];
  const parts = [
    blob([0.062, 0.045, 0.04], [0, 0.065, 0], FUR, PART.body),
    blob([0.045, 0.03, 0.032], [0.01, 0.05, 0], belly, PART.body),
    blob([0.034, 0.033, 0.031], [0.055, 0.105, 0], FUR, PART.head),
    blob([0.022, 0.008, 0.008], [0.09, 0.1, 0], beak, PART.head, [5, 3]),
    blob([0.007, 0.007, 0.007], [0.075, 0.114, 0.022], dark, PART.head, [4, 3]),
    blob([0.007, 0.007, 0.007], [0.075, 0.114, -0.022], dark, PART.head, [4, 3]),
    flat([[-0.04, 0], [-0.105, 0.025], [-0.11, -0.025]], 0.075, () => [0.85, 0.85, 0.85], PART.tail),
    blob([0.004, 0.025, 0.004], [0.0, 0.02, 0.014], dark, PART.feet, [4, 3]),
    blob([0.004, 0.025, 0.004], [0.0, 0.02, -0.014], dark, PART.feet, [4, 3]),
  ];
  for (const [side, part] of [[1, PART.left], [-1, PART.right]] as const) {
    // a wing in its spread pose, hinged at the shoulder (x 0.01, z ±0.03); tips darker
    const s = side;
    parts.push(flat([[0.03, 0.03 * s], [0.035, 0.07 * s], [0.0, 0.14 * s], [-0.045, 0.12 * s], [-0.05, 0.035 * s]], 0.085, (k) => (k === 2 || k === 3 ? [0.55, 0.55, 0.6] : [0.95, 0.95, 0.95]), part));
  }
  birdGeo = mergeGeometries(parts, false)!;
  birdGeo.computeBoundingSphere();
  return birdGeo;
}

let butterflyGeo: THREE.BufferGeometry | null = null;
/** ~8 cm wingspan; the wings are drawn flat (open) and the shader folds them up. */
export function butterflyGeometry() {
  if (butterflyGeo) return butterflyGeo;
  const dark: [number, number, number] = [0.12, 0.1, 0.12];
  const parts = [blob([0.024, 0.006, 0.006], [0, 0, 0], dark, PART.body, [6, 4])];
  for (const [side, part] of [[1, PART.left], [-1, PART.right]] as const) {
    const s = side;
    // fore and hind wing lobes; the rim fades to a darker band, the base stays light
    const rim = (k: number): [number, number, number] => (k === 0 ? [1.1, 1.1, 1.1] : k % 2 ? [0.55, 0.5, 0.55] : [0.95, 0.95, 0.95]);
    parts.push(flat([[0.004, 0.003 * s], [0.03, 0.02 * s], [0.032, 0.045 * s], [0.012, 0.05 * s], [-0.004, 0.03 * s]], 0, rim, part));
    parts.push(flat([[-0.002, 0.003 * s], [-0.004, 0.03 * s], [-0.026, 0.038 * s], [-0.03, 0.02 * s], [-0.016, 0.006 * s]], 0, rim, part));
  }
  butterflyGeo = mergeGeometries(parts, false)!;
  butterflyGeo.computeBoundingSphere();
  return butterflyGeo;
}

/**
 * The pose functions, per species. `aAnim`:
 *   rabbit:    x ears laid back (0..1), y sitting up (0..1), z sniff phase, w grooming (0..1)
 *   bird:      x wing beat phase, y wings spread (0..1), z peck (0..1), w head turn (rad)
 *   butterfly: x wing beat phase, y how far the beat closes the wings (0..1), z, w unused
 */
const POSE: Record<'rabbit' | 'bird' | 'butterfly', string> = {
  rabbit: /* glsl */ `
    void faunaPose(inout vec3 p, inout vec3 n) {
      int part = int(aPart + 0.5);
      if (part == 1 || part == 2) {
        // ears: lay back around their base, with a little twitch
        float side = part == 1 ? 1.0 : -1.0;
        vec3 pivot = vec3(0.105, 0.24, side * 0.036);
        float a = -aAnim.x * 1.25 + sin(aAnim.z * 0.6 + side) * 0.06;
        mat3 r = faRotZ(a) * faRotX(side * aAnim.x * 0.35);
        p = pivot + r * (p - pivot); n = r * n;
      }
      if (part == 1 || part == 2 || part == 3) {
        // head: sniffing bob, and down to the paws when grooming
        vec3 neck = vec3(0.09, 0.18, 0.0);
        mat3 r = faRotZ(-aAnim.w * 0.45 + sin(aAnim.z) * 0.035);
        p = neck + r * (p - neck); n = r * n;
      }
      if (part != 5) {
        // sitting up on the haunches
        vec3 hip = vec3(-0.11, 0.05, 0.0);
        mat3 r = faRotZ(aAnim.y * 0.75);
        p = hip + r * (p - hip); n = r * n;
      }
    }`,
  bird: /* glsl */ `
    void faunaPose(inout vec3 p, inout vec3 n) {
      int part = int(aPart + 0.5);
      if (part == 1 || part == 2) {
        float side = part == 1 ? 1.0 : -1.0;
        vec3 pivot = vec3(0.01, 0.085, side * 0.03);
        // folded: swept back along the body; spread: beating up and down
        float fold = 1.0 - aAnim.y;
        mat3 sweep = faRotY(-side * fold * 1.35);
        mat3 beat = faRotX(side * (sin(aAnim.x) * 0.95 * aAnim.y + fold * 0.25));
        mat3 r = beat * sweep;
        p = pivot + r * (p - pivot); n = r * n;
      }
      if (part == 3) {
        vec3 neck = vec3(0.04, 0.085, 0.0);
        mat3 r = faRotY(aAnim.w) * faRotZ(-aAnim.z * 0.9);
        p = neck + r * (p - neck); n = r * n;
      }
      if (part == 5) p.y *= 1.0 - aAnim.y; // legs tuck in flight
    }`,
  butterfly: /* glsl */ `
    void faunaPose(inout vec3 p, inout vec3 n) {
      int part = int(aPart + 0.5);
      if (part == 1 || part == 2) {
        float side = part == 1 ? 1.0 : -1.0;
        float a = (0.5 + 0.5 * sin(aAnim.x)) * (0.3 + aAnim.y * 1.05) + 0.15;
        mat3 r = faRotX(-side * a);
        p = r * p; n = r * n;
      }
    }`,
};

const ROT = /* glsl */ `
  attribute float aPart;
  attribute vec4 aAnim;
  mat3 faRotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
  mat3 faRotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
  mat3 faRotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
`;

export function faunaMaterial(kind: keyof typeof POSE) {
  const m = new THREE.MeshToonMaterial({ gradientMap: getGradient(), vertexColors: true, side: kind === 'rabbit' ? THREE.FrontSide : THREE.DoubleSide });
  enhanceToon(m, false);
  const toon = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    toon.call(m, shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${ROT}\n${POSE[kind]}`)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvec3 faP = position;\nfaunaPose(faP, objectNormal);')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = faP;');
  };
  m.customProgramCacheKey = () => `fauna-${kind}`;
  return m;
}
