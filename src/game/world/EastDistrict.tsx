import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { Toon, Ink, enhanceToon, getGradient, windTime } from '../materials';
import { getPuffGeometry } from '../foliageGeometry';
import { House, PaperLantern } from './Buildings';
import { usePlazaTexture } from './Ground';
import { DistanceCull } from '../DistanceCull';
import { SakuraTree, PineTree, Bamboo, MapleTree, StoneLantern } from './Props';
import {
  EAST_FENCE, EAST_GATE, EAST_PLAZA, PERGOLA, POND, POND_STONES, KOI, TEA, LOOKOUT, WIND_BELL,
  EAST_HOUSES, RIDGE, RIDGE_Z1, EAST_TREES,
} from '../../data/east';
import { Rock } from './Rock';

/**
 * Bairro das Glicínias (art audit §25): lane of houses under a wisteria tunnel, a koi pond, tea
 * terraces climbing to a rocky ridge with a lookout. Static parts go through StaticMerge; the moving
 * ones (water, koi, ducks, laundry, wind bell, instanced wisteria) are marked dynamic.
 */

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const STONE = '#A8A196';
const STONE_DARK = '#8E877C';
const WOOD = '#6A4630';
const SOIL = '#9A7550';

// ── Fence around the district (north and east) ──────────────────────────────

function DistrictFence() {
  const rails = useMemo(() => {
    const list: { pos: [number, number, number]; rotY: number; len: number }[] = [];
    const seg = 2.4;
    for (let x = EAST_GATE.x; x < EAST_FENCE.maxX - 0.1; x += seg) list.push({ pos: [x, 0, EAST_FENCE.minZ], rotY: 0, len: Math.min(seg, EAST_FENCE.maxX - x) });
    for (let z = EAST_FENCE.minZ; z < RIDGE[RIDGE.length - 1].z0 - 0.1; z += seg) list.push({ pos: [EAST_FENCE.maxX, 0, z], rotY: -Math.PI / 2, len: Math.min(seg, RIDGE[RIDGE.length - 1].z0 - z) });
    return list;
  }, []);
  const zMid = (EAST_FENCE.minZ + RIDGE_Z1) / 2;
  return (
    <>
      {rails.map((p, i) => (
        <group key={i} position={p.pos} rotation={[0, p.rotY, 0]}>
          <mesh position={[0, 0.55, 0]} castShadow>
            <boxGeometry args={[0.16, 1.1, 0.16]} />
            <Toon color="#7A5536" />
          </mesh>
          {[0.75, 0.4].map((y) => (
            <mesh key={y} position={[p.len / 2, y, 0]}>
              <boxGeometry args={[p.len, 0.1, 0.07]} />
              <Toon color="#94693F" />
            </mesh>
          ))}
        </group>
      ))}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[(EAST_FENCE.maxX - EAST_GATE.x) / 2 + 0.4, 3, 0.3]} position={[(EAST_FENCE.maxX + EAST_GATE.x) / 2, 2, EAST_FENCE.minZ - 0.4]} />
        <CuboidCollider args={[0.3, 3, (RIDGE_Z1 - EAST_FENCE.minZ) / 2]} position={[EAST_FENCE.maxX + 0.4, 2, zMid]} />
      </RigidBody>
    </>
  );
}

/** Gate posts and a little roof over the opening in the village fence. */
function EastGate() {
  const { x, z, halfWidth } = EAST_GATE;
  return (
    <group position={[x, 0, z]}>
      {[-1, 1].map((s) => (
        <RigidBody key={s} type="fixed" colliders={false} position={[0, 0, s * (halfWidth + 0.05)]}>
          <CuboidCollider args={[0.14, 1.2, 0.14]} position={[0, 1.2, 0]} />
          <mesh position={[0, 1.2, 0]} castShadow>
            <boxGeometry args={[0.26, 2.4, 0.26]} />
            <Toon color={WOOD} tex="wood" />
            <Ink thickness={0.02} />
          </mesh>
        </RigidBody>
      ))}
      <mesh position={[0, 2.45, 0]} castShadow>
        <boxGeometry args={[0.36, 0.16, halfWidth * 2 + 0.7]} />
        <Toon color={WOOD} tex="wood" />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.32, 2.62, 0]} rotation={[0, 0, s * 0.62]} castShadow>
          <boxGeometry args={[0.72, 0.06, halfWidth * 2 + 1.0]} />
          <Toon color="#6A4F8C" tex="tiles" />
        </mesh>
      ))}
      <PaperLantern position={[0.2, 2.1, -halfWidth + 0.35]} color="#9C7CC8" />
      <PaperLantern position={[0.2, 2.1, halfWidth - 0.35]} color="#9C7CC8" />
    </group>
  );
}

// ── Plaza ────────────────────────────────────────────────────────────────────

function Plaza() {
  // the same radial flagstones as the village plaza, so the two squares feel like one town
  const flag = usePlazaTexture();
  const stones = useMemo(() => {
    const r = seeded(77);
    return Array.from({ length: 30 }).map((_, i) => {
      const a = (i / 30) * Math.PI * 2;
      return { p: [EAST_PLAZA.x + Math.cos(a) * (EAST_PLAZA.r + 0.1), 0.05, EAST_PLAZA.z + Math.sin(a) * (EAST_PLAZA.r + 0.1)] as [number, number, number], s: 0.22 + r() * 0.1, rot: r() * 6 };
    });
  }, []);
  return (
    <group>
      <mesh position={[EAST_PLAZA.x, 0.014, EAST_PLAZA.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[EAST_PLAZA.r, 40]} />
        <meshToonMaterial map={flag} gradientMap={getGradient()} />
      </mesh>
      {stones.map((s, i) => (
        <Rock key={i} variant={i % 5} kind="flat" position={s.p} rotation={[0, s.rot, 0]} scale={[s.s * 1.4, s.s * 0.8, s.s]} color={i % 3 ? STONE : STONE_DARK} receiveShadow />
      ))}
      {/* hokora: a tiny roadside shrine, the heart of the neighbourhood */}
      <RigidBody type="fixed" colliders={false} position={[EAST_PLAZA.x - 0.2, 0, EAST_PLAZA.z + EAST_PLAZA.r + 0.9]}>
        <CuboidCollider args={[0.45, 0.6, 0.4]} position={[0, 0.6, 0]} />
        <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.9, 0.6, 0.8]} />
          <Toon color={STONE} tex="stone" />
        </mesh>
        <mesh position={[0, 0.85, 0]} castShadow>
          <boxGeometry args={[0.6, 0.5, 0.5]} />
          <Toon color="#B5523E" tex="wood" />
          <Ink thickness={0.015} />
        </mesh>
        <mesh position={[0, 0.82, -0.26]}>
          <boxGeometry args={[0.32, 0.32, 0.02]} />
          <Toon color="#2A1D16" />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.2, 1.18, 0]} rotation={[0, 0, s * 0.7]} castShadow>
            <boxGeometry args={[0.5, 0.05, 0.7]} />
            <Toon color="#4A3A30" tex="tiles" />
          </mesh>
        ))}
        {/* offerings: two mandarins and a cup */}
        {[-0.14, 0.14].map((x) => (
          <mesh key={x} position={[x, 0.66, -0.3]}>
            <sphereGeometry args={[0.06, 10, 8]} />
            <Toon color="#F29A2E" />
          </mesh>
        ))}
      </RigidBody>
      {/* benches facing the plaza */}
      {/* benches on the rim, between the paths that leave the plaza, facing its centre */}
      {[Math.PI * 0.28, Math.PI * 1.25].map((a) => (
        <Bench key={a} position={[EAST_PLAZA.x + Math.cos(a) * (EAST_PLAZA.r + 0.8), 0, EAST_PLAZA.z + Math.sin(a) * (EAST_PLAZA.r + 0.8)]} rotY={-(a + Math.PI / 2)} />
      ))}
      {/* lanterns flanking the path that comes in from the gate */}
      <StoneLantern position={[EAST_PLAZA.x - 3.6, 0, EAST_PLAZA.z - 1.7]} />
      <StoneLantern position={[EAST_PLAZA.x - 3.6, 0, EAST_PLAZA.z + 1.7]} />
    </group>
  );
}

export function Bench({ position, rotY = 0 }: { position: [number, number, number]; rotY?: number }) {
  return (
    <RigidBody type="fixed" colliders={false} position={position} rotation={[0, rotY, 0]}>
      <CuboidCollider args={[0.75, 0.22, 0.24]} position={[0, 0.22, 0]} />
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.08, 0.46]} />
        <Toon color="#9B7048" tex="planks" />
        <Ink thickness={0.012} />
      </mesh>
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} position={[x, 0.2, 0]} castShadow>
          <boxGeometry args={[0.12, 0.4, 0.4]} />
          <Toon color={STONE} tex="stone" />
        </mesh>
      ))}
    </RigidBody>
  );
}

// ── Wisteria tunnel ─────────────────────────────────────────────────────────

/**
 * A hanging raceme: a chain of small flower beads, widest at the stem and tapering to a point,
 * deep violet at the top and pale lilac at the tip (vertex colors). Reads as a wisteria cluster
 * instead of the stiff cones it replaced.
 */
function racemeGeometry() {
  const r = seeded(7);
  const parts: THREE.BufferGeometry[] = [];
  const N = 8;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const rad = 0.085 - 0.05 * t;
    const g = new THREE.SphereGeometry(rad, 5, 3).toNonIndexed();
    g.translate((r() - 0.5) * 0.04, -0.07 * i - rad * 0.5, (r() - 0.5) * 0.04);
    parts.push(g);
  }
  const pos: number[] = [];
  const nor: number[] = [];
  for (const g of parts) {
    pos.push(...(g.getAttribute('position').array as Float32Array));
    nor.push(...(g.getAttribute('normal').array as Float32Array));
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  const len = 0.07 * N;
  const col = new Float32Array(pos.length);
  const top = new THREE.Color('#7A58AE');
  const tip = new THREE.Color('#EADFFA');
  const c = new THREE.Color();
  for (let i = 0; i < pos.length / 3; i++) {
    c.copy(top).lerp(tip, THREE.MathUtils.clamp(-pos[i * 3 + 1] / len, 0, 1));
    col.set([c.r, c.g, c.b], i * 3);
  }
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

function Pergola() {
  const { x, z0, z1, halfWidth } = PERGOLA;
  const H = 2.55;
  const posts = [0, 1, 2, 3].map((i) => z0 + ((z1 - z0) * i) / 3);
  const wisteria = useMemo(() => {
    const r = seeded(404);
    const mat = new THREE.MeshToonMaterial({ gradientMap: getGradient(), vertexColors: true });
    enhanceToon(mat, false);
    const n = 100;
    const mesh = new THREE.InstancedMesh(racemeGeometry(), mat, n);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const tint = new THREE.Color();
    for (let i = 0; i < n; i++) {
      // denser along the two side beams, a few hanging in the middle of the tunnel
      const side = i % 5 === 0 ? (r() - 0.5) * 1.2 : (r() > 0.5 ? 1 : -1) * (halfWidth - 0.15 - r() * 0.45);
      const zz = z0 + (z1 - z0) * r();
      const len = 0.7 + r() * 0.5;
      q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.25, r() * 6, (r() - 0.5) * 0.25));
      const wide = 0.85 + r() * 0.3;
      m.compose(new THREE.Vector3(x + side, H - 0.02, zz), q, new THREE.Vector3(wide, len, wide));
      mesh.setMatrixAt(i, m);
      // mostly lilac, some deeper violet and a few white racemes
      const k = r();
      tint.set(k > 0.88 ? '#FFFFFF' : k > 0.6 ? '#C7A6E8' : '#E9DDF8');
      mesh.setColorAt(i, tint);
    }
    mesh.castShadow = true;
    mesh.userData.dynamic = true;
    return mesh;
  }, [x, z0, z1, halfWidth]);
  useEffect(() => () => {
    wisteria.geometry.dispose();
    (wisteria.material as THREE.Material).dispose();
  }, [wisteria]);
  // a slow breeze through the racemes
  useFrame(() => {
    wisteria.rotation.z = Math.sin(windTime.value * 0.9) * 0.004;
  });
  return (
    <group>
      {posts.map((z) => [-1, 1].map((s) => (
        <RigidBody key={`${z}${s}`} type="fixed" colliders={false} position={[x + s * halfWidth, 0, z]}>
          <CuboidCollider args={[0.08, H / 2, 0.08]} position={[0, H / 2, 0]} />
          <mesh position={[0, H / 2, 0]} castShadow>
            <boxGeometry args={[0.16, H, 0.16]} />
            <Toon color={WOOD} tex="wood" />
          </mesh>
        </RigidBody>
      )))}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[x + s * halfWidth, H + 0.06, (z0 + z1) / 2]} castShadow>
          <boxGeometry args={[0.14, 0.14, Math.abs(z1 - z0) + 0.6]} />
          <Toon color={WOOD} tex="wood" />
        </mesh>
      ))}
      {Array.from({ length: 9 }).map((_, i) => (
        <mesh key={i} position={[x, H + 0.17, z0 + ((z1 - z0) * i) / 8]} castShadow>
          <boxGeometry args={[halfWidth * 2 + 0.5, 0.08, 0.09]} />
          <Toon color="#7A5536" tex="wood" />
        </mesh>
      ))}
      {/* leafy vine along the top (foliage material: it turns see-through when it hides the cat), then the flowers */}
      {Array.from({ length: 7 }).map((_, i) => (
        <mesh key={i} position={[x + (i % 2 ? 0.7 : -0.7), H + 0.32, z0 + ((z1 - z0) * (i + 0.5)) / 7]} scale={[0.75, 0.3, 0.6]} rotation={[0, i, 0]} geometry={getPuffGeometry(i, 'low')} dispose={null} castShadow>
          <Toon color={i % 3 ? '#5E9A4A' : '#6DAA52'} wind vertexColors />
        </mesh>
      ))}
      <primitive object={wisteria} />
    </group>
  );
}

// ── Koi pond ────────────────────────────────────────────────────────────────

/** Still-water shader shared by the districts: koi pond, hot spring (warmer colors), forest stream. */
export function usePondMaterial(shallow = '#CFEEE5', deep = '#87C4CF') {
  return useMemo(() => new THREE.ShaderMaterial({
    fog: true,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: windTime, uShallow: { value: new THREE.Color(shallow) }, uDeep: { value: new THREE.Color(deep) } },
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vec4 mvPosition = viewMatrix * world;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform vec3 uShallow, uDeep;
      varying vec2 vUv;
      varying vec3 vWorld;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      void main() {
        float r = length(vUv * 2.0 - 1.0);              // 0 centre, 1 rim
        vec2 p = vWorld.xz;
        float depth = 1.0 - smoothstep(0.15, 1.0, r + (noise(p * 1.4 + uTime * 0.2) - 0.5) * 0.1);
        vec3 col = mix(uShallow, uDeep, smoothstep(0.1, 0.8, depth));
        float ca = noise(p * 2.6 + vec2(uTime * 0.4, uTime * 0.25)) * noise(p * 3.3 - vec2(uTime * 0.3, -uTime * 0.2));
        col += vec3(0.9, 1.0, 0.95) * smoothstep(0.22, 0.42, ca) * (1.0 - depth) * 0.16;
        float g = noise(p * 3.6 + vec2(uTime * 0.9, -uTime * 0.6));
        col += smoothstep(0.87, 0.91, g) * 0.3;
        col = mix(col, vec3(0.95, 0.99, 1.0), smoothstep(0.9, 0.98, r) * 0.55);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  }), [shallow, deep]);
}

/** A koi: rounded body, tail fin and two small side fins, nose along +x. */
function koiGeometry() {
  const body = new THREE.SphereGeometry(0.1, 10, 7);
  body.scale(2.1, 0.62, 0.85);
  const tail = new THREE.ConeGeometry(0.08, 0.16, 6);
  tail.rotateZ(Math.PI / 2);
  tail.scale(1, 0.4, 1.2);
  tail.translate(-0.27, 0, 0);
  const parts = [body, tail].map((g) => g.toNonIndexed());
  const pos: number[] = [];
  const nor: number[] = [];
  for (const g of parts) {
    pos.push(...(g.getAttribute('position').array as Float32Array));
    nor.push(...(g.getAttribute('normal').array as Float32Array));
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return out;
}

function Koi() {
  const fish = useMemo(() => {
    const colors: string[] = [
      ...Array(KOI.orange).fill('#F28C38'),
      ...Array(KOI.white).fill('#FBF8F2'),
      ...Array(KOI.spotted).fill('#FBF1E6'),
    ];
    const r = seeded(912);
    return colors.map((c, i) => ({
      c, spotted: i >= KOI.orange + KOI.white,
      // each fish swims its own slow ellipse: different size, speed, direction and phase
      a: 0.35 + r() * 0.5, b: 0.3 + r() * 0.45, speed: (0.16 + r() * 0.18) * (r() > 0.4 ? 1 : -1), phase: r() * 6.3,
      ox: (r() - 0.5) * 1.6, oz: (r() - 0.5) * 0.9, y: -0.02 + r() * 0.03,
    }));
  }, []);
  const { bodies, spots } = useMemo(() => {
    const mat = new THREE.MeshToonMaterial({ gradientMap: getGradient() });
    const bodies = new THREE.InstancedMesh(koiGeometry(), mat, fish.length);
    const c = new THREE.Color();
    fish.forEach((f, i) => bodies.setColorAt(i, c.set(f.c)));
    const spotMat = new THREE.MeshToonMaterial({ gradientMap: getGradient(), color: '#E8662A' });
    const spots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 8, 6), spotMat, fish.filter((f) => f.spotted).length * 2);
    bodies.frustumCulled = false;
    spots.frustumCulled = false;
    return { bodies, spots };
  }, [fish]);
  useEffect(() => () => {
    bodies.geometry.dispose();
    (bodies.material as THREE.Material).dispose();
    spots.geometry.dispose();
    (spots.material as THREE.Material).dispose();
  }, [bodies, spots]);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), s: new THREE.Vector3(1, 1, 1), p: new THREE.Vector3(), o: new THREE.Vector3() }), []);
  useFrame(() => {
    const t = windTime.value;
    let k = 0;
    fish.forEach((f, i) => {
      const ang = f.phase + t * f.speed;
      const x = POND.x + f.ox + Math.cos(ang) * POND.rx * f.a;
      const z = POND.z + f.oz + Math.sin(ang) * POND.rz * f.b;
      // heading = derivative of the ellipse, plus a little tail wiggle
      const dx = -Math.sin(ang) * POND.rx * f.a * f.speed;
      const dz = Math.cos(ang) * POND.rz * f.b * f.speed;
      const yaw = Math.atan2(-dz, dx) + Math.sin(t * 6 + i) * 0.12;
      tmp.q.setFromEuler(tmp.e.set(0, yaw, 0));
      tmp.m.compose(tmp.p.set(x, f.y, z), tmp.q, tmp.s);
      bodies.setMatrixAt(i, tmp.m);
      if (f.spotted) {
        for (const off of [0.06, -0.09]) {
          tmp.o.set(off, 0.04, 0.01).applyQuaternion(tmp.q).add(tmp.p);
          tmp.m.compose(tmp.o, tmp.q, tmp.s.set(1.2, 0.5, 0.9));
          spots.setMatrixAt(k++, tmp.m);
          tmp.s.set(1, 1, 1);
        }
      }
    });
    bodies.instanceMatrix.needsUpdate = true;
    spots.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <primitive object={bodies} />
      <primitive object={spots} />
    </group>
  );
}

/** A mother duck and three ducklings paddling in line around the pond. */
function Ducks() {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const t = windTime.value * 0.12;
    g.children.forEach((d, i) => {
      const ang = t - i * 0.2;
      const x = POND.x + Math.cos(ang) * POND.rx * 0.7;
      const z = POND.z + Math.sin(ang) * POND.rz * 0.66;
      d.position.set(x, 0.02 + Math.sin(windTime.value * 3 + i) * 0.01, z);
      d.rotation.y = Math.atan2(-Math.cos(ang) * POND.rz, -Math.sin(ang) * POND.rx) + Math.PI;
    });
  });
  return (
    <group ref={group}>
      {[1, 0.55, 0.5, 0.5].map((s, i) => (
        <group key={i} scale={s}>
          <mesh position={[0, 0.12, 0]} scale={[1.4, 0.8, 1]}>
            <sphereGeometry args={[0.16, 12, 9]} />
            <Toon color={i === 0 ? '#F3EEE2' : '#F6D86A'} />
          </mesh>
          <mesh position={[0.18, 0.28, 0]}>
            <sphereGeometry args={[0.09, 10, 8]} />
            <Toon color={i === 0 ? '#3E7A52' : '#F6D86A'} />
          </mesh>
          <mesh position={[0.28, 0.27, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.035, 0.09, 6]} />
            <Toon color="#F29A2E" />
          </mesh>
          <mesh position={[-0.21, 0.17, 0]} rotation={[0, 0, 0.6]}>
            <coneGeometry args={[0.05, 0.12, 5]} />
            <Toon color={i === 0 ? '#E6DFD0' : '#EDCB55'} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Pond() {
  const water = usePondMaterial();
  const rim = useMemo(() => {
    const r = seeded(55);
    return Array.from({ length: 34 }).map((_, i) => {
      const a = (i / 34) * Math.PI * 2 + r() * 0.08;
      const k = 1.02 + r() * 0.05;
      return { p: [POND.x + Math.cos(a) * POND.rx * k, 0.06, POND.z + Math.sin(a) * POND.rz * k] as [number, number, number], s: 0.24 + r() * 0.16, rot: r() * 6 };
    });
  }, []);
  const pads = useMemo(() => {
    const r = seeded(88);
    return Array.from({ length: 7 }).map(() => {
      const a = r() * Math.PI * 2;
      const d = 0.45 + r() * 0.4;
      return { p: [POND.x + Math.cos(a) * POND.rx * d, 0.045, POND.z + Math.sin(a) * POND.rz * d] as [number, number, number], s: 0.18 + r() * 0.1, flower: r() > 0.55, rot: r() * 6 };
    });
  }, []);
  return (
    <group>
      <mesh position={[POND.x, 0.035, POND.z]} rotation={[-Math.PI / 2, 0, 0]} scale={[POND.rx, POND.rz, 1]} userData={{ dynamic: true }}>
        <circleGeometry args={[1, 48]} />
        <primitive object={water} attach="material" />
      </mesh>
      {rim.map((s, i) => (
        <Rock key={i} variant={i % 5} kind="flat" position={s.p} rotation={[0, s.rot, 0]} scale={[s.s * 1.3, s.s * 0.95, s.s]} color={i % 4 ? STONE : STONE_DARK} castShadow receiveShadow />
      ))}
      {POND_STONES.map((p, i) => (
        <RigidBody key={i} type="fixed" colliders={false} position={p}>
          <CylinderCollider args={[0.14, 0.52]} position={[0, 0.14, 0]} />
          <mesh position={[0, 0.13, 0]} scale={[1, 1, 0.85]} rotation={[0, i, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.52, 0.6, 0.28, 9]} />
            <Toon color={STONE} />
            <Ink thickness={0.015} />
          </mesh>
        </RigidBody>
      ))}
      {pads.map((l, i) => (
        <group key={i} position={l.p} rotation={[0, l.rot, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[l.s, 14, 0.4, Math.PI * 2 - 0.4]} />
            <Toon color={i % 2 ? '#5E9A4A' : '#6DAA52'} side={THREE.DoubleSide} />
          </mesh>
          {l.flower && (
            <mesh position={[0, 0.05, 0]} scale={[1, 0.6, 1]}>
              <sphereGeometry args={[0.06, 8, 6]} />
              <Toon color="#F7B6CB" />
            </mesh>
          )}
        </group>
      ))}
      <DistanceCull center={[POND.x, 0, POND.z]} far={26}>
        <Koi />
        <Ducks />
      </DistanceCull>
    </group>
  );
}

// ── Houses, gardens and laundry ─────────────────────────────────────────────

function Mailbox({ position, rotY }: { position: [number, number, number]; rotY: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[0.06, 0.8, 0.06]} />
        <Toon color={WOOD} />
      </mesh>
      <mesh position={[0, 0.86, 0]} castShadow>
        <boxGeometry args={[0.22, 0.17, 0.16]} />
        <Toon color="#C8463A" />
        <Ink thickness={0.012} />
      </mesh>
    </group>
  );
}

function Laundry({ from, to }: { from: [number, number]; to: [number, number] }) {
  const cloths = useRef<THREE.Group>(null);
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const rot = -Math.atan2(to[1] - from[1], to[0] - from[0]);
  useFrame(() => {
    cloths.current?.children.forEach((c, i) => {
      c.rotation.x = Math.sin(windTime.value * 2.1 + i * 0.9) * 0.18 + 0.08;
    });
  });
  const colors = ['#FFFFFF', '#9CC4E8', '#F7B6CB', '#FFE58A', '#C7A6E8'];
  return (
    <group position={[from[0], 0, from[1]]} rotation={[0, rot, 0]}>
      {[0, len].map((x) => (
        <mesh key={x} position={[x, 0.9, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.05, 1.8, 6]} />
          <Toon color={WOOD} />
        </mesh>
      ))}
      <mesh position={[len / 2, 1.72, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.008, 0.008, len, 4]} />
        <Toon color="#EDE6DA" />
      </mesh>
      <group ref={cloths} userData={{ dynamic: true }}>
        {colors.map((c, i) => (
          <group key={i} position={[0.35 + (i * (len - 0.7)) / (colors.length - 1), 1.72, 0]}>
            <mesh position={[0, -0.26, 0]} castShadow>
              <boxGeometry args={[0.36, 0.5, 0.015]} />
              <Toon color={c} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

function Houses() {
  return (
    <>
      {EAST_HOUSES.map((h, i) => (
        <House key={i} position={h.pos} rotY={h.rotY} size={h.size} wall={h.wall} roof={h.roof} noren={h.noren} flower={h.flower} lanterns={i === 4} tiered={i === 4} />
      ))}
      {/* mailboxes at the lane edge, in front of each house */}
      {EAST_HOUSES.slice(0, 4).map((h, i) => (
        <Mailbox key={i} position={[h.pos[0] + (h.rotY > 0 ? 2.75 : -2.75), 0, h.pos[2] + 1.15]} rotY={h.rotY} />
      ))}
      <DistanceCull center={[29, 0, -6]} far={30}>
        <Laundry from={[35.4, -7.6]} to={[38.6, -8.6]} />
        <Laundry from={[20.4, -3.2]} to={[20.6, -6.4]} />
      </DistanceCull>
    </>
  );
}

// ── Tea terraces, ridge and lookout ─────────────────────────────────────────

function TeaTerraces() {
  const bushes = useMemo(() => {
    const list: { p: [number, number, number]; s: number; v: number }[] = [];
    const r = seeded(303);
    TEA.levels.forEach((lv, li) => {
      const z1 = li + 1 < TEA.levels.length ? TEA.levels[li + 1].z0 : TEA.z1;
      for (let row = 0; row < TEA.rows; row++) {
        const z = lv.z0 + ((z1 - lv.z0) * (row + 0.5)) / TEA.rows;
        for (let k = 0; k < TEA.perRow; k++) {
          const x = TEA.x0 + 0.9 + ((TEA.x1 - TEA.x0 - 1.5) * k) / (TEA.perRow - 1);
          list.push({ p: [x, lv.h, z], s: 0.34 + r() * 0.05, v: k + row });
        }
      }
    });
    return list;
  }, []);
  return (
    <group>
      {TEA.levels.map((lv, li) => {
        const z1 = TEA.z1;
        const d = z1 - lv.z0;
        const w = TEA.x1 - TEA.x0;
        return (
          <RigidBody key={li} type="fixed" colliders={false} userData={{ surface: 'stone' }}>
            <CuboidCollider args={[w / 2, lv.h / 2, d / 2]} position={[(TEA.x0 + TEA.x1) / 2, lv.h / 2, lv.z0 + d / 2]} />
            {/* stone retaining wall, soil on top */}
            <mesh position={[(TEA.x0 + TEA.x1) / 2, lv.h / 2 - 0.02, lv.z0 + d / 2]} castShadow receiveShadow>
              <boxGeometry args={[w, lv.h - 0.04, d]} />
              <Toon color={STONE} tex="stone" />
              <Ink thickness={0.02} />
            </mesh>
            <mesh position={[(TEA.x0 + TEA.x1) / 2, lv.h - 0.02, lv.z0 + d / 2]} receiveShadow>
              <boxGeometry args={[w - 0.1, 0.05, d - 0.1]} />
              <Toon color={SOIL} />
            </mesh>
            {/* stone step at the west end, half the rise */}
            <CuboidCollider args={[0.5, (lv.h - 0.25) / 2, 0.24]} position={[TEA.x0 + 0.7, (lv.h - 0.25) / 2, lv.z0 - 0.24]} />
            <mesh position={[TEA.x0 + 0.7, (lv.h - 0.25) / 2, lv.z0 - 0.24]} castShadow receiveShadow>
              <boxGeometry args={[1.0, lv.h - 0.25, 0.48]} />
              <Toon color={STONE_DARK} tex="stone" />
            </mesh>
          </RigidBody>
        );
      })}
      {bushes.map((b, i) => (
        <mesh key={i} position={[b.p[0], b.p[1] + b.s * 0.55, b.p[2]]} scale={[b.s * 1.25, b.s * 0.85, b.s * 1.05]} rotation={[0, i * 1.7, 0]} geometry={getPuffGeometry(b.v, 'tiny')} dispose={null} castShadow receiveShadow>
          <Toon color={i % 3 ? '#4E9446' : '#5DA54E'} vertexColors />
        </mesh>
      ))}
    </group>
  );
}

function Ridge() {
  const boulders = useMemo(() => {
    const r = seeded(611);
    const list: { p: [number, number, number]; s: [number, number, number]; rot: [number, number, number]; c: string }[] = [];
    const tones = ['#9A9184', '#8A8174', '#A39A8C', '#7F776B'];
    for (const seg of RIDGE) {
      // two staggered rows of boulders on the face, big at the foot and smaller higher up, so the cliff
      // reads as stacked rock (the plain box behind only fills the gaps)
      for (let row = 0; row < 3; row++) {
        const y0 = (seg.h * row) / 3;
        for (let x = seg.x0 + 0.3 + (row % 2) * 0.6; x < seg.x1 - 0.2; x += 1.0 + r() * 0.6) {
          const s = (1.15 - row * 0.22) * (0.75 + r() * 0.45);
          list.push({ p: [x, y0 + s * 0.45, seg.z0 + 0.05 + r() * 0.1], s: [s * 1.15, s * 0.85, s * 0.55], rot: [r() * 0.5, r() * 6, r() * 0.5], c: tones[Math.floor(r() * tones.length)] });
        }
      }
      // an uneven skyline: rocks and shrubs sitting on the top edge
      for (let x = seg.x0 + 0.5; x < seg.x1 - 0.3; x += 1.4 + r() * 1.2) {
        const s = 0.5 + r() * 0.55;
        list.push({ p: [x, seg.h + s * 0.25, seg.z0 + 0.4 + r() * 0.8], s: [s * 1.2, s * 0.7, s], rot: [0, r() * 6, 0], c: tones[Math.floor(r() * tones.length)] });
      }
    }
    return list;
  }, []);
  return (
    <group>
      {RIDGE.map((seg, i) => {
        const w = seg.x1 - seg.x0;
        const d = RIDGE_Z1 - seg.z0;
        return (
          <RigidBody key={i} type="fixed" colliders={false} userData={{ surface: 'stone' }}>
            {/* the collider starts in front of the face, where the boulders stick out */}
            <CuboidCollider args={[w / 2, seg.h / 2, (d + 0.45) / 2]} position={[(seg.x0 + seg.x1) / 2, seg.h / 2, seg.z0 - 0.45 + (d + 0.45) / 2]} />
            <mesh position={[(seg.x0 + seg.x1) / 2, seg.h / 2, seg.z0 + 0.3 + d / 2]} castShadow receiveShadow>
              <boxGeometry args={[w, seg.h, d - 0.2]} />
              <Toon color="#857D71" />
            </mesh>
            <mesh position={[(seg.x0 + seg.x1) / 2, seg.h + 0.06, seg.z0 + d / 2]} receiveShadow>
              <boxGeometry args={[w + 0.1, 0.14, d - 0.2]} />
              <Toon color="#6FA350" />
            </mesh>
            {Array.from({ length: Math.floor(w / 1.6) }).map((_, k) => (
              <mesh key={k} position={[seg.x0 + 0.9 + k * 1.6, seg.h + 0.2, seg.z0 + 1.4 + (k % 2) * 0.9]} scale={[0.7, 0.42, 0.6]} rotation={[0, k * 1.3, 0]} geometry={getPuffGeometry(k + i, 'low')} dispose={null} castShadow>
                <Toon color={k % 2 ? '#5E9A4A' : '#4F8A44'} vertexColors />
              </mesh>
            ))}
          </RigidBody>
        );
      })}
      {boulders.map((b, i) => (
        <Rock key={i} variant={i % 6} moss={i % 2 === 0} position={b.p} rotation={b.rot} scale={b.s} color={b.c} castShadow receiveShadow />
      ))}
    </group>
  );
}

function Lookout() {
  const { x0, x1, z0, z1, h } = LOOKOUT;
  const w = x1 - x0;
  const d = z1 - z0;
  return (
    <group>
      <RigidBody type="fixed" colliders={false} userData={{ surface: 'wood' }}>
        <CuboidCollider args={[w / 2, h / 2, d / 2]} position={[(x0 + x1) / 2, h / 2, z0 + d / 2]} />
        {/* step from the top terrace, half the rise */}
        <CuboidCollider args={[0.5, (h - 0.25) / 2, 0.24]} position={[x0 + 0.7, (h - 0.25) / 2, z0 - 0.24]} />
        {/* railing on the north edge, open above the step */}
        <CuboidCollider args={[(w - 1.5) / 2, 0.45, 0.05]} position={[x0 + 1.5 + (w - 1.5) / 2, h + 0.45, z0 + 0.05]} />
      </RigidBody>
      <mesh position={[(x0 + x1) / 2, h / 2, z0 + d / 2]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <Toon color={STONE} tex="stone" />
        <Ink thickness={0.03} />
      </mesh>
      <mesh position={[(x0 + x1) / 2, h + 0.04, z0 + d / 2]} receiveShadow>
        <boxGeometry args={[w - 0.1, 0.08, d - 0.1]} />
        <Toon color="#9B7048" tex="planks" />
      </mesh>
      <mesh position={[x0 + 0.7, (h - 0.25) / 2, z0 - 0.24]} castShadow receiveShadow>
        <boxGeometry args={[1.0, h - 0.25, 0.48]} />
        <Toon color={STONE_DARK} tex="stone" />
      </mesh>
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={i} position={[x0 + 1.5 + ((w - 1.5) * i) / 4, h + 0.45, z0 + 0.05]} castShadow>
          <boxGeometry args={[0.08, 0.9, 0.08]} />
          <Toon color="#B5523E" />
        </mesh>
      ))}
      <mesh position={[x0 + 1.5 + (w - 1.5) / 2, h + 0.88, z0 + 0.05]}>
        <boxGeometry args={[w - 1.5, 0.07, 0.1]} />
        <Toon color="#B5523E" />
      </mesh>
      <Bench position={[x1 - 1.2, h, z1 - 0.95]} rotY={Math.PI} />
      <DistanceCull center={WIND_BELL} far={30}>
        <WindBell />
      </DistanceCull>
    </group>
  );
}

/** Furin: a glass bell under a little arch; the paper strip swings in the wind. */
function WindBell() {
  const strip = useRef<THREE.Group>(null);
  useFrame(() => {
    if (strip.current) strip.current.rotation.x = Math.sin(windTime.value * 2.4) * 0.35;
  });
  const [x, y, z] = WIND_BELL;
  return (
    <group position={[x, y, z]}>
      {[-0.45, 0.45].map((dx) => (
        <mesh key={dx} position={[dx, 0.85, 0]} castShadow>
          <boxGeometry args={[0.08, 1.7, 0.08]} />
          <Toon color={WOOD} />
        </mesh>
      ))}
      <mesh position={[0, 1.72, 0]} castShadow>
        <boxGeometry args={[1.1, 0.1, 0.14]} />
        <Toon color={WOOD} />
      </mesh>
      <mesh position={[0, 1.42, 0]}>
        <sphereGeometry args={[0.13, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        <Toon color="#CFE8F5" emissive="#9FD3EE" emissiveIntensity={0.25} side={THREE.DoubleSide} />
      </mesh>
      <group ref={strip} position={[0, 1.36, 0]} userData={{ dynamic: true }}>
        <mesh position={[0, -0.22, 0]}>
          <boxGeometry args={[0.1, 0.32, 0.01]} />
          <Toon color="#F2C14E" side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

// ── Trees ───────────────────────────────────────────────────────────────────

function Trees() {
  return (
    <>
      {EAST_TREES.map((t, i) => {
        const p = t.pos;
        switch (t.kind) {
          case 'sakura': return <SakuraTree key={i} position={p} scale={t.scale} seed={t.seed} detail="low" />;
          case 'maple': return <MapleTree key={i} position={p} scale={t.scale} seed={t.seed} />;
          case 'maple_green': return <MapleTree key={i} position={p} scale={t.scale} seed={t.seed} green />;
          case 'pine': return <PineTree key={i} position={p} scale={t.scale} detail="low" />;
          case 'bamboo': return <Bamboo key={i} position={p} seed={t.seed} />;
        }
        return null;
      })}
    </>
  );
}

/** Flower beds along the lane and around the plaza (static). */
function FlowerBeds() {
  const beds: { p: [number, number, number]; w: number; d: number; c: string }[] = [
    { p: [25.4, 0, -8.1], w: 0.8, d: 2.0, c: '#C7A6E8' },
    { p: [29.4, 0, -2.6], w: 0.8, d: 1.6, c: '#FFD1E3' },
    { p: [23.6, 0, 4.9], w: 1.6, d: 0.7, c: '#FFE58A' },
  ];
  return (
    <>
      {beds.map((b, i) => (
        <group key={i} position={b.p}>
          <mesh position={[0, 0.09, 0]} receiveShadow castShadow>
            <boxGeometry args={[b.w, 0.18, b.d]} />
            <Toon color="#8E877C" tex="stone" />
          </mesh>
          <mesh position={[0, 0.17, 0]}>
            <boxGeometry args={[b.w - 0.12, 0.04, b.d - 0.12]} />
            <Toon color={SOIL} />
          </mesh>
          {Array.from({ length: Math.round((b.w * b.d) / 0.18) }).map((_, k) => {
            const cols = Math.max(1, Math.round(b.w / 0.4));
            const fx = ((k % cols) + 0.5) / cols - 0.5;
            const fz = (Math.floor(k / cols) + 0.5) / Math.ceil(Math.round((b.w * b.d) / 0.18) / cols) - 0.5;
            return (
              <mesh key={k} position={[fx * (b.w - 0.2), 0.3, fz * (b.d - 0.2)]} scale={[0.17, 0.15, 0.17]} rotation={[0, k, 0]} geometry={getPuffGeometry(k, 'tiny')} dispose={null}>
                <Toon color={k % 3 === 0 ? '#5E9A4A' : b.c} vertexColors />
              </mesh>
            );
          })}
        </group>
      ))}
    </>
  );
}

/** Static scenery of the district (goes inside StaticMerge; moving parts mark themselves dynamic). */
export function EastDistrict() {
  return (
    <group>
      <DistrictFence />
      <EastGate />
      <Plaza />
      <Pergola />
      <Pond />
      <Houses />
      <TeaTerraces />
      <Ridge />
      <Lookout />
      <FlowerBeds />
      <Trees />
    </group>
  );
}

