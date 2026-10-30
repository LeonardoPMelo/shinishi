import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { Toon, Ink } from '../materials';
import { WORLD_OBJECTS, WISHES, type WorldObject } from '../../data/world';
import { useGameStore } from '../../store/gameStore';
import { checkCondition } from '../../systems/progression';
import { emit, onGameEvent } from '../../systems/events';
import { useInteractable } from '../systems/interaction';
import { playerPosition, playerGround, abilityState, now } from '../systems/playerState';
import { StoneLantern } from './Props';
import { PaperLantern } from './Buildings';
import { spawnParticles } from '../systems/particles';
import { spawnRing } from '../systems/vfx';
import { HortaProp, LauncherProp, BalanceProp, PieProp, HerbModel } from './Chapter3Props';
import { PillarBell, CodeStone, PromoBoard } from './RedesignProps';
import { DistanceCull } from '../DistanceCull';
import { StaticMerge } from '../StaticMerge';

const segment = new THREE.Line3();
const closest = new THREE.Vector3();

/** Distance from a point to the path the player travelled this frame (robust at low frame rates). */
function sweptDistance(target: THREE.Vector3, from: THREE.Vector3, to: THREE.Vector3) {
  // A huge jump means a teleport (respawn), not movement: don't sweep across the map.
  segment.set(from.distanceTo(to) > 3 ? to : from, to);
  segment.closestPointToPoint(target, true, closest);
  return closest;
}

function useObjectState(obj: WorldObject) {
  const exists = useGameStore((s) => checkCondition(obj.when, s.progress) && !(obj.hideWhen && checkCondition(obj.hideWhen, s.progress)));
  const usable = useGameStore((s) => checkCondition(obj.usableWhen, s.progress, s.player.coins));
  return { exists, usable };
}

function handleInteract(obj: WorldObject) {
  const st = useGameStore.getState();
  switch (obj.kind) {
    case 'fountain':
      st.runActions(obj.actions);
      emit({ type: 'toast', icon: '🪙', text: WISHES[Math.floor(Math.random() * WISHES.length)] });
      return;
    case 'lantern':
      st.runActions(obj.actions);
      if (obj.value === 16) emit({ type: 'toast', icon: '🏮', text: 'A lanterna 16 acendeu... e a porta de pedra está se abrindo!' });
      else emit({ type: 'toast', icon: '💨', text: `A chama da lanterna ${obj.value} piscou e apagou. Qual número continua 2, 4, 8?` });
      return;
    case 'bell':
      st.runActions(obj.actions);
      emit({ type: 'toast', icon: '🔔', text: 'GOOONG! Um passarinho dá um pulo de susto na árvore.' });
      return;
    case 'chest':
      st.runActions(obj.actions);
      emit({ type: 'toast', icon: '🧰', text: 'Baú aberto!' });
      return;
    default:
      if (obj.dialogue) st.openDialogue(obj.id, obj.name ?? obj.label, obj.dialogue, 'start');
      else st.runActions(obj.actions);
  }
}

/** Small floating sparkle: a discreet hint that something can be used. */
function Hint({ y = 1.4, color = '#FFE082' }: { y?: number; color?: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (!ref.current) return;
    const t = s.clock.elapsedTime;
    ref.current.position.y = y + Math.sin(t * 2.5) * 0.08;
    ref.current.rotation.y = t * 2;
    const faro = abilityState.faroUntil > now();
    ref.current.scale.setScalar(faro ? 1.6 : 1);
  });
  return (
    // animated every frame: must stay out of StaticMerge
    <mesh ref={ref} position={[0, y, 0]} userData={{ dynamic: true }}>
      <octahedronGeometry args={[0.09, 0]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

/** Tall beam shown while Faro Ninja is active. */
function FaroBeam({ position, color = '#FFE082' }: { position: THREE.Vector3; color?: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (!ref.current) return;
    const active = abilityState.faroUntil > now() && playerPosition.distanceTo(position) < 24;
    ref.current.visible = active;
    if (active) (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.25 + Math.sin(s.clock.elapsedTime * 4) * 0.1;
  });
  return (
    <mesh ref={ref} position={[position.x, position.y + 3, position.z]} visible={false}>
      <cylinderGeometry args={[0.18, 0.35, 6, 10, 1, true]} />
      <meshBasicMaterial color={color} transparent opacity={0.3} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Interactive({ obj, exists, usable }: { obj: WorldObject; exists: boolean; usable: boolean }) {
  const pos = useMemo(() => new THREE.Vector3(...obj.position), [obj.position]);
  const state = useRef({ exists, usable });
  state.current = { exists, usable };
  const item = useMemo(() => ({
    id: obj.id,
    position: pos,
    radius: obj.radius ?? 1.9,
    tagHeight: (HINT_Y[obj.id] ?? 1.2) + 0.3,
    priority: obj.priority,
    label: () => (state.current.exists && state.current.usable ? obj.label : null),
    onInteract: () => handleInteract(obj),
  }), [obj, pos]);
  useInteractable(item);
  return null;
}

/** Pickups are collected within this horizontal distance (meters). */
const PICKUP_RADIUS = 1.1;
/** Within this distance the pickup starts flying toward Shinichi. */
const MAGNET_RADIUS = 1.8;

function Pickup({ obj }: { obj: WorldObject }) {
  const ref = useRef<THREE.Group>(null);
  const taken = useRef(false);
  const pos = useMemo(() => new THREE.Vector3(...obj.position), [obj.position]);
  const isPaw = obj.kind === 'pickup_paw';
  const isLantern = obj.kind === 'pickup_lantern';
  const isHerb = obj.kind === 'pickup_herb';
  const phase = useMemo(() => Math.random() * 6, []);
  const last = useRef(playerPosition.clone());
  /** Where the pickup is now: it drifts toward Shinichi once he is close (the "magnet"). */
  const cur = useMemo(() => pos.clone(), [pos]);

  useFrame((s, raw) => {
    if (!ref.current || taken.current) return;
    const t = s.clock.elapsedTime + phase;
    const playing = useGameStore.getState().phase === 'playing';
    // Magnet: within ~1.8 m the pickup flies to the cat, so a near miss with the keyboard still counts.
    // Only when Shinichi stands on the pickup's own level (his center sits 0–0.7 m above the pickup:
    // paws float 0.5 m over their ground, fish lie on it): jumping at a paw on a high rock never pulls
    // it down, the climb is still the challenge.
    const hx = playerPosition.x - cur.x;
    const hz = playerPosition.z - cur.z;
    const near = Math.hypot(hx, hz);
    const rel = playerPosition.y - pos.y;
    const sameLevel = playerGround.grounded && rel > -0.25 && rel < 0.8;
    if (playing && near < MAGNET_RADIUS && sameLevel) {
      const k = 1 - Math.exp(-Math.min(raw, 0.05) * 9);
      cur.x += hx * k;
      cur.z += hz * k;
    } else {
      // out of reach again: drift back home (a paw on the high rock must stay on the rock)
      const k = 1 - Math.exp(-Math.min(raw, 0.05) * 4);
      cur.x += (pos.x - cur.x) * k;
      cur.z += (pos.z - cur.z) * k;
    }
    ref.current.rotation.y = t * (isPaw ? 1.8 : isLantern ? 0.6 : 3);
    ref.current.position.set(cur.x, pos.y + 0.35 + (isPaw || isLantern ? Math.sin(t * 2) * 0.1 : Math.abs(Math.sin(t * 4)) * 0.35), cur.z);
    const c = sweptDistance(cur, last.current, playerPosition);
    last.current.copy(playerPosition);
    const dx = c.x - cur.x;
    const dz = c.z - cur.z;
    const dy = c.y - (pos.y + 0.6);
    if (Math.hypot(dx, dz) < PICKUP_RADIUS && Math.abs(dy) < 1.2 && playing) {
      taken.current = true;
      spawnParticles('sparkle', [cur.x, pos.y + 0.5, cur.z], 10);
      spawnRing([cur.x, pos.y + 0.05, cur.z], { color: isPaw || isLantern ? '#FFD54A' : '#9FE3FF', size: 0.9, life: 0.4 });
      useGameStore.getState().runActions(obj.actions);
    }
  });

  return (
    <>
      <group ref={ref} position={[pos.x, pos.y + 0.35, pos.z]}>
        {isLantern ? (
          <PaperLantern position={[0, 0.25, 0]} color="#F2A541" />
        ) : isHerb ? (
          <HerbModel />
        ) : isPaw ? (
          <>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.28, 0.28, 0.07, 20]} />
              <Toon color="#FFC93C" emissive="#FFB300" emissiveIntensity={0.45} />
              <Ink thickness={0.015} />
            </mesh>
            {[[-0.11, 0.07], [-0.04, 0.12], [0.04, 0.12], [0.11, 0.07], [0, -0.04]].map(([x, y], i) => (
              <mesh key={i} position={[x, y, 0.04]} scale={i === 4 ? [1.6, 1.3, 0.5] : [1, 1, 0.5]}>
                <sphereGeometry args={[0.04, 8, 6]} />
                <Toon color="#C98B12" />
              </mesh>
            ))}
          </>
        ) : (
          <group rotation={[0, 0, 0.4]}>
            <mesh scale={[1, 0.45, 0.3]}>
              <sphereGeometry args={[0.22, 12, 8]} />
              <Toon color="#7FB2E0" />
              <Ink thickness={0.012} />
            </mesh>
            <mesh position={[-0.26, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.3]}>
              <coneGeometry args={[0.12, 0.16, 3]} />
              <Toon color="#5E93C4" />
            </mesh>
            <mesh position={[0.13, 0.03, 0.06]}>
              <sphereGeometry args={[0.025, 6, 6]} />
              <meshBasicMaterial color="#111" />
            </mesh>
          </group>
        )}
      </group>
      <FaroBeam position={pos} color={isPaw || isLantern ? '#FFD54A' : '#9FE3FF'} />
    </>
  );
}

function Ring({ obj }: { obj: WorldObject }) {
  const ref = useRef<THREE.Mesh>(null);
  const pos = useMemo(() => new THREE.Vector3(...obj.position), [obj.position]);
  const count = useGameStore((s) => s.progress.counters.argolas ?? 0);
  const isNext = obj.value === count;
  const passed = (obj.value ?? 0) < count;
  const cooldown = useRef(0);
  const last = useRef(playerPosition.clone());

  useFrame((s, d) => {
    if (!ref.current) return;
    ref.current.rotation.z = s.clock.elapsedTime * (isNext ? 1.5 : 0.3);
    const scale = isNext ? 1 + Math.sin(s.clock.elapsedTime * 4) * 0.05 : 0.92;
    ref.current.scale.setScalar(scale);
    cooldown.current = Math.max(0, cooldown.current - d);
    const near = sweptDistance(pos, last.current, playerPosition).distanceTo(pos) < 0.95;
    last.current.copy(playerPosition);
    if (isNext && cooldown.current <= 0 && near && useGameStore.getState().phase === 'playing') {
      cooldown.current = 1;
      useGameStore.getState().runActions('COUNT:argolas;SFX:ring');
    }
  });

  if (passed) return null;
  return (
    <group>
      <mesh ref={ref} position={pos} rotation={[0, Math.PI / 2 + 0.6, 0]}>
        <torusGeometry args={[0.85, 0.08, 10, 32]} />
        <Toon color={isNext ? '#FFC93C' : '#B9A6FF'} emissive={isNext ? '#FFB300' : '#6A55C8'} emissiveIntensity={isNext ? 0.9 : 0.2} transparent opacity={isNext ? 1 : 0.55} />
      </mesh>
      <mesh position={[pos.x, pos.y / 2, pos.z]}>
        <cylinderGeometry args={[0.03, 0.03, pos.y - 0.8, 6]} />
        <Toon color="#6B4A30" />
      </mesh>
    </group>
  );
}

function Chest({ obj, usable }: { obj: WorldObject; usable: boolean }) {
  const lid = useRef<THREE.Group>(null);
  useFrame((_s, d) => {
    if (!lid.current) return;
    const target = usable ? 0 : -1.9;
    lid.current.rotation.x += (target - lid.current.rotation.x) * Math.min(1, d * 6);
  });
  return (
    <group position={obj.position} rotation={[0, obj.rotation ?? 0, 0]}>
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[0.8, 0.5, 0.55]} />
        <Toon color="#8A5A34" />
        <Ink thickness={0.02} />
      </mesh>
      <mesh position={[0, 0.25, 0.28]}>
        <boxGeometry args={[0.82, 0.08, 0.02]} />
        <Toon color="#D6B04C" />
      </mesh>
      <group ref={lid} position={[0, 0.5, -0.27]}>
        <mesh position={[0, 0.08, 0.27]} castShadow>
          <boxGeometry args={[0.84, 0.16, 0.58]} />
          <Toon color="#9B6744" />
          <Ink thickness={0.02} />
        </mesh>
      </group>
      {!usable && (
        <mesh position={[0, 0.48, 0]}>
          <boxGeometry args={[0.6, 0.06, 0.35]} />
          <Toon color="#FFC93C" emissive="#FFB300" emissiveIntensity={0.6} />
        </mesh>
      )}
      {usable && <Hint y={1.1} />}
    </group>
  );
}

function SignBoard({ obj }: { obj: WorldObject }) {
  const isTablet = obj.id === 'lapide';
  return (
    <RigidBody type="fixed" colliders={false} position={obj.position} rotation={[0, obj.rotation ?? 0, 0]}>
      <CuboidCollider args={[0.6, 0.6, 0.15]} position={[0, 0.6, 0]} />
      {isTablet ? (
        <mesh position={[0, 0.65, 0]} castShadow>
          <boxGeometry args={[1, 1.3, 0.25]} />
          <Toon color="#8E8A80" />
          <Ink thickness={0.02} />
        </mesh>
      ) : (
        <>
          {[-0.45, 0.45].map((x) => (
            <mesh key={x} position={[x, 0.55, 0]}>
              <boxGeometry args={[0.1, 1.1, 0.1]} />
              <Toon color="#5B3A24" />
            </mesh>
          ))}
          <mesh position={[0, 1.0, 0.02]} castShadow>
            <boxGeometry args={[1.2, 0.7, 0.08]} />
            <Toon color="#C9A36B" />
            <Ink thickness={0.02} />
          </mesh>
          {[0.15, 0, -0.15].map((y) => (
            <mesh key={y} position={[0, 1.0 + y, 0.065]}>
              <boxGeometry args={[0.8, 0.04, 0.01]} />
              <Toon color="#6B4A30" />
            </mesh>
          ))}
        </>
      )}
    </RigidBody>
  );
}

function LanternPuzzle({ obj }: { obj: WorldObject }) {
  const lit = useGameStore((s) => !!s.progress.flags.porta_aberta) && obj.value === 16;
  const flame = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (flame.current) flame.current.scale.setScalar(1 + Math.sin(s.clock.elapsedTime * 12) * 0.12);
  });
  return (
    <group>
      <StoneLantern position={obj.position} lit={lit} />
      <group position={[obj.position[0] + 0.25, 0.75, obj.position[2]]} rotation={[0, Math.PI / 2, 0]}>
        <mesh>
          <boxGeometry args={[0.32, 0.2, 0.02]} />
          <Toon color="#3A3340" />
        </mesh>
        <NumberGlyph value={obj.value ?? 0} />
      </group>
      {lit && (
        <mesh ref={flame} position={[obj.position[0], 1.08, obj.position[2]]} userData={{ dynamic: true }}>
          <sphereGeometry args={[0.12, 8, 6]} />
          <meshBasicMaterial color="#FFB347" />
        </mesh>
      )}
    </group>
  );
}

/** Numbers drawn on a tiny canvas texture so the puzzle lanterns are readable in 3D. */
function NumberGlyph({ value }: { value: number }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 40;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#3A3340';
    ctx.fillRect(0, 0, 64, 40);
    ctx.fillStyle = '#FFE9B0';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(value), 32, 22);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [value]);
  return (
    <mesh position={[0, 0, 0.012]}>
      <planeGeometry args={[0.3, 0.19]} />
      <meshBasicMaterial map={tex} />
    </mesh>
  );
}

function DigSpot({ usable, done }: { usable: boolean; done: boolean }) {
  return (
    <group position={[-7, 0, 19.0]}>
      {!done ? (
        <mesh position={[0, 0.06, 0]} scale={[1, 0.25, 1]}>
          <sphereGeometry args={[0.55, 10, 8]} />
          <Toon color="#7A5A3E" />
        </mesh>
      ) : (
        <>
          <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.5, 12]} />
            <meshBasicMaterial color="#3A2A1E" />
          </mesh>
          <mesh position={[0.7, 0.12, 0.2]} scale={[1, 0.4, 1]}>
            <sphereGeometry args={[0.4, 8, 6]} />
            <Toon color="#7A5A3E" />
          </mesh>
        </>
      )}
      {usable && <Hint y={0.8} />}
    </group>
  );
}

function Bell() {
  const bell = useRef<THREE.Group>(null);
  const swing = useRef(0);
  useFrame((_s, d) => {
    if (!bell.current) return;
    swing.current *= Math.exp(-1.5 * d);
    bell.current.rotation.z = Math.sin(performance.now() / 180) * swing.current;
  });
  useEffect(() => onGameEvent((e) => {
    if (e.type === 'sfx' && e.name === 'temple_bell') swing.current = 0.45;
  }), []);
  return (
    <RigidBody type="fixed" colliders={false} position={[3.2, 0, -12.4]}>
      <CuboidCollider args={[0.7, 1.2, 0.2]} position={[0, 1.2, 0]} />
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} position={[x, 1.2, 0]} castShadow>
          <boxGeometry args={[0.14, 2.4, 0.14]} />
          <Toon color="#5B3A24" />
        </mesh>
      ))}
      <mesh position={[0, 2.4, 0]}>
        <boxGeometry args={[1.5, 0.16, 0.22]} />
        <Toon color="#3A2C22" />
      </mesh>
      <group ref={bell} position={[0, 2.3, 0]}>
        <mesh position={[0, -0.45, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.36, 0.7, 14]} />
          <Toon color="#B07A3A" />
          <Ink thickness={0.015} />
        </mesh>
      </group>
    </RigidBody>
  );
}

/** A tiny tanuki cub hiding; giggles now and then so you can find it by ear. */
function Cub({ obj }: { obj: WorldObject }) {
  const ref = useRef<THREE.Group>(null);
  const next = useRef(2 + Math.random() * 3);
  useFrame((s, d) => {
    if (!ref.current) return;
    const t = s.clock.elapsedTime;
    ref.current.position.y = obj.position[1] + Math.abs(Math.sin(t * 3 + obj.position[0])) * 0.05;
    ref.current.rotation.y = Math.sin(t * 0.8 + obj.position[2]) * 0.6;
    next.current -= d;
    if (next.current <= 0) {
      next.current = 3.5 + Math.random() * 3;
      if (playerPosition.distanceTo(new THREE.Vector3(...obj.position)) < 14) {
        emit({ type: 'sfx', name: 'giggle', position: obj.position });
      }
    }
  });
  return (
    <group ref={ref} position={obj.position}>
      <mesh position={[0, 0.2, 0]} scale={[1.1, 1, 1]} castShadow>
        <sphereGeometry args={[0.2, 14, 10]} />
        <Toon color="#9A7A5C" />
        <Ink thickness={0.015} />
      </mesh>
      <mesh position={[0, 0.45, 0.02]} castShadow>
        <sphereGeometry args={[0.18, 14, 10]} />
        <Toon color="#9A7A5C" />
        <Ink thickness={0.015} />
      </mesh>
      {[1, -1].map((s) => (
        <group key={s}>
          <mesh position={[0.07 * s, 0.46, 0.15]} rotation={[0, 0.3 * s, -0.3 * s]} scale={[1.2, 0.8, 0.4]}>
            <sphereGeometry args={[0.05, 8, 6]} />
            <Toon color="#3B2C24" />
          </mesh>
          <mesh position={[0.07 * s, 0.47, 0.17]}>
            <sphereGeometry args={[0.02, 6, 6]} />
            <meshBasicMaterial color="#111" />
          </mesh>
          <mesh position={[0.12 * s, 0.6, 0]} scale={[1, 1, 0.6]}>
            <sphereGeometry args={[0.05, 8, 6]} />
            <Toon color="#9A7A5C" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.38, 0.17]} scale={[1.3, 0.8, 0.8]}>
        <sphereGeometry args={[0.05, 8, 6]} />
        <Toon color="#E9D9C3" />
      </mesh>
      <mesh position={[0, 0.66, 0.02]} rotation={[0.3, 0, 0.5]} scale={[0.6, 1, 0.12]}>
        <sphereGeometry args={[0.09, 8, 6]} />
        <Toon color="#5DAA4A" />
      </mesh>
    </group>
  );
}

function ClueNote({ obj }: { obj: WorldObject }) {
  return (
    <group position={obj.position}>
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[0.08, 0.8, 0.08]} />
        <Toon color="#7A5536" />
      </mesh>
      <mesh position={[0, 0.78, 0.05]} rotation={[-0.2, 0, 0.1]}>
        <boxGeometry args={[0.38, 0.28, 0.01]} />
        <Toon color="#FFF6E4" />
        <Ink thickness={0.012} />
      </mesh>
      <mesh position={[0, 0.82, 0.06]} rotation={[-0.2, 0, 0.1]}>
        <boxGeometry args={[0.24, 0.03, 0.005]} />
        <meshBasicMaterial color="#5E7FC4" />
      </mesh>
      <Hint y={1.2} color="#9FE3FF" />
    </group>
  );
}

function Vault({ obj }: { obj: WorldObject }) {
  const door = useRef<THREE.Group>(null);
  const opened = useGameStore((s) => s.progress.missions.cofre?.steps.includes('abrir') ?? false);
  useFrame((_s, d) => {
    if (door.current) door.current.rotation.y += ((opened ? -1.6 : 0) - door.current.rotation.y) * Math.min(1, d * 4);
  });
  return (
    <RigidBody type="fixed" colliders={false} position={obj.position} rotation={[0, obj.rotation ?? 0, 0]}>
      <CuboidCollider args={[0.45, 0.45, 0.4]} position={[0, 0.45, 0]} />
      {/* the guard's strongbox: dark wood with iron straps and corner caps, on four little feet
          (toon materials: the old metal PBR box rendered almost black without an environment map) */}
      <mesh position={[0, 0.47, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 0.82, 0.8]} />
        <Toon color="#7A4E32" tex="wood" />
        <Ink thickness={0.02} />
      </mesh>
      {[0.2, 0.74].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[0.93, 0.07, 0.83]} />
          <Toon color="#4A4E5A" />
        </mesh>
      ))}
      {[-1, 1].map((sx) => [-1, 1].map((sz) => (
        <mesh key={`${sx}${sz}`} position={[sx * 0.4, 0.04, sz * 0.34]}>
          <boxGeometry args={[0.12, 0.08, 0.12]} />
          <Toon color="#3A3D46" />
        </mesh>
      )))}
      <group ref={door} position={[-0.42, 0.47, 0.41]}>
        <mesh position={[0.42, 0, 0.01]} castShadow>
          <boxGeometry args={[0.8, 0.74, 0.05]} />
          <Toon color="#8A5A3A" tex="wood" />
          <Ink thickness={0.015} />
        </mesh>
        {/* brass plate with the paw emblem and the three code dials */}
        <mesh position={[0.42, 0.14, 0.04]}>
          <boxGeometry args={[0.46, 0.22, 0.02]} />
          <Toon color="#D6A84A" emissive="#5A3A10" emissiveIntensity={0.15} />
        </mesh>
        {[-0.13, 0, 0.13].map((x) => (
          <mesh key={x} position={[0.42 + x, 0.14, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.03, 16]} />
            <Toon color="#F2D27A" />
          </mesh>
        ))}
        {[[0, -0.12, 0.07], [-0.07, -0.05, 0.04], [0.07, -0.05, 0.04], [-0.12, -0.11, 0.035], [0.12, -0.11, 0.035]].map(([x, y, r], k) => (
          <mesh key={k} position={[0.42 + x, y - 0.06, 0.045]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[r, r, 0.02, 14]} />
            <Toon color="#3A3D46" />
          </mesh>
        ))}
      </group>
    </RigidBody>
  );
}

/** The cantina's stock: six empty fish crates, each labelled "8 peixes" (clue for the 48 fish mission). */
const CRATE_SPOTS: [number, number, number][] = [
  [-0.55, 0.25, 0], [0, 0.25, 0.05], [0.55, 0.25, -0.03],
  [-0.28, 0.75, 0], [0.28, 0.75, 0.02],
  [0, 1.25, 0],
];
function FishCrates({ obj }: { obj: WorldObject }) {
  const fur = useGameStore((s) => !!s.progress.flags.pista_pelo);
  return (
    <RigidBody type="fixed" colliders={false}>
      <group rotation={[0, obj.rotation ?? 0, 0]}>
        <CuboidCollider args={[0.82, 0.75, 0.3]} position={[0, 0.75, 0]} />
        {CRATE_SPOTS.map((p, i) => (
          <group key={i} position={p} rotation={[0, (i % 3 - 1) * 0.06, 0]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.5, 0.48, 0.5]} />
              <Toon color={i % 2 ? '#B98A52' : '#A87A45'} />
              <Ink thickness={0.02} />
            </mesh>
            {/* paper label "8 peixes" */}
            <mesh position={[0, 0.02, 0.252]}>
              <planeGeometry args={[0.26, 0.16]} />
              <Toon color="#F6ECD2" />
            </mesh>
            <mesh position={[0, 0.02, 0.254]}>
              <planeGeometry args={[0.1, 0.05]} />
              <Toon color="#3E6FB0" />
            </mesh>
          </group>
        ))}
        {fur && (
          // the striped tufts found during the investigation
          <group position={[0.62, 0.52, 0.27]}>
            {[0, 1, 2].map((k) => (
              <mesh key={k} position={[k * 0.05, k * 0.02, 0]} rotation={[0, 0, 0.6 + k * 0.3]}>
                <capsuleGeometry args={[0.012, 0.07, 3, 6]} />
                <Toon color={k === 1 ? '#5A4A3E' : '#9A8A7A'} />
              </mesh>
            ))}
          </group>
        )}
      </group>
    </RigidBody>
  );
}

/** Height of the floating "!" hint over examinable objects that are taller or lower than usual. */
const HINT_Y: Record<string, number> = { sino_pilar: 1.6, pedra_codigo: 1.7, placa_promocao: 1.4, cerejeira_receita: 2.2, estoque_cantina: 2.1, lancador_kiko: 2.3, balanca_templo: 1.9, horta_mochi: 1.2, torta_hana: 1.3 };

/**
 * Kinds whose look only changes with the game state (no per-frame animation besides the "!" hint and the
 * lantern flame, both marked dynamic): their pieces are merged per object (Etapa 1: ~100 objects were
 * ~660 draw calls). The merge is rebuilt whenever the progress changes, through the key below.
 */
const MERGEABLE = new Set<WorldObject['kind']>(['sign', 'lantern', 'dig', 'clue', 'examine']);
const LIVE_PROPS = new Set(['lancador_kiko']); // animates its arm and the flying fish

/** Changes whenever any flag, step or mission status changes: used to rebuild merged objects. */
const progressVersion = (s: ReturnType<typeof useGameStore.getState>) => {
  let n = Object.keys(s.progress.flags).length * 1000;
  for (const m of Object.values(s.progress.missions)) n += m.steps.length + (m.status === 'done' ? 100 : 1);
  return n;
};

function ObjectView({ obj }: { obj: WorldObject }) {
  const { exists, usable } = useObjectState(obj);
  const mergeable = MERGEABLE.has(obj.kind) && !LIVE_PROPS.has(obj.id);
  const version = useGameStore((s) => (mergeable ? progressVersion(s) : 0));
  const beamPos = useMemo(() => new THREE.Vector3(...obj.position), [obj.position]);
  const tesouro = useGameStore((s) => !!s.progress.flags.got_tesouro);

  if (obj.kind === 'pickup_fish' || obj.kind === 'pickup_paw' || obj.kind === 'pickup_lantern' || obj.kind === 'pickup_herb') return exists ? <Pickup obj={obj} /> : null;
  if (obj.kind === 'ring') return exists ? <Ring obj={obj} /> : null;

  let model: JSX.Element | null = null;
  switch (obj.kind) {
    case 'chest': model = exists ? <Chest obj={obj} usable={usable} /> : null; break;
    case 'sign': model = <SignBoard obj={obj} />; break;
    case 'lantern': model = <LanternPuzzle obj={obj} />; break;
    case 'dig': model = <DigSpot usable={usable && exists} done={tesouro} />; break;
    case 'bell': model = <Bell />; break;
    case 'examine':
      model = (
        <group position={obj.position}>
          {obj.id === 'estoque_cantina' && <FishCrates obj={obj} />}
          {obj.id === 'horta_mochi' && <HortaProp />}
          {obj.id === 'lancador_kiko' && <LauncherProp />}
          {obj.id === 'balanca_templo' && <BalanceProp />}
          {obj.id === 'torta_hana' && <PieProp />}
          {obj.id === 'sino_pilar' && <PillarBell />}
          {obj.id === 'pedra_codigo' && <CodeStone />}
          {obj.id === 'placa_promocao' && <PromoBoard />}
          {obj.id === 'caixote_mercado' && (
            <RigidBody type="fixed" colliders={false}>
              <CuboidCollider args={[0.4, 0.35, 0.4]} position={[0, 0.35, 0]} />
              <mesh position={[0, 0.35, 0]} castShadow>
                <boxGeometry args={[0.8, 0.7, 0.8]} />
                <Toon color="#B98A52" />
                <Ink thickness={0.02} />
              </mesh>
            </RigidBody>
          )}
          {obj.id === 'pergaminho_altar' && exists && (
            <mesh position={[0, 0.82, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.07, 0.07, 0.5, 10]} />
              <Toon color="#F6ECD2" emissive="#FFE9B0" emissiveIntensity={0.4} />
            </mesh>
          )}
          {exists && usable && <Hint y={HINT_Y[obj.id] ?? 1.4} />}
        </group>
      );
      break;
    case 'listen':
      model = exists && usable ? <group position={obj.position}><Hint y={1.6} color="#9FE3FF" /></group> : null;
      break;
    case 'hang':
      model = exists && usable ? <group position={obj.position}><Hint y={obj.value === 4 ? 2.0 : 2.8} /></group> : null;
      break;
    case 'cub':
      model = exists ? <Cub obj={obj} /> : null;
      break;
    case 'clue':
      model = exists ? <ClueNote obj={obj} /> : null;
      break;
    case 'vault':
      model = <Vault obj={obj} />;
      break;
  }

  return (
    <>
      {/* each object is 8–24 separate meshes; past 38 m (fog starts at ~42) they are a few pixels, and the
          ~100 objects were ~660 draw calls from the plaza (Etapa 1). Interaction is unaffected. */}
      {model && (
        <DistanceCull center={obj.position} far={38}>
          {mergeable ? (
            <StaticMerge key={`${exists}|${usable}|${version}`} chunk={0}>
              {model}
            </StaticMerge>
          ) : (
            model
          )}
        </DistanceCull>
      )}
      {exists && <Interactive obj={obj} exists={exists} usable={usable} />}
      {exists && usable && obj.kind !== 'sign' && obj.kind !== 'fountain' && obj.kind !== 'bell' && (
        <FaroBeam position={beamPos} />
      )}
    </>
  );
}

export function WorldObjects() {
  return (
    <>
      {WORLD_OBJECTS.map((obj) => <ObjectView key={obj.id} obj={obj} />)}
    </>
  );
}
