import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RIVER } from '../../data/world';
import { HANG_SPOTS } from '../../data/world2';
import { useGameStore } from '../../store/gameStore';
import { onGameEvent, emit } from '../../systems/events';
import { spawnParticles } from '../systems/particles';
import { spawnRing } from '../systems/vfx';
import { playerPosition } from '../systems/playerState';
import { PaperLantern } from './Buildings';

/** Small touches that make the village feel alive. Everything here is purely visual. */

/** A river fish leaps out now and then (splash + sound). */
function JumpingFish() {
  const fish = useRef<THREE.Group>(null);
  const jump = useRef({ t: 1, x: 0, next: 3 });
  useFrame((_s, rawDelta) => {
    const f = fish.current;
    if (!f) return;
    const d = Math.min(rawDelta, 0.05);
    const j = jump.current;
    if (j.t >= 1) {
      f.visible = false;
      j.next -= d;
      if (j.next <= 0) {
        j.x = (Math.random() - 0.5) * 30;
        if (Math.abs(j.x) < 2.5) j.x += 4;
        j.t = 0;
        j.next = 3 + Math.random() * 5;
        spawnParticles('splash', [j.x, 0.1, RIVER.z], 6);
        if (Math.hypot(playerPosition.x - j.x, playerPosition.z - RIVER.z) < 16) emit({ type: 'sfx', name: 'flop', position: [j.x, 0.2, RIVER.z] });
      }
      return;
    }
    j.t = Math.min(1, j.t + d / 0.9);
    f.visible = true;
    f.position.set(j.x + (j.t - 0.5) * 1.6, Math.sin(j.t * Math.PI) * 1.3, RIVER.z + 0.3);
    f.rotation.z = (0.5 - j.t) * 2.2;
    if (j.t >= 1) spawnParticles('splash', [j.x + 0.8, 0.1, RIVER.z + 0.3], 6);
  });
  return (
    <group ref={fish} visible={false}>
      <mesh scale={[1, 0.45, 0.3]}>
        <sphereGeometry args={[0.25, 10, 8]} />
        <meshToonMaterial color="#F28C38" />
      </mesh>
      <mesh position={[-0.28, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.3]}>
        <coneGeometry args={[0.13, 0.18, 3]} />
        <meshToonMaterial color="#E06A1E" />
      </mesh>
    </group>
  );
}

const CHIMNEYS: [number, number, number][] = [[-9.4, 5.6, -9.2], [15.6, 4.4, 15.2], [-13, 3.6, 9]];

function ChimneySmoke() {
  const timer = useRef(0);
  useFrame((_s, d) => {
    timer.current -= d;
    if (timer.current > 0) return;
    timer.current = 0.45;
    for (const c of CHIMNEYS) {
      if (Math.hypot(playerPosition.x - c[0], playerPosition.z - c[2]) < 40) spawnParticles('smoke', c, 1);
    }
  });
  return null;
}

const FIREWORK_COLORS = ['#FFD54A', '#F49AB8', '#7FD3FF', '#8BE38F', '#FF8A5B', '#C79BFF'];

/** Fireworks over the plaza when the festival starts or the chapter ends. */
function Fireworks() {
  const queue = useRef<number[]>([]);
  const levelBurst = useRef({ until: 0, angle: 0 });
  useEffect(() => onGameEvent((e) => {
    if (e.type === 'levelUp') {
      // a golden spiral around Shinichi and a burst above the head
      levelBurst.current.until = performance.now() + 1400;
      spawnParticles('firework', [playerPosition.x, playerPosition.y + 2.2, playerPosition.z], 26, '#FFD54A');
      spawnParticles('firework', [playerPosition.x, playerPosition.y + 2.4, playerPosition.z], 16, '#7FD3FF');
      spawnRing([playerPosition.x, playerPosition.y - 0.6, playerPosition.z], { color: '#FFD54A', size: 2.4, life: 0.8 });
      window.setTimeout(() => spawnRing([playerPosition.x, playerPosition.y - 0.6, playerPosition.z], { color: '#7FD3FF', size: 1.8, life: 0.7 }), 180);
    }
    if (e.type === 'sfx' && e.name === 'fireworks') {
      const now = performance.now();
      queue.current.push(...Array.from({ length: 10 }, (_, i) => now + i * 550 + Math.random() * 200));
    }
  }), []);
  useFrame((_s, dt) => {
    const now = performance.now();
    const lb = levelBurst.current;
    if (now < lb.until) {
      lb.angle += dt * 9;
      const h = 1 - (lb.until - now) / 1400;
      for (const k of [0, Math.PI]) {
        const a = lb.angle + k;
        spawnParticles('sparkle', [playerPosition.x + Math.cos(a) * 0.8, playerPosition.y + 0.2 + h * 1.8, playerPosition.z + Math.sin(a) * 0.8], 1, k ? '#7FD3FF' : '#FFD54A');
      }
    }
    while (queue.current.length && queue.current[0] <= now) {
      queue.current.shift();
      const x = (Math.random() - 0.5) * 14;
      const z = (Math.random() - 0.5) * 10 - 2;
      const y = 13 + Math.random() * 5;
      spawnParticles('firework', [x, y, z], 22, FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)]);
      emit({ type: 'sfx', name: 'firework_pop', position: [x, y, z] });
    }
  });
  return null;
}

/** Lanterns hung during the festival, glowing (or dark when Kuro blows them out). */
function FestivalLanterns() {
  const flags = useGameStore((s) => s.progress.flags);
  const dark = !!flags.lanternas_escuras && !flags.lanternas_reacesas;
  return (
    <group userData={{ dynamic: true }}>
      {HANG_SPOTS.map((p, i) => {
        if (!flags[`pendurada_${i}`]) return null;
        const torii = i === 4;
        return (
          <group key={i} position={[p[0], torii ? 2.35 : 3.05, p[2]]}>
            <mesh position={[0, 0.3, 0]}>
              <cylinderGeometry args={[0.01, 0.01, 0.35, 4]} />
              <meshBasicMaterial color="#3a2a22" />
            </mesh>
            {dark ? (
              <mesh scale={[1, 1.25, 1]}>
                <sphereGeometry args={[0.17, 12, 10]} />
                <meshToonMaterial color="#6A5A5A" />
              </mesh>
            ) : (
              <PaperLantern position={[0, 0, 0]} color={['#E0483A', '#F2A541', '#E8A0BF', '#5E7FC4', '#FFD54A'][i]} />
            )}
          </group>
        );
      })}
    </group>
  );
}

export function LivingWorld() {
  return (
    <>
      {/* butterflies and birds live in Fauna.tsx now (Etapa 4) */}
      <JumpingFish />
      <ChimneySmoke />
      <Fireworks />
      <FestivalLanterns />
    </>
  );
}
