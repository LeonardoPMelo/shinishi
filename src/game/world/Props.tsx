import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CylinderCollider, CuboidCollider } from '@react-three/rapier';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { Toon, Ink } from '../materials';
import { getPuffGeometry } from '../foliageGeometry';
import { Asset } from '../assets/AssetModel';

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Fallen petals: a soft-edged patch with scattered petals (painted once, shared by every sakura),
 * instead of a solid pink disc that read as a sticker on the grass.
 */
let petalTexture: THREE.CanvasTexture | null = null;
function getPetalTexture() {
  if (petalTexture) return petalTexture;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  const r = seeded(4242);
  // a faint pink wash that fades out toward an irregular edge
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.05, S / 2, S / 2, S * 0.5);
  g.addColorStop(0, 'rgba(246,190,208,0.55)');
  g.addColorStop(0.55, 'rgba(246,190,208,0.32)');
  g.addColorStop(1, 'rgba(246,190,208,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  // petals: denser in the middle, a few strays outside
  for (let i = 0; i < 420; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.pow(r(), 0.7) * S * 0.48;
    const x = S / 2 + Math.cos(a) * d;
    const y = S / 2 + Math.sin(a) * d;
    const fade = 1 - d / (S * 0.5);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(r() * Math.PI);
    ctx.fillStyle = r() > 0.35 ? `rgba(250,${200 + Math.floor(r() * 30)},${215 + Math.floor(r() * 25)},${0.55 + 0.45 * fade})` : `rgba(236,150,182,${0.5 + 0.4 * fade})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, 3 + r() * 2.5, 1.6 + r() * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  petalTexture = new THREE.CanvasTexture(c);
  petalTexture.colorSpace = THREE.SRGBColorSpace;
  petalTexture.anisotropy = 4;
  return petalTexture;
}

/** `detail` 'low' uses the lighter leaf clusters (the newer districts, where many trees share the view). */
export function SakuraTree({ position, scale = 1, seed = 1, detail = 'low' }: { position: [number, number, number]; scale?: number; seed?: number; detail?: 'high' | 'low' }) {
  const { blossoms, branches } = useMemo(() => {
    const r = seeded(seed * 97);
    // Clusters on a dome: the top ones are lighter, the lower ones a deeper pink.
    const blossoms = Array.from({ length: 12 }).map((_, i) => {
      const a = (i / 12) * Math.PI * 2 + r() * 0.5;
      const ring = i % 3 === 0 ? 0.35 : 1.1 + r() * 0.35;
      const y = 2.75 + (1.3 - ring) * 0.9 + r() * 0.35;
      return {
        p: [Math.cos(a) * ring + 0.2, y, Math.sin(a) * ring] as [number, number, number],
        s: 0.55 + r() * 0.35,
        c: y > 3.4 ? '#FCC0D4' : r() > 0.5 ? '#F9B4CB' : '#F296B6',
      };
    });
    const branches = [0, 2.1, 4.2].map((a) => ({ a: a + r() * 0.6, tilt: 0.75 + r() * 0.25, len: 1.0 + r() * 0.3 }));
    return { blossoms, branches };
  }, [seed]);
  return (
    <RigidBody type="fixed" colliders={false} position={position} scale={scale}>
      <CylinderCollider args={[1.2, 0.3]} position={[0, 1.2, 0]} />
      <mesh position={[0, 1.05, 0]} rotation={[0, 0, 0.1]} castShadow>
        <cylinderGeometry args={[0.15, 0.3, 2.2, 9]} />
        <Toon color="#7A5444" tex="bark" />
        <Ink thickness={0.02} />
      </mesh>
      {/* root flare */}
      <mesh position={[0, 0.1, 0]} scale={[1, 0.35, 1]}>
        <sphereGeometry args={[0.38, 9, 6]} />
        <Toon color="#6E4A3A" tex="bark" />
      </mesh>
      {branches.map((b, i) => (
        <group key={i} position={[0.1, 1.95, 0]} rotation={[0, b.a, 0]}>
          <mesh position={[Math.sin(b.tilt) * b.len * 0.5, Math.cos(b.tilt) * b.len * 0.5, 0]} rotation={[0, 0, -b.tilt]} castShadow>
            <cylinderGeometry args={[0.06, 0.11, b.len, 6]} />
            <Toon color="#6E4A3A" tex="bark" />
          </mesh>
        </group>
      ))}
      {blossoms.map((b, i) => (
        <mesh key={i} position={b.p} scale={b.s * 0.9} rotation={[0, i * 1.7, 0]} geometry={getPuffGeometry(i + seed, detail)} dispose={null} castShadow>
          {/* no ink on foliage: soft shading + baked occlusion read as a real canopy (and each outline
              meant drawing every puff twice) */}
          <Toon color={b.c} wind vertexColors />
        </mesh>
      ))}
      {/* fallen petals: soft patch, no hard edge */}
      <mesh position={[0.2, 0.03, 0]} rotation={[-Math.PI / 2, 0, seed]} receiveShadow renderOrder={1}>
        <planeGeometry args={[4.6, 4.6]} />
        <meshToonMaterial map={getPetalTexture()} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
    </RigidBody>
  );
}

/**
 * Japanese maple (momiji): a lower, wider crown than the sakura, built from more and smaller
 * clusters, in warm reds and oranges, or fresh greens for `green` (so a grove never repeats one color).
 */
export function MapleTree({ position, scale = 1, seed = 1, green = false }: { position: [number, number, number]; scale?: number; seed?: number; green?: boolean }) {
  const { leaves, branches, lean } = useMemo(() => {
    const r = seeded(seed * 53 + 7);
    const palette = green ? ['#6DAA4A', '#84BC52', '#5A9A46', '#9CC85A'] : ['#E2553A', '#F07A3A', '#F2A33A', '#C8402E'];
    const leaves = Array.from({ length: 11 }).map((_, i) => {
      const a = (i / 11) * Math.PI * 2 + r() * 0.6;
      const ring = i % 4 === 0 ? 0.3 : 0.95 + r() * 0.55;
      const y = 2.1 + (1.5 - ring) * 0.55 + r() * 0.4;
      return { p: [Math.cos(a) * ring, y, Math.sin(a) * ring] as [number, number, number], s: 0.46 + r() * 0.28, c: palette[Math.floor(r() * palette.length)] };
    });
    const branches = [0.4, 2.5, 4.4].map((a) => ({ a: a + r() * 0.5, tilt: 0.9 + r() * 0.3, len: 0.9 + r() * 0.3 }));
    return { leaves, branches, lean: (r() - 0.5) * 0.16 };
  }, [seed, green]);
  return (
    <RigidBody type="fixed" colliders={false} position={position} scale={scale}>
      <CylinderCollider args={[1.0, 0.24]} position={[0, 1.0, 0]} />
      <mesh position={[0, 0.85, 0]} rotation={[lean, 0, -lean]} castShadow>
        <cylinderGeometry args={[0.11, 0.22, 1.8, 8]} />
        <Toon color="#5E4436" tex="bark" />
      </mesh>
      {branches.map((b, i) => (
        <group key={i} position={[0, 1.55, 0]} rotation={[0, b.a, 0]}>
          <mesh position={[Math.sin(b.tilt) * b.len * 0.5, Math.cos(b.tilt) * b.len * 0.5, 0]} rotation={[0, 0, -b.tilt]} castShadow>
            <cylinderGeometry args={[0.04, 0.08, b.len, 6]} />
            <Toon color="#5E4436" tex="bark" />
          </mesh>
        </group>
      ))}
      {leaves.map((l, i) => (
        <mesh key={i} position={l.p} scale={[l.s, l.s * 0.72, l.s]} rotation={[0, i * 1.3, 0]} geometry={getPuffGeometry(i + seed, 'low')} dispose={null} castShadow>
          <Toon color={l.c} wind vertexColors />
        </mesh>
      ))}
    </RigidBody>
  );
}

export function PineTree({ position, scale = 1, detail = 'low' }: { position: [number, number, number]; scale?: number; detail?: 'high' | 'low' }) {
  return (
    <RigidBody type="fixed" colliders={false} position={position} scale={scale}>
      <CylinderCollider args={[1.2, 0.3]} position={[0, 1.2, 0]} />
      <mesh position={[0, 1.4, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.26, 2.8, 8]} />
        <Toon color="#7A5A48" tex="bark" />
      </mesh>
      {[[0, 1.7, 0, 1.5], [0.2, 2.6, 0.1, 1.2], [-0.1, 3.4, 0, 0.85], [0, 4.0, 0, 0.5]].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} scale={[r, r * 0.5, r]} rotation={[0, i * 2.1, 0]} geometry={getPuffGeometry(i, detail)} dispose={null} castShadow>
          <Toon color={i % 2 ? '#4E9A5A' : '#3F8A4E'} wind vertexColors />
        </mesh>
      ))}
    </RigidBody>
  );
}

export function Bamboo({ position, seed = 1 }: { position: [number, number, number]; seed?: number }) {
  const stalks = useMemo(() => {
    const r = seeded(seed * 31);
    return Array.from({ length: 7 }).map(() => ({
      x: (r() - 0.5) * 1.6, z: (r() - 0.5) * 1.6, h: 3.5 + r() * 2, lean: (r() - 0.5) * 0.12,
    }));
  }, [seed]);
  return (
    <RigidBody type="fixed" colliders={false} position={position}>
      <CylinderCollider args={[1.5, 0.9]} position={[0, 1.5, 0]} />
      {stalks.map((s, i) => (
        <group key={i} position={[s.x, 0, s.z]} rotation={[s.lean, 0, s.lean]}>
          <mesh position={[0, s.h / 2, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.07, s.h, 8]} />
            <Toon color="#86BC4E" wind />
          </mesh>
          {Array.from({ length: Math.floor(s.h / 0.7) }).map((_, k) => (
            <mesh key={k} position={[0, 0.7 * (k + 1), 0]}>
              <cylinderGeometry args={[0.075, 0.075, 0.04, 8]} />
              <Toon color="#5D8A36" />
            </mesh>
          ))}
          {/* narrow leaves fanning out near the top (cheap 6×3 spheres), so a grove reads leafy, not as sticks */}
          {[0, 1, 2, 3].map((k) => (
            <mesh key={k} position={[Math.cos(k * 1.9 + i) * 0.22, s.h - 0.25 - k * 0.42, Math.sin(k * 1.9 + i) * 0.22]} rotation={[0, -(k * 1.9 + i), -0.7 - (k % 2) * 0.25]} scale={[1, 0.12, 0.32]}>
              <sphereGeometry args={[0.38, 6, 3]} />
              <Toon color={k % 2 ? '#7DB850' : '#6AA644'} wind />
            </mesh>
          ))}
        </group>
      ))}
    </RigidBody>
  );
}

export function StoneLantern({ position, lit = true }: { position: [number, number, number]; lit?: boolean }) {
  return (
    <RigidBody type="fixed" colliders={false} position={position}>
      <CylinderCollider args={[0.7, 0.3]} position={[0, 0.7, 0]} />
      {/* tōrō: hexagonal base, pillar, platform, a stone light box with paper windows, curved roof, jewel */}
      <mesh position={[0, 0.09, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.3, 0.36, 0.18, 6]} />
        <Toon color="#A39C91" tex="stone" />
      </mesh>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.12, 0.66, 8]} />
        <Toon color="#ABA498" tex="stone" />
      </mesh>
      <mesh position={[0, 0.86, 0]} castShadow>
        <cylinderGeometry args={[0.27, 0.2, 0.1, 6]} />
        <Toon color="#A39C91" tex="stone" />
      </mesh>
      {/* light box: four stone posts around a warm paper core */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
        <mesh key={`${sx}${sz}`} position={[sx * 0.15, 1.06, sz * 0.15]} castShadow>
          <boxGeometry args={[0.07, 0.3, 0.07]} />
          <Toon color="#9A9388" tex="stone" />
        </mesh>
      ))}
      <mesh position={[0, 1.06, 0]}>
        <boxGeometry args={[0.24, 0.24, 0.24]} />
        <Toon color={lit ? '#FFE3A8' : '#6E685F'} emissive={lit ? '#FFAF52' : '#000000'} emissiveIntensity={lit ? 0.75 : 0} />
      </mesh>
      {/* roof: wide hexagonal cap with a lifted rim, then the jewel finial */}
      <mesh position={[0, 1.27, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.42, 0.18, 6]} />
        <Toon color="#8E877C" tex="stone" />
        <Ink thickness={0.012} />
      </mesh>
      <mesh position={[0, 1.18, 0]}>
        <cylinderGeometry args={[0.44, 0.44, 0.03, 6]} />
        <Toon color="#857E73" />
      </mesh>
      <mesh position={[0, 1.42, 0]}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <Toon color="#8E877C" />
      </mesh>
      <mesh position={[0, 1.5, 0]}>
        <coneGeometry args={[0.04, 0.08, 8]} />
        <Toon color="#8E877C" />
      </mesh>
    </RigidBody>
  );
}

export function TrainingPost({ position }: { position: [number, number, number] }) {
  return (
    <RigidBody type="fixed" colliders={false} position={position}>
      <CylinderCollider args={[0.8, 0.18]} position={[0, 0.8, 0]} />
      <mesh position={[0, 0.8, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.17, 1.6, 10]} />
        <Toon color="#9C7046" />
        <Ink thickness={0.015} />
      </mesh>
      {[0.6, 1.0, 1.4].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.06, 10]} />
          <Toon color="#C9A36B" />
        </mesh>
      ))}
    </RigidBody>
  );
}

const POLE_ANGLES = [0.35, 1.92, 3.49, 5.06];
const FLAG_COLORS = ['#E8553B', '#F2B33D', '#4CAF7A', '#3E7CC4', '#C75BA0'];

function Bunting() {
  const poles = POLE_ANGLES.map((a) => new THREE.Vector3(Math.cos(a) * 6.3, 3.3, Math.sin(a) * 6.3));
  const flags = useMemo(() => {
    const list: { pos: THREE.Vector3; rotY: number; color: string }[] = [];
    const spans: [number, number][] = [[0, 2], [1, 3]];
    spans.forEach(([a, b], si) => {
      const p0 = poles[a], p1 = poles[b];
      const n = 16;
      const rotY = -Math.atan2(p1.z - p0.z, p1.x - p0.x);
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const pos = p0.clone().lerp(p1, t);
        pos.y -= Math.sin(t * Math.PI) * 1.0;
        list.push({ pos, rotY, color: FLAG_COLORS[(i + si) % FLAG_COLORS.length] });
      }
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lines = useMemo(() => {
    return ([[0, 2], [1, 3]] as [number, number][]).map(([a, b]) => {
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const p = poles[a].clone().lerp(poles[b], t);
        p.y -= Math.sin(t * Math.PI) * 1.0;
        pts.push(p);
      }
      return new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: '#3a2a22' }),
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {poles.map((p, i) => (
        <RigidBody key={i} type="fixed" colliders={false} position={[p.x, 0, p.z]}>
          <CuboidCollider args={[0.1, 1.7, 0.1]} position={[0, 1.7, 0]} />
          <mesh position={[0, 1.7, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.08, 3.4, 8]} />
            <Toon color="#6B4A30" />
          </mesh>
          <mesh position={[0, 3.45, 0]}>
            <sphereGeometry args={[0.12, 8, 6]} />
            <Toon color="#E0483A" emissive="#E0483A" emissiveIntensity={0.5} />
          </mesh>
        </RigidBody>
      ))}
      {lines.map((l, i) => <primitive key={i} object={l} />)}
      {flags.map((f, i) => (
        <mesh key={i} position={f.pos} rotation={[0, f.rotY, Math.PI]}>
          <circleGeometry args={[0.2, 3, Math.PI / 6]} />
          <Toon color={f.color} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  );
}

function Petals({ count = 260 }: { count?: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const data = useMemo(() => {
    const r = seeded(5);
    return Array.from({ length: count }).map(() => ({
      x: (r() - 0.5) * 40, y: r() * 12, z: -20 + r() * 60,
      speed: 0.4 + r() * 0.5, drift: r() * Math.PI * 2, spin: 1 + r() * 2,
    }));
  }, [count]);

  useFrame((state, delta) => {
    if (!mesh.current) return;
    const t = state.clock.elapsedTime;
    data.forEach((p, i) => {
      p.y -= p.speed * delta;
      if (p.y < 0) p.y = 12;
      dummy.position.set(p.x + Math.sin(t * 0.6 + p.drift) * 1.2, p.y, p.z + Math.cos(t * 0.5 + p.drift) * 0.8);
      dummy.rotation.set(t * p.spin, t * p.spin * 0.7, p.drift);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <circleGeometry args={[0.07, 5]} />
      <meshBasicMaterial color="#FFC1D6" side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

export function Props() {
  return (
    <>
      <Asset name="sakura_tree" position={[-4.5, 0, -11]} fitWidth={3.60} fallback={<SakuraTree position={[-4.5, 0, -11]} seed={1} />} />
      {/* moved back a little to leave the target range (TargetRange.tsx) in the open */}
      <Asset name="sakura_tree" position={[6.4, 0, -14.2]} fitWidth={3.96} fallback={<SakuraTree position={[6.4, 0, -14.2]} seed={2} scale={1.1} />} />
      <Asset name="sakura_tree" position={[-9.5, 0, 2.5]} fitWidth={3.60} fallback={<SakuraTree position={[-9.5, 0, 2.5]} seed={3} />} />
      <Asset name="sakura_tree" position={[5.5, 0, 6.5]} fitWidth={3.60} fallback={<SakuraTree position={[5.5, 0, 6.5]} seed={4} scale={0.9} />} />
      <Asset name="sakura_tree" position={[-6.5, 0, 12.5]} fitWidth={3.60} fallback={<SakuraTree position={[-6.5, 0, 12.5]} seed={5} scale={1.15} />} />
      <Asset name="sakura_tree" position={[-16, 0, -15.5]} fitWidth={3.60} fallback={<SakuraTree position={[-16, 0, -15.5]} seed={7} scale={1.2} />} />
      <Asset name="sakura_tree" position={[10.5, 0, 15]} fitWidth={3.60} fallback={<SakuraTree position={[10.5, 0, 15]} seed={8} />} />

      <PineTree position={[-16.5, 0, 4]} scale={1.1} />
      <PineTree position={[16.5, 0, 2]} />
      <PineTree position={[-12, 0, 15.5]} scale={1.2} />
      <PineTree position={[1.5, 0, 16.5]} />
      <PineTree position={[16, 0, 12]} scale={0.9} />
      <PineTree position={[-15.5, 0, -8]} />
      <PineTree position={[6, 0, -16.5]} scale={1.1} />

      <Bamboo position={[-16.5, 0, 12]} seed={1} />
      <Bamboo position={[16.5, 0, -6]} seed={2} />
      <Bamboo position={[-4.2, 0, -18]} seed={3} />

      <StoneLantern position={[-1.6, 0, -10]} />
      <StoneLantern position={[1.6, 0, -10]} />
      <StoneLantern position={[-3, 0, -6.2]} />
      <StoneLantern position={[6, 0, 2.3]} />
      <StoneLantern position={[-7.5, 0, 6.5]} />
      <StoneLantern position={[3.5, 0, 7.5]} />

      <TrainingPost position={[5.6, 0, -7.4]} />
      <TrainingPost position={[5.4, 0, -9.6]} />
      <TrainingPost position={[13.2, 0, -7.2]} />

      <Bunting />
      <Petals />
      <Sparkles count={40} scale={[10, 3, 10]} position={[0, 1.5, 0]} size={3} speed={0.3} color="#FFE29A" />
    </>
  );
}
