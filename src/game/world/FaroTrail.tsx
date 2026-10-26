import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { abilityState, now, playerPosition } from '../systems/playerState';

/**
 * Faro (key 4): glowing paw prints on the ground from Shinichi toward the tracked objective.
 * The trail is rebuilt from the cat's current position every frame, so it keeps guiding while
 * he moves, and fades out when the sense wears off.
 */
const MAX_PRINTS = 18;
const SPACING = 0.85;

function pawGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const pad = new THREE.CircleGeometry(0.11, 14);
  pad.scale(1, 0.85, 1);
  parts.push(pad);
  for (const [x, y] of [[-0.11, 0.1], [-0.04, 0.16], [0.04, 0.16], [0.11, 0.1]]) {
    const toe = new THREE.CircleGeometry(0.04, 10);
    toe.scale(1, 1.2, 1);
    toe.translate(x, y, 0);
    parts.push(toe);
  }
  const g = mergeGeometries(parts)!;
  g.rotateX(-Math.PI / 2);
  return g;
}

export function FaroTrail() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => pawGeometry(), []);
  // HDR gold (above 1.0) so the bloom pass makes the prints glow
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 1.45, 0.45), transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const trail = abilityState.trail;
    const t = now();
    if (!trail || t > trail.until) {
      m.count = 0;
      return;
    }
    const from = new THREE.Vector3(playerPosition.x, 0, playerPosition.z);
    const to = trail.to;
    const dist = from.distanceTo(to);
    const dir = to.clone().sub(from).normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const angle = Math.atan2(dir.x, dir.z);
    const n = Math.min(MAX_PRINTS, Math.floor(dist / SPACING));
    const left = trail.until - t;
    mat.opacity = Math.min(0.9, left * 0.6);
    for (let i = 0; i < n; i++) {
      const d = (i + 1) * SPACING;
      const p = from.clone().addScaledVector(dir, d).addScaledVector(side, i % 2 ? 0.14 : -0.14);
      // a soft pulse runs along the trail, away from the cat
      const pulse = 0.85 + 0.25 * Math.max(0, Math.sin(state.clock.elapsedTime * 6 - i * 0.6));
      // magic prints float just above the grass tips (the grass is ~0.3 m tall) and bob softly
      const ground = playerPosition.y < 1.5 ? 0 : playerPosition.y - 0.68;
      dummy.position.set(p.x, ground + 0.36 + Math.sin(state.clock.elapsedTime * 3 + i) * 0.03, p.z);
      dummy.rotation.set(0, angle, 0);
      dummy.scale.setScalar(2.1 * pulse);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geo, mat, MAX_PRINTS]} frustumCulled={false} userData={{ dynamic: true }} />;
}
