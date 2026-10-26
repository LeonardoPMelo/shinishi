import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Expanding glow rings (impacts, landings, pickups, dash, level up), drawn with one
 * instanced mesh and additive blending: a ring fades by darkening its color.
 */

interface Ring {
  alive: boolean;
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
}

const MAX = 32;
const pool: Ring[] = Array.from({ length: MAX }, () => ({
  alive: false, pos: new THREE.Vector3(), quat: new THREE.Quaternion(), life: 0, maxLife: 1, size: 1, color: new THREE.Color(),
}));
let cursor = 0;
const UP = new THREE.Vector3(0, 0, 1);
const tmpN = new THREE.Vector3();

export interface RingOptions {
  color?: string;
  /** Final radius in meters. */
  size?: number;
  life?: number;
  /** Ring plane normal; default is lying on the ground. */
  normal?: THREE.Vector3 | [number, number, number];
}

export function spawnRing(at: THREE.Vector3 | [number, number, number], o: RingOptions = {}) {
  const r = pool[cursor];
  cursor = (cursor + 1) % MAX;
  r.alive = true;
  if (Array.isArray(at)) r.pos.set(at[0], at[1], at[2]);
  else r.pos.copy(at);
  const n = o.normal ? (Array.isArray(o.normal) ? tmpN.set(...o.normal) : tmpN.copy(o.normal)) : tmpN.set(0, 1, 0);
  r.quat.setFromUnitVectors(UP, n.normalize());
  r.life = 0;
  r.maxLife = o.life ?? 0.45;
  r.size = o.size ?? 1.1;
  r.color.set(o.color ?? '#FFE27A');
}

const m4 = new THREE.Matrix4();
const s3 = new THREE.Vector3();
const black = new THREE.Color(0, 0, 0);
const c = new THREE.Color();

export function VfxRings() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.RingGeometry(0.82, 1, 48), []);
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    []
  );

  useFrame((_s, raw) => {
    const im = mesh.current;
    if (!im) return;
    const dt = Math.min(raw, 0.05);
    let n = 0;
    for (const r of pool) {
      if (!r.alive) continue;
      r.life += dt;
      const k = r.life / r.maxLife;
      if (k >= 1) {
        r.alive = false;
        continue;
      }
      // fast ease-out growth, the band thins as it grows
      const grow = 1 - Math.pow(1 - k, 3);
      const radius = 0.15 + r.size * grow;
      s3.set(radius, radius, 1);
      m4.compose(r.pos, r.quat, s3);
      im.setMatrixAt(n, m4);
      im.setColorAt(n, c.copy(r.color).lerp(black, k * k).multiplyScalar(1.6));
      n++;
    }
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geo, mat, MAX]} frustumCulled={false} renderOrder={5} />;
}
