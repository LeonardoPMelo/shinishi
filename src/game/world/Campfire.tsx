import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Toon } from '../materials';
import { Rock } from './Rock';

/**
 * A campfire in the game's storybook style: a ring of real stones (the rock shader, not grey balls), crossed bark
 * logs with charred ends and a little teepee of sticks, a bed of embers, three layers of soft flame that lick and
 * sway (a gradient shader, additive, no hard cone edges), sparks drifting up, and a warm glow on the ground.
 * `lit = false` leaves charred wood and grey ash. No collider: the caller owns that.
 */

// one teardrop, wide near the bottom and drawn up to a point, as a lathe
let flameGeo: THREE.LatheGeometry | null = null;
function flameGeometry() {
  if (flameGeo) return flameGeo;
  const pts: THREE.Vector2[] = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    // round belly at the bottom, a long tapering tip
    const r = Math.sin(Math.PI * Math.min(1, t * 1.6) * 0.5 + (t < 0.3 ? 0 : 0)) * Math.pow(1 - t, 0.85);
    pts.push(new THREE.Vector2(Math.max(0.0001, r * 0.5), t));
  }
  flameGeo = new THREE.LatheGeometry(pts, 14);
  return flameGeo;
}

const FLAME_VERT = /* glsl */ `
uniform float uTime;
uniform float uSeed;
varying float vH;
varying float vRim;
void main() {
  vec3 p = position;
  vH = p.y;
  // the tip sways and licks more than the base
  float h = p.y * p.y;
  p.x += sin(uTime * 6.1 + uSeed * 4.0 + p.y * 3.0) * 0.16 * h;
  p.z += cos(uTime * 5.3 + uSeed * 7.0 + p.y * 2.5) * 0.12 * h;
  p.y *= 1.0 + 0.16 * sin(uTime * 9.0 + uSeed * 3.0) + 0.08 * sin(uTime * 13.7 + uSeed);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec3 n = normalize(normalMatrix * normal);
  vRim = abs(dot(n, normalize(-mv.xyz)));
  gl_Position = projectionMatrix * mv;
}`;

const FLAME_FRAG = /* glsl */ `
uniform vec3 uCore;
uniform vec3 uEdge;
uniform float uAlpha;
varying float vH;
varying float vRim;
void main() {
  vec3 col = mix(uCore, uEdge, smoothstep(0.05, 0.85, vH));
  // soft silhouette: bright where the flame faces the camera, fading to its edges and its tip
  float a = smoothstep(0.0, 0.55, vRim) * (1.0 - smoothstep(0.55, 1.0, vH)) * uAlpha;
  gl_FragColor = vec4(col * a, a);
}`;

function flameMaterial(core: string, edge: string, alpha: number, seed: number, time: { value: number }) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: time, uSeed: { value: seed }, uCore: { value: new THREE.Color(core) }, uEdge: { value: new THREE.Color(edge) }, uAlpha: { value: alpha } },
    vertexShader: FLAME_VERT,
    fragmentShader: FLAME_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    fog: false,
  });
}

const SPARK_VERT = /* glsl */ `
uniform float uTime;
attribute float aSeed;
varying float vLife;
void main() {
  float t = fract(uTime * (0.45 + aSeed * 0.35) + aSeed * 7.13);
  vLife = t;
  vec3 p = vec3(
    sin(aSeed * 40.0 + uTime * 2.0) * 0.12 * (0.3 + t) + sin(t * 9.0 + aSeed * 20.0) * 0.08,
    0.35 + t * 1.9,
    cos(aSeed * 33.0 + uTime * 1.7) * 0.12 * (0.3 + t)
  );
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (2.2 + aSeed * 2.0) * (1.0 - t) * (60.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const SPARK_FRAG = /* glsl */ `
varying float vLife;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = 1.0 - smoothstep(0.2, 0.5, length(c));
  vec3 col = mix(vec3(1.0, 0.85, 0.45), vec3(1.0, 0.35, 0.1), vLife);
  float a = d * (1.0 - vLife);
  gl_FragColor = vec4(col * a, a);
}`;

let glowTex: THREE.CanvasTexture | null = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

const BARK = '#6A4A32';
const CHAR = '#2E2622';

/**
 * The wood, merged into two meshes (bark and charred ends) so a fire costs two draw calls for it, not ten: two
 * crossed logs with charred ends and a little teepee of four sticks leaning in over them.
 */
let woodGeo: { bark: THREE.BufferGeometry; char: THREE.BufferGeometry } | null = null;
function woodGeometry() {
  if (woodGeo) return woodGeo;
  const bark: THREE.BufferGeometry[] = [];
  const char: THREE.BufferGeometry[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const place = (g: THREE.BufferGeometry, pos: THREE.Vector3, euler: THREE.Euler) => g.applyMatrix4(m.compose(pos, q.setFromEuler(euler), one));
  for (const [len, r, rot, y] of [[0.95, 0.075, 0.25, 0.09], [0.9, 0.07, 0.25 + Math.PI / 2, 0.17]]) {
    const log = new THREE.CylinderGeometry(r, r * 1.08, len * 0.7, 7).rotateZ(Math.PI / 2);
    bark.push(place(log, new THREE.Vector3(0, y, 0), new THREE.Euler(0, rot, 0)));
    for (const e of [-1, 1]) {
      const end = new THREE.CylinderGeometry(r * 0.85, r, len * 0.16, 7).rotateZ(Math.PI / 2).translate(e * len * 0.42, 0, 0);
      char.push(place(end, new THREE.Vector3(0, y, 0), new THREE.Euler(0, rot, 0)));
    }
  }
  for (let i = 0; i < 4; i++) {
    const a = i * (Math.PI / 2) + 0.6;
    const stick = new THREE.CylinderGeometry(0.028, 0.04, 0.55, 5);
    bark.push(place(stick, new THREE.Vector3(Math.cos(a) * 0.17, 0.3, Math.sin(a) * 0.17), new THREE.Euler(Math.sin(a) * -0.55, 0, Math.cos(a) * 0.55)));
  }
  woodGeo = { bark: mergeGeometries(bark)!, char: mergeGeometries(char)! };
  return woodGeo;
}

export function Campfire({ lit = true, stones = true, scale = 1 }: { lit?: boolean; stones?: boolean; scale?: number }) {
  const time = useMemo(() => ({ value: 0 }), []);
  const parts = useMemo(() => {
    const flames = [
      { m: flameMaterial('#FFE9A0', '#FF5A1E', 0.75, 0.0, time), s: [0.62, 1.05, 0.62], y: 0.16, x: 0, z: 0 },
      { m: flameMaterial('#FFD36A', '#FF7A2A', 0.7, 1.7, time), s: [0.4, 0.78, 0.4], y: 0.18, x: 0.12, z: -0.06 },
      { m: flameMaterial('#FFFFFF', '#FFC250', 0.9, 4.6, time), s: [0.3, 0.55, 0.3], y: 0.17, x: 0, z: 0 },
    ];
    const n = 16;
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    const seeds = new Float32Array(n);
    for (let i = 0; i < n; i++) seeds[i] = ((i * 0.618034) % 1);
    sg.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
    sg.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.2, 0), 1.5);
    const sparks = new THREE.ShaderMaterial({
      uniforms: { uTime: time },
      vertexShader: SPARK_VERT,
      fragmentShader: SPARK_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const glow = new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#FF9A40', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const embers = new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#FF6A20', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    return { flames, sparkGeo: sg, sparks, glow, embers };
  }, [time]);
  const glowRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    time.value = clock.elapsedTime;
    if (glowRef.current) (glowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.12 * Math.sin(clock.elapsedTime * 7.3) + 0.06 * Math.sin(clock.elapsedTime * 17.1);
  });
  const ring = useMemo(() => Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 + (i % 2) * 0.08;
    const k = 0.23 + ((i * 0.37) % 1) * 0.09;
    return { a, k, v: i % 4, r: 0.66 + ((i * 0.53) % 1) * 0.06 };
  }), []);
  return (
    <group scale={scale}>
      {stones && ring.map((s, i) => (
        <Rock key={i} variant={s.v} kind="pebble" position={[Math.cos(s.a) * s.r, 0.06, Math.sin(s.a) * s.r]} rotation={[0, s.a * 3, 0]} scale={[s.k * 1.25, s.k * 0.85, s.k]} color={i % 3 ? '#8C8478' : '#7A7268'} contact={false} />
      ))}
      {/* the bed: ash, then glowing embers on top when lit */}
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.5, 16]} />
        <Toon color={lit ? '#3A2C26' : '#6E6862'} />
      </mesh>
      {/* crossed logs, and a small teepee of sticks over them */}
      <mesh geometry={woodGeometry().bark} castShadow>
        <Toon color={lit ? BARK : '#4A3E36'} tex="bark" />
      </mesh>
      <mesh geometry={woodGeometry().char}>
        <Toon color={CHAR} />
      </mesh>
      {lit && (
        <group userData={{ dynamic: true }}>
          <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} material={parts.embers} renderOrder={2}>
            <planeGeometry args={[0.9, 0.9]} />
          </mesh>
          <mesh ref={glowRef} position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]} material={parts.glow} renderOrder={1}>
            <planeGeometry args={[3.6, 3.6]} />
          </mesh>
          {parts.flames.map((f, i) => (
            <mesh key={i} geometry={flameGeometry()} material={f.m} position={[f.x, f.y, f.z]} scale={f.s as [number, number, number]} renderOrder={3} />
          ))}
          <points geometry={parts.sparkGeo} material={parts.sparks} renderOrder={4} frustumCulled={false} />
        </group>
      )}
    </group>
  );
}
