import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { Toon, Ink } from '../materials';
import { PaperLantern } from './Buildings';
import { INTERIORS, insideDoor, outsideDoor, partitionSegments, type InteriorDef, type Prop } from '../../data/interiors';
import { useInteractable, type Interactable } from '../systems/interaction';
import { useZone, enterInterior, exitInterior } from '../systems/zone';
import { useGameStore } from '../../store/gameStore';
import { checkCondition } from '../../systems/progression';
import { emit } from '../../systems/events';
import { Box, Solid, ROOM_BODY, WOOD, DARK, PAPER } from './interiorParts';
import { MorePropView, FloorPatchView } from './interiorProps';
import { AcademyActivities } from './AcademyActivities';
import { wallHides, type WallLine } from './cutaway';
import { playerPosition } from '../systems/playerState';
import { SedeActivities } from './SedeActivities';

/**
 * The rooms of the houses you can walk into (Etapa 4 da expansão), built from data/interiors.ts: floor,
 * walls and furniture with colliders, the way out, and the front door outside that leads in. Rooms are
 * open-topped (the camera looks in from above) and drawn only while the cat is inside; their colliders
 * stay, far east of the map, where nothing else goes.
 */


const CUSHIONS = ['#C0573E', '#3F5277', '#E8A33D', '#4F6B52'];

/** The clock's hands: stopped at 7:40 until the riddle is solved, then at 3:00 with the panel open. */
function ClockFace() {
  const open = useGameStore((s) => !!s.progress.flags.relogio_aberto);
  const hour = open ? 3 : 7 + 40 / 60;
  const minute = open ? 0 : 40;
  const ha = -(hour / 12) * Math.PI * 2;
  const ma = -(minute / 60) * Math.PI * 2;
  return (
    <group position={[0, 1.75, 0.26]}>
      <mesh>
        <circleGeometry args={[0.3, 32]} />
        <Toon color="#F4EAD2" />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.sin(a) * 0.25, Math.cos(a) * 0.25, 0.005]}>
            <circleGeometry args={[i % 3 === 0 ? 0.025 : 0.014, 8]} />
            <Toon color={DARK} />
          </mesh>
        );
      })}
      {/* hands turn about the centre and point out from it, with a short tail */}
      <group rotation={[0, 0, ha]} position={[0, 0, 0.01]}>
        <mesh position={[0, 0.07, 0]}>
          <boxGeometry args={[0.035, 0.18, 0.01]} />
          <Toon color={DARK} />
        </mesh>
      </group>
      <group rotation={[0, 0, ma]} position={[0, 0, 0.015]}>
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[0.022, 0.25, 0.01]} />
          <Toon color={DARK} />
        </mesh>
      </group>
      <mesh position={[0, 0, 0.02]}>
        <circleGeometry args={[0.028, 12]} />
        <Toon color="#C9A227" />
      </mesh>
      {/* the hidden compartment below the face opens when the riddle is solved */}
      <mesh position={[open ? 0.32 : 0, -0.85, -0.02]} rotation={[0, open ? -1.1 : 0, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.03]} />
        <Toon color="#7A5236" tex="wood" />
      </mesh>
    </group>
  );
}

function PropView({ p, def }: { p: Prop; def: InteriorDef }) {
  const { w, d, h } = def.size;
  const rot = p.rot ?? 0;
  const pos: [number, number, number] = [p.at[0], 0, p.at[1]];
  switch (p.kind) {
    case 'balcao':
      return (
        <group position={pos} rotation={[0, rot, 0]}>
          <Solid size={[3.2, 0.95, 0.75]} color={WOOD} tex="planks" />
          <Box size={[3.35, 0.08, 0.85]} at={[0, 0.99, 0]} color="#8A5A36" tex="wood" ink={0.015} />
          <Box size={[0.5, 0.12, 0.35]} at={[1.1, 1.09, 0.05]} color="#E9E2D3" />
        </group>
      );
    case 'fogao':
      return (
        <group position={pos} rotation={[0, rot, 0]}>
          <Solid size={[1.3, 0.85, 0.8]} color="#9C8F82" tex="stone" />
          {[-0.3, 0.3].map((x) => (
            <mesh key={x} position={[x, 1.0, 0]} castShadow>
              <cylinderGeometry args={[0.2, 0.17, 0.28, 14]} />
              <Toon color="#3F4650" />
              <Ink thickness={0.012} />
            </mesh>
          ))}
          <mesh position={[0, 0.35, 0.41]}>
            <boxGeometry args={[0.6, 0.3, 0.02]} />
            <Toon color="#FF8A3D" emissive="#FF6A1A" emissiveIntensity={1.4} />
          </mesh>
        </group>
      );
    case 'prateleira': {
      const z = -d / 2 + 0.22;
      return (
        <group position={[p.at[0], 0, z]}>
          {[1.35, 1.85].map((y) => (
            <group key={y}>
              <Box size={[1.8, 0.06, 0.32]} at={[0, y, 0]} color={WOOD} tex="wood" />
              {[-0.6, -0.2, 0.2, 0.6].map((x, i) => (
                <mesh key={x} position={[x, y + 0.14, 0]} castShadow>
                  <cylinderGeometry args={[0.09, 0.1, 0.22, 10]} />
                  <Toon color={['#C9D9E8', '#E8C07A', '#D98A7A', '#B5D3A7'][(i + (y > 1.5 ? 1 : 0)) % 4]} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      );
    }
    case 'quadro_receitas':
      return (
        <group position={[-w / 2 + 0.06, 1.55, p.at[1]]} rotation={[0, Math.PI / 2, 0]}>
          <Box size={[1.3, 0.9, 0.05]} at={[0, 0, 0]} color={WOOD} tex="wood" />
          {[[-0.32, 0.18], [0.28, 0.2], [-0.25, -0.2], [0.3, -0.18]].map(([x, y], i) => (
            <mesh key={i} position={[x, y, 0.035]} rotation={[0, 0, (i - 1.5) * 0.08]}>
              <planeGeometry args={[0.46, 0.32]} />
              <Toon color={PAPER} />
            </mesh>
          ))}
        </group>
      );
    case 'aquario':
      return (
        <group position={pos} rotation={[0, rot, 0]}>
          <Solid size={[1.1, 0.7, 0.5]} color={WOOD} tex="wood" />
          <mesh position={[0, 1.0, 0]}>
            <boxGeometry args={[1.0, 0.6, 0.42]} />
            <Toon color="#8FD3E8" emissive="#4AA8C8" emissiveIntensity={0.35} />
            <Ink thickness={0.012} />
          </mesh>
          <mesh position={[0.15, 1.02, 0.22]} rotation={[0, 0, 0.2]}>
            <sphereGeometry args={[0.07, 10, 8]} />
            <Toon color="#FF9A2E" emissive="#FF7A00" emissiveIntensity={0.3} />
          </mesh>
        </group>
      );
    case 'mesa_baixa':
      return (
        <group position={pos} rotation={[0, rot, 0]}>
          <RigidBody type="fixed" colliders={false} userData={ROOM_BODY}>
            <CuboidCollider args={[0.6, 0.2, 0.42]} position={[0, 0.2, 0]} />
          </RigidBody>
          <Box size={[1.2, 0.07, 0.84]} at={[0, 0.36, 0]} color="#8A5A36" tex="wood" ink={0.015} />
          {[[-0.5, -0.34], [0.5, -0.34], [-0.5, 0.34], [0.5, 0.34]].map(([x, z]) => (
            <Box key={`${x}${z}`} size={[0.08, 0.33, 0.08]} at={[x, 0.16, z]} color={DARK} />
          ))}
        </group>
      );
    case 'almofada': {
      const color = CUSHIONS[Math.abs(Math.round(p.at[0] * 3 + p.at[1] * 5)) % CUSHIONS.length];
      return (
        <mesh position={[p.at[0], 0.06, p.at[1]]} castShadow receiveShadow>
          <cylinderGeometry args={[0.27, 0.29, 0.11, 14]} />
          <Toon color={color} />
        </mesh>
      );
    }
    case 'barril':
      return (
        <group position={pos}>
          <RigidBody type="fixed" colliders={false} userData={ROOM_BODY}>
            <CuboidCollider args={[0.34, 0.42, 0.34]} position={[0, 0.42, 0]} />
          </RigidBody>
          <mesh position={[0, 0.42, 0]} castShadow>
            <cylinderGeometry args={[0.34, 0.36, 0.84, 14]} />
            <Toon color="#9B6B43" tex="planks" />
            <Ink thickness={0.015} />
          </mesh>
          {[0.15, 0.7].map((y) => (
            <mesh key={y} position={[0, y, 0]}>
              <cylinderGeometry args={[0.365, 0.365, 0.05, 14]} />
              <Toon color="#4A4A52" />
            </mesh>
          ))}
        </group>
      );
    case 'lanterna':
      return <PaperLantern position={[p.at[0], h - 0.45, p.at[1]]} color={def.id === 'relojoeiro' ? '#E8C27A' : '#E0483A'} />;
    case 'relogio':
      return (
        <group position={[p.at[0], 0, -d / 2 + 0.32]}>
          <Solid size={[0.8, 2.2, 0.5]} color="#5A3B28" tex="wood" />
          <Box size={[0.9, 0.12, 0.56]} at={[0, 2.26, 0]} color={DARK} tex="wood" ink={0.015} />
          <ClockFace />
        </group>
      );
    case 'bancada':
      return (
        <group position={pos} rotation={[0, rot, 0]}>
          <Solid size={[1.7, 0.85, 0.75]} color="#7A5236" tex="planks" />
          {[[-0.5, 0.05], [0.1, -0.1], [0.55, 0.12]].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.9, z]} rotation={[Math.PI / 2, 0, i]} castShadow>
              <torusGeometry args={[0.1 + i * 0.03, 0.03, 6, 12]} />
              <Toon color={i === 1 ? '#C9A04A' : '#8D939C'} />
            </mesh>
          ))}
        </group>
      );
    case 'estante': {
      const eh = p.h ?? 2.0;
      return (
        <group position={pos} rotation={[0, rot, 0]}>
          <Solid size={[1.6, eh, 0.42]} color={WOOD} tex="wood" />
          {[0.45, 1.0, 1.55].filter((y) => y + 0.4 < eh).map((y, row) =>
            [-0.55, -0.35, -0.15, 0.05, 0.25, 0.45].map((x, i) => (
              <mesh key={`${y}${x}`} position={[x, y + 0.15, 0.22]} castShadow>
                <boxGeometry args={[0.15, 0.32 - ((i + row) % 3) * 0.04, 0.05]} />
                <Toon color={['#7E3B32', '#3F5277', '#4F6B52', '#C9A04A', '#6A4C7A'][(i + row * 2) % 5]} />
              </mesh>
            )),
          )}
        </group>
      );
    }
    case 'movel_coberto':
      return (
        <group position={pos} rotation={[0, rot, 0]}>
          <Solid size={[1.3, 0.95, 0.85]} color={p.color ?? '#E6E1D6'} ink={0.015} />
          <mesh position={[0, 0.98, 0]} scale={[1, 0.25, 1]} castShadow>
            <sphereGeometry args={[0.62, 14, 8]} />
            <Toon color={p.color ?? '#E6E1D6'} />
          </mesh>
        </group>
      );
    case 'tapete':
      return (
        <mesh position={[p.at[0], 0.014, p.at[1]]} receiveShadow>
          <boxGeometry args={[p.size?.[0] ?? 2.6, 0.02, p.size?.[1] ?? 1.8]} />
          <Toon color={p.color ?? '#7E3B32'} />
        </mesh>
      );
    case 'teia': {
      // a cobweb in a top corner: a few threads fanning out from it
      const cx = Math.sign(p.at[0]) * (w / 2 - 0.05);
      const cz = Math.sign(p.at[1]) * (d / 2 - 0.05);
      return (
        <group position={[cx, h - 0.05, cz]}>
          {[0, 0.4, 0.8, 1.2].map((a) => {
            const dir = new THREE.Vector3(-Math.sign(p.at[0]) * Math.cos(a), -0.6, -Math.sign(p.at[1]) * Math.sin(a)).normalize();
            const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
            return (
              <mesh key={a} position={dir.clone().multiplyScalar(0.3)} quaternion={q}>
                <cylinderGeometry args={[0.006, 0.006, 0.6, 4]} />
                <Toon color="#F4F1EA" />
              </mesh>
            );
          })}
        </group>
      );
    }
    case 'janela': {
      // a shoji window glowing with the daylight outside, on the wall it hangs on (the glow faces the room)
      const wall = p.wall ?? 'w';
      const at: [number, number, number] =
        wall === 'w' ? [-w / 2 + 0.13, 1.45, p.at[1]]
          : wall === 'e' ? [w / 2 - 0.13, 1.45, p.at[1]]
            : wall === 'n' ? [p.at[0], 1.45, -d / 2 + 0.13]
              : [p.at[0], 1.45, d / 2 - 0.13];
      const turn = wall === 'w' ? -Math.PI / 2 : wall === 'e' ? Math.PI / 2 : wall === 'n' ? Math.PI : 0;
      return (
        <group position={at} rotation={[0, turn, 0]}>
          <Box size={[1.2, 0.9, 0.06]} at={[0, 0, 0]} color={WOOD} tex="wood" />
          <mesh position={[0, 0, -0.035]}>
            <planeGeometry args={[1.05, 0.75]} />
            <Toon color="#FFF6E2" emissive="#FFE7B0" emissiveIntensity={0.55} side={THREE.DoubleSide} />
          </mesh>
        </group>
      );
    }
  }
  return <MorePropView p={p} def={def} />;
}

/** Height of the south wall as drawn (its collider is full height). */
const CUTAWAY = 0.5;
/** Inner walls are drawn this high (the camera looks over them); their colliders go all the way up. */
const PARTITION_H = 2.1;
const PARTITION_T = 0.2;

/**
 * Walls between the camera and the cat drop low (cutaway.ts); everything else stands at full height. Each
 * wall is a group drawn from the floor up, so squashing it in y keeps it on the floor.
 */
function useCutaway(def: InteriorDef, lines: (WallLine & { low: number })[], active: boolean) {
  const groups = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ camera }, dt) => {
    const k = Math.min(1, dt * 10);
    const c = { x: camera.position.x - def.origin[0], y: camera.position.y, z: camera.position.z - def.origin[1] };
    const cat = { x: playerPosition.x - def.origin[0], y: playerPosition.y + 0.35, z: playerPosition.z - def.origin[1] };
    lines.forEach((line, i) => {
      const g = groups.current[i];
      if (!g) return;
      const want = active && wallHides(c, cat, line) ? line.low : 1;
      g.scale.y += (want - g.scale.y) * k;
    });
  });
  return groups;
}

/** The inner walls of a big building, with their doorways. */
function Partitions({ def, active }: { def: InteriorDef; active: boolean }) {
  const { h } = def.size;
  const wains = 0.9;
  const pieces = useMemo(
    () => (def.partitions ?? []).flatMap(partitionSegments).map(([x0, z0, x1, z1]) => {
      const alongX = z0 === z1;
      const len = alongX ? x1 - x0 : z1 - z0;
      return {
        at: [(x0 + x1) / 2, (z0 + z1) / 2] as [number, number],
        size: (alongX ? [len, PARTITION_T] : [PARTITION_T, len]) as [number, number],
        line: { x0, z0, x1, z1, top: PARTITION_H, low: CUTAWAY / PARTITION_H },
      };
    }),
    [def],
  );
  const lines = useMemo(() => pieces.map((p) => p.line), [pieces]);
  const groups = useCutaway(def, lines, active);
  return (
    <>
      <RigidBody type="fixed" colliders={false} userData={ROOM_BODY}>
        {pieces.map((p, i) => (
          <CuboidCollider key={i} args={[p.size[0] / 2, h / 2, p.size[1] / 2]} position={[p.at[0], h / 2, p.at[1]]} />
        ))}
      </RigidBody>
      {pieces.map((p, i) => (
        <group key={i} ref={(g) => (groups.current[i] = g)} position={[p.at[0], 0, p.at[1]]}>
          <Box size={[p.size[0], wains, p.size[1]]} at={[0, wains / 2, 0]} color={def.wainscot} tex="planks" />
          <Box size={[p.size[0] - 0.01, PARTITION_H - wains, p.size[1] - 0.01]} at={[0, wains + (PARTITION_H - wains) / 2, 0]} color={def.wall} tex="plaster" ink={0.015} />
          <Box size={[p.size[0] + 0.05, 0.08, p.size[1] + 0.05]} at={[0, PARTITION_H + 0.04, 0]} color={DARK} tex="wood" />
        </group>
      ))}
    </>
  );
}

function Room({ def, visible }: { def: InteriorDef; visible: boolean }) {
  const { w, d, h } = def.size;
  const t = 0.25;
  const wains = 0.9;
  // inner faces of the four walls: wainscot below, plaster above
  const walls: { at: [number, number, number]; size: [number, number, number] }[] = [
    { at: [0, h / 2, -d / 2 - t / 2], size: [w + 2 * t, h, t] },
    { at: [0, h / 2, d / 2 + t / 2], size: [w + 2 * t, h, t] },
    { at: [-w / 2 - t / 2, h / 2, 0], size: [t, h, d] },
    { at: [w / 2 + t / 2, h / 2, 0], size: [t, h, d] },
  ];
  const lines = useMemo<(WallLine & { low: number })[]>(() => [
    { x0: -w / 2, z0: -d / 2 - t / 2, x1: w / 2, z1: -d / 2 - t / 2, top: h, low: CUTAWAY / h },
    { x0: 0, z0: 0, x1: 0, z1: 0, top: 0, low: 1 },
    { x0: -w / 2 - t / 2, z0: -d / 2, x1: -w / 2 - t / 2, z1: d / 2, top: h, low: CUTAWAY / h },
    { x0: w / 2 + t / 2, z0: -d / 2, x1: w / 2 + t / 2, z1: d / 2, top: h, low: CUTAWAY / h },
  ], [w, d, h]);
  const groups = useCutaway(def, lines, visible);
  return (
    <group position={[def.origin[0], 0, def.origin[1]]} visible={visible} userData={{ dynamic: true }}>
      <RigidBody type="fixed" colliders={false} userData={ROOM_BODY}>
        <CuboidCollider args={[w / 2 + t, 0.1, d / 2 + t]} position={[0, -0.1, 0]} />
        {walls.map((wl, i) => (
          <CuboidCollider key={i} args={[wl.size[0] / 2, wl.size[1] / 2, wl.size[2] / 2]} position={wl.at} />
        ))}
      </RigidBody>
      <Box size={[w + 2 * t, 0.2, d + 2 * t]} at={[0, -0.1, 0]} color={def.floor} tex="planks" />
      {/* dark ground around the room: the outdoor world is hidden while inside */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.22, 0]}>
        <planeGeometry args={[60, 60]} />
        <meshBasicMaterial color="#1B1622" fog={false} />
      </mesh>
      {walls.map((wl, i) =>
        i === 1 ? (
          // south wall, between the camera and the cat: drawn as a low cutaway so it never hides Shinichi
          <group key={i}>
            <Box size={[wl.size[0], CUTAWAY, wl.size[2]]} at={[wl.at[0], CUTAWAY / 2, wl.at[2]]} color={def.wainscot} tex="planks" />
            <Box size={[wl.size[0] + 0.04, 0.08, wl.size[2] + 0.04]} at={[wl.at[0], CUTAWAY + 0.04, wl.at[2]]} color={DARK} tex="wood" />
          </group>
        ) : (
          <group key={i} ref={(g) => (groups.current[i] = g)}>
            <Box size={[wl.size[0], wains, wl.size[2]]} at={[wl.at[0], wains / 2, wl.at[2]]} color={def.wainscot} tex="planks" />
            <Box size={[wl.size[0] - 0.01, h - wains, wl.size[2] - 0.01]} at={[wl.at[0], wains + (h - wains) / 2, wl.at[2]]} color={def.wall} tex="plaster" ink={0.02} />
            <Box size={[wl.size[0] + 0.04, 0.1, wl.size[2] + 0.04]} at={[wl.at[0], h - 0.05, wl.at[2]]} color={DARK} tex="wood" />
          </group>
        ),
      )}
      {/* the way out: a lit doormat and two low door posts in the south wall */}
      <group position={[0, 0, d / 2]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, -0.45]}>
          <planeGeometry args={[1.3, 0.7]} />
          <Toon color={PAPER} emissive="#FFE7B0" emissiveIntensity={0.55} />
        </mesh>
        <Box size={[0.12, CUTAWAY + 0.3, 0.3]} at={[-0.71, (CUTAWAY + 0.3) / 2, 0.1]} color={DARK} tex="wood" />
        <Box size={[0.12, CUTAWAY + 0.3, 0.3]} at={[0.71, (CUTAWAY + 0.3) / 2, 0.1]} color={DARK} tex="wood" />
      </group>
      {(def.floors ?? []).map((f, i) => <FloorPatchView key={i} rect={f.rect} kind={f.kind} />)}
      <Partitions def={def} active={visible} />
      {def.props.map((p, i) => <PropView key={i} p={p} def={def} />)}
    </group>
  );
}

function Doors({ def }: { def: InteriorDef }) {
  const outside = useMemo<Interactable>(() => {
    const o = outsideDoor(def);
    return {
      id: `porta_${def.id}`,
      position: new THREE.Vector3(o.door[0], 0, o.door[2]),
      radius: 1.9,
      tagHeight: 2.0,
      label: () => {
        if (useZone.getState().fading) return null;
        if (def.lock && !checkCondition(def.lock.unless, useGameStore.getState().progress)) return def.lock.label;
        return `Entrar: ${def.name}`;
      },
      onInteract: () => {
        if (def.lock && !checkCondition(def.lock.unless, useGameStore.getState().progress)) {
          emit({ type: 'sfx', name: 'denied' });
          emit({ type: 'toast', icon: '🔒', text: def.lock.text });
          return;
        }
        enterInterior(def.id);
      },
    };
  }, [def]);
  const inside = useMemo<Interactable>(() => {
    const i = insideDoor(def);
    return {
      id: `saida_${def.id}`,
      position: new THREE.Vector3(i.door[0], 0, i.door[2]),
      radius: 1.6,
      tagHeight: 1.9,
      label: () => (useZone.getState().fading ? null : 'Sair'),
      onInteract: () => exitInterior(def.id),
    };
  }, [def]);
  useInteractable(outside);
  useInteractable(inside);
  return null;
}

export function Interiors() {
  const zone = useZone((s) => s.zone);
  return (
    <>
      {INTERIORS.map((def) => (
        <group key={def.id}>
          <Room def={def} visible={zone === def.id} />
          <Doors def={def} />
        </group>
      ))}
      <AcademyActivities active={zone === 'academia'} />
      <SedeActivities active={zone === 'sede'} />
    </>
  );
}
