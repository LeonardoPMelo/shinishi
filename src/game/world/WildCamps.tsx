import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import { Toon, Ink } from '../materials';
import { useGameStore } from '../../store/gameStore';
import { emit } from '../../systems/events';
import { isHostile } from '../../systems/combat';
import { combatWorld } from '../systems/hearts';
import { useSpot, useIconTexture } from '../systems/training';
import { useZone } from '../systems/zone';
import { w } from '../../data/wild';
import {
  ESPINHO_CAMP, ESPINHO_TENTS, ESPINHO_LOOKOUT, ESPINHO_FIRE, ESPINHO_LOOT, CAGES, CAGE_SAFE, CAGE_REACH, FORT_TOWERS, WILD2_CODE_ACTIONS,
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

/** A tent: two sloped cloth sides on a ridge pole, the front open. */
export function Tent({ x, z, rot = 0, color = CLOTH, size = 1 }: { x: number; z: number; rot?: number; color?: string; size?: number }) {
  const s = size;
  return (
    <RigidBody type="fixed" colliders={false} position={[x, 0, z]} rotation={[0, rot, 0]}>
      <CuboidCollider args={[1.0 * s, 0.7 * s, 1.2 * s]} position={[0, 0.7 * s, 0]} />
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.55 * s, 0.7 * s, 0]} rotation={[0, 0, -side * 0.72]} castShadow receiveShadow>
          <boxGeometry args={[1.6 * s, 0.05, 2.4 * s]} />
          <Toon color={color} />
          <Ink thickness={0.012} />
        </mesh>
      ))}
      <mesh position={[0, 1.27 * s, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 2.6 * s, 6]} />
        <Toon color={WOOD_DARK} />
      </mesh>
      {[-1.25, 1.25].map((zz) => (
        <mesh key={zz} position={[0, 0.64 * s, zz * s]}>
          <cylinderGeometry args={[0.05, 0.05, 1.3 * s, 6]} />
          <Toon color={WOOD_DARK} />
        </mesh>
      ))}
      {/* a bedroll inside */}
      <mesh position={[0, 0.06, -0.2 * s]} scale={[0.7, 0.12, 1.4]}>
        <boxGeometry args={[1 * s, 1, 1 * s]} />
        <Toon color="#7E3B32" />
      </mesh>
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
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[Math.cos((i / 9) * Math.PI * 2) * 0.55, 0.08, Math.sin((i / 9) * Math.PI * 2) * 0.55]}>
          <sphereGeometry args={[0.14, 6, 5]} />
          <Toon color="#8E877C" />
        </mesh>
      ))}
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
export function WildCamps() {
  const { x: fx, z: fz } = ESPINHO_FIRE;
  return (
    <group>
      {/* O Acampamento dos Espinhos */}
      {ESPINHO_TENTS.map((t, i) => <Tent key={i} x={t.x} z={t.z} rot={t.rot} color={['#7A5A4A', '#6E5A44', '#8C6A50'][i]} />)}
      <Lookout x={ESPINHO_LOOKOUT.x} z={ESPINHO_LOOKOUT.z} h={ESPINHO_LOOKOUT.h} />
      <FirePlace x={fx} z={fz} />
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

/** The fire: lit and smoking while the band is there, cold ash after. */
function CampFire({ x, z }: { x: number; z: number }) {
  const gone = useGameStore((s) => !!s.progress.flags.espinho_vencido);
  const flame = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    flame.current?.children.forEach((m, i) => m.scale.setScalar(0.85 + 0.25 * Math.sin(clock.elapsedTime * 9 + i * 2)));
  });
  return (
    <group position={[x, 0, z]} userData={{ dynamic: true }}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.1, 0]} rotation={[0, i * 1.05, Math.PI / 2 - 0.3]}>
          <cylinderGeometry args={[0.06, 0.07, 0.7, 6]} />
          <Toon color={gone ? '#3A3430' : '#5A3E2A'} />
        </mesh>
      ))}
      {!gone && (
        <group ref={flame}>
          <mesh position={[0, 0.32, 0]}><coneGeometry args={[0.22, 0.55, 8]} /><meshBasicMaterial color="#FF8A2A" /></mesh>
          <mesh position={[0, 0.42, 0]}><coneGeometry args={[0.12, 0.42, 8]} /><meshBasicMaterial color="#FFD86A" /></mesh>
        </group>
      )}
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
