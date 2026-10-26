import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { Toon, Ink, getGradient } from '../materials';
import { useGameStore } from '../../store/gameStore';
import { onGameEvent } from '../../systems/events';
import { spawnParticles } from '../systems/particles';
import { HORTA, LAUNCHER } from '../../data/chapter3';

/**
 * 3D props for the Capítulo 3 missions. They are built to be READ: the garden has a stake every
 * metre to count, the launcher has a painted protractor, the scale shows its weights, the pie
 * tray holds exactly the slices that are left. Each one changes as the mission advances.
 */

const stepDone = (ref: string) => (s: ReturnType<typeof useGameStore.getState>) => {
  const [m, st] = ref.split('.');
  return !!s.progress.missions[m]?.steps.includes(st);
};

/** Big readable number painted on a square (weights, protractor marks). */
function labelTexture(text: string, bg = '#E9DFC9', fg = '#2A1E16') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = fg;
  ctx.font = `bold ${text.length > 2 ? 54 : 72}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function Label({ text, size = 0.3, position, rotation, bg, fg }: { text: string; size?: number; position: [number, number, number]; rotation?: [number, number, number]; bg?: string; fg?: string }) {
  const tex = useMemo(() => labelTexture(text, bg, fg), [text, bg, fg]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[size, size]} />
      <meshToonMaterial map={tex} gradientMap={getGradient()} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ── Horta (6 m × 4 m): a stake every metre, rope fence after the perimeter, sprouts after the area ──
export function HortaProp() {
  const fenced = useGameStore(stepDone('horta.cerca'));
  const planted = useGameStore(stepDone('horta.mudas'));
  const { w, d } = HORTA;
  const stakes = useMemo(() => {
    const pts: [number, number][] = [];
    for (let i = 0; i < w; i++) pts.push([-w / 2 + i, -d / 2], [w / 2 - i, d / 2]);
    for (let j = 0; j < d; j++) pts.push([w / 2, -d / 2 + j], [-w / 2, d / 2 - j]);
    return pts; // 2 × (6 + 4) = 20 stakes, one per metre of perimeter
  }, [w, d]);
  return (
    <group userData={{ dynamic: true }}>
      {/* soil bed */}
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[w, 0.08, d]} />
        <Toon color="#7A5236" />
      </mesh>
      {/* 1 m grid furrows */}
      {Array.from({ length: w - 1 }, (_, i) => (
        <mesh key={`gx${i}`} position={[-w / 2 + i + 1, 0.085, 0]}>
          <boxGeometry args={[0.04, 0.01, d]} />
          <Toon color="#5E3E26" />
        </mesh>
      ))}
      {Array.from({ length: d - 1 }, (_, j) => (
        <mesh key={`gz${j}`} position={[0, 0.085, -d / 2 + j + 1]}>
          <boxGeometry args={[w, 0.01, 0.04]} />
          <Toon color="#5E3E26" />
        </mesh>
      ))}
      {stakes.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.25, z]} castShadow>
          <boxGeometry args={[0.07, 0.5, 0.07]} />
          <Toon color={i % 2 ? '#C9A16A' : '#B98A52'} />
        </mesh>
      ))}
      {/* corner signs with the measures */}
      <Label text="6 m" size={0.42} position={[0, 0.42, d / 2 + 0.25]} />
      <Label text="4 m" size={0.42} position={[w / 2 + 0.25, 0.42, 0]} rotation={[0, Math.PI / 2, 0]} />
      {fenced && [[0, -d / 2, w, 0], [0, d / 2, w, 0], [-w / 2, 0, d, Math.PI / 2], [w / 2, 0, d, Math.PI / 2]].map(([x, z, len, r], i) => (
        <mesh key={`rope${i}`} position={[x, 0.42, z]} rotation={[0, r, 0]}>
          <boxGeometry args={[len, 0.025, 0.025]} />
          <Toon color="#E8D9A8" />
        </mesh>
      ))}
      {planted && Array.from({ length: w * d }, (_, k) => {
        const x = -w / 2 + 0.5 + (k % w);
        const z = -d / 2 + 0.5 + Math.floor(k / w);
        return (
          <group key={`m${k}`} position={[x, 0.09, z]}>
            <mesh position={[0, 0.1, 0]}>
              <coneGeometry args={[0.09, 0.22, 5]} />
              <Toon color="#6FBF4A" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ── Launcher: protractor, arm at 30° (45° once adjusted), a fish flying into the basket on test ──
const ARM = 1.2;
// the arm swings in front of the painted protractor (z +0.5), so it is never hidden by it
const PIVOT = new THREE.Vector3(0, 0.9, 0.5);

export function LauncherProp() {
  const adjusted = useGameStore((s) => !!s.progress.flags.lancador_ajustado);
  const tested = useGameStore(stepDone('maquina.testar'));
  const arm = useRef<THREE.Group>(null);
  const fish = useRef<THREE.Group>(null);
  const flight = useRef({ t: -1 });
  const angle = useRef(30);
  const basketLocal = useMemo(() => new THREE.Vector3(LAUNCHER.basketX - LAUNCHER.x, 0.55, 0), []);

  useEffect(() => onGameEvent((e) => {
    if (e.type === 'sfx' && e.name === 'launch') flight.current.t = 0;
  }), []);

  useFrame((_s, raw) => {
    const dt = Math.min(raw, 0.05);
    const goal = adjusted ? 45 : 30;
    angle.current += (goal - angle.current) * (1 - Math.exp(-dt * 3));
    const a = THREE.MathUtils.degToRad(angle.current);
    if (arm.current) arm.current.rotation.z = -a; // arm points toward −x (the basket), raised by a
    const f = fish.current;
    if (!f) return;
    const fl = flight.current;
    if (fl.t >= 0) {
      fl.t = Math.min(1, fl.t + dt / 1.1);
      const tip = new THREE.Vector3(-Math.cos(a) * ARM, Math.sin(a) * ARM, 0).add(PIVOT);
      const p = tip.clone().lerp(basketLocal, fl.t);
      p.y += Math.sin(fl.t * Math.PI) * 1.6;
      f.position.copy(p);
      f.rotation.z = fl.t * Math.PI * 3;
      f.visible = true;
      if (fl.t >= 1) {
        fl.t = -1;
        spawnParticles('sparkle', [LAUNCHER.basketX, 0.8, LAUNCHER.z], 14, '#FFD54A');
      }
    } else {
      f.visible = tested;
      if (tested) {
        f.position.copy(basketLocal).y += 0.12;
        f.rotation.z = 0.4;
      }
    }
  });

  return (
    <group userData={{ dynamic: true }}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.45, 0.45, 0.4]} position={[0, 0.45, 0]} />
        <mesh position={[0, 0.4, 0]} castShadow>
          <boxGeometry args={[0.9, 0.8, 0.8]} />
          <Toon color="#8C6A48" tex="wood" />
          <Ink thickness={0.02} />
        </mesh>
      </RigidBody>
      {/* painted protractor on the side, marks every 15° */}
      <mesh position={[0, 0.9, 0.41]} rotation={[0, 0, 0]}>
        <circleGeometry args={[0.75, 32, Math.PI / 2, Math.PI / 2]} />
        <Toon color="#F2E6C8" side={THREE.DoubleSide} />
      </mesh>
      {[0, 15, 30, 45, 60, 75, 90].map((deg) => {
        const r = THREE.MathUtils.degToRad(deg);
        return (
          <group key={deg} position={[-Math.cos(r) * 0.62, 0.9 + Math.sin(r) * 0.62, 0.42]} rotation={[0, 0, -r]}>
            <mesh>
              <boxGeometry args={[0.14, 0.02, 0.01]} />
              <meshBasicMaterial color={deg === 45 ? '#2F9A44' : deg === 30 ? '#D9473A' : '#5A4632'} />
            </mesh>
          </group>
        );
      })}
      {/* labels sit beside their marks (12° off the line), out of the arm's way */}
      <Label text="45°" size={0.24} position={[-Math.cos(THREE.MathUtils.degToRad(58)) * 0.98, 0.9 + Math.sin(THREE.MathUtils.degToRad(58)) * 0.98, 0.42]} bg="#DFF3D6" fg="#2F6B24" />
      <Label text="30°" size={0.24} position={[-Math.cos(THREE.MathUtils.degToRad(17)) * 0.98, 0.9 + Math.sin(THREE.MathUtils.degToRad(17)) * 0.98, 0.42]} bg="#F8DDD6" fg="#9C2E22" />
      {/* the arm */}
      <group position={PIVOT.toArray()}>
        <group ref={arm}>
          <mesh position={[-ARM / 2, 0, 0]} castShadow>
            <boxGeometry args={[ARM, 0.1, 0.12]} />
            <Toon color="#D9473A" />
            <Ink thickness={0.015} />
          </mesh>
          <mesh position={[-ARM, 0.06, 0]}>
            <cylinderGeometry args={[0.14, 0.1, 0.1, 12]} />
            <Toon color="#5A4632" />
          </mesh>
        </group>
      </group>
      {/* basket 3 m ahead */}
      <group position={[basketLocal.x, 0, 0]}>
        <mesh position={[0, 0.3, 0]} castShadow>
          <cylinderGeometry args={[0.42, 0.34, 0.6, 16, 1, true]} />
          <Toon color="#C9A16A" tex="thatch" side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.42, 0.04, 6, 20]} />
          <Toon color="#8C6A48" />
        </mesh>
      </group>
      {/* the flying fish */}
      <group ref={fish} visible={false}>
        <mesh scale={[1, 0.45, 0.3]}>
          <sphereGeometry args={[0.16, 10, 8]} />
          <Toon color="#F28B50" />
        </mesh>
        <mesh position={[0.18, 0, 0]} rotation={[0, 0, -Math.PI / 2]} scale={[1, 1, 0.3]}>
          <coneGeometry args={[0.09, 0.12, 3]} />
          <Toon color="#E06A2C" />
        </mesh>
      </group>
    </group>
  );
}

// ── Balance: 3 equal stones + "4" against "19"; each stone shows "5" once solved ──
export function BalanceProp() {
  const solved = useGameStore(stepDone('balanca.pedras'));
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[0.9, 0.6, 0.35]} position={[0, 0.6, 0]} />
      <group userData={{ dynamic: true }}>
        <mesh position={[0, 0.06, 0]} receiveShadow>
          <cylinderGeometry args={[0.5, 0.6, 0.12, 12]} />
          <Toon color="#9C8F7C" tex="stone" />
        </mesh>
        <mesh position={[0, 0.6, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.08, 1.1, 10]} />
          <Toon color="#B08A3A" />
          <Ink thickness={0.015} />
        </mesh>
        <mesh position={[0, 1.15, 0]} castShadow>
          <boxGeometry args={[1.9, 0.07, 0.1]} />
          <Toon color="#C9A04A" />
          <Ink thickness={0.015} />
        </mesh>
        {[-0.85, 0.85].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh position={[0, 0.95, 0]}>
              <cylinderGeometry args={[0.008, 0.008, 0.4, 4]} />
              <meshBasicMaterial color="#5A4632" />
            </mesh>
            <mesh position={[0, 0.74, 0]} castShadow>
              <cylinderGeometry args={[0.36, 0.3, 0.06, 18]} />
              <Toon color="#B08A3A" />
              <Ink thickness={0.012} />
            </mesh>
          </group>
        ))}
        {/* left pan: 3 stones + weight "4" */}
        {[-0.2, 0, 0.2].map((dx, i) => (
          <group key={i} position={[-0.85 + dx, 0.85, -0.1]}>
            <mesh castShadow scale={[1, 0.8, 1]}>
              <dodecahedronGeometry args={[0.1, 0]} />
              <Toon color="#8E8E96" />
            </mesh>
            {solved && <Label text="5" size={0.12} position={[0, 0.02, 0.1]} bg="#FFFFFF" fg="#2F6B24" />}
          </group>
        ))}
        {/* the "4" weight sits at the front of the pan, so it reads from the path */}
        <mesh position={[-0.85, 0.86, 0.17]} castShadow>
          <boxGeometry args={[0.2, 0.18, 0.14]} />
          <Toon color="#5A4632" />
          <Ink thickness={0.01} />
        </mesh>
        <Label text="4" size={0.15} position={[-0.85, 0.86, 0.241]} />
        {/* right pan: weight "19" */}
        <mesh position={[0.85, 0.89, 0]} castShadow>
          <boxGeometry args={[0.32, 0.26, 0.22]} />
          <Toon color="#5A4632" />
          <Ink thickness={0.012} />
        </mesh>
        <Label text="19" size={0.2} position={[0.85, 0.89, 0.111]} />
      </group>
    </RigidBody>
  );
}

// ── Pie tray: exactly the slices left (5 of 8); after half is saved, 4 go under a cloth ──
export function PieProp() {
  const halfSaved = useGameStore(stepDone('fatias.metade'));
  const delivered = useGameStore(stepDone('fatias.entregar'));
  const slices = delivered ? 4 : 5; // one slice went to the guard
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[0.42, 0.35, 0.42]} position={[0, 0.35, 0]} />
      <group userData={{ dynamic: true }}>
        <mesh position={[0, 0.3, 0]} castShadow>
          <cylinderGeometry args={[0.45, 0.4, 0.6, 14]} />
          <Toon color="#A87A45" tex="wood" />
          <Ink thickness={0.015} />
        </mesh>
        <mesh position={[0, 0.62, 0]}>
          <cylinderGeometry args={[0.42, 0.42, 0.03, 24]} />
          <Toon color="#F4F1EA" />
        </mesh>
        {Array.from({ length: slices }, (_, i) => {
          const start = (i / 8) * Math.PI * 2;
          const covered = halfSaved && i < 4;
          return (
            <mesh key={i} position={[0, 0.68, 0]}>
              <cylinderGeometry args={[0.36, 0.36, 0.09, 6, 1, false, start + 0.02, (Math.PI * 2) / 8 - 0.04]} />
              <Toon color={covered ? '#F3E2D6' : '#E8A65A'} />
            </mesh>
          );
        })}
        {halfSaved && (
          <mesh position={[0, 0.74, 0]} rotation={[0, Math.PI / 8, 0]}>
            <cylinderGeometry args={[0.38, 0.38, 0.02, 12, 1, false, 0, Math.PI]} />
            <Toon color="#7FB2E0" />
          </mesh>
        )}
      </group>
    </RigidBody>
  );
}

/** Camomile flower pickup (Luna's tea). */
export function HerbModel() {
  return (
    <group>
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.3, 5]} />
        <Toon color="#5E9E3A" />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.1, 0.12, Math.sin(a) * 0.1]} rotation={[0, -a, 0]} scale={[1.6, 0.4, 0.8]}>
            <sphereGeometry args={[0.05, 8, 6]} />
            <Toon color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.15} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.13, 0]}>
        <sphereGeometry args={[0.06, 10, 8]} />
        <Toon color="#FFC93C" emissive="#FFB300" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}
