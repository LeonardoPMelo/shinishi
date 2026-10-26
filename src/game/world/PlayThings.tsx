import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, BallCollider, CylinderCollider } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { Toon, Ink } from '../materials';
import { RIVER } from '../../data/world';
import { RAFTS, BALL_START, GOAL, FISH_ZONE, LEAF_ZONE } from '../../data/world2';
import { MISSIONS } from '../../data/missions';
import { useGameStore } from '../../store/gameStore';
import { isStepAvailable } from '../../systems/progression';
import { emit } from '../../systems/events';
import { useInteractable } from '../systems/interaction';
import { playerPosition, playerFacing } from '../systems/playerState';
import { spawnParticles } from '../systems/particles';

const stepOpen = (mission: string, step: string) => {
  const s = useGameStore.getState();
  return s.progress.missions[mission]?.status === 'active' && isStepAvailable(MISSIONS[mission], step, s.progress);
};

// ── Rafts: kinematic logs that ferry the cat across the river ─────────────────
function Raft({ x, phase }: { x: number; phase: number }) {
  const body = useRef<RapierRigidBody>(null);
  useFrame(({ clock }, delta) => {
    const b = body.current;
    if (!b || delta <= 0) return;
    const target = RIVER.z + Math.sin(clock.elapsedTime * 0.45 + phase) * 1.15;
    const p = b.translation();
    b.setLinvel({ x: 0, y: 0, z: THREE.MathUtils.clamp((target - p.z) / Math.max(delta, 0.016), -2, 2) }, true);
  });
  return (
    <RigidBody ref={body} type="kinematicVelocity" colliders={false} position={[x, 0.1, RIVER.z]} userData={{ surface: 'wood', noCamera: true }}>
      <CuboidCollider args={[0.8, 0.14, 0.85]} />
      {[-0.5, 0, 0.5].map((dx) => (
        <mesh key={dx} position={[dx, 0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.24, 0.24, 1.75, 10]} />
          <Toon color={dx === 0 ? '#8C5A3A' : '#9B6744'} />
          <Ink thickness={0.02} />
        </mesh>
      ))}
      {[-0.55, 0.55].map((dz) => (
        <mesh key={dz} position={[0, 0.2, dz]}>
          <boxGeometry args={[1.7, 0.06, 0.12]} />
          <Toon color="#6B4A30" />
        </mesh>
      ))}
    </RigidBody>
  );
}

// ── Ball and goal ("Gol de Patinha") ─────────────────────────────────────────
function Goal() {
  const { x, z, halfWidth, height } = GOAL;
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {[-1, 1].map((s) => (
          <CylinderCollider key={s} args={[height / 2, 0.08]} position={[x + s * halfWidth, height / 2, z]} />
        ))}
        <CuboidCollider args={[halfWidth, height / 2, 0.08]} position={[x, height / 2, z + 0.9]} />
        <CuboidCollider args={[0.05, height / 2, 0.45]} position={[x - halfWidth, height / 2, z + 0.45]} />
        <CuboidCollider args={[0.05, height / 2, 0.45]} position={[x + halfWidth, height / 2, z + 0.45]} />
      </RigidBody>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[x + s * halfWidth, height / 2, z]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, height, 8]} />
          <Toon color="#D2402F" />
          <Ink thickness={0.02} />
        </mesh>
      ))}
      <mesh position={[x, height, z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, halfWidth * 2 + 0.1, 8]} />
        <Toon color="#D2402F" />
        <Ink thickness={0.02} />
      </mesh>
      <mesh position={[x, height / 2, z + 0.9]}>
        <planeGeometry args={[halfWidth * 2, height]} />
        <meshBasicMaterial color="#FFFFFF" transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function KickBall() {
  const body = useRef<RapierRigidBody>(null);
  const pos = useMemo(() => new THREE.Vector3(...BALL_START), []);
  const resetAt = useRef(0);
  const cooldown = useRef(0);

  const kick = () => {
    const b = body.current;
    if (!b) return;
    // The ball flies away from the cat (approach from behind to aim), like a real kick.
    const dir = new THREE.Vector3(pos.x - playerPosition.x, 0, pos.z - playerPosition.z);
    if (dir.lengthSq() < 0.01) dir.set(Math.sin(playerFacing.angle), 0, Math.cos(playerFacing.angle));
    dir.normalize();
    b.applyImpulse({ x: dir.x * 2.6, y: 1.0, z: dir.z * 2.6 }, true);
    emit({ type: 'sfx', name: 'kick', position: [pos.x, pos.y, pos.z] });
    spawnParticles('dust', pos, 4);
  };
  const item = useMemo(() => ({ id: 'bola', position: pos, radius: 1.6, label: () => 'Chutar a bola', onInteract: kick }), [pos]);
  useInteractable(item);

  useFrame((_s, delta) => {
    const b = body.current;
    if (!b) return;
    const t = b.translation();
    pos.set(t.x, t.y, t.z);
    cooldown.current = Math.max(0, cooldown.current - delta);
    const inGoal = t.z > GOAL.z + 0.15 && Math.abs(t.x - GOAL.x) < GOAL.halfWidth && t.y < GOAL.height;
    if (inGoal && cooldown.current <= 0) {
      cooldown.current = 2;
      resetAt.current = 1.5;
      spawnParticles('sparkle', [t.x, t.y + 0.4, t.z], 16);
      emit({ type: 'sfx', name: 'goal', position: [t.x, t.y, t.z] });
      if (stepOpen('gol', 'gols')) useGameStore.getState().runActions('COUNT:gols');
      else emit({ type: 'toast', icon: '⚽', text: 'GOOOL! (O Taro adoraria ver isso.)' });
    }
    const lost = t.y < -2 || Math.abs(t.z - RIVER.z) < RIVER.halfWidth;
    if (resetAt.current > 0) {
      resetAt.current -= delta;
      if (resetAt.current <= 0) placeAtStart(b);
    } else if (lost) placeAtStart(b);
  });

  return (
    <RigidBody ref={body} colliders={false} position={BALL_START} restitution={0.55} friction={0.8} linearDamping={0.6} angularDamping={0.6} userData={{ noCamera: true }} ccd>
      <BallCollider args={[0.34]} mass={0.35} />
      <mesh castShadow>
        <sphereGeometry args={[0.34, 20, 14]} />
        <Toon color="#FFF6E4" />
        <Ink thickness={0.02} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} rotation={[i * 1.05, i * 0.6, 0]}>
          <torusGeometry args={[0.345, 0.03, 6, 24]} />
          <Toon color={['#E8553B', '#3E7CC4', '#F2B33D'][i]} />
        </mesh>
      ))}
    </RigidBody>
  );
}

function placeAtStart(b: RapierRigidBody) {
  b.setTranslation({ x: BALL_START[0], y: BALL_START[1] + 0.3, z: BALL_START[2] }, true);
  b.setLinvel({ x: 0, y: 0, z: 0 }, true);
  b.setAngvel({ x: 0, y: 0, z: 0 }, true);
}

// ── Pushable props ───────────────────────────────────────────────────────────
function Crate({ position, size = 0.7 }: { position: [number, number, number]; size?: number }) {
  return (
    <RigidBody position={position} colliders={false} friction={0.9} linearDamping={0.8} angularDamping={0.8} userData={{ noCamera: true }}>
      <CuboidCollider args={[size / 2, size / 2, size / 2]} mass={2.5} />
      <mesh castShadow receiveShadow>
        <boxGeometry args={[size, size, size]} />
        <Toon color="#C9A36B" />
        <Ink thickness={0.02} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0, s * (size / 2 + 0.005)]}>
          <boxGeometry args={[size * 0.95, 0.07, 0.01]} />
          <Toon color="#8C6440" />
        </mesh>
      ))}
    </RigidBody>
  );
}

function Barrel({ position }: { position: [number, number, number] }) {
  return (
    <RigidBody position={position} colliders={false} friction={0.8} linearDamping={0.7} angularDamping={0.7} userData={{ noCamera: true }}>
      <CylinderCollider args={[0.42, 0.34]} mass={3} />
      <mesh castShadow>
        <cylinderGeometry args={[0.32, 0.35, 0.84, 14]} />
        <Toon color="#9B6744" />
        <Ink thickness={0.02} />
      </mesh>
      {[-0.25, 0.25].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[0.355, 0.355, 0.05, 14]} />
          <Toon color="#4A4558" />
        </mesh>
      ))}
    </RigidBody>
  );
}

function YarnBall({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <RigidBody position={position} colliders={false} restitution={0.5} linearDamping={0.9} angularDamping={0.9} userData={{ noCamera: true }}>
      <BallCollider args={[0.22]} mass={0.15} />
      <mesh castShadow>
        <icosahedronGeometry args={[0.22, 1]} />
        <Toon color={color} />
        <Ink thickness={0.015} />
      </mesh>
      <mesh rotation={[0.6, 0.3, 0]}>
        <torusGeometry args={[0.2, 0.02, 4, 16]} />
        <Toon color="#FFFFFF" />
      </mesh>
    </RigidBody>
  );
}

// ── "O Peixe Fujão": a fish that hops away from Shinichi ─────────────────────
function FleeingFish() {
  const active = useGameStore((s) => s.progress.missions.peixe_fujao?.status === 'active' && isStepAvailable(MISSIONS.peixe_fujao, 'pegar', s.progress));
  const group = useRef<THREE.Group>(null);
  const state = useRef({ pos: new THREE.Vector3(...FISH_ZONE.start), from: new THREE.Vector3(...FISH_ZONE.start), to: new THREE.Vector3(...FISH_ZONE.start), t: 1, rest: 0 });
  const caught = useRef(false);

  useFrame((_s, rawDelta) => {
    const g = group.current;
    if (!g || !active) return;
    const d = Math.min(rawDelta, 0.05);
    const st = state.current;
    const dist = Math.hypot(playerPosition.x - st.pos.x, playerPosition.z - st.pos.z);
    if (!caught.current && dist < 0.9 && useGameStore.getState().phase === 'playing') {
      caught.current = true;
      spawnParticles('splash', st.pos, 10);
      useGameStore.getState().runActions('STEP:peixe_fujao.pegar;SFX:pickup_fish');
      return;
    }
    if (st.t < 1) {
      st.t = Math.min(1, st.t + d / 0.45);
      st.pos.lerpVectors(st.from, st.to, st.t);
      st.pos.y = Math.sin(st.t * Math.PI) * 0.7;
      if (st.t >= 1) {
        spawnParticles('splash', st.to, 3);
        if (Math.random() < 0.4) emit({ type: 'sfx', name: 'flop', position: [st.to.x, 0.2, st.to.z] });
      }
    } else {
      st.rest -= d;
      if (st.rest <= 0) {
        // Hop away from the cat if close, otherwise flop around lazily.
        const away = new THREE.Vector3(st.pos.x - playerPosition.x, 0, st.pos.z - playerPosition.z);
        const scared = dist < 6;
        if (!scared || away.lengthSq() < 0.01) away.set(Math.random() - 0.5, 0, Math.random() - 0.5);
        away.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 1.2);
        const hop = scared ? 2.4 : 0.8;
        st.from.copy(st.pos).setY(0);
        st.to.set(
          THREE.MathUtils.clamp(st.pos.x + away.x * hop, FISH_ZONE.x0, FISH_ZONE.x1),
          0,
          THREE.MathUtils.clamp(st.pos.z + away.z * hop, FISH_ZONE.z0, FISH_ZONE.z1),
        );
        st.t = 0;
        st.rest = scared ? 0.08 : 0.9 + Math.random();
      }
    }
    g.position.copy(st.pos);
    g.rotation.y = Math.atan2(st.to.x - st.from.x, st.to.z - st.from.z) + Math.PI / 2;
    g.rotation.z = st.t < 1 ? Math.sin(st.t * Math.PI * 3) * 0.6 : Math.sin(performance.now() / 90) * 0.3;
  });

  if (!active) return null;
  return (
    <group ref={group}>
      <mesh position={[0, 0.2, 0]} scale={[1, 0.5, 0.35]} castShadow>
        <sphereGeometry args={[0.3, 14, 10]} />
        <Toon color="#F2B33D" emissive="#F2B33D" emissiveIntensity={0.25} />
        <Ink thickness={0.015} />
      </mesh>
      <mesh position={[-0.34, 0.2, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.3]}>
        <coneGeometry args={[0.16, 0.22, 3]} />
        <Toon color="#E08A1E" />
      </mesh>
      <mesh position={[0.18, 0.26, 0.09]}>
        <sphereGeometry args={[0.035, 8, 6]} />
        <meshBasicMaterial color="#111111" />
      </mesh>
    </group>
  );
}

// ── "Folhas ao Vento": catch golden leaves before they land ─────────────────
interface Leaf { id: number; x: number; z: number; y: number; sway: number }
let leafId = 0;

function LeafGame() {
  const active = useGameStore((s) => s.progress.missions.folhas?.status === 'active' && isStepAvailable(MISSIONS.folhas, 'folhas', s.progress));
  const [leaves, setLeaves] = useState<Leaf[]>([]);
  const timer = useRef(0);
  const refs = useRef<Map<number, THREE.Group>>(new Map());
  const data = useRef<Leaf[]>([]);

  useFrame((_s, rawDelta) => {
    if (!active || useGameStore.getState().phase !== 'playing') return;
    const d = Math.min(rawDelta, 0.05);
    timer.current -= d;
    let changed = false;
    if (timer.current <= 0 && data.current.length < 3) {
      timer.current = 1.4 + Math.random();
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * LEAF_ZONE.radius;
      data.current.push({ id: leafId++, x: LEAF_ZONE.center[0] + Math.cos(a) * r, z: LEAF_ZONE.center[2] + Math.sin(a) * r, y: 6.5, sway: Math.random() * 6 });
      changed = true;
    }
    data.current = data.current.filter((l) => {
      l.y -= d * 1.25;
      const dx = playerPosition.x - l.x;
      const dz = playerPosition.z - l.z;
      if (Math.hypot(dx, dz) < 1.0 && l.y < playerPosition.y + 1.4 && l.y > playerPosition.y - 1) {
        spawnParticles('sparkle', [l.x, l.y, l.z], 10);
        useGameStore.getState().runActions('COUNT:folhas;SFX:ring');
        changed = true;
        return false;
      }
      if (l.y <= 0.05) {
        spawnParticles('leaf', [l.x, 0.1, l.z], 4, '#F2C14E');
        changed = true;
        return false;
      }
      const g = refs.current.get(l.id);
      if (g) {
        g.position.set(l.x + Math.sin(l.y * 1.6 + l.sway) * 0.35, l.y, l.z);
        g.rotation.set(Math.sin(l.y * 2 + l.sway) * 0.8, l.y * 1.5, 0.3);
      }
      return true;
    });
    if (changed) setLeaves([...data.current]);
  });

  if (!active) return null;
  return (
    <>
      {leaves.map((l) => (
        <group key={l.id}>
          <group ref={(el) => (el ? refs.current.set(l.id, el) : refs.current.delete(l.id))} position={[l.x, l.y, l.z]}>
            <mesh scale={[1, 0.08, 0.6]}>
              <sphereGeometry args={[0.22, 10, 6]} />
              <Toon color="#FFC93C" emissive="#FFB300" emissiveIntensity={0.7} />
            </mesh>
          </group>
          {/* Landing marker: observe where it will fall */}
          <mesh position={[l.x, 0.04, l.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.45, 0.6, 20]} />
            <meshBasicMaterial color="#FFC93C" transparent opacity={0.55} />
          </mesh>
        </group>
      ))}
    </>
  );
}

export function PlayThings() {
  return (
    <>
      {RAFTS.map((r, i) => <Raft key={i} x={r.x} phase={r.phase} />)}
      <Goal />
      <KickBall />
      <Crate position={[10.6, 0.4, -6.8]} />
      <Crate position={[11.4, 0.4, -7.2]} />
      <Crate position={[11.0, 1.1, -7.0]} size={0.6} />
      <Crate position={[7.4, 0.4, -18.2]} />
      <Crate position={[6.6, 0.4, -18.4]} size={0.6} />
      <Barrel position={[12.4, 0.45, -5.2]} />
      <Barrel position={[-4.6, 0.45, -7.8]} />
      <Barrel position={[-10.4, 0.45, -3.4]} />
      <YarnBall position={[2.6, 0.4, 2.8]} color="#E8553B" />
      <YarnBall position={[-2.4, 0.4, -2.4]} color="#5E7FC4" />
      <YarnBall position={[-1.2, 0.4, 30.2]} color="#F49AB8" />
      <FleeingFish />
      <LeafGame />
    </>
  );
}
