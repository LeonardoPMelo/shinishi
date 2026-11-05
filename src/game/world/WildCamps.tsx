import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import { Toon, Ink, getGradient } from '../materials';
import { Campfire } from './Campfire';
import { Rock } from './Rock';
import { useGameStore } from '../../store/gameStore';
import { emit } from '../../systems/events';
import { isHostile } from '../../systems/combat';
import { combatWorld } from '../systems/hearts';
import { useSpot, useIconTexture } from '../systems/training';
import { useZone } from '../systems/zone';
import { w } from '../../data/wild';
import {
  ESPINHO_CAMP, ESPINHO_TENTS, ESPINHO_LOOKOUT, ESPINHO_FIRE, ESPINHO_LOOT, CAGES, CAGE_SAFE, CAGE_REACH, FORT_TOWERS, WILD2_CODE_ACTIONS,
  CAMP_PATHS, CAMP_PROPS,
} from '../../data/wild2';

/**
 * The enemies' places in the wild lands (data/wild2.ts), in local coordinates (the region's group places them):
 *  - O Acampamento dos Espinhos: tents, a lookout, the fire, the stolen goods and the cages. While the band is
 *    there it is lived in (smoke, a lit fire, banners up); once the chief is beaten it is left empty.
 *  - O Fortim do Hissui: watchtowers for its archers, racks, a training dummy, more tents.
 *  - The animals the cat set free, safe at the expedition's camp.
 * Static parts merge with the region (`WildCamps`); what changes is in `WildCampsLife`.
 */

const WOOD = '#6E4E36';
const WOOD_DARK = '#4E3626';
const CLOTH = '#8C6A4A';
const toast = (icon: string, text: string) => emit({ type: 'toast', icon, text });

/** Tent panel: a cloth sheet from the ridge down to one side, sagging a little between the poles. */
function panelGeometry(side: number, W: number, H: number, L: number) {
  const g = new THREE.PlaneGeometry(1, 1, 6, 10);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) + 0.5; // 0 at the ridge, 1 at the ground
    const v = pos.getY(i) + 0.5; // along the ridge
    const sag = Math.sin(Math.PI * u) * (0.55 + 0.45 * Math.sin(Math.PI * v));
    pos.setXYZ(i, side * (W * u - 0.05 * sag), H * (1 - u) - 0.06 * sag + 0.02, (v - 0.5) * L);
  }
  g.computeVertexNormals();
  return g;
}

/** Tent end: the back closed by a triangle; at the front two flaps folded open. */
function triangleGeometry(a: [number, number, number], b: [number, number, number], c: [number, number, number]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
  g.computeVertexNormals();
  return g;
}

/**
 * A canvas tent: two sagging cloth sides on a ridge pole, the back closed, the front flaps tied open (a dark
 * inside with a bedroll), a hem along the bottom, guy ropes to pegs at both ends. The front faces +z.
 * `torn`: an abandoned one, sagging low and leaning over.
 */
export function Tent({ x, z, rot = 0, color = CLOTH, size = 1, torn = false }: { x: number; z: number; rot?: number; color?: string; size?: number; torn?: boolean }) {
  const s = size;
  const W = 1.08 * s, H = 1.38 * s, L = 2.4 * s;
  const geo = useMemo(() => ({
    sides: [panelGeometry(-1, W, H, L), panelGeometry(1, W, H, L)],
    back: triangleGeometry([-W, 0.02, -L / 2], [W, 0.02, -L / 2], [0, H, -L / 2]),
    // the flaps: each half of the front, swung out round its outer edge
    flaps: [-1, 1].map((side) => triangleGeometry([side * W, 0.02, L / 2], [side * W * 1.55, 0.25 * s, L / 2 + 0.55 * s], [0, H, L / 2])),
  }), [W, H, L, s]);
  const hem = new THREE.Color(color).multiplyScalar(0.72).getStyle();
  const inner = new THREE.Color(color).multiplyScalar(1.15).getStyle();
  return (
    <RigidBody type="fixed" colliders={false} position={[x, 0, z]} rotation={[0, rot, 0]}>
      <CuboidCollider args={[1.0 * s, 0.7 * s, 1.2 * s]} position={[0, 0.7 * s, 0]} />
      <group rotation={[0, 0, torn ? 0.16 : 0]} scale={[1, torn ? 0.7 : 1, 1]}>
      {geo.sides.map((g, i) => (
        <mesh key={i} geometry={g} castShadow receiveShadow>
          <Toon color={color} side={THREE.DoubleSide} />
          <Ink thickness={0.012} />
        </mesh>
      ))}
      <mesh geometry={geo.back} receiveShadow>
        <Toon color={hem} side={THREE.DoubleSide} />
      </mesh>
      {geo.flaps.map((g, i) => (
        <mesh key={i} geometry={g} castShadow>
          <Toon color={inner} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* the hem along both bottom edges */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (W - 0.04), 0.07, 0]} rotation={[0, 0, side * 0.9]}>
          <boxGeometry args={[0.04, 0.16, L + 0.02]} />
          <Toon color={hem} />
        </mesh>
      ))}
      {/* ridge pole, the two uprights, guy ropes and pegs */}
      <mesh position={[0, H + 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, L + 0.3, 6]} />
        <Toon color={WOOD_DARK} />
      </mesh>
      {[-1, 1].map((e) => (
        <group key={e}>
          <mesh position={[0, H / 2, e * (L / 2 + 0.05)]}>
            <cylinderGeometry args={[0.04, 0.045, H, 6]} />
            <Toon color={WOOD_DARK} />
          </mesh>
          <mesh position={[0, H * 0.5, e * (L / 2 + 0.52 * s)]} rotation={[e * -0.6, 0, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 1.66 * s, 4]} />
            <Toon color="#D8C8A0" />
          </mesh>
          <mesh position={[0, 0.06, e * (L / 2 + 0.98 * s)]} rotation={[e * 0.3, 0, 0]}>
            <cylinderGeometry args={[0.02, 0.012, 0.16, 5]} />
            <Toon color={WOOD} />
          </mesh>
        </group>
      ))}
      {/* the shade inside, and a bedroll */}
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W * 1.7, L]} />
        <Toon color="#4A3A30" />
      </mesh>
      <mesh position={[0, 0.06, -0.2 * s]} scale={[0.7, 0.12, 1.4]}>
        <boxGeometry args={[1 * s, 1, 1 * s]} />
        <Toon color="#7E3B32" />
      </mesh>
      </group>
    </RigidBody>
  );
}

function Crate({ x, z, s = 0.6, rot = 0, y = 0 }: { x: number; z: number; s?: number; rot?: number; y?: number }) {
  return (
    <RigidBody type="fixed" colliders={false} position={[x, y, z]} rotation={[0, rot, 0]}>
      <CuboidCollider args={[s / 2, s / 2, s / 2]} position={[0, s / 2, 0]} />
      <mesh position={[0, s / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[s, s, s]} />
        <Toon color="#A87A45" tex="planks" />
        <Ink thickness={0.012} />
      </mesh>
    </RigidBody>
  );
}

function Barrel({ x, z }: { x: number; z: number }) {
  return (
    <RigidBody type="fixed" colliders={false} position={[x, 0, z]}>
      <CylinderCollider args={[0.42, 0.34]} position={[0, 0.42, 0]} />
      <mesh position={[0, 0.42, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.35, 0.84, 12]} />
        <Toon color="#8C6440" tex="planks" />
        <Ink thickness={0.012} />
      </mesh>
      {[0.15, 0.7].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[0.36, 0.36, 0.05, 12]} />
          <Toon color="#4A4A52" />
        </mesh>
      ))}
    </RigidBody>
  );
}

/** A lookout: four log legs, a ladder, a railed platform and a little roof. */
function Lookout({ x, z, h, roof = '#5A3A2E' }: { x: number; z: number; h: number; roof?: string }) {
  return (
    <RigidBody type="fixed" colliders={false} position={[x, 0, z]}>
      {/* legs and the platform only: the archer up there sees (and is seen) between the legs */}
      {[[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]].map(([px, pz]) => <CuboidCollider key={`c${px}${pz}`} args={[0.13, (h + 1.6) / 2, 0.13]} position={[px, (h + 1.6) / 2, pz]} />)}
      <CuboidCollider args={[0.95, 0.1, 0.95]} position={[0, h, 0]} />
      {[[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]].map(([px, pz]) => (
        <mesh key={`${px}${pz}`} position={[px, (h + 1.6) / 2, pz]} castShadow>
          <cylinderGeometry args={[0.1, 0.13, h + 1.6, 7]} />
          <Toon color={WOOD} tex="bark" />
        </mesh>
      ))}
      <mesh position={[0, h, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.9, 0.14, 1.9]} />
        <Toon color="#7A5A3E" tex="planks" />
      </mesh>
      {[[0, -0.92, 1.9, 0.06], [0, 0.92, 1.9, 0.06], [-0.92, 0, 0.06, 1.9], [0.92, 0, 0.06, 1.9]].map(([px, pz, sx, sz], i) => (
        <mesh key={i} position={[px, h + 0.55, pz]}>
          <boxGeometry args={[sx, 0.07, sz]} />
          <Toon color={WOOD} />
        </mesh>
      ))}
      {/* the ladder, on the side facing the camp */}
      {[-0.22, 0.22].map((px) => (
        <mesh key={px} position={[px, h / 2, 1.0]} rotation={[-0.12, 0, 0]}>
          <boxGeometry args={[0.06, h + 0.2, 0.06]} />
          <Toon color={WOOD_DARK} />
        </mesh>
      ))}
      {Array.from({ length: Math.floor(h / 0.4) }, (_, i) => (
        <mesh key={`r${i}`} position={[0, 0.3 + i * 0.4, 1.0 + 0.04 - i * 0.05]}>
          <boxGeometry args={[0.48, 0.05, 0.05]} />
          <Toon color={WOOD_DARK} />
        </mesh>
      ))}
      <mesh position={[0, h + 1.75, 0]} castShadow>
        <coneGeometry args={[1.5, 0.8, 4]} />
        <Toon color={roof} />
        <Ink thickness={0.015} />
      </mesh>
    </RigidBody>
  );
}

/** A low fence of sharpened stakes from a to b (the camp's edges). */
function Stakes({ a, b }: { a: [number, number]; b: [number, number] }) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const rot = -Math.atan2(b[1] - a[1], b[0] - a[0]);
  const n = Math.max(2, Math.round(len / 0.45));
  return (
    <group position={[a[0], 0, a[1]]} rotation={[0, rot, 0]}>
      <RigidBody type="fixed" colliders={false} position={[len / 2, 0, 0]}>
        <CuboidCollider args={[len / 2, 0.6, 0.12]} position={[0, 0.6, 0]} />
      </RigidBody>
      {Array.from({ length: n }, (_, i) => (
        <group key={i} position={[(i / (n - 1)) * len, 0, 0]} rotation={[0, 0, (i % 3 - 1) * 0.06]}>
          <mesh position={[0, 0.5, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.08, 1.0, 6]} />
            <Toon color={WOOD} tex="bark" />
          </mesh>
          <mesh position={[0, 1.08, 0]}>
            <coneGeometry args={[0.07, 0.18, 6]} />
            <Toon color="#9A7A54" />
          </mesh>
        </group>
      ))}
      <mesh position={[len / 2, 0.62, 0]}>
        <boxGeometry args={[len, 0.06, 0.05]} />
        <Toon color="#C9B48C" />
      </mesh>
    </group>
  );
}

/** A banner pole with a cloth and a drawn mark. */
function Flag({ x, z, icon, cloth, rot = 0 }: { x: number; z: number; icon: string; cloth: string; rot?: number }) {
  const tex = useIconTexture(icon, cloth, '#FFFFFF');
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 1.4, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 2.8, 6]} />
        <Toon color={WOOD_DARK} />
      </mesh>
      <mesh position={[0.36, 2.25, 0]}>
        <planeGeometry args={[0.7, 0.9]} />
        <Toon color={cloth} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0.36, 2.25, 0.01]}>
        <planeGeometry args={[0.5, 0.5]} />
        <meshBasicMaterial map={tex} transparent />
      </mesh>
    </group>
  );
}

/** Log seats around a fire ring. */
function FirePlace({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        const k = 0.23 + ((i * 0.37) % 1) * 0.08;
        return <Rock key={i} variant={i % 4} kind="pebble" position={[Math.cos(a) * 0.66, 0.06, Math.sin(a) * 0.66]} rotation={[0, a * 3, 0]} scale={[k * 1.25, k * 0.85, k]} color={i % 3 ? '#8C8478' : '#7A7268'} contact={false} />;
      })}
      {[0, 2.1, 4.2].map((a, i) => (
        <RigidBody key={i} type="fixed" colliders={false} position={[Math.cos(a) * 1.6, 0, Math.sin(a) * 1.6]} rotation={[0, -a + Math.PI / 2, 0]}>
          <CuboidCollider args={[0.6, 0.18, 0.18]} position={[0, 0.18, 0]} />
          <mesh position={[0, 0.2, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.18, 0.2, 1.2, 8]} />
            <Toon color="#7A5A44" tex="bark" />
          </mesh>
        </RigidBody>
      ))}
    </group>
  );
}

/** A training dummy of straw on a post. */
function Dummy({ x, z }: { x: number; z: number }) {
  return (
    <RigidBody type="fixed" colliders={false} position={[x, 0, z]}>
      <CylinderCollider args={[0.7, 0.25]} position={[0, 0.7, 0]} />
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 1.2, 6]} />
        <Toon color={WOOD_DARK} />
      </mesh>
      <mesh position={[0, 0.95, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.22, 0.6, 9]} />
        <Toon color="#D8C27A" tex="thatch" />
      </mesh>
      <mesh position={[0, 1.38, 0]}>
        <sphereGeometry args={[0.17, 9, 7]} />
        <Toon color="#E3CF8C" tex="thatch" />
      </mesh>
      <mesh position={[0, 1.0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 0.9, 5]} />
        <Toon color={WOOD_DARK} />
      </mesh>
    </RigidBody>
  );
}

function WeaponRack({ x, z, rot = 0 }: { x: number; z: number; rot?: number }) {
  return (
    <RigidBody type="fixed" colliders={false} position={[x, 0, z]} rotation={[0, rot, 0]}>
      <CuboidCollider args={[0.7, 0.6, 0.18]} position={[0, 0.6, 0]} />
      {[-0.65, 0.65].map((px) => (
        <mesh key={px} position={[px, 0.6, 0]}>
          <boxGeometry args={[0.08, 1.2, 0.08]} />
          <Toon color={WOOD_DARK} />
        </mesh>
      ))}
      <mesh position={[0, 1.05, 0]}>
        <boxGeometry args={[1.4, 0.08, 0.1]} />
        <Toon color={WOOD} />
      </mesh>
      {[-0.4, -0.13, 0.13, 0.4].map((px) => (
        <mesh key={px} position={[px, 0.75, 0.05]} rotation={[0.08, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 1.4, 5]} />
          <Toon color="#C9A26A" />
        </mesh>
      ))}
    </RigidBody>
  );
}

/** The static half: tents, lookouts, fences, racks, crates. */
// ── The camp's ground and its clutter ───────────────────────────────────────────

/** Cheap smooth noise for the ground's colour (a few sines). */
const gnoise = (x: number, z: number) => (Math.sin(x * 0.9 + Math.sin(z * 0.7) * 1.7) + Math.sin(z * 1.1 + Math.sin(x * 0.6) * 2.1) + Math.sin((x - z) * 2.3) * 0.4) / 2.4;
const smoothstep = (a: number, b: number, t: number) => {
  const k = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
function segDist(x: number, z: number, [ax, az]: [number, number], [bx, bz]: [number, number]) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}
const campPathDist = (x: number, z: number) => Math.min(...CAMP_PATHS.flatMap((p) => p.slice(1).map((b, i) => segDist(x, z, p[i], b))));

/**
 * The camp's floor, over the region's ground (which is too coarse, ~1.3 m a vertex, for paths): trampled earth
 * in patches, paths worn paler and smoother, a dark ring of ash round the fire, a ragged edge fading into the
 * grass (vertex alpha). Drawn on its own (dynamic: the static merge keeps only rgb).
 */
function CampGround() {
  const geometry = useMemo(() => {
    const R = ESPINHO_CAMP.r + 1;
    const g = new THREE.PlaneGeometry(R * 2, R * 2, 88, 88);
    g.rotateX(-Math.PI / 2);
    g.translate(ESPINHO_CAMP.x, 0.012, ESPINHO_CAMP.z);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 4);
    // muted, earthy browns (a saturated orange read as painted floor next to the green)
    const earth = new THREE.Color('#8A7458'), darker = new THREE.Color('#6A5844'), worn = new THREE.Color('#B4A284');
    const ash = new THREE.Color('#4A4540'), scorched = new THREE.Color('#5E5044');
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const n = gnoise(x * 0.45, z * 0.45);
      c.copy(earth).lerp(darker, smoothstep(-0.2, 0.7, n) * 0.7);
      // grit: a fine speckle
      c.multiplyScalar(0.94 + 0.1 * (gnoise(x * 4.1 + 3, z * 4.3 - 1) * 0.5 + 0.5));
      c.lerp(worn, (1 - smoothstep(0.3, 0.95, campPathDist(x, z) + gnoise(x * 1.7, z * 1.7) * 0.18)) * 0.85);
      const fd = Math.hypot(x - ESPINHO_FIRE.x, z - ESPINHO_FIRE.z);
      c.lerp(scorched, (1 - smoothstep(1.4, 3.0, fd + gnoise(x * 2.2, z * 2.2) * 0.3)) * 0.7);
      c.lerp(ash, 1 - smoothstep(0.5, 1.4, fd));
      // a ragged edge: the trodden earth gives way to the grass unevenly
      const r = Math.hypot(x - ESPINHO_CAMP.x, z - ESPINHO_CAMP.z);
      const edge = ESPINHO_CAMP.r - 1.6 + gnoise(x * 0.8 + 11, z * 0.8) * 1.2;
      col.set([c.r, c.g, c.b, 1 - smoothstep(edge - 1.8, edge + 0.6, r)], i * 4);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 4));
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} receiveShadow userData={{ dynamic: true }} renderOrder={-1}>
      <meshToonMaterial vertexColors transparent depthWrite={false} polygonOffset polygonOffsetFactor={-2} gradientMap={getGradient()} />
    </mesh>
  );
}

/** A tripod of sticks over the fire with a black pot hanging from it. */
function CookingPot({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      {[0, 2.09, 4.19].map((a) => (
        <mesh key={a} position={[Math.cos(a) * 0.38, 0.56, Math.sin(a) * 0.38]} rotation={[Math.sin(a) * 0.36, 0, -Math.cos(a) * 0.36]}>
          <cylinderGeometry args={[0.025, 0.03, 1.2, 5]} />
          <Toon color={WOOD_DARK} />
        </mesh>
      ))}
      <mesh position={[0, 0.88, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.28, 4]} />
        <Toon color="#3A3A40" />
      </mesh>
      <mesh position={[0, 0.62, 0]} scale={[1, 0.8, 1]} castShadow>
        <sphereGeometry args={[0.2, 12, 8, 0, Math.PI * 2, 0.35, Math.PI - 0.35]} />
        <Toon color="#2E2E34" side={THREE.DoubleSide} />
        <Ink thickness={0.01} />
      </mesh>
      <mesh position={[0, 0.74, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.18, 12]} />
        <Toon color="#B8783A" />
      </mesh>
    </group>
  );
}

/** Split logs stacked crosswise. */
function Firewood({ x, z, rot = 0 }: { x: number; z: number; rot?: number }) {
  const logs: [number, number][] = [[-0.26, 0.08], [0, 0.08], [0.26, 0.08], [-0.13, 0.23], [0.13, 0.23], [0, 0.38]];
  return (
    <RigidBody type="fixed" colliders={false} position={[x, 0, z]} rotation={[0, rot, 0]}>
      <CuboidCollider args={[0.4, 0.22, 0.45]} position={[0, 0.22, 0]} />
      {logs.map(([lx, ly], i) => (
        <mesh key={i} position={[lx, ly, 0]} rotation={[Math.PI / 2, 0, (i % 2) * 0.08]} castShadow>
          <cylinderGeometry args={[0.08, 0.085, 0.8, 7]} />
          <Toon color={i % 2 ? '#8A6446' : '#7A5A44'} tex="bark" />
        </mesh>
      ))}
    </RigidBody>
  );
}

/** A tied sack of stolen grain. */
function Sack({ x, z, rot = 0, s = 1 }: { x: number; z: number; rot?: number; s?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]} scale={s}>
      <mesh position={[0, 0.26, 0]} scale={[1, 1.2, 0.9]} castShadow>
        <sphereGeometry args={[0.24, 10, 8]} />
        <Toon color="#C8AE7E" />
        <Ink thickness={0.01} />
      </mesh>
      <mesh position={[0, 0.56, 0]}>
        <cylinderGeometry args={[0.05, 0.09, 0.1, 8]} />
        <Toon color="#A88E5E" />
      </mesh>
      <mesh position={[0, 0.52, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.07, 0.015, 5, 10]} />
        <Toon color="#7A2E2A" />
      </mesh>
    </group>
  );
}

/** The archer's ammunition: a heap of pinecones. */
function PineconePile({ x, z }: { x: number; z: number }) {
  const cones = useMemo(() => {
    const out: [number, number, number, number][] = [];
    for (let i = 0; i < 11; i++) {
      const a = i * 2.4, r = i < 7 ? 0.22 : 0.09;
      out.push([Math.cos(a) * r, i < 7 ? 0.08 : 0.2, Math.sin(a) * r, a]);
    }
    return out;
  }, []);
  return (
    <group position={[x, 0, z]}>
      {cones.map(([cx, cy, cz, a], i) => (
        <mesh key={i} position={[cx, cy, cz]} rotation={[1.3, a, 0.4]}>
          <coneGeometry args={[0.07, 0.18, 7]} />
          <Toon color={i % 3 ? '#7A5236' : '#8C6440'} />
        </mesh>
      ))}
    </group>
  );
}

/** Two posts and a bar with fish and herbs drying in the sun. */
function DryingRack({ x, z, rot = 0 }: { x: number; z: number; rot?: number }) {
  return (
    <RigidBody type="fixed" colliders={false} position={[x, 0, z]} rotation={[0, rot, 0]}>
      {[-0.7, 0.7].map((px) => (
        <group key={px}>
          <CylinderCollider args={[0.7, 0.06]} position={[px, 0.7, 0]} />
          <mesh position={[px, 0.72, 0]}>
            <cylinderGeometry args={[0.045, 0.055, 1.44, 6]} />
            <Toon color={WOOD} tex="bark" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.38, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, 1.6, 6]} />
        <Toon color={WOOD_DARK} />
      </mesh>
      {[-0.45, -0.15, 0.15, 0.45].map((px, i) => (
        <group key={px} position={[px, 1.2, 0]}>
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.004, 0.004, 0.16, 3]} />
            <Toon color="#D8C8A0" />
          </mesh>
          {i % 2 === 0 ? (
            <mesh rotation={[0, 0, Math.PI / 2]} scale={[1, 0.38, 0.22]}>
              <sphereGeometry args={[0.16, 8, 6]} />
              <Toon color="#9FB0B8" />
            </mesh>
          ) : (
            <mesh position={[0, -0.04, 0]}>
              <coneGeometry args={[0.07, 0.22, 6]} />
              <Toon color="#6E8E4A" />
            </mesh>
          )}
        </group>
      ))}
    </RigidBody>
  );
}

/** A low table with the band's map of the region, and two stumps to sit on. */
function MapTable({ x, z, rot = 0 }: { x: number; z: number; rot?: number }) {
  return (
    <RigidBody type="fixed" colliders={false} position={[x, 0, z]} rotation={[0, rot, 0]}>
      <CuboidCollider args={[0.5, 0.25, 0.35]} position={[0, 0.25, 0]} />
      <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 0.07, 0.7]} />
        <Toon color="#8C6440" tex="planks" />
        <Ink thickness={0.01} />
      </mesh>
      {[[-0.42, -0.28], [0.42, -0.28], [-0.42, 0.28], [0.42, 0.28]].map(([lx, lz]) => (
        <mesh key={`${lx}${lz}`} position={[lx, 0.2, lz]}>
          <boxGeometry args={[0.07, 0.4, 0.07]} />
          <Toon color={WOOD_DARK} />
        </mesh>
      ))}
      <mesh position={[0, 0.482, 0]} rotation={[-Math.PI / 2, 0, 0.12]}>
        <planeGeometry args={[0.7, 0.48]} />
        <Toon color="#E8D8B0" />
      </mesh>
      {/* the map's marks: the river, and a red cross on the camp */}
      <mesh position={[0.1, 0.486, 0.02]} rotation={[-Math.PI / 2, 0, 0.6]}>
        <planeGeometry args={[0.04, 0.42]} />
        <Toon color="#5E8EC0" />
      </mesh>
      {[0.78, -0.78].map((a) => (
        <mesh key={a} position={[-0.18, 0.488, -0.08]} rotation={[-Math.PI / 2, 0, a]}>
          <planeGeometry args={[0.1, 0.025]} />
          <Toon color="#C0392B" />
        </mesh>
      ))}
      {[-0.85, 0.85].map((sx) => (
        <mesh key={sx} position={[sx, 0.17, 0.05]} castShadow>
          <cylinderGeometry args={[0.18, 0.2, 0.34, 9]} />
          <Toon color="#7A5A44" tex="bark" />
        </mesh>
      ))}
    </RigidBody>
  );
}

export function WildCamps() {
  const { x: fx, z: fz } = ESPINHO_FIRE;
  return (
    <group>
      {/* O Acampamento dos Espinhos */}
      {ESPINHO_TENTS.map((t, i) => <Tent key={i} x={t.x} z={t.z} rot={t.rot} color={['#7A5A4A', '#6E5A44', '#8C6A50'][i]} />)}
      <Lookout x={ESPINHO_LOOKOUT.x} z={ESPINHO_LOOKOUT.z} h={ESPINHO_LOOKOUT.h} />
      <FirePlace x={fx} z={fz} />
      <CampGround />
      <CookingPot x={fx} z={fz} />
      <Firewood {...CAMP_PROPS.firewood} />
      {CAMP_PROPS.sacks.map((p, i) => <Sack key={i} {...p} />)}
      <PineconePile {...CAMP_PROPS.pinecones} />
      <DryingRack {...CAMP_PROPS.rack} />
      <MapTable {...CAMP_PROPS.table} />
      <Stakes a={[-26.4, -8.4]} b={[-26.4, -22.6]} />
      <Stakes a={[-24.4, -23.8]} b={[-12.6, -24.0]} />
      <Stakes a={[-7.2, -14.6]} b={[-7.6, -21.8]} />
      <Flag x={-6.4} z={-8.6} icon="🦔" cloth="#5A3A2E" rot={Math.PI / 2} />
      <Flag x={-6.6} z={-14.0} icon="🦔" cloth="#5A3A2E" rot={Math.PI / 2} />
      {/* the stolen goods: a cart, crates, baskets, a pot */}
      <group>
        <Crate x={ESPINHO_LOOT.x} z={ESPINHO_LOOT.z} s={0.7} />
        <Crate x={ESPINHO_LOOT.x + 0.8} z={ESPINHO_LOOT.z + 0.2} s={0.6} rot={0.4} />
        <Crate x={ESPINHO_LOOT.x + 0.35} z={ESPINHO_LOOT.z - 0.1} s={0.5} rot={0.8} y={0.7} />
        <Barrel x={ESPINHO_LOOT.x - 1.0} z={ESPINHO_LOOT.z + 0.4} />
        <RigidBody type="fixed" colliders={false} position={[ESPINHO_LOOT.x + 2.4, 0, ESPINHO_LOOT.z + 1.0]} rotation={[0, 0.5, 0]}>
          <CuboidCollider args={[0.75, 0.4, 0.5]} position={[0, 0.5, 0]} />
          <mesh position={[0, 0.55, 0]} castShadow>
            <boxGeometry args={[1.5, 0.35, 1.0]} />
            <Toon color="#8C6440" tex="planks" />
            <Ink thickness={0.012} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0, 0.32, s * 0.55]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.32, 0.32, 0.08, 12]} />
              <Toon color={WOOD_DARK} />
            </mesh>
          ))}
          <mesh position={[1.1, 0.5, 0]} rotation={[0, 0, -0.3]}>
            <boxGeometry args={[0.9, 0.06, 0.06]} />
            <Toon color={WOOD_DARK} />
          </mesh>
        </RigidBody>
      </group>
      {/* O Fortim do Hissui */}
      {FORT_TOWERS.map((t, i) => <Lookout key={i} x={t.x} z={t.z} h={t.h} roof="#7A3E3E" />)}
      <Tent x={-46.0} z={-36.4} rot={-0.2} color="#7A3E3E" size={1.0} />
      <WeaponRack x={-33.6} z={-30.4} rot={0.3} />
      <Dummy x={-35.2} z={-28.6} />
      <Dummy x={-32.8} z={-27.4} />
      <Barrel x={-28.6} z={-33.4} />
      <Crate x={-28.6} z={-34.4} s={0.6} />
    </group>
  );
}

// ── What changes ───────────────────────────────────────────────────────────────

/** A wooden cage with an animal inside; open, the door hangs aside and the animal is gone. */
function Cage({ id, x, z, animal }: { id: string; x: number; z: number; animal: 'coelho' | 'cervo' | 'passaro' }) {
  const open = useGameStore((s) => !!s.progress.flags[id]);
  const active = useGameStore((s) => s.progress.missions.animais_sumidos?.status === 'active');
  const [wx, , wz] = w(x, z);
  const bob = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (bob.current) bob.current.position.y = Math.abs(Math.sin(clock.elapsedTime * 2.2 + x)) * 0.05;
  });
  useSpot(id, [wx, 0, wz], CAGE_REACH, () => {
    if (useZone.getState().zone !== 'selvagem' || open) return null;
    return active && useGameStore.getState().progress.missions.animais_sumidos?.steps.includes('rastros') ? 'Abrir a jaula' : 'Olhar a jaula';
  }, () => {
    const st = useGameStore.getState();
    const m = st.progress.missions.animais_sumidos;
    if (!m || m.status !== 'active' || !m.steps.includes('rastros')) {
      toast('🐇', 'Um bichinho assustado olha para você pela grade. Alguém precisa saber disso: a Doutora Momo, no acampamento, cuida dos bichos.');
      return;
    }
    const chased = combatWorld.enemies.some((e) => isHostile(e) && Math.hypot(e.x - wx, e.z - wz) < CAGE_SAFE);
    if (chased) {
      emit({ type: 'sfx', name: 'denied' });
      toast('👀', 'Agora não: tem bandido de olho! Despiste-os primeiro (agachado, ou uma shuriken jogada longe faz eles irem olhar).');
      return;
    }
    st.runActions(`FLAG:${id};${WILD2_CODE_ACTIONS.jaula}`);
    toast(animal === 'passaro' ? '🐦' : animal === 'cervo' ? '🦌' : '🐇', animal === 'passaro'
      ? 'O passarinho azul sai voando direto para o acampamento da expedição!'
      : animal === 'cervo' ? 'O filhote de cervo pula para fora e some correndo na direção da campina!' : 'O coelhinho sai saltitando, livre, rumo ao acampamento!');
  }, 1.2);
  return (
    <group position={[x, 0, z]} userData={{ dynamic: true }}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.5, 0.5, 0.5]} position={[0, 0.5, 0]} />
      </RigidBody>
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[1.0, 0.08, 1.0]} />
        <Toon color={WOOD} tex="planks" />
      </mesh>
      <mesh position={[0, 1.0, 0]}>
        <boxGeometry args={[1.04, 0.08, 1.04]} />
        <Toon color={WOOD} tex="planks" />
      </mesh>
      {[-0.48, -0.24, 0, 0.24, 0.48].flatMap((u) => [
        <mesh key={`a${u}`} position={[u, 0.52, -0.48]}><boxGeometry args={[0.05, 0.92, 0.05]} /><Toon color={WOOD_DARK} /></mesh>,
        <mesh key={`b${u}`} position={[-0.48, 0.52, u]}><boxGeometry args={[0.05, 0.92, 0.05]} /><Toon color={WOOD_DARK} /></mesh>,
        <mesh key={`c${u}`} position={[0.48, 0.52, u]}><boxGeometry args={[0.05, 0.92, 0.05]} /><Toon color={WOOD_DARK} /></mesh>,
      ])}
      {/* the door (front): shut, or swung open */}
      <group position={[-0.5, 0, 0.48]} rotation={[0, open ? -1.9 : 0, 0]}>
        {[0.02, 0.26, 0.5, 0.74, 0.98].map((u) => (
          <mesh key={u} position={[u, 0.52, 0]}><boxGeometry args={[0.05, 0.92, 0.05]} /><Toon color={WOOD_DARK} /></mesh>
        ))}
      </group>
      {!open && (
        <group ref={bob}>
          {animal === 'coelho' && (
            <group>
              <mesh position={[0, 0.25, 0]} scale={[1, 0.85, 1.2]}><sphereGeometry args={[0.18, 10, 8]} /><Toon color="#E9E3DA" /></mesh>
              <mesh position={[0, 0.4, 0.15]}><sphereGeometry args={[0.12, 10, 8]} /><Toon color="#E9E3DA" /></mesh>
              {[-0.05, 0.05].map((u) => <mesh key={u} position={[u, 0.58, 0.12]} scale={[0.4, 1, 0.4]}><sphereGeometry args={[0.1, 6, 5]} /><Toon color="#E9E3DA" /></mesh>)}
            </group>
          )}
          {animal === 'cervo' && (
            <group scale={0.55}>
              <mesh position={[0, 0.62, 0]} scale={[1.5, 0.82, 0.8]}><sphereGeometry args={[0.3, 10, 8]} /><Toon color="#B07A4A" /></mesh>
              <mesh position={[0, 0.98, 0.42]}><sphereGeometry args={[0.17, 10, 8]} /><Toon color="#B07A4A" /></mesh>
              {[[-0.26, -0.11], [-0.26, 0.11], [0.28, -0.11], [0.28, 0.11]].map(([lx, lz], k) => (
                <mesh key={k} position={[lz, 0.22, lx]}><cylinderGeometry args={[0.05, 0.035, 0.46, 6]} /><Toon color="#8C5E3A" /></mesh>
              ))}
            </group>
          )}
          {animal === 'passaro' && (
            <group position={[0, 0.3, 0]}>
              <mesh scale={[1, 0.9, 1.3]}><sphereGeometry args={[0.12, 10, 8]} /><Toon color="#6FA3E0" /></mesh>
              <mesh position={[0, 0.06, 0.15]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.025, 0.07, 5]} /><Toon color="#F2B238" /></mesh>
            </group>
          )}
        </group>
      )}
    </group>
  );
}

/** The fire: lit and smoking while the band is there, cold ash after. Its stones are the fire place's. */
function CampFire({ x, z }: { x: number; z: number }) {
  const gone = useGameStore((s) => !!s.progress.flags.espinho_vencido);
  return (
    <group position={[x, 0, z]} userData={{ dynamic: true }}>
      <Campfire lit={!gone} stones={false} />
    </group>
  );
}

/** The animals the cat set free, safe at the expedition camp (by the Doutora Momo), once the mission is done. */
function Rescued() {
  const saved = useGameStore((s) => !!s.progress.flags.animais_salvos);
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    group.current?.children.forEach((g, i) => {
      g.position.y = Math.max(0, Math.sin(clock.elapsedTime * 3 + i * 2)) * 0.12;
    });
  });
  if (!saved) return null;
  return (
    <group ref={group} userData={{ dynamic: true }}>
      {[[38.8, 16.4], [36.4, 16.6], [39.6, 14.2]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, i * 2, 0]}>
          <mesh position={[0, 0.2, 0]} scale={[1, 0.85, 1.2]}><sphereGeometry args={[0.16, 10, 8]} /><Toon color={i === 2 ? '#C9B091' : '#E9E3DA'} /></mesh>
          <mesh position={[0, 0.34, 0.14]}><sphereGeometry args={[0.11, 10, 8]} /><Toon color={i === 2 ? '#C9B091' : '#E9E3DA'} /></mesh>
          {[-0.05, 0.05].map((u) => <mesh key={u} position={[u, 0.5, 0.11]} scale={[0.4, 1, 0.4]}><sphereGeometry args={[0.09, 6, 5]} /><Toon color="#E9E3DA" /></mesh>)}
        </group>
      ))}
      {/* the fawn, grazing, and the blue bird on the tent's ridge */}
      <group position={[35.4, 0, 14.0]} rotation={[0, 0.8, 0]} scale={0.6}>
        <mesh position={[0, 0.62, 0]} scale={[1.5, 0.82, 0.8]}><sphereGeometry args={[0.3, 10, 8]} /><Toon color="#B07A4A" /></mesh>
        <mesh position={[0.4, 0.5, 0]}><sphereGeometry args={[0.17, 10, 8]} /><Toon color="#B07A4A" /></mesh>
      </group>
      <mesh position={[37.0, 1.35, 13.4]} scale={[1, 0.9, 1.3]}><sphereGeometry args={[0.1, 8, 6]} /><Toon color="#6FA3E0" /></mesh>
    </group>
  );
}

/** Smoke over the band's fire, and its banners: down once the chief is beaten. */
export function WildCampsLife() {
  const gone = useGameStore((s) => !!s.progress.flags.espinho_vencido);
  const smoke = useRef<THREE.Group>(null);
  const puffs = useMemo(() => [0, 1, 2, 3], []);
  useFrame(({ clock }) => {
    smoke.current?.children.forEach((m, i) => {
      const t = (clock.elapsedTime * 0.35 + i / puffs.length) % 1;
      m.position.set(Math.sin(t * 6 + i) * 0.2, 0.8 + t * 3.2, 0);
      m.scale.setScalar(0.3 + t * 0.9);
      ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - t);
    });
  });
  return (
    <group>
      {CAGES.map((c) => <Cage key={c.id} {...c} />)}
      <CampFire x={ESPINHO_FIRE.x} z={ESPINHO_FIRE.z} />
      {!gone && (
        <group ref={smoke} position={[ESPINHO_FIRE.x, 0, ESPINHO_FIRE.z]} userData={{ dynamic: true }}>
          {puffs.map((i) => (
            <mesh key={i}>
              <sphereGeometry args={[0.5, 8, 6]} />
              <meshBasicMaterial color="#D8D4CC" transparent opacity={0.4} depthWrite={false} />
            </mesh>
          ))}
        </group>
      )}
      <Rescued />
      {/* the camp, once empty: a dropped crown by the fire */}
      {gone && (
        <group position={[ESPINHO_CAMP.x + 0.6, 0.05, ESPINHO_CAMP.z - 1.8]} userData={{ dynamic: true }}>
          {Array.from({ length: 5 }, (_, i) => (
            <mesh key={i} position={[(i - 2) * 0.1, 0.08, 0]} rotation={[0, 0, Math.PI / 2 - 0.2]}>
              <coneGeometry args={[0.04, 0.2, 5]} />
              <Toon color="#D9A520" />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}
