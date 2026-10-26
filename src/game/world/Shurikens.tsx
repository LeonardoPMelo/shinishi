import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useRapier } from '@react-three/rapier';
import * as THREE from 'three';
import { enhanceToon, getGradient } from '../materials';
import { projectiles, allTargets, segmentHitsSphere, SHURIKEN_RANGE_TIME } from '../systems/shuriken';
import { playerBody } from '../systems/playerState';
import { spawnParticles } from '../systems/particles';
import { spawnRing } from '../systems/vfx';
import { emit } from '../../systems/events';

const POOL = 12;
const STUCK_TIME = 2.2;
const GRAVITY = 3;

/** Four-pointed training star with a hole in the middle. */
function starGeometry() {
  const shape = new THREE.Shape();
  const pts = 4;
  for (let i = 0; i < pts * 2; i++) {
    const a = (i / (pts * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? 0.2 : 0.06;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.025, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1 });
  g.center();
  g.rotateX(-Math.PI / 2); // lie flat: it spins around the vertical axis while flying
  return g;
}

// Non-violent rule: villagers, the player and soft props never stop a shuriken.
const solidOnly = (collider: { parent: () => { userData?: unknown } | null }) =>
  !((collider.parent()?.userData as { noCamera?: boolean } | undefined)?.noCamera);

export function Shurikens() {
  const { world, rapier } = useRapier();
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const geo = useMemo(() => starGeometry(), []);
  const mat = useMemo(() => {
    const m = new THREE.MeshToonMaterial({ color: '#C9CED8', gradientMap: getGradient(), emissive: '#3A4050', emissiveIntensity: 0.4 });
    enhanceToon(m, false);
    return m;
  }, []);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);

  useFrame((_s, raw) => {
    const dt = Math.min(raw, 0.05);
    for (let i = 0; i < POOL; i++) {
      const p = projectiles[i];
      const mesh = meshes.current[i];
      if (!mesh) continue;
      if (!p || !p.alive) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      if (p.stuck > 0) {
        p.stuck -= dt;
        const k = Math.min(1, p.stuck / 0.4);
        mesh.scale.setScalar(k);
        if (p.stuck <= 0) p.alive = false;
        continue;
      }
      p.age += dt;
      a.copy(p.pos);
      p.vel.y -= GRAVITY * dt;
      b.copy(p.pos).addScaledVector(p.vel, dt);

      // targets first (they are small and float in front of walls)
      let hitTarget = false;
      for (const t of allTargets()) {
        if (segmentHitsSphere(a, b, t.position, t.radius)) {
          t.onHit();
          emit({ type: 'sfx', name: 'target_hit', position: [t.position.x, t.position.y, t.position.z] });
          spawnParticles('sparkle', [t.position.x, t.position.y, t.position.z], 10);
          spawnRing(t.position, { color: '#FFE27A', size: 0.9, life: 0.4, normal: [0, 0, 1] });
          p.pos.copy(t.position);
          p.stuck = STUCK_TIME;
          hitTarget = true;
          break;
        }
      }
      if (!hitTarget) {
        const len = a.distanceTo(b);
        const dir = b.clone().sub(a).normalize();
        const hit = world.castRay(new rapier.Ray(a, dir), len, true, rapier.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, playerBody.current ?? undefined, solidOnly);
        if (hit) {
          p.pos.copy(a).addScaledVector(dir, Math.max(0, hit.timeOfImpact - 0.05));
          p.stuck = STUCK_TIME;
          emit({ type: 'sfx', name: 'thwack', position: [p.pos.x, p.pos.y, p.pos.z] });
          spawnParticles('dust', [p.pos.x, p.pos.y, p.pos.z], 3);
          spawnRing(p.pos, { color: '#CFE6FF', size: 0.35, life: 0.25, normal: dir.clone().negate() });
        } else {
          p.pos.copy(b);
          // a short glinting trail behind the spinning star
          if (Math.random() < 0.7) spawnParticles('sparkle', [p.pos.x, p.pos.y, p.pos.z], 1, '#DDEEFF');
          if (p.age > SHURIKEN_RANGE_TIME || p.pos.y < -1) p.alive = false;
        }
      }
      mesh.position.copy(p.pos);
      mesh.scale.setScalar(1);
      if (p.stuck <= 0) mesh.rotation.y += dt * 28;
    }
  });

  return (
    <group userData={{ dynamic: true }}>
      {Array.from({ length: POOL }).map((_, i) => (
        <mesh key={i} ref={(el) => (meshes.current[i] = el)} geometry={geo} material={mat} visible={false} castShadow />
      ))}
    </group>
  );
}
