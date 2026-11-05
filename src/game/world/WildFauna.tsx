import { Suspense, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Toon, Ink } from '../materials';
import { playerMotion, playerPosition } from '../systems/playerState';
import { WILD_ORIGIN, WILD_RIVER } from '../../data/wild';
import { OLD_TREES } from './WildScenery';
import { deerStep, makeDeer, CAMPINA, DEER, type Deer } from '../../systems/wildlife';
import { DeerModel, DEER_SIZE, deerClipFor, deerKind, deerModelsReady, playDeerClip, type DeerRig } from './DeerModel';

/**
 * The wild lands' animals that live outside the village's fauna system (after Etapa 10), in local coordinates:
 * a deer herd in the Campina das Ervas (systems/wildlife.ts: they graze, wander and run off when the cat comes
 * close, less shy when it crouches), fish leaping in the river, and squirrels that dash up the old trees.
 * Rabbits, songbirds and butterflies are game/world/Fauna.tsx's, as in the village.
 */

const [OX, OZ] = WILD_ORIGIN;

const HERD: { x: number; z: number; s: number }[] = [
  { x: 18.0, z: 20.0, s: 1.0 }, { x: 20.6, z: 17.6, s: 0.95 }, { x: 16.4, z: 25.4, s: 1.05 }, { x: 21.4, z: 22.8, s: 0.6 }, { x: 18.8, z: 13.6, s: 0.58 },
];

/** The deer drawn from primitives, while the models (world/DeerModel.tsx) are not in the build. */
function PrimitiveDeer({ adult }: { adult: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.62, 0]} scale={[0.8, 0.82, 1.5]} castShadow>
        <sphereGeometry args={[0.3, 12, 9]} />
        <Toon color="#B07A4A" />
        <Ink thickness={0.012} />
      </mesh>
      <mesh position={[0, 0.6, -0.1]} scale={[0.7, 0.5, 1.2]}>
        <sphereGeometry args={[0.26, 10, 8]} />
        <Toon color="#E8D2B0" />
      </mesh>
      <group name="neck" position={[0, 0.78, 0.36]}>
        <mesh position={[0, 0.16, 0.04]} rotation={[0.5, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.1, 0.34, 7]} />
          <Toon color="#B07A4A" />
        </mesh>
        <mesh position={[0, 0.34, 0.14]} scale={[0.85, 0.9, 1.2]}>
          <sphereGeometry args={[0.13, 10, 8]} />
          <Toon color="#B07A4A" />
        </mesh>
        <mesh position={[0, 0.3, 0.29]}>
          <sphereGeometry args={[0.035, 6, 5]} />
          <meshBasicMaterial color="#2A1E1E" />
        </mesh>
        {[-0.09, 0.09].map((x) => (
          <mesh key={x} position={[x, 0.46, 0.08]} rotation={[0, 0, x * 4]} scale={[0.5, 1, 0.25]}>
            <sphereGeometry args={[0.08, 6, 5]} />
            <Toon color="#9A6A40" />
          </mesh>
        ))}
        {adult && [-0.06, 0.06].map((x) => (
          <group key={`a${x}`} position={[x, 0.48, 0.1]} rotation={[0, 0, x * 5]}>
            <mesh position={[0, 0.14, 0]}>
              <cylinderGeometry args={[0.015, 0.02, 0.3, 4]} />
              <Toon color="#E8D8B8" />
            </mesh>
            <mesh position={[x * 1.5, 0.22, 0.04]} rotation={[0, 0, x * 8]}>
              <cylinderGeometry args={[0.012, 0.015, 0.16, 4]} />
              <Toon color="#E8D8B8" />
            </mesh>
          </group>
        ))}
      </group>
      {[[-0.12, 0.28], [0.12, 0.28], [-0.12, -0.28], [0.12, -0.28]].map(([x, z], i) => (
        <group key={i} name={`leg${i}`} position={[x, 0.46, z]}>
          <mesh position={[0, -0.22, 0]}>
            <cylinderGeometry args={[0.04, 0.03, 0.46, 6]} />
            <Toon color="#8C5E3A" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.74, -0.46]}>
        <sphereGeometry args={[0.06, 6, 5]} />
        <Toon color="#FFFFFF" />
      </mesh>
    </group>
  );
}

/** The stag of the herd: the biggest one. */
const STAG = HERD.reduce((b, d, i) => (d.s > HERD[b].s ? i : b), 0);

function Herd() {
  if (!deerModelsReady()) return <PrimitiveHerd />;
  return (
    <Suspense fallback={null}>
      <ModelHerd />
    </Suspense>
  );
}

/** The herd from the Blender models: grazing, looking up, watching the cat, walking and running off. */
function ModelHerd() {
  const deer = useMemo<Deer[]>(() => HERD.map((d, i) => makeDeer(d.x, d.z, i)), []);
  const rigs = useRef<(DeerRig | null)[]>([]);
  const ready = useMemo(() => HERD.map((_, i) => (r: DeerRig) => (rigs.current[i] = r)), []);
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }, raw) => {
    const dt = Math.min(raw, 0.05);
    const cat = { x: playerPosition.x - OX, z: playerPosition.z - OZ, crouch: playerMotion.crouch };
    const reach = cat.crouch ? DEER.noticeCrouch : DEER.notice;
    group.current?.children.forEach((g, i) => {
      const d = deer[i];
      deerStep(d, dt, cat);
      g.position.set(d.x, 0, d.z);
      // turning to a new heading takes a moment
      let dh = d.heading - g.rotation.y;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      g.rotation.y += dh * Math.min(1, dt * (d.mode === 'flee' ? 10 : 4));
      const rig = rigs.current[i];
      if (!rig) return;
      const dist = Math.hypot(cat.x - d.x, cat.z - d.z);
      const clip = deerClipFor(d.mode, dist, reach, clock.elapsedTime, i * 0.27);
      // a fawn's short legs step faster to keep up
      playDeerClip(rig, clip, clip === 'walk' || clip === 'run' ? 1 / Math.max(0.6, HERD[i].s) : 1, (i * 0.31) % 1);
      rig.mixer.update(dt);
    });
  });
  return (
    <group ref={group} userData={{ dynamic: true }}>
      {HERD.map((d, i) => (
        <group key={i}>
          <group scale={d.s * DEER_SIZE}>
            <DeerModel kind={deerKind(d.s, i === STAG)} onReady={ready[i]} />
          </group>
        </group>
      ))}
    </group>
  );
}

function PrimitiveHerd() {
  const deer = useMemo<Deer[]>(() => HERD.map((d, i) => makeDeer(d.x, d.z, i)), []);
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }, raw) => {
    const dt = Math.min(raw, 0.05);
    const cat = { x: playerPosition.x - OX, z: playerPosition.z - OZ, crouch: playerMotion.crouch };
    const t = clock.elapsedTime;
    group.current?.children.forEach((g, i) => {
      const d = deer[i];
      deerStep(d, dt, cat);
      g.position.set(d.x, 0, d.z);
      g.rotation.y = d.heading;
      const neck = g.getObjectByName('neck');
      // grazing: the head goes down; walking or running: up and bobbing
      if (neck) neck.rotation.x += ((d.mode === 'graze' ? 1.0 : 0) - neck.rotation.x) * Math.min(1, dt * 4);
      const pace = d.mode === 'flee' ? 14 : d.mode === 'walk' ? 6 : 0;
      for (let k = 0; k < 4; k++) {
        const leg = g.getObjectByName(`leg${k}`);
        if (leg) leg.rotation.x = pace ? Math.sin(t * pace + (k === 0 || k === 3 ? 0 : Math.PI)) * (d.mode === 'flee' ? 0.7 : 0.35) : 0;
      }
      g.children[0].position.y = d.mode === 'flee' ? Math.abs(Math.sin(t * 7)) * 0.12 : 0;
    });
  });
  return (
    <group ref={group} userData={{ dynamic: true }}>
      {HERD.map((d, i) => (
        <group key={i} scale={d.s}>
          <group>
            <PrimitiveDeer adult={d.s > 0.8} />
          </group>
        </group>
      ))}
    </group>
  );
}

/** A fish leaping out of the river now and then, somewhere along it. */
function LeapingFish() {
  const fish = useRef<THREE.Group>(null);
  const st = useRef({ next: 2, start: -10, x: 6, z: 0, dir: 1 });
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const s = st.current;
    if (t > s.next) {
      s.start = t;
      s.next = t + 2.5 + Math.random() * 3.5;
      s.x = WILD_RIVER.x0 + 1 + Math.random() * (WILD_RIVER.x1 - WILD_RIVER.x0 - 2);
      s.z = -26 + Math.random() * 56;
      s.dir = Math.random() > 0.5 ? 1 : -1;
    }
    const k = (t - s.start) / 0.9;
    const g = fish.current;
    if (!g) return;
    g.visible = k >= 0 && k <= 1;
    if (!g.visible) return;
    g.position.set(s.x + s.dir * (k - 0.5) * 1.2, Math.sin(k * Math.PI) * 0.9, s.z);
    g.rotation.set(0, s.dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
    g.rotateX((k - 0.5) * 2.4);
  });
  return (
    <group ref={fish} visible={false} userData={{ dynamic: true }}>
      <mesh scale={[0.08, 0.1, 0.26]}>
        <sphereGeometry args={[1, 10, 6]} />
        <Toon color="#C9D2DA" emissive="#9AB0C8" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0, 0, -0.28]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.3]}>
        <coneGeometry args={[0.09, 0.14, 4]} />
        <Toon color="#AFB8C2" />
      </mesh>
    </group>
  );
}

/** Squirrels by the old trees: they nose about at the foot and dash up the trunk when the cat comes. */
function Squirrels() {
  const spots = useMemo(() => OLD_TREES.slice(0, 3).map((t, i) => ({ x: t.x + 0.9, z: t.z + 0.4 * (i - 1), up: 0, a: i * 2 })), []);
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }, raw) => {
    const dt = Math.min(raw, 0.05);
    const cat = { x: playerPosition.x - OX, z: playerPosition.z - OZ };
    group.current?.children.forEach((g, i) => {
      const s = spots[i];
      const near = Math.hypot(cat.x - s.x, cat.z - s.z) < (playerMotion.crouch ? 2.2 : 4.5);
      s.up += ((near ? 2.6 : 0) - s.up) * Math.min(1, dt * (near ? 5 : 0.8));
      s.a += dt * (near ? 0 : 1.2);
      const r = s.up > 0.2 ? 0.38 : 0.7 + 0.2 * Math.sin(s.a * 0.7);
      g.position.set(s.x - 0.9 + Math.cos(s.a) * r, s.up + (s.up < 0.2 ? Math.abs(Math.sin(clock.elapsedTime * 9 + i)) * 0.06 : 0), s.z + Math.sin(s.a) * r);
      g.rotation.set(s.up > 0.2 ? -1.3 : 0, -s.a, 0);
    });
  });
  return (
    <group ref={group} userData={{ dynamic: true }}>
      {spots.map((_, i) => (
        <group key={i}>
          <mesh position={[0, 0.1, 0]} scale={[0.8, 0.8, 1.2]}>
            <sphereGeometry args={[0.09, 8, 6]} />
            <Toon color="#B5653A" />
          </mesh>
          <mesh position={[0, 0.17, 0.09]}>
            <sphereGeometry args={[0.065, 8, 6]} />
            <Toon color="#B5653A" />
          </mesh>
          <mesh position={[0, 0.2, -0.12]} rotation={[-0.6, 0, 0]} scale={[0.6, 1.6, 0.6]}>
            <sphereGeometry args={[0.07, 8, 6]} />
            <Toon color="#C97A48" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function WildFauna() {
  return (
    <group>
      <Herd />
      <LeapingFish />
      <Squirrels />
    </group>
  );
}

export { CAMPINA };
