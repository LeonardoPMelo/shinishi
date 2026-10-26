import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import { Toon, Ink } from '../materials';
import { getPuffGeometry } from '../foliageGeometry';
import { MIRANTE, MIRANTE_STAIRS, TELESCOPE, MUSHROOMS, TREEHOUSE } from '../../data/world2';
import { useGameStore } from '../../store/gameStore';
import { SakuraTree, StoneLantern } from './Props';
import { PaperLantern } from './Buildings';

const STONE = '#A79E90';
const STONE_DARK = '#8C8477';

/** Raised viewpoint terrace in the north-east corner (static part). */
export function MiranteTerrace() {
  const { x0, x1, z0, z1, h } = MIRANTE;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const w = x1 - x0;
  const d = z1 - z0;
  return (
    <group>
      <RigidBody type="fixed" colliders={false} userData={{ surface: 'stone' }}>
        <CuboidCollider args={[w / 2, h / 2, d / 2]} position={[cx, h / 2, cz]} />
      </RigidBody>
      <mesh position={[cx, h / 2, cz]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <Toon color={STONE} />
        <Ink thickness={0.04} />
      </mesh>
      {/* Rounded stones pattern on the visible wall faces */}
      {Array.from({ length: 7 }).map((_, i) =>
        [0.5, 1.3, 2.0].map((y, j) => (
          <mesh key={`${i}-${j}`} position={[x0 + 0.45 + i * 0.9 + (j % 2) * 0.35, y, z1 + 0.02]} scale={[1, 0.7, 0.25]}>
            <sphereGeometry args={[0.36, 8, 6]} />
            <Toon color={(i + j) % 2 ? STONE_DARK : '#B5AC9D'} />
          </mesh>
        ))
      )}
      <mesh position={[cx, h + 0.04, cz]} receiveShadow>
        <boxGeometry args={[w - 0.1, 0.08, d - 0.1]} />
        <Toon color="#8CCB5E" />
      </mesh>
      {/* Wooden railing */}
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={i} position={[x0 + 0.3 + i * ((w - 0.6) / 7), h + 0.45, z1 - 0.15]} castShadow>
          <boxGeometry args={[0.1, 0.9, 0.1]} />
          <Toon color="#7A5536" />
        </mesh>
      ))}
      <mesh position={[cx, h + 0.82, z1 - 0.15]}>
        <boxGeometry args={[w - 0.5, 0.08, 0.08]} />
        <Toon color="#94693F" />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[(w - 0.5) / 2, 0.5, 0.06]} position={[cx + 0.6, h + 0.5, z1 - 0.15]} />
      </RigidBody>
      <SakuraTree position={[15.6, h, -17.4]} seed={21} scale={1.15} />
      <StoneLantern position={[x0 + 0.5, h, -18.2]} />
      <PaperLantern position={[x0 + 0.4, h + 1.4, z1 - 0.15]} />
      {/* Telescope */}
      <group position={TELESCOPE}>
        {[0, 2.1, 4.2].map((a) => (
          <mesh key={a} position={[Math.cos(a) * 0.18, 0.45, Math.sin(a) * 0.18]} rotation={[Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35]}>
            <cylinderGeometry args={[0.025, 0.025, 0.95, 5]} />
            <Toon color="#6B4A30" />
          </mesh>
        ))}
        <mesh position={[0, 1.0, 0]} rotation={[0.35, -0.6, Math.PI / 2 - 0.25]}>
          <cylinderGeometry args={[0.07, 0.11, 0.8, 12]} />
          <meshStandardMaterial color="#C9A24A" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

const STEPS = 9;

/** Stairs up to the terrace; the lower steps are broken until the "Escada do Mirante" mission. */
export function MiranteStairs() {
  const fixed = useGameStore((s) => !!s.progress.flags.escada_consertada);
  const { xBottom, xTop, z0, z1, brokenUntil } = MIRANTE_STAIRS;
  const h = MIRANTE.h;
  const run = xTop - xBottom;
  const startX = fixed ? xBottom : brokenUntil;
  const startY = ((startX - xBottom) / run) * h;
  const len = Math.hypot(xTop - startX, h - startY);
  const angle = Math.atan2(h - startY, xTop - startX);
  const zc = (z0 + z1) / 2;
  const width = z1 - z0;
  const t = 0.12;

  return (
    <group userData={{ dynamic: true }}>
      <RigidBody type="fixed" colliders={false} key={fixed ? 'fixed' : 'broken'} userData={{ surface: 'wood' }}>
        <CuboidCollider
          args={[len / 2, t, width / 2]}
          position={[(startX + xTop) / 2 + t * Math.sin(angle), (startY + h) / 2 - t * Math.cos(angle), zc]}
          rotation={[0, 0, angle]}
          friction={0}
        />
      </RigidBody>
      {Array.from({ length: STEPS }).map((_, i) => {
        const x = xBottom + ((i + 0.5) / STEPS) * run;
        if (x < startX - 0.05) return null;
        const y = ((i + 1) / STEPS) * h;
        return (
          <mesh key={i} position={[x, y / 2, zc]} castShadow receiveShadow>
            <boxGeometry args={[run / STEPS + 0.02, y, width]} />
            <Toon color={i % 2 ? '#9B6744' : '#8C5A3A'} />
          </mesh>
        );
      })}
      {!fixed && (
        <>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[xBottom + 0.5 + i * 0.7, 0.08, zc + (i - 1) * 0.4]} rotation={[0, i * 0.7, 0.2]}>
              <boxGeometry args={[0.8, 0.08, 0.22]} />
              <Toon color="#7A5536" />
            </mesh>
          ))}
          <mesh position={[startX - 0.3, startY - 0.15, zc]} rotation={[0, 0, -0.4]}>
            <boxGeometry args={[0.6, 0.06, width * 0.9]} />
            <Toon color="#6B4A30" />
          </mesh>
        </>
      )}
    </group>
  );
}

/** Giant bouncy mushrooms and the tree house they lead to (forest). */
export function MushroomsAndTreehouse() {
  return (
    <group>
      {MUSHROOMS.map((m, i) => (
        <group key={i} position={m.pos}>
          <RigidBody type="fixed" colliders={false} userData={{ bounce: m.bounce }}>
            <CylinderCollider args={[0.25, m.r]} position={[0, 0.75, 0]} />
          </RigidBody>
          <RigidBody type="fixed" colliders={false}>
            <CylinderCollider args={[0.3, 0.22]} position={[0, 0.3, 0]} />
          </RigidBody>
          <mesh position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.2, 0.26, 0.7, 10]} />
            <Toon color="#F4ECDC" />
            <Ink thickness={0.02} />
          </mesh>
          <mesh position={[0, 0.8, 0]} scale={[1, 0.55, 1]} castShadow>
            <sphereGeometry args={[m.r, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <Toon color="#E8553B" />
            <Ink thickness={0.03} />
          </mesh>
          {[0, 1.3, 2.6, 3.9, 5.2].map((a, j) => (
            <mesh key={j} position={[Math.cos(a) * m.r * 0.55, 0.8 + m.r * 0.38, Math.sin(a) * m.r * 0.55]} scale={[1, 0.4, 1]}>
              <sphereGeometry args={[0.1, 8, 6]} />
              <Toon color="#FFF6E4" />
            </mesh>
          ))}
        </group>
      ))}
      <group position={[TREEHOUSE.pos[0], 0, TREEHOUSE.pos[2]]}>
        <RigidBody type="fixed" colliders={false}>
          <CylinderCollider args={[TREEHOUSE.pos[1] / 2, 0.45]} position={[0, TREEHOUSE.pos[1] / 2, 0]} />
          <CylinderCollider args={[0.12, TREEHOUSE.r]} position={[0, TREEHOUSE.pos[1] - 0.12, 0]} />
        </RigidBody>
        <mesh position={[0, TREEHOUSE.pos[1] / 2, 0]} castShadow>
          <cylinderGeometry args={[0.38, 0.5, TREEHOUSE.pos[1], 10]} />
          <Toon color="#6B4A30" />
          <Ink thickness={0.03} />
        </mesh>
        <mesh position={[0, TREEHOUSE.pos[1] - 0.12, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[TREEHOUSE.r, TREEHOUSE.r, 0.24, 16]} />
          <Toon color="#9B6744" />
          <Ink thickness={0.03} />
        </mesh>
        <mesh position={[0, TREEHOUSE.pos[1] + 2.0, 0]} scale={[2.1, 1.7, 2.1]} geometry={getPuffGeometry(2)} dispose={null} castShadow>
          <Toon color="#4E9A5A" wind vertexColors />
        </mesh>
        <mesh position={[0.9, TREEHOUSE.pos[1] + 0.9, 0.5]}>
          <boxGeometry args={[0.9, 0.9, 0.9]} />
          <Toon color="#C9A36B" />
        </mesh>
        <mesh position={[0.9, TREEHOUSE.pos[1] + 1.55, 0.5]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[0.85, 0.5, 4]} />
          <Toon color="#C0573E" />
        </mesh>
      </group>
    </group>
  );
}
