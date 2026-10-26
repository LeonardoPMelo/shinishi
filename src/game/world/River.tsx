import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { Toon, Ink, windTime } from '../materials';
import { RIVER, STEPPING_STONES, RIVER_LANTERNS } from '../../data/world';

/** The river runs from the waterfall (east) past the Bambuzal's riverbank (west) and on under the hills. */
const RIVER_LEN = 80;
const RIVER_X = -20;
import { StoneLantern } from './Props';
import { Asset } from '../assets/AssetModel';

function useWaterTexture(stretch: number) {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#4FA9D6';
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 26; i++) {
      ctx.strokeStyle = i % 3 ? 'rgba(255,255,255,0.35)' : 'rgba(30,110,170,0.35)';
      ctx.lineWidth = 2 + (i % 2);
      const y = (i * 37) % 128;
      const x = (i * 53) % 128;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 10, y - 4, x + 22, y);
      ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(stretch, 1);
    return t;
  }, [stretch]);
}

/** Stylized toon water: shallow edges, deep middle, drifting foam streaks, shore foam and glints. */
function useWaterMaterial() {
  return useMemo(() => {
    const m = new THREE.ShaderMaterial({
      fog: true,
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        uTime: windTime,
        uShallow: { value: new THREE.Color('#A6E6DA') },
        uMid: { value: new THREE.Color('#4FB3C8') },
        uDeep: { value: new THREE.Color('#2A6E9C') },
        uLen: { value: RIVER_LEN },
        uWidth: { value: RIVER.halfWidth * 2 },
      },
      vertexShader: /* glsl */ `
        #include <common>
        #include <fog_pars_vertex>
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vWorld;
        void main() {
          vUv = uv;
          vec3 transformed = position;
          transformed.z += sin(uTime * 1.3 + position.x * 0.6) * 0.015;
          vec4 world = modelMatrix * vec4(transformed, 1.0);
          vWorld = world.xyz;
          vec4 mvPosition = viewMatrix * world;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <common>
        #include <fog_pars_fragment>
        uniform float uTime;
        uniform vec3 uShallow, uMid, uDeep;
        uniform float uLen, uWidth;
        varying vec2 vUv;
        varying vec3 vWorld;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
        }
        void main() {
          vec2 p = vec2(vWorld.x, vWorld.z);
          float across = abs(vUv.y * 2.0 - 1.0);           // 0 middle, 1 bank
          float wob = noise(vec2(p.x * 0.8 - uTime * 0.6, uTime * 0.2)) * 0.12;
          float depth = 1.0 - smoothstep(0.0, 1.0, across + wob);
          // smooth depth gradient: clear turquoise shallows, a deep blue channel in the middle
          vec3 col = mix(uShallow, uMid, smoothstep(0.08, 0.45, depth));
          col = mix(col, uDeep, smoothstep(0.45, 0.95, depth));
          // caustic shimmer where the water is shallow enough to see the riverbed
          float ca = noise(p * 2.4 + vec2(uTime * 0.5, uTime * 0.3)) * noise(p * 3.1 - vec2(uTime * 0.4, -uTime * 0.2));
          col += vec3(0.9, 1.0, 0.95) * smoothstep(0.22, 0.42, ca) * (1.0 - smoothstep(0.2, 0.6, depth)) * 0.14;
          // drifting foam streaks along the current (flows toward -x)
          vec2 q = vec2(p.x * 0.35 + uTime * 0.45, p.y * 1.6);
          float streak = noise(q) * 0.65 + noise(q * 2.3 + 7.0) * 0.35;
          float lines = smoothstep(0.70, 0.74, streak) * (1.0 - smoothstep(0.80, 0.86, streak));
          col = mix(col, vec3(1.0), lines * 0.32);
          // shore foam: wobbly white rim on both banks
          float shore = smoothstep(0.80, 0.86, across + noise(vec2(p.x * 2.0 + uTime * 0.8, vUv.y * 6.0)) * 0.12);
          col = mix(col, vec3(0.96, 0.99, 1.0), shore * 0.65);
          // glints
          float g = noise(p * 3.2 + vec2(uTime * 1.1, -uTime * 0.7));
          col += vec3(1.0) * smoothstep(0.86, 0.9, g) * 0.35 * depth;
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    return m;
  }, []);
}

/** Collider for a straight ramp rising from (z0, 0) to (z1, h) along z. */
function Ramp({ z0, z1, h, halfWidth }: { z0: number; z1: number; h: number; halfWidth: number }) {
  const dz = z1 - z0;
  const len = Math.hypot(dz, h);
  const angle = Math.atan2(h, Math.abs(dz)) * (dz > 0 ? -1 : 1);
  const t = 0.1;
  return (
    <CuboidCollider
      args={[halfWidth, t, len / 2]}
      position={[0, h / 2 - t * Math.cos(angle), (z0 + z1) / 2 - t * Math.sin(angle)]}
      rotation={[angle, 0, 0]}
      friction={0}
    />
  );
}

function Bridge() {
  const hw = RIVER.bridgeHalfWidth;
  const h = 0.55;
  const z0 = RIVER.z - 2.4;
  const z1 = RIVER.z - 0.8;
  const z2 = RIVER.z + 0.8;
  const z3 = RIVER.z + 2.4;
  const deckShape = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const z = z0 + (z3 - z0) * t;
      const y = Math.sin(t * Math.PI) * h;
      pts.push(new THREE.Vector2(z, y));
    }
    return pts;
  }, [z0, z3]);

  const planks = deckShape.slice(0, -1).map((p, i) => {
    const q = deckShape[i + 1];
    return { z: (p.x + q.x) / 2, y: (p.y + q.y) / 2, rot: -Math.atan2(q.y - p.y, q.x - p.x), len: p.distanceTo(q) + 0.02 };
  });

  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <Ramp z0={z0} z1={z1} h={h} halfWidth={hw} />
        <CuboidCollider args={[hw, 0.1, (z2 - z1) / 2]} position={[0, h - 0.1, RIVER.z]} friction={0} />
        <Ramp z0={z3} z1={z2} h={h} halfWidth={hw} />
        {[-1, 1].map((s) => (
          <CuboidCollider key={s} args={[0.08, 0.6, (z3 - z0) / 2 - 0.3]} position={[s * (hw + 0.05), h + 0.4, RIVER.z]} />
        ))}
      </RigidBody>
      {planks.map((p, i) => (
        <mesh key={i} position={[0, p.y + 0.02, p.z]} rotation={[p.rot, 0, 0]} receiveShadow castShadow>
          <boxGeometry args={[hw * 2 + 0.2, 0.1, p.len]} />
          <Toon color={i % 2 ? '#8C5A3A' : '#9B6744'} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <group key={s}>
          {deckShape.filter((_, i) => i % 4 === 0).map((p, i) => (
            <mesh key={i} position={[s * (hw + 0.05), p.y + 0.45, p.x]} castShadow>
              <boxGeometry args={[0.12, 0.9, 0.12]} />
              <Toon color="#D2402F" />
            </mesh>
          ))}
          {planks.map((p, i) => (
            <mesh key={i} position={[s * (hw + 0.05), p.y + 0.88, p.z]} rotation={[p.rot, 0, 0]}>
              <boxGeometry args={[0.14, 0.1, p.len]} />
              <Toon color="#D2402F" />
            </mesh>
          ))}
          <mesh position={[s * (hw + 0.05), 1.0, z0 + 0.05]}>
            <sphereGeometry args={[0.1, 10, 8]} />
            <Toon color="#F2C14E" />
          </mesh>
          <mesh position={[s * (hw + 0.05), 1.0, z3 - 0.05]}>
            <sphereGeometry args={[0.1, 10, 8]} />
            <Toon color="#F2C14E" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, -0.25, RIVER.z]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[2.1, 0.18, 8, 24, Math.PI]} />
        <Toon color="#B5362A" />
        <Ink thickness={0.02} />
      </mesh>
    </group>
  );
}

function Waterfall() {
  const tex = useWaterTexture(1);
  const fall = useMemo(() => {
    const t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set(1, 2);
    return t;
  }, [tex]);
  useFrame((_s, d) => {
    fall.offset.y += d * 1.6;
  });
  return (
    <group position={[18.2, 0, RIVER.z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.6, 2.4, 3.6]} position={[0.6, 2.4, 0]} />
      </RigidBody>
      <mesh position={[0.6, 2.2, 0]} castShadow>
        <boxGeometry args={[3.2, 4.4, 7.2]} />
        <Toon color="#8E8173" />
        <Ink thickness={0.04} />
      </mesh>
      <mesh position={[0.3, 4.5, 0]}>
        <boxGeometry args={[3.6, 0.3, 7.6]} />
        <Toon color="#6E9E5A" />
      </mesh>
      <mesh position={[-1.05, 2.2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[2.6, 4.4]} />
        <meshBasicMaterial map={fall} transparent opacity={0.92} />
      </mesh>
      {[-0.9, 0, 0.9].map((z, i) => (
        <mesh key={i} position={[-1.3, 0.15, z]} scale={[1, 0.5, 1]}>
          <sphereGeometry args={[0.45, 10, 8]} />
          <meshBasicMaterial color="#EAF7FF" transparent opacity={0.85} />
        </mesh>
      ))}
    </group>
  );
}

export function River() {
  const water = useWaterMaterial();

  return (
    <group>
      <mesh position={[RIVER_X, 0.03, RIVER.z]} rotation={[-Math.PI / 2, 0, 0]} userData={{ dynamic: true }}>
        <planeGeometry args={[RIVER_LEN, RIVER.halfWidth * 2, RIVER_LEN, 4]} />
        <primitive object={water} attach="material" />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[RIVER_X, 0.06, RIVER.z + s * (RIVER.halfWidth + 0.15)]} receiveShadow>
          <boxGeometry args={[RIVER_LEN, 0.16, 0.5]} />
          <Toon color="#B8B0A2" tex="cobble" />
        </mesh>
      ))}

      {STEPPING_STONES.map((p, i) => (
        <RigidBody key={i} type="fixed" colliders={false} position={p}>
          <CylinderCollider args={[0.18, 0.62]} position={[0, 0.18, 0]} />
          <mesh position={[0, 0.17, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.62, 0.7, 0.36, 9]} />
            <Toon color="#A8A196" />
            <Ink thickness={0.02} />
          </mesh>
        </RigidBody>
      ))}

      {RIVER_LANTERNS.map((p, i) => <StoneLantern key={i} position={p} />)}

      <Asset name="ponte_vermelha" position={[0, 0, RIVER.z]} rotation={[0, Math.PI / 2, 0]} fitWidth={5} fallback={<Bridge />} />
      <Waterfall />
    </group>
  );
}
