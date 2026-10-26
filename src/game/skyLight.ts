import * as THREE from 'three';
import type { Lighting } from './timeOfDay';

/**
 * Sky light (Etapa 3): the light that comes from the whole sky, as a light probe (9 spherical-harmonic
 * coefficients), built from the same gradient the sky dome paints. MeshToonMaterial can't use an
 * environment map, but it does read light probes. The hemisphere light it replaces only knew "sky color
 * above, ground color below"; the probe also knows the side the sun is on, so shaded faces turned toward the
 * sunset pick up the warm horizon and the ones turned away stay cool, like under a real sky.
 *
 * The probe is scaled so a face turned to the sky receives the same light as with the old hemisphere +
 * ambient pair: the overall brightness of the shade doesn't move, only where its color comes from.
 */

const col = (hex: string) => new THREE.Color(hex);
const smooth = THREE.MathUtils.smoothstep;

/** The sky dome's color in direction `d` (SkyDome.tsx), without the sun disk; below the horizon, the ground. */
export function skyRadiance(l: Lighting, d: THREE.Vector3, out = new THREE.Color()) {
  if (d.y < 0) {
    // the ground bounces the hemisphere's ground tint, fading into the horizon right at the edge
    return out.copy(col(l.hemi.ground)).lerp(col(l.sky.horizon), Math.max(0, 1 + d.y * 6) * 0.5);
  }
  out.copy(col(l.sky.horizon)).lerp(col(l.sky.mid), smooth(d.y, -0.05, 0.22));
  out.lerp(col(l.sky.top), smooth(d.y, 0.22, 0.85));
  const sun = new THREE.Vector3(...l.sky.sunDir).normalize();
  const glow = Math.pow(Math.max(0, d.dot(sun)), 8) * 0.45;
  out.add(col(l.sky.sunGlow).multiplyScalar(glow));
  // halfway to the preset's chosen sky light: the art direction wants a warm light from above at sunset,
  // while the dome's zenith is blue (pure dome light made the shade grey and cold)
  return out.lerp(col(l.hemi.sky), 0.5);
}

/** Projects the sky onto spherical harmonics (Fibonacci sphere, uniform weights). */
export function skySH(l: Lighting, samples = 1024) {
  const sh = new THREE.SphericalHarmonics3();
  const basis = new Array<number>(9);
  const d = new THREE.Vector3();
  const c = new THREE.Color();
  const golden = Math.PI * (3 - Math.sqrt(5));
  const w = (4 * Math.PI) / samples;
  for (let i = 0; i < samples; i++) {
    const y = 1 - (2 * (i + 0.5)) / samples;
    const r = Math.sqrt(1 - y * y);
    d.set(Math.cos(golden * i) * r, y, Math.sin(golden * i) * r);
    skyRadiance(l, d, c);
    THREE.SphericalHarmonics3.getBasisAt(d, basis);
    for (let k = 0; k < 9; k++) {
      sh.coefficients[k].x += c.r * basis[k] * w;
      sh.coefficients[k].y += c.g * basis[k] * w;
      sh.coefficients[k].z += c.b * basis[k] * w;
    }
  }
  return sh;
}

const lum = (c: { r: number; g: number; b: number }) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

/**
 * Probe intensity that matches the old hemisphere + ambient light on average over every face direction of
 * the upper hemisphere (walls and characters as much as the ground). Matching only the face turned up
 * made walls far too bright: sideways the probe sees the whole bright horizon, the hemisphere light only
 * a half-and-half mix of sky and ground.
 */
export function skyIntensity(l: Lighting, sh: THREE.SphericalHarmonics3) {
  const sky = col(l.hemi.sky), ground = col(l.hemi.ground), amb = col(l.ambient.color).multiplyScalar(l.ambient.intensity);
  const n = new THREE.Vector3();
  const e = new THREE.Vector3();
  const c = new THREE.Color();
  let old = 0, probe = 0;
  const samples = 256;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < samples; i++) {
    const y = (i + 0.5) / samples; // upper hemisphere only
    const r = Math.sqrt(1 - y * y);
    n.set(Math.cos(golden * i) * r, y, Math.sin(golden * i) * r);
    // three's hemisphere light: mix(ground, sky, 0.5 + 0.5 * n.y)
    c.copy(ground).lerp(sky, 0.5 + 0.5 * y).multiplyScalar(l.hemi.intensity).add(amb);
    old += lum(c);
    sh.getIrradianceAt(n, e);
    probe += lum({ r: e.x, g: e.y, b: e.z });
  }
  return old / Math.max(1e-4, probe);
}
