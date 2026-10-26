import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { reducedMotion } from '../../store/uiSettings';

/** Lightweight pooled particles (dust, splashes, sparkles) drawn with one instanced mesh. */

type Kind = 'dust' | 'splash' | 'sparkle' | 'leaf' | 'smoke' | 'firework';

interface Particle {
  alive: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  grow: number;
  gravity: number;
  color: THREE.Color;
}

const MAX = 240;
const pool: Particle[] = Array.from({ length: MAX }, () => ({
  alive: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, maxLife: 1, size: 0.1, grow: 1, gravity: 0, color: new THREE.Color(),
}));
let cursor = 0;

const PRESETS: Record<Kind, { color: string; life: number; size: number; grow: number; gravity: number; speed: number; up: number }> = {
  dust: { color: '#F2EAD8', life: 0.55, size: 0.12, grow: 2.2, gravity: -0.4, speed: 1.2, up: 0.6 },
  splash: { color: '#BFE8FF', life: 0.7, size: 0.09, grow: 0.6, gravity: 9, speed: 2.2, up: 3.6 },
  sparkle: { color: '#FFE27A', life: 0.8, size: 0.07, grow: -0.6, gravity: -0.8, speed: 1.6, up: 1.4 },
  leaf: { color: '#F7B6CB', life: 1.4, size: 0.06, grow: 0, gravity: 1.2, speed: 1, up: 0.8 },
  smoke: { color: '#F4F1EC', life: 2.6, size: 0.18, grow: 1.4, gravity: -0.7, speed: 0.25, up: 0.5 },
  firework: { color: '#FFD54A', life: 1.4, size: 0.16, grow: -0.5, gravity: 2.2, speed: 7, up: 0 },
};

export function spawnParticles(kind: Kind, at: THREE.Vector3 | [number, number, number], count = 6, color?: string) {
  const p = PRESETS[kind];
  // reduced motion (Etapa 7): bursts shrink to a few calm sparks, fireworks are skipped
  if (reducedMotion()) {
    if (kind === 'firework') return;
    if (kind === 'sparkle' || kind === 'splash') count = Math.ceil(count * 0.35);
  }
  const [x, y, z] = Array.isArray(at) ? at : [at.x, at.y, at.z];
  for (let i = 0; i < count; i++) {
    const part = pool[cursor];
    cursor = (cursor + 1) % MAX;
    const a = Math.random() * Math.PI * 2;
    const s = p.speed * (0.4 + Math.random() * 0.8);
    part.alive = true;
    part.pos.set(x + Math.cos(a) * 0.1, y, z + Math.sin(a) * 0.1);
    if (kind === 'firework') {
      // Spherical burst.
      const u = Math.random() * 2 - 1;
      const r = Math.sqrt(1 - u * u);
      part.vel.set(Math.cos(a) * r * s, u * s, Math.sin(a) * r * s);
    } else part.vel.set(Math.cos(a) * s, p.up * (0.6 + Math.random() * 0.6), Math.sin(a) * s);
    part.maxLife = part.life = p.life * (0.75 + Math.random() * 0.5);
    part.size = p.size * (0.7 + Math.random() * 0.6);
    part.grow = p.grow;
    part.gravity = p.gravity;
    part.color.set(color ?? p.color);
  }
}

export function Particles() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_s, rawDelta) => {
    const m = mesh.current;
    if (!m) return;
    const d = Math.min(rawDelta, 0.05);
    for (let i = 0; i < MAX; i++) {
      const p = pool[i];
      if (p.alive) {
        p.life -= d;
        if (p.life <= 0) p.alive = false;
        p.vel.y -= p.gravity * d;
        p.vel.multiplyScalar(1 - d * 1.8);
        p.pos.addScaledVector(p.vel, d);
      }
      const k = p.alive ? p.life / p.maxLife : 0;
      const size = p.alive ? Math.max(0.001, p.size * (1 + p.grow * (1 - k)) * Math.min(1, k * 3)) : 0;
      dummy.position.copy(p.pos);
      dummy.scale.setScalar(size);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, p.color);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 1]} />
      <meshBasicMaterial transparent opacity={0.85} depthWrite={false} />
    </instancedMesh>
  );
}
