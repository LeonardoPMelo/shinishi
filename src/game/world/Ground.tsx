import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useUiSettings, renderProfile } from '../../store/uiSettings';
import { Toon, getGradient } from '../materials';
import { contactTexture, addGroundContact } from '../groundContact';
import { rockGeometry } from '../rockGeometry';
import { GATE } from '../../systems/temple';
import { EAST_GATE, EAST_PATHS } from '../../data/east';
import { WEST_GATE, WEST_PATHS, CLEARING } from '../../data/west';
import { SOUTH_GATE, SOUTH_PATHS } from '../../data/south';

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function useGrassTexture() {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#8CCB5E';
    ctx.fillRect(0, 0, 512, 512);
    const rand = seeded(7);
    for (let i = 0; i < 60; i++) {
      const x = rand() * 512, y = rand() * 512, r = 30 + rand() * 70;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const tone = rand() > 0.5 ? '160,214,104' : '112,182,80';
      g.addColorStop(0, `rgba(${tone},0.55)`);
      g.addColorStop(1, `rgba(${tone},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 1800; i++) {
      const x = rand() * 512, y = rand() * 512;
      ctx.strokeStyle = rand() > 0.5 ? 'rgba(80,150,64,0.45)' : 'rgba(186,232,120,0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * 3, y - 4 - rand() * 4);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(14, 17);
    return tex;
  }, []);
}

/**
 * Radial flagstones for the plazas (Etapa 2: was flat-colored ring segments). Each stone is inset from its
 * neighbours by a dark mortar joint with specks of moss, has its own tone, a lighter worn top that darkens
 * toward its edges, and a few chips and grains. 1024 px over the ~9 m plaza ≈ 110 px per meter.
 */
export function usePlazaTexture() {
  return useMemo(() => {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const rand = seeded(11);
    const c = size / 2;
    // mortar
    ctx.fillStyle = '#76695A';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = rand() > 0.55 ? 'rgba(104,140,70,0.5)' : 'rgba(84,74,62,0.5)';
      ctx.fillRect(rand() * size, rand() * size, 2 + rand() * 3, 2 + rand() * 3);
    }
    const ringW = 58;
    const gap = 4;
    for (let ring = 0; ring < 9; ring++) {
      const r0 = ring * ringW + gap * 0.5;
      const r1 = r0 + ringW - gap;
      const count = Math.max(1, Math.floor((ring + 0.5) * 6));
      for (let k = 0; k < count; k++) {
        const a0 = (k / count) * Math.PI * 2;
        const a1 = ((k + 1) / count) * Math.PI * 2;
        // the joint is a fixed width in pixels, so the angular inset shrinks on the outer rings
        const pad0 = gap / Math.max(r0, 8);
        const pad1 = gap / r1;
        const shade = 146 + Math.floor(rand() * 56);
        const warm = Math.floor(rand() * 14);
        const base = `rgb(${shade + warm},${shade - 10 + warm * 0.4},${shade - 30})`;
        ctx.save();
        ctx.beginPath();
        if (ring === 0) ctx.arc(c, c, r1, 0, Math.PI * 2);
        else {
          ctx.arc(c, c, r1, a0 + pad1, a1 - pad1);
          ctx.arc(c, c, r0, a1 - pad0, a0 + pad0, true);
          ctx.closePath();
        }
        ctx.clip();
        // body: lighter worn middle, darker toward the joint
        const mid = (a0 + a1) / 2;
        const rm = ring === 0 ? 0 : (r0 + r1) / 2;
        const mx = c + Math.cos(mid) * rm, my = c + Math.sin(mid) * rm;
        const g = ctx.createRadialGradient(mx, my, 2, mx, my, ringW * 0.95);
        g.addColorStop(0, `rgb(${shade + warm + 22},${shade + 12 + warm * 0.4},${shade - 10})`);
        g.addColorStop(0.6, base);
        g.addColorStop(1, `rgb(${shade - 26},${shade - 34},${shade - 48})`);
        ctx.fillStyle = g;
        ctx.fillRect(mx - ringW * 1.5, my - ringW * 1.5, ringW * 3, ringW * 3);
        // grain and a couple of chips
        for (let i = 0; i < 40; i++) {
          const ang = a0 + rand() * (a1 - a0), rr = r0 + rand() * (r1 - r0);
          ctx.fillStyle = rand() > 0.5 ? 'rgba(255,245,225,0.18)' : 'rgba(40,30,20,0.16)';
          ctx.fillRect(c + Math.cos(ang) * rr, c + Math.sin(ang) * rr, 1.5 + rand() * 2, 1.5 + rand() * 2);
        }
        // a worn, chipped corner now and then: a soft darker notch at the joint, not a hole
        if (rand() < 0.35) {
          const ang = rand() > 0.5 ? a0 + pad1 * 2 : a1 - pad1 * 2, rr = rand() > 0.5 ? r1 - 2 : r0 + 2;
          const x = c + Math.cos(ang) * rr, y = c + Math.sin(ang) * rr;
          const chip = ctx.createRadialGradient(x, y, 0, x, y, 7);
          chip.addColorStop(0, 'rgba(96,84,70,0.6)');
          chip.addColorStop(1, 'rgba(96,84,70,0)');
          ctx.fillStyle = chip;
          ctx.fillRect(x - 7, y - 7, 14, 14);
        }
        ctx.restore();
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, []);
}

export const PATHS: [number, number][][] = [
  [[0, -4.3], [-2.5, -4.5], [-5, -5.3], [-7, -6]],
  [[4.3, -0.5], [6, -1], [8, -1.2]],
  [[1, 4.3], [1.5, 6.2], [2, 7]],
  [[-3.2, 3], [-6, 5.5], [-9, 7.2]],
  [[0, -4.3], [0, -7], [0, -10]],
  [[3, -3.2], [5.5, -5.5], [8, -6.5]],
  [[0.6, 4.6], [0.4, 9], [0.2, 14], [0, 20.2]],
  [[0, 25.8], [0, 27.2], [-2.4, 28.6]],
  [[0, 27.2], [1.2, 28]],
  [[-6, -6.4], [-8.4, -11.2], [-10.4, -13.6]],
  [[6, 10], [9, 13.5], [11.5, 16]],
  // Bairro das Glicínias (east gate)
  ...EAST_PATHS,
  // Bambuzal das Águas Quentes (west gate) and Bosque Antigo (south gate)
  ...WEST_PATHS,
  ...SOUTH_PATHS,
]

/**
 * One large texture over the whole ground plane (112 x 112 world units, 8 px per unit):
 * R = brightness patches, G = warm/dry patches, B = dirt-path mask.
 * The grass shader uses it to break up the repetition and draw soft dirt paths.
 */
// x from -56 to 56 and z to 72: the three districts outside the fence (§25, §26) and the land beyond them
const GROUND = { minX: -56, minZ: -40, w: 112, d: 112, ppu: 8 };

function valueNoise(seed: number) {
  const rand = seeded(seed);
  const n = 64;
  const grid = Array.from({ length: n * n }, () => rand());
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const g = (i: number, j: number) => grid[(((j % n) + n) % n) * n + (((i % n) + n) % n)];
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return (g(xi, yi) * (1 - u) + g(xi + 1, yi) * u) * (1 - v) + (g(xi, yi + 1) * (1 - u) + g(xi + 1, yi + 1) * u) * v;
  };
}

function useGroundMacro() {
  return useMemo(() => {
    const W = GROUND.w * GROUND.ppu;
    const H = GROUND.d * GROUND.ppu;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(W, H);
    const n1 = valueNoise(3);
    const n2 = valueNoise(9);
    const segs: [number, number, number, number][] = [];
    PATHS.forEach((p) => {
      for (let i = 0; i < p.length - 1; i++) segs.push([p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]]);
    });
    for (let py = 0; py < H; py++) {
      const z = GROUND.minZ + (py + 0.5) / GROUND.ppu;
      for (let px = 0; px < W; px++) {
        const x = GROUND.minX + (px + 0.5) / GROUND.ppu;
        const bright = n1(x * 0.12, z * 0.12) * 0.7 + n1(x * 0.4 + 17, z * 0.4) * 0.3;
        const warm = n2(x * 0.08, z * 0.08);
        let dirt = 0;
        if (x > -42 && x < 42 && z > -21 && z < 64) {
          let d = 99;
          for (const [ax, az, bx, bz] of segs) {
            const vx = bx - ax, vz = bz - az;
            const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
            d = Math.min(d, Math.hypot(x - ax - vx * t, z - az - vz * t));
          }
          const edge = 0.62 + (n2(x * 1.3, z * 1.3) - 0.5) * 0.35;
          dirt = 1 - Math.min(1, Math.max(0, (d - edge * 0.7) / (edge * 0.6)));
          // the plaza gets a soft worn ring around it
          const pr = Math.hypot(x, z);
          dirt = Math.max(dirt, 1 - Math.min(1, Math.abs(pr - 5.1) / 0.6) * 1.0);
          // and so does the little plaza of the Bairro das Glicínias
          const er = Math.hypot(x - 27, z - 2);
          dirt = Math.max(dirt, 1 - Math.min(1, Math.abs(er - 3.45) / 0.5));
          // the Bambuzal's crossroads is a bare, trodden clearing
          const cr = Math.hypot(x - CLEARING.x, z - CLEARING.z);
          dirt = Math.max(dirt, 1 - Math.min(1, Math.max(0, cr - CLEARING.r * 0.7) / 0.8));
        }
        const k = (py * W + px) * 4;
        img.data[k] = Math.round(bright * 255);
        img.data[k + 1] = Math.round(warm * 255);
        img.data[k + 2] = Math.round(Math.max(0, Math.min(1, dirt)) * 255);
        img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.NoColorSpace;
    tex.flipY = false;
    return tex;
  }, []);
}

/**
 * Procedural detail for the dirt (Etapa 2), all in world space so nothing tiles: the 8 px/m macro mask
 * only says roughly where a path is. Here the edge is broken up by noise into a ragged, slightly damp
 * border with the grass; the dirt gets two scales of tone variation, a lighter trodden middle, scattered
 * pebbles (a cell pattern: light top, dark rim) and fine grit. Details fade out by screen size (fwidth),
 * so far paths don't shimmer. Pebbles are only computed where there is dirt.
 */
const DIRT_GLSL = /* glsl */ `
  float gHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float gNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), u.x), mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  // nearest pebble: x = distance to its centre (in cells), y = its id, z = its radius (0 = no pebble)
  vec3 gPebble(vec2 w) {
    vec2 ip = floor(w), fp = fract(w);
    float best = 9.0, id = 0.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j));
      vec2 c = o + 0.2 + 0.6 * vec2(gHash(ip + o), gHash(ip + o + 17.17)) - fp;
      float d = dot(c, c);
      if (d < best) { best = d; id = gHash(ip + o + 5.31); }
    }
    float rad = id > 0.6 ? 0.1 + 0.2 * fract(id * 7.13) : 0.0;
    return vec3(sqrt(best), id, rad);
  }
`;

/** 1 = draw the dirt's pebbles, 0 = skip them (cheaper rungs). A uniform, so switching never recompiles. */
const pebbleSwitch = { value: 1 };
if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__pebbles = pebbleSwitch;

function useGroundMaterial(grass: THREE.Texture, macro: THREE.Texture) {
  return useMemo(() => {
    const m = new THREE.MeshToonMaterial({ map: grass, gradientMap: getGradient() });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uMacro = { value: macro };
      shader.uniforms.uContact = { value: contactTexture() };
      shader.uniforms.uPebbles = pebbleSwitch;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vWorldXZ;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
uniform sampler2D uMacro;
uniform sampler2D uContact;
uniform float uPebbles;
varying vec2 vWorldXZ;
${DIRT_GLSL}`)
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
           vec2 w = vWorldXZ;
           vec2 macroUv = vec2((w.x - (${GROUND.minX.toFixed(1)})) / ${GROUND.w.toFixed(1)}, (w.y - (${GROUND.minZ.toFixed(1)})) / ${GROUND.d.toFixed(1)});
           vec3 mac = texture2D(uMacro, macroUv).rgb;
           diffuseColor.rgb *= 0.86 + mac.r * 0.28;
           diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 1.05, 0.78), smoothstep(0.55, 0.8, mac.g) * 0.6);

           // how much detail this pixel can hold (1 up close, 0 far away)
           float px = length(fwidth(w));
           float near = 1.0 - smoothstep(0.03, 0.12, px);
           float grain = 1.0 - smoothstep(0.012, 0.04, px);

           // ragged edge: the soft macro mask pushed in and out by two scales of noise, then cut fairly crisp
           float edgeN = (gNoise(w * 1.7) - 0.5) * 0.5 + (gNoise(w * 5.3 + 3.1) - 0.5) * 0.28 * near;
           float e = mac.b + edgeN;
           float dirtMask = smoothstep(0.42, 0.42 + mix(0.22, 0.06, near), e);

           // grass just outside the path: a little darker and damper (trampled, shaded by the tufts)
           diffuseColor.rgb *= 1.0 - 0.12 * smoothstep(0.24, 0.42, e) * (1.0 - dirtMask);

           if (dirtMask > 0.001) {
             float t1 = gNoise(w * 0.65 + 11.0), t2 = gNoise(w * 3.2 + 7.0);
             vec3 dirt = mix(vec3(0.62, 0.47, 0.32), vec3(0.80, 0.64, 0.44), smoothstep(0.15, 0.85, t1 * 0.6 + t2 * 0.4));
             dirt *= 0.94 + mac.r * 0.12;
             // trodden middle is paler and smoother, the border darker
             dirt *= mix(0.86, 1.07, smoothstep(0.5, 0.95, e));
             // fine grit
             float g1 = gHash(floor(w * 38.0));
             dirt *= 1.0 - grain * (step(0.9, g1) * 0.16 - step(g1, 0.05) * 0.08);
             // pebbles, ~7 per meter, thinner toward the middle of the path
             if (uPebbles > 0.5 && near > 0.01) {
               vec3 pb = gPebble(w * 6.5);
               float keep = 1.0 - 0.6 * smoothstep(0.75, 1.0, e);
               float peb = pb.z > 0.0 && fract(pb.y * 3.7) < keep ? 1.0 - smoothstep(pb.z * 0.82, pb.z, pb.x) : 0.0;
               float rim = peb * smoothstep(pb.z * 0.45, pb.z, pb.x);
               vec3 stone = vec3(0.74, 0.70, 0.64) * (0.82 + 0.3 * fract(pb.y * 13.1));
               stone *= 1.0 - rim * 0.32;
               // a thin dark ring of shadow just outside each pebble
               float ring = pb.z > 0.0 ? smoothstep(pb.z * 1.35, pb.z, pb.x) * (1.0 - peb) : 0.0;
               dirt *= 1.0 - ring * 0.18 * near;
               dirt = mix(dirt, stone, peb * near);
             }
             diffuseColor.rgb = mix(diffuseColor.rgb, dirt, dirtMask);
           }

           // contact shadows stamped by rocks and stones (groundContact.ts)
           float ao = texture2D(uContact, macroUv).r;
           diffuseColor.rgb *= 1.0 - 0.55 * ao;`
        );
    };
    m.customProgramCacheKey = () => 'ground-macro-2';
    return m;
  }, [grass, macro]);
}

/** Distance from (x, z) to the nearest dirt path. */
export function pathDistance(x: number, z: number) {
  let d = Infinity;
  for (const p of PATHS) {
    for (let i = 0; i < p.length - 1; i++) {
      const [ax, az] = p[i];
      const vx = p[i + 1][0] - ax, vz = p[i + 1][1] - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
      d = Math.min(d, Math.hypot(x - ax - vx * t, z - az - vz * t));
    }
  }
  return d;
}

function SteppingStones() {
  const stones = useMemo(() => {
    const rand = seeded(23);
    const list: { pos: [number, number, number]; rot: number; s: number }[] = [];
    PATHS.forEach((path) => {
      for (let i = 0; i < path.length - 1; i++) {
        const [x0, z0] = path[i];
        const [x1, z1] = path[i + 1];
        const len = Math.hypot(x1 - x0, z1 - z0);
        const n = Math.max(1, Math.round(len / 0.75));
        for (let k = 0; k < n; k++) {
          if (rand() < 0.55) continue;
          const t = k / n;
          list.push({
            pos: [x0 + (x1 - x0) * t + (rand() - 0.5) * 0.35, 0.02, z0 + (z1 - z0) * t + (rand() - 0.5) * 0.35],
            rot: rand() * Math.PI,
            s: 0.26 + rand() * 0.12,
          });
        }
      }
    });
    // each stone sits in a soft hollow of shade, so it reads as set into the path (Etapa 2)
    for (const st of list) addGroundContact(st.pos[0], st.pos[2], st.s * 1.45, 0.32);
    return list;
  }, []);

  return (
    <>
      {stones.map((st, i) => (
        // chipped slabs with a flat walkable top (were flat discs); the top sits ~3 cm above the dirt
        <mesh key={i} position={[st.pos[0], 0.012, st.pos[2]]} rotation={[0, st.rot, 0]} scale={[st.s * 1.3, st.s * 0.5, st.s]} geometry={rockGeometry(i % 6, 'slab')} receiveShadow>
          <Toon color={i % 3 === 0 ? '#CDBFA8' : '#BCAF99'} vertexColors />
        </mesh>
      ))}
    </>
  );
}

const FENCE = { minX: -19.2, maxX: 19.2, minZ: -19.2, maxZ: 39.8 };

/** The village fence as rail segments, each starting at a post (also the birds' perches, Etapa 4). */
export function fenceLayout() {
  const list: { pos: [number, number, number]; rotY: number; len: number }[] = [];
  const seg = 2.4;
  /** One rail segment starting at t (along the side), cut around a gate gap [g0, g1] if it has one. */
  const rail = (t: number, len: number, at: (u: number) => [number, number, number], rotY: number, gap?: { c: number; hw: number }) => {
    if (!gap) return void list.push({ pos: at(t), rotY, len });
    const g0 = gap.c - gap.hw;
    const g1 = gap.c + gap.hw;
    if (t + len <= g0 || t >= g1) return void list.push({ pos: at(t), rotY, len });
    if (t < g0) list.push({ pos: at(t), rotY, len: g0 - t });
    if (t + len > g1) list.push({ pos: at(g1), rotY, len: t + len - g1 });
  };
  for (let x = FENCE.minX; x < FENCE.maxX - 0.1; x += seg) {
    const len = Math.min(seg, FENCE.maxX - x);
    // north: the Templo dos Enigmas gate; south: the Bosque Antigo gate
    rail(x, len, (u) => [u, 0, FENCE.minZ], 0, { c: GATE.x, hw: GATE.halfWidth });
    rail(x, len, (u) => [u, 0, FENCE.maxZ], 0, { c: SOUTH_GATE.x, hw: SOUTH_GATE.halfWidth });
  }
  for (let z = FENCE.minZ; z < FENCE.maxZ - 0.1; z += seg) {
    const len = Math.min(seg, FENCE.maxZ - z);
    // west: the Bambuzal gate; east: the Bairro das Glicínias gate
    rail(z, len, (u) => [FENCE.minX, 0, u], -Math.PI / 2, { c: WEST_GATE.z, hw: WEST_GATE.halfWidth });
    rail(z, len, (u) => [FENCE.maxX, 0, u], -Math.PI / 2, { c: EAST_GATE.z, hw: EAST_GATE.halfWidth });
  }
  return list;
}

/** Height of a fence post's top (the post is 1.1 m tall). */
export const FENCE_POST_TOP = 1.1;

function Fence() {
  const posts = useMemo(fenceLayout, []);

  return (
    <>
      {posts.map((p, i) => (
        <group key={i} position={p.pos} rotation={[0, p.rotY, 0]}>
          <mesh position={[0, 0.55, 0]} castShadow>
            <boxGeometry args={[0.16, 1.1, 0.16]} />
            <Toon color="#7A5536" />
          </mesh>
          <mesh position={[p.len / 2, 0.75, 0]}>
            <boxGeometry args={[p.len, 0.1, 0.07]} />
            <Toon color="#94693F" />
          </mesh>
          <mesh position={[p.len / 2, 0.4, 0]}>
            <boxGeometry args={[p.len, 0.1, 0.07]} />
            <Toon color="#94693F" />
          </mesh>
        </group>
      ))}
    </>
  );
}

export function Ground() {
  const grass = useGrassTexture();
  const plaza = usePlazaTexture();
  const macro = useGroundMacro();
  const groundMat = useGroundMaterial(grass, macro);
  useFrame(() => {
    const ui = useUiSettings.getState();
    pebbleSwitch.value = renderProfile(ui.quality, ui.autoLevel).pebbles ? 1 : 0;
  });

  return (
    <>
      <RigidBody type="fixed" colliders={false} name="ground">
        <CuboidCollider args={[GROUND.w / 2, 1.5, GROUND.d / 2]} position={[GROUND.minX + GROUND.w / 2, -1.5, GROUND.minZ + GROUND.d / 2]} />
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[GROUND.minX + GROUND.w / 2, 0, GROUND.minZ + GROUND.d / 2]}>
          <planeGeometry args={[GROUND.w, GROUND.d]} />
          <primitive object={groundMat} attach="material" />
        </mesh>
      </RigidBody>

      <mesh receiveShadow position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[4.6, 48]} />
        <meshToonMaterial map={plaza} />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[4.55, 4.85, 48]} />
        <Toon color="#7E7263" />
      </mesh>

      <SteppingStones />
      <Fence />

      <RigidBody type="fixed" colliders={false}>
        {/* north side in two pieces around the temple gate (the gate has its own door collider) */}
        <CuboidCollider args={[(GATE.x - GATE.halfWidth + 22) / 2, 3, 0.3]} position={[(GATE.x - GATE.halfWidth - 22) / 2, 2, FENCE.minZ - 0.4]} />
        <CuboidCollider args={[(22 - GATE.x - GATE.halfWidth) / 2, 3, 0.3]} position={[(22 + GATE.x + GATE.halfWidth) / 2, 2, FENCE.minZ - 0.4]} />
        {/* south side in two pieces around the Bosque Antigo gate */}
        <CuboidCollider args={[(SOUTH_GATE.x - SOUTH_GATE.halfWidth + 22) / 2, 3, 0.3]} position={[(SOUTH_GATE.x - SOUTH_GATE.halfWidth - 22) / 2, 2, FENCE.maxZ + 0.4]} />
        <CuboidCollider args={[(22 - SOUTH_GATE.x - SOUTH_GATE.halfWidth) / 2, 3, 0.3]} position={[(22 + SOUTH_GATE.x + SOUTH_GATE.halfWidth) / 2, 2, FENCE.maxZ + 0.4]} />
        {/* west side in two pieces around the Bambuzal gate */}
        <CuboidCollider args={[0.3, 3, (WEST_GATE.z - WEST_GATE.halfWidth + 22) / 2]} position={[FENCE.minX - 0.4, 2, (WEST_GATE.z - WEST_GATE.halfWidth - 22) / 2]} />
        <CuboidCollider args={[0.3, 3, (42 - WEST_GATE.z - WEST_GATE.halfWidth) / 2]} position={[FENCE.minX - 0.4, 2, (42 + WEST_GATE.z + WEST_GATE.halfWidth) / 2]} />
        {/* east side in two pieces around the Bairro das Glicínias gate */}
        <CuboidCollider args={[0.3, 3, (EAST_GATE.z - EAST_GATE.halfWidth + 22) / 2]} position={[FENCE.maxX + 0.4, 2, (EAST_GATE.z - EAST_GATE.halfWidth - 22) / 2]} />
        <CuboidCollider args={[0.3, 3, (42 - EAST_GATE.z - EAST_GATE.halfWidth) / 2]} position={[FENCE.maxX + 0.4, 2, (42 + EAST_GATE.z + EAST_GATE.halfWidth) / 2]} />
      </RigidBody>
    </>
  );
}
