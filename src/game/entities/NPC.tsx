import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CylinderCollider } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { Html, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import type { NPCDefinition } from '../../types';
import { playerPosition, abilityState } from '../systems/playerState';
import { useInteractable } from '../systems/interaction';
import { useGameStore } from '../../store/gameStore';
import { resolveDialogue, availableOffer } from '../../data/npcs';
import { MISSIONS } from '../../data/missions';
import { availableSteps, checkCondition } from '../../systems/progression';
import { emit } from '../../systems/events';
import { Suspense } from 'react';
import { Critter } from './Critter';
import { VillagerModel, VILLAGER_ASSETS, type VillagerMood } from './VillagerModel';
import { useAssetAvailable, ModelBoundary } from '../assets/AssetModel';
import { Toon, Ink } from '../materials';
import { blobMaterial } from './contactBlob';

/** One soft ground shadow material for every villager. */
const npcBlob = blobMaterial(0.42);

const TALK_RADIUS = 2.6;
const WALK_SPEED = 1.3;

const MEOW_REPLIES: Record<NPCDefinition['voice'], string[]> = {
  meow: ['Miau pra você também!', 'Isso foi um miado ninja?', 'Hm? Chamou?'],
  meow_low: ['MRRRAU. (Isso foi um olá.)', 'Hmpf. Miado aceito.'],
  meow_high: ['Miau! Miau! Ganhei de você no volume!', 'MIAU!'],
  woof: ['Au! Quer dizer... miau?', 'Au au! Organizado e pontual!'],
  squeak: ['*(dá um pulinho)* Ah! Oi...', 'Eep!'],
  chitter: ['*(esconde algo)* Nada aqui!', 'Krr krr!'],
  grunt: ['Hmm. Bom pulmão.', 'O vento miou também.'],
  snore: ['Zzz... miau... zzz...', '*(ronca mais alto)*'],
};

/**
 * Floating "!" (has a mission to offer) or blue gem (a step of the tracked mission is here). Etapa 7: the
 * "!" was 0.36 m tall and vanished against the lit yellow windows behind Chef Hana in the very first view;
 * now it is ~1.6x larger and sits on a dark round badge that always faces the camera, so it reads over
 * any background.
 */
const badgeMat = new THREE.MeshBasicMaterial({ color: '#1E2A4A', transparent: true, opacity: 0.82, depthWrite: false });
const ringMat = new THREE.MeshBasicMaterial({ color: '#FFD54A', depthWrite: false });
const ringBlue = new THREE.MeshBasicMaterial({ color: '#7FD3FF', depthWrite: false });
const badgeGeo = new THREE.CircleGeometry(0.4, 28);
const ringGeo = new THREE.RingGeometry(0.4, 0.47, 28);

function Marker({ kind }: { kind: 'offer' | 'target' }) {
  const bob = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (bob.current) bob.current.position.y = 2.45 + Math.sin(t * 3) * 0.1;
    if (spin.current) spin.current.rotation.y = Math.sin(t * 1.6) * 0.5;
  });
  return (
    <group ref={bob} position={[0, 2.45, 0]}>
      <Billboard>
        <mesh geometry={badgeGeo} material={badgeMat} position={[0, 0, -0.12]} renderOrder={2} />
        <mesh geometry={ringGeo} material={kind === 'offer' ? ringMat : ringBlue} position={[0, 0, -0.11]} renderOrder={2} />
      </Billboard>
      <group ref={spin} scale={1.6}>
        {kind === 'offer' ? (
          <>
            <mesh position={[0, 0.06, 0]}>
              <boxGeometry args={[0.13, 0.3, 0.13]} />
              <Toon color="#FFD54A" emissive="#FFB300" emissiveIntensity={0.9} />
              <Ink thickness={0.02} />
            </mesh>
            <mesh position={[0, -0.18, 0]}>
              <sphereGeometry args={[0.075, 10, 8]} />
              <Toon color="#FFD54A" emissive="#FFB300" emissiveIntensity={0.9} />
              <Ink thickness={0.02} />
            </mesh>
          </>
        ) : (
          <mesh>
            <octahedronGeometry args={[0.17, 0]} />
            <Toon color="#7FD3FF" emissive="#3EA8E0" emissiveIntensity={0.8} />
            <Ink thickness={0.02} />
          </mesh>
        )}
      </group>
    </group>
  );
}

function Bubble({ text }: { text: string }) {
  return (
    <Html position={[0, 2.05, 0]} center distanceFactor={9} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div className="npc-bubble">{text}</div>
    </Html>
  );
}

export function NPC({ npc }: { npc: NPCDefinition }) {
  const visible = useGameStore((s) => checkCondition(npc.visibleWhen, s.progress));
  if (!visible) return null;
  return <NPCBody npc={npc} />;
}

function NPCBody({ npc }: { npc: NPCDefinition }) {
  const body = useRef<RapierRigidBody>(null);
  const visual = useRef<THREE.Group>(null);
  const arms = useRef<(THREE.Group | null)[]>([]);
  const worldPos = useMemo(() => new THREE.Vector3(...npc.position), [npc.position]);
  const time = useRef(Math.random() * Math.PI * 2);
  const facing = useRef(npc.faceRotation ?? 0);
  const patrolIndex = useRef(1);
  /** Current walking speed: eases in and out instead of starting and stopping at full speed (Etapa 5). */
  const pace = useRef(0);
  const hop = useRef(0);
  const seenMeow = useRef(-1);
  const nextBark = useRef(4 + Math.random() * 8);
  const [bubble, setBubble] = useState<string | null>(null);
  const bubbleUntil = useRef(0);
  // Cast GLB when the file exists; otherwise the procedural Critter.
  const castAsset = VILLAGER_ASSETS[npc.id] ?? null;
  const hasModel = useAssetAvailable(castAsset) === true;
  const mood = useRef<VillagerMood>({ walking: false, talking: false, greeting: false, cheer: 0, walkSpeed: 0, lookYaw: 0, lookPitch: 0 });
  const glance = useRef({ yaw: 0, until: 0, next: 3 + Math.random() * 5 });

  const offer = useGameStore((s) => availableOffer(npc, s.progress));
  const isTarget = useGameStore((s) => {
    const tracked = s.progress.tracked;
    if (!tracked || s.progress.missions[tracked]?.status !== 'active') return false;
    return availableSteps(MISSIONS[tracked], s.progress).some((st) => st.target && 'npc' in st.target && st.target.npc === npc.id);
  });

  const interactable = useMemo(() => ({
    id: `npc:${npc.id}`,
    position: worldPos,
    radius: TALK_RADIUS,
    tagHeight: 2.5 * Math.max(0.85, npc.look.scale),
    label: () => `Falar com ${npc.name}`,
    onInteract: () => {
      const st = useGameStore.getState();
      const resolved = resolveDialogue(npc, st.progress);
      if (!resolved) return;
      emit({ type: 'sfx', name: `voice_${npc.voice}`, position: [worldPos.x, worldPos.y + 1, worldPos.z] });
      setBubble(null);
      st.openDialogue(npc.id, npc.name, resolved.tree, resolved.startId);
    },
  }), [npc, worldPos]);
  useInteractable(interactable);

  const sleeping = npc.look.accessory === 'sleeper';

  useFrame((_state, rawDelta) => {
    if (!visual.current) return;
    const delta = Math.min(rawDelta, 0.05);
    time.current += delta;
    const t = time.current;
    const store = useGameStore.getState();
    const inDialogue = store.activeDialogue?.npcId === npc.id;
    const dist = playerPosition.distanceTo(worldPos);

    // Simple routine: patrol between points unless the player is close or talking.
    // The pace eases toward the patrol speed (or to a stop when Shinichi comes close or a dialogue opens),
    // so the walk clip, timed to the real pace, never has the body gliding at full speed on standing feet.
    let walking = false;
    if (npc.patrol && store.phase === 'playing') {
      const wants = !inDialogue && dist > 3.5;
      const top = npc.speed ?? WALK_SPEED;
      pace.current = Math.max(0, Math.min(top, pace.current + (wants ? 1 : -1) * top * 3.2 * delta));
      const target = npc.patrol[patrolIndex.current];
      const dx = target[0] - worldPos.x;
      const dz = target[2] - worldPos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.1) patrolIndex.current = (patrolIndex.current + 1) % npc.patrol.length;
      else if (pace.current > 0) {
        const step = Math.min(d, pace.current * delta);
        worldPos.x += (dx / d) * step;
        worldPos.z += (dz / d) * step;
        walking = true;
        const want = Math.atan2(dx, dz);
        const diff = ((want - facing.current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        facing.current += diff * Math.min(1, delta * 6);
      }
      body.current?.setNextKinematicTranslation({ x: worldPos.x, y: worldPos.y, z: worldPos.z });
    }

    // Turn toward Shinichi when he is near: the head leads (rigged models), the body follows.
    let lookYaw = 0;
    let lookPitch = 0;
    if (!walking && !sleeping && dist < 6) {
      const want = Math.atan2(playerPosition.x - worldPos.x, playerPosition.z - worldPos.z);
      const diff = ((want - facing.current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      facing.current += diff * Math.min(1, delta * (hasModel ? 2.2 : 5));
      const left = ((want - facing.current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      lookYaw = THREE.MathUtils.clamp(left, -0.9, 0.9);
      // Shinichi is short: look down at him, more when he is close
      const flat = Math.max(0.5, Math.hypot(playerPosition.x - worldPos.x, playerPosition.z - worldPos.z));
      lookPitch = THREE.MathUtils.clamp(Math.atan2(playerPosition.y + 0.2 - (worldPos.y + 1.45 * scale), flat), -0.5, 0.15);
    } else if (!walking && !sleeping) {
      // nobody around: an occasional glance to the side
      const g = glance.current;
      g.next -= delta;
      if (g.next <= 0) {
        g.yaw = (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.35);
        g.until = t + 1.2 + Math.random();
        g.next = 4 + Math.random() * 6;
      }
      if (t < g.until) lookYaw = g.yaw;
    }

    // React to Shinichi's meow.
    const meow = abilityState.lastMeow;
    if (meow.time > seenMeow.current && meow.position.distanceTo(worldPos) < 8) {
      seenMeow.current = meow.time;
      hop.current = 1;
      const lines = MEOW_REPLIES[npc.voice];
      setBubble(lines[Math.floor(Math.random() * lines.length)]);
      bubbleUntil.current = t + 2.6;
      setTimeout(() => emit({ type: 'sfx', name: `voice_${npc.voice}`, position: [worldPos.x, 1, worldPos.z] }), 350 + Math.random() * 250);
    }

    // Occasional barks when the player walks by.
    nextBark.current -= delta;
    if (npc.barks && nextBark.current <= 0 && dist < 7 && dist > TALK_RADIUS && store.phase === 'playing') {
      nextBark.current = 16 + Math.random() * 14;
      setBubble(npc.barks[Math.floor(Math.random() * npc.barks.length)]);
      bubbleUntil.current = t + 3.2;
    }
    if (bubble && (t > bubbleUntil.current || inDialogue)) setBubble(null);

    hop.current = Math.max(0, hop.current - delta * 2.5);
    const hopY = Math.sin(hop.current * Math.PI) * 0.35;
    const bounce = walking ? Math.abs(Math.sin(t * (npc.speed ? 14 : 9))) * 0.06 : Math.abs(Math.sin(t * 2.2)) * 0.03;
    visual.current.rotation.y = facing.current;
    if (hasModel) {
      // the rigged model animates its own stride and breathing
      visual.current.position.set(worldPos.x, worldPos.y + hopY * 0.5, worldPos.z);
      const m = mood.current;
      m.walking = walking;
      m.talking = inDialogue;
      m.greeting = dist < TALK_RADIUS + 1 && !walking && !sleeping && !inDialogue;
      m.cheer = hop.current;
      m.walkSpeed = walking ? pace.current : 0;
      m.lookYaw = lookYaw;
      m.lookPitch = lookPitch;
      return;
    }
    visual.current.position.set(worldPos.x, worldPos.y + (sleeping ? 0 : bounce + hopY), worldPos.z);
    const breathe = Math.sin(t * (sleeping ? 1.6 : 4.4)) * (sleeping ? 0.03 : 0.012);
    visual.current.scale.set(1 + breathe, 1 - breathe, 1);

    arms.current.forEach((arm, i) => {
      if (!arm) return;
      const waving = dist < TALK_RADIUS + 1 && i === 0 && !walking && !sleeping;
      const target = waving ? 2.3 + Math.sin(t * 9) * 0.35 : walking ? (i ? -1 : 1) * (0.35 + Math.sin(t * 9 + i * Math.PI) * 0.3) : (i ? -0.35 : 0.35);
      arm.rotation.z += (target - arm.rotation.z) * 0.2;
    });
  });

  const scale = npc.look.scale;

  return (
    <>
      <RigidBody ref={body} type="kinematicPosition" colliders={false} position={npc.position} userData={{ noCamera: true }}>
        <CylinderCollider args={[0.6 * scale, 0.36 * scale * (npc.look.wide ?? 1)]} position={[0, 0.6 * scale, 0]} />
      </RigidBody>
      <group ref={visual} position={npc.position}>
        {/* the procedural doll lies down to sleep; the rigged Neko dozes standing up (sleepy lids and nodding) */}
        <group rotation={sleeping && !hasModel ? [0, 0, Math.PI / 2] : [0, 0, 0]} position={sleeping && !hasModel ? [0.55, 0.3, 0] : [0, 0, 0]}>
          {hasModel && castAsset ? (
            <ModelBoundary fallback={<Critter look={npc.look} armsRef={arms} />}>
              <Suspense fallback={<Critter look={npc.look} armsRef={arms} />}>
                <VillagerModel name={castAsset} mood={mood} scale={1.3 * scale} />
              </Suspense>
            </ModelBoundary>
          ) : (
            <Critter look={npc.look} armsRef={arms} />
          )}
        </group>
        {/* soft contact shadow (was a hard-edged black disc that read as a sticker), Etapa 5 */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} scale={[1.15 * scale, 1.15 * scale, 1]} material={npcBlob} renderOrder={1}>
          <planeGeometry args={[1, 1]} />
        </mesh>
        {offer ? <Marker kind="offer" /> : isTarget ? <Marker kind="target" /> : null}
        {sleeping && <Bubble text="💤" />}
        {bubble && !sleeping && <Bubble text={bubble} />}
      </group>
    </>
  );
}
