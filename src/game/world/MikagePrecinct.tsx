import { useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import { create } from 'zustand';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import { Toon, Ink, windTime } from '../materials';
import { JapaneseRoof, PaperLantern } from './Buildings';
import { SakuraTree, PineTree, MapleTree, Bamboo, StoneLantern } from './Props';
import { Rock } from './Rock';
import { usePondMaterial } from './EastDistrict';
import { PawEmblem } from './interiorProps';
import { useGameStore } from '../../store/gameStore';
import { emit } from '../../systems/events';
import { press, brokenRule } from '../../systems/orderPuzzle';
import { useSpot } from '../systems/training';
import { playerPosition } from '../systems/playerState';
import {
  AXIS_X, PRECINCT_WALL, GREAT_GATE, TERRACE, STAIRS, RESIDENCE, RESIDENCE_FRONT, TEMPLE_POND, PLUNGE, ARCH_BRIDGE,
  SPRING, WATERFALL, NICHE, BELL, ARCHIVE, TOWER, TOWER_STEPS, BAMBOO_GROVE, GUARDIANS, GUARDIAN_LOOK,
  GUARDIAN_LANTERNS, LANTERN_PUZZLE, LANTERNS_LIT, JADE_PAWS, PRECINCT_PATHS,
} from '../../data/precinct';

/**
 * O Templo de Mikage (data/precinct.ts): the walled precinct north of the Bairro das Glicínias. `MikagePrecinct`
 * is the stone, wood and trees (static: merged with the village); `PrecinctLife` is what moves or changes with
 * the story: the water, the koi, the bell and its nest, the four guardian lanterns and their puzzle, the slab
 * behind the waterfall, the kitten's jade paws, petals and fireflies.
 */

const NAVY = '#2E3A5C';
const NAVY_DARK = '#232B45';
const GOLD = '#D9A520';
const RED = '#A8352C';
const WOOD = '#6A4630';
const DARK = '#3B2A20';
const PLASTER = '#F3EADB';
const STONE = '#A8A196';
const STONE_DARK = '#8E877C';
const PAVING = '#C9C0AE';
const STONE_DATA = { surface: 'stone' };
const WOOD_DATA = { surface: 'wood' };
const H = TERRACE.h;

/** Words painted on a board (gate and residence plaques). */
function useBoardTexture(text: string, w: number, h: number, bg = '#1F2238', fg = GOLD) {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d')!;
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = fg;
    g.lineWidth = 6;
    g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = fg;
    g.font = `bold ${Math.round(h * 0.42)}px "Segoe UI", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [text, w, h, bg, fg]);
}

/**
 * A roof that turns see-through while it stands between the camera and the cat. The camera looks down from
 * about 6 m, so walking through the great gate or into a pavilion the roof would hide Shinichi (seen in play;
 * blocking the camera with a collider only swung it to odd angles). Kept out of the static merge, so it can fade.
 * `box`: the roof's volume in world space [minX, minY, minZ, maxX, maxY, maxZ].
 */
function RoofFade({ box, children }: { box: [number, number, number, number, number, number]; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const st = useRef({ k: 1, mats: [] as THREE.Material[] });
  const tools = useMemo(() => ({
    aabb: new THREE.Box3(new THREE.Vector3(box[0], box[1], box[2]), new THREE.Vector3(box[3], box[4], box[5])),
    ray: new THREE.Ray(),
    hit: new THREE.Vector3(),
    cat: new THREE.Vector3(),
  }), [box]);
  useFrame(({ camera }, dt) => {
    const g = group.current;
    if (!g) return;
    const s = st.current;
    if (!s.mats.length) {
      g.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        if (m) for (const mm of Array.isArray(m) ? m : [m]) s.mats.push(mm);
      });
    }
    const { aabb, ray, hit, cat } = tools;
    cat.set(playerPosition.x, playerPosition.y + 0.3, playerPosition.z);
    ray.origin.copy(camera.position);
    ray.direction.copy(cat).sub(camera.position);
    const len = ray.direction.length();
    ray.direction.normalize();
    const p = ray.intersectBox(aabb, hit);
    const want = p && p.distanceTo(camera.position) < len ? 0.2 : 1;
    if (Math.abs(s.k - want) < 0.004) return;
    s.k += (want - s.k) * Math.min(1, dt * 8);
    if (Math.abs(s.k - want) < 0.004) s.k = want;
    for (const m of s.mats) {
      // an opaque material is compiled with its alpha forced to 1 (three's OPAQUE define): switching rebuilds it
      if (m.transparent !== s.k < 1) {
        m.transparent = s.k < 1;
        m.needsUpdate = true;
      }
      m.opacity = s.k;
      m.depthWrite = s.k >= 1;
    }
  });
  return <group ref={group} userData={{ dynamic: true }}>{children}</group>;
}

// ── Walls ─────────────────────────────────────────────────────────────────────

/** A temple wall from a to b (along x or z): stone base, white plaster, dark posts, a navy tiled cap. */
function TempleWall({ a, b, h = 2.4, base = 0 }: { a: [number, number]; b: [number, number]; h?: number; base?: number }) {
  const alongX = a[1] === b[1];
  const len = Math.abs(alongX ? b[0] - a[0] : b[1] - a[1]);
  const cx = (a[0] + b[0]) / 2;
  const cz = (a[1] + b[1]) / 2;
  const sx = alongX ? len : 0.5;
  const sz = alongX ? 0.5 : len;
  const posts = Math.max(1, Math.round(len / 2.4));
  const total = base + h;
  return (
    <group>
      <RigidBody type="fixed" colliders={false} userData={STONE_DATA}>
        {/* the wall, and an invisible top so nobody jumps over it */}
        <CuboidCollider args={[sx / 2, Math.max(total, 4.6) / 2, sz / 2]} position={[cx, Math.max(total, 4.6) / 2, cz]} />
      </RigidBody>
      <mesh position={[cx, (base + 0.6) / 2, cz]} castShadow receiveShadow>
        <boxGeometry args={[sx + 0.08, base + 0.6, sz + 0.08]} />
        <Toon color={STONE} tex="stone" />
        <Ink thickness={0.015} />
      </mesh>
      <mesh position={[cx, base + 0.6 + (h - 0.85) / 2, cz]} castShadow receiveShadow>
        <boxGeometry args={[sx, h - 0.85, sz]} />
        <Toon color={PLASTER} tex="plaster" />
        <Ink thickness={0.015} />
      </mesh>
      {Array.from({ length: posts + 1 }, (_, i) => {
        const u = -len / 2 + (len * i) / posts;
        return (
          <mesh key={i} position={[alongX ? cx + u : cx, base + 0.6 + (h - 0.85) / 2, alongX ? cz : cz + u]}>
            <boxGeometry args={[alongX ? 0.16 : sx + 0.06, h - 0.85, alongX ? sz + 0.06 : 0.16]} />
            <Toon color={DARK} tex="wood" />
          </mesh>
        );
      })}
      {/* the tiled cap: a low gable along the wall */}
      <mesh position={[cx, total - 0.12, cz]} castShadow>
        <boxGeometry args={[sx + (alongX ? 0.2 : 0.5), 0.12, sz + (alongX ? 0.5 : 0.2)]} />
        <Toon color={NAVY} tex="tiles" />
      </mesh>
      <mesh position={[cx, total, cz]} rotation={alongX ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.09, 0.09, len + 0.2, 6]} />
        <Toon color={NAVY_DARK} />
      </mesh>
    </group>
  );
}

function Walls() {
  const { x0, x1, z0, z1 } = PRECINCT_WALL;
  const gx = GREAT_GATE.x;
  return (
    <group>
      {/* south: the Glicínias' north fence line, with the great gate in it */}
      <TempleWall a={[19.2, z1]} b={[gx - 2.6, z1]} />
      <TempleWall a={[gx + 2.6, z1]} b={[x1, z1]} />
      {/* the forecourt's sides, then taller along the terrace */}
      <TempleWall a={[x0, z1]} b={[x0, TERRACE.z1]} />
      <TempleWall a={[x1, z1]} b={[x1, TERRACE.z1]} />
      <TempleWall a={[x0, TERRACE.z1]} b={[x0, z0]} base={H} />
      <TempleWall a={[x1, TERRACE.z1]} b={[x1, z0]} base={H} />
      <TempleWall a={[x0, z0]} b={[x1, z0]} base={H} />
    </group>
  );
}

// ── The great gate ────────────────────────────────────────────────────────────

/** A seated stone cat on a pedestal: one holds the world (a ball), the other a kitten. */
function GuardianCat({ position, rotY = 0, kitten = false }: { position: [number, number, number]; rotY?: number; kitten?: boolean }) {
  const c = '#B4AEA2';
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <RigidBody type="fixed" colliders={false} userData={STONE_DATA}>
        <CuboidCollider args={[0.45, 0.9, 0.45]} position={[0, 0.9, 0]} />
      </RigidBody>
      <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 0.7, 0.9]} />
        <Toon color={STONE_DARK} tex="stone" />
        <Ink thickness={0.015} />
      </mesh>
      <mesh position={[0, 0.74, 0]}>
        <boxGeometry args={[1.0, 0.08, 1.0]} />
        <Toon color={STONE} tex="stone" />
      </mesh>
      {/* body, chest, head, ears, tail */}
      <mesh position={[0, 1.08, -0.05]} scale={[1, 1.15, 1.05]} castShadow>
        <sphereGeometry args={[0.3, 14, 10]} />
        <Toon color={c} tex="stone" />
        <Ink thickness={0.012} />
      </mesh>
      <mesh position={[0, 1.55, 0.06]} castShadow>
        <sphereGeometry args={[0.24, 14, 10]} />
        <Toon color={c} tex="stone" />
        <Ink thickness={0.012} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.13, 1.78, 0.04]} rotation={[0, 0, -s * 0.25]}>
          <coneGeometry args={[0.08, 0.18, 4]} />
          <Toon color={c} tex="stone" />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.1, 1.55, 0.27]}>
          <sphereGeometry args={[0.035, 6, 5]} />
          <Toon color="#5E584E" />
        </mesh>
      ))}
      <mesh position={[0.28, 0.98, -0.25]} rotation={[0.5, 0, -0.6]}>
        <cylinderGeometry args={[0.05, 0.06, 0.5, 6]} />
        <Toon color={c} tex="stone" />
      </mesh>
      {kitten ? (
        <mesh position={[0.17, 0.92, 0.3]} castShadow>
          <sphereGeometry args={[0.12, 10, 8]} />
          <Toon color={c} tex="stone" />
        </mesh>
      ) : (
        <mesh position={[-0.17, 0.9, 0.3]} castShadow>
          <sphereGeometry args={[0.13, 12, 9]} />
          <Toon color="#C9A94E" />
          <Ink thickness={0.01} />
        </mesh>
      )}
      {/* a red bib, as guardian statues wear */}
      <mesh position={[0, 1.3, 0.2]} rotation={[0.35, 0, 0]}>
        <coneGeometry args={[0.2, 0.22, 3]} />
        <Toon color={RED} />
      </mesh>
    </group>
  );
}

/** A tall pole with a navy banner and the golden paw. */
function Banner({ position, h = 3.6 }: { position: [number, number, number]; h?: number }) {
  return (
    <group position={position}>
      <mesh position={[0, h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, h, 8]} />
        <Toon color={DARK} tex="wood" />
      </mesh>
      <mesh position={[0, h + 0.06, 0]}>
        <sphereGeometry args={[0.08, 8, 6]} />
        <Toon color={GOLD} />
      </mesh>
      <mesh position={[0.32, h - 0.15, 0]}>
        <boxGeometry args={[0.66, 0.05, 0.05]} />
        <Toon color={DARK} />
      </mesh>
      <mesh position={[0.32, h - 1.0, 0.0]}>
        <boxGeometry args={[0.56, 1.6, 0.03]} />
        <Toon color={NAVY} />
      </mesh>
      {[1, -1].map((s) => (
        <group key={s} position={[0.32, h - 0.75, s * 0.02]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
          <PawEmblem scale={0.75} />
        </group>
      ))}
      <mesh position={[0.32, h - 1.83, 0]}>
        <boxGeometry args={[0.56, 0.06, 0.04]} />
        <Toon color={GOLD} />
      </mesh>
    </group>
  );
}

function GreatGate() {
  const { x, z } = GREAT_GATE;
  const plaque = useBoardTexture('TEMPLO DE MIKAGE', 512, 128);
  const posts: [number, number][] = [[-1.9, 0.45], [1.9, 0.45], [-1.9, -0.75], [1.9, -0.75]];
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false} userData={WOOD_DATA}>
        {posts.map(([px, pz], i) => <CuboidCollider key={i} args={[0.26, 2.2, 0.26]} position={[px, 2.2, pz]} />)}
        {[-1, 1].map((s) => <CuboidCollider key={s} args={[0.36, 2.2, 0.75]} position={[s * 2.25, 2.2, -0.15]} />)}
      </RigidBody>
      {/* stone threshold */}
      <mesh position={[0, 0.06, -0.15]} receiveShadow>
        <boxGeometry args={[3.6, 0.12, 1.9]} />
        <Toon color={STONE} tex="stone" />
      </mesh>
      {posts.map(([px, pz], i) => (
        <group key={i} position={[px, 0, pz]}>
          <mesh position={[0, 0.25, 0]} castShadow>
            <boxGeometry args={[0.6, 0.5, 0.6]} />
            <Toon color={STONE_DARK} tex="stone" />
          </mesh>
          <mesh position={[0, 2.15, 0]} castShadow>
            <cylinderGeometry args={[0.22, 0.25, 3.6, 14]} />
            <Toon color={RED} tex="wood" />
            <Ink thickness={0.015} />
          </mesh>
          <mesh position={[0, 3.6, 0]}>
            <cylinderGeometry args={[0.27, 0.27, 0.12, 14]} />
            <Toon color={GOLD} />
          </mesh>
        </group>
      ))}
      {/* side wings: plaster between the posts and the walls */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 2.25, 0, -0.15]}>
          <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.7, 0.6, 1.5]} />
            <Toon color={STONE} tex="stone" />
          </mesh>
          <mesh position={[0, 1.7, 0]} castShadow>
            <boxGeometry args={[0.62, 2.2, 1.4]} />
            <Toon color={PLASTER} tex="plaster" />
            <Ink thickness={0.012} />
          </mesh>
          <mesh position={[0, 2.86, 0]}>
            <boxGeometry args={[0.86, 0.14, 1.7]} />
            <Toon color={NAVY} tex="tiles" />
          </mesh>
        </group>
      ))}
      {/* tie beams, the plaque with the paw, and the two-tier roof with golden ridge ornaments */}
      <RoofFade box={[x - 3.5, 3.4, z - 1.9, x + 3.5, 6.2, z + 1.6]}>
      {[0.45, -0.75].map((pz) => (
        <mesh key={pz} position={[0, 3.75, pz]} castShadow>
          <boxGeometry args={[4.8, 0.3, 0.32]} />
          <Toon color={RED} tex="wood" />
          <Ink thickness={0.015} />
        </mesh>
      ))}
      <mesh position={[0, 3.2, 0.58]}>
        <boxGeometry args={[2.2, 0.56, 0.06]} />
        <meshBasicMaterial map={plaque} />
      </mesh>
      <group position={[0, 4.35, 0.62]}>
        <PawEmblem scale={1.1} />
      </group>
      <group position={[0, 4.0, -0.15]}>
        <JapaneseRoof w={6.6} d={2.8} h={0.95} color={NAVY} overhang={0.75} upturn={0.5} />
      </group>
      <group position={[0, 5.0, -0.15]}>
        <JapaneseRoof w={4.6} d={2.0} h={0.8} color={NAVY} overhang={0.55} upturn={0.55} />
      </group>
      <mesh position={[0, 5.86, -0.15]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, 3.0, 8]} />
        <Toon color={GOLD} emissive={GOLD} emissiveIntensity={0.15} />
      </mesh>
      {[-1, 1].map((s) => (
        <PaperLantern key={s} position={[s * 1.25, 3.05, 0.75]} color="#E8A33D" />
      ))}
      </RoofFade>
    </group>
  );
}

// ── Forecourt ─────────────────────────────────────────────────────────────────

/** Stone paving along the precinct's paths (on the terrace for the upper ones). */
function Paving() {
  const slabs = useMemo(() => {
    const out: { at: [number, number, number]; size: [number, number]; rot: number }[] = [];
    PRECINCT_PATHS.forEach((line, li) => {
      const wide = li < 2;
      for (let i = 0; i < line.length - 1; i++) {
        const [ax, az] = line[i];
        const [bx, bz] = line[i + 1];
        const len = Math.hypot(bx - ax, bz - az);
        const y = (az + bz) / 2 < TERRACE.z1 ? H + 0.015 : 0.02;
        out.push({ at: [(ax + bx) / 2, y, (az + bz) / 2], size: [wide ? 2.4 : 1.3, len + (wide ? 0 : 1.3)], rot: Math.atan2(bx - ax, bz - az) });
      }
    });
    return out;
  }, []);
  return (
    <group>
      {slabs.map((s, i) => (
        <mesh key={i} position={s.at} rotation={[-Math.PI / 2, 0, -s.rot]} receiveShadow>
          <planeGeometry args={s.size} />
          <Toon color={PAVING} tex="tiles" />
        </mesh>
      ))}
      {/* raked gravel either side of the entrance walk */}
      <mesh position={[AXIS_X, 0.012, (GREAT_GATE.z + STAIRS.zBottom) / 2 - 0.1]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[5.4, Math.abs(STAIRS.zBottom - GREAT_GATE.z) - 0.6]} />
        <Toon color="#DCD3C0" />
      </mesh>
      {/* gravel court in front of the residence */}
      <mesh position={[AXIS_X, H + 0.01, (TERRACE.z1 + RESIDENCE_FRONT) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[9.0, Math.abs(RESIDENCE_FRONT - TERRACE.z1) - 0.2]} />
        <Toon color="#DCD3C0" />
      </mesh>
    </group>
  );
}

/** The purification basin under its little roof, fed by a bamboo spout. */
function Basin() {
  const [x, z] = [23.6, -16.6];
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false} userData={STONE_DATA}>
        <CuboidCollider args={[0.55, 0.4, 0.35]} position={[0, 0.4, 0]} />
      </RigidBody>
      <mesh position={[0, 0.38, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 0.76, 0.7]} />
        <Toon color={STONE_DARK} tex="stone" />
        <Ink thickness={0.015} />
      </mesh>
      <mesh position={[0, 0.77, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.9, 0.5]} />
        <Toon color="#8FD0EC" emissive="#4AA8C8" emissiveIntensity={0.25} />
      </mesh>
      {[[-0.5, -0.4], [0.5, -0.4], [-0.5, 0.4], [0.5, 0.4]].map(([px, pz]) => (
        <mesh key={`${px}${pz}`} position={[px * 1.4, 1.1, pz * 1.3]} castShadow>
          <boxGeometry args={[0.1, 2.2, 0.1]} />
          <Toon color={RED} tex="wood" />
        </mesh>
      ))}
      <RoofFade box={[x - 1.3, 2.0, z - 1.1, x + 1.3, 2.9, z + 1.1]}>
        <group position={[0, 2.2, 0]}>
          <JapaneseRoof w={1.9} d={1.4} h={0.5} color={NAVY} overhang={0.3} upturn={0.35} />
        </group>
      </RoofFade>
      <mesh position={[-0.45, 0.95, -0.1]} rotation={[0, 0, Math.PI / 2 - 0.25]}>
        <cylinderGeometry args={[0.04, 0.04, 0.7, 6]} />
        <Toon color="#86BC4E" />
      </mesh>
      {/* the ladles resting on the rim */}
      {[0.15, 0.32].map((px) => (
        <mesh key={px} position={[px, 0.82, 0.25]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.012, 0.012, 0.45, 4]} />
          <Toon color="#C9A26A" />
        </mesh>
      ))}
    </group>
  );
}

/** The guard's post inside the gate: a little roof over a table (the diary is there) and a noticeboard. */
function GuardPost() {
  return (
    <group>
      <group position={[24.9, 0, -14.75]}>
        <RigidBody type="fixed" colliders={false} userData={WOOD_DATA}>
          <CuboidCollider args={[0.4, 0.38, 0.25]} position={[0, 0.38, 0]} />
        </RigidBody>
        <mesh position={[0, 0.72, 0]} castShadow>
          <boxGeometry args={[0.8, 0.06, 0.5]} />
          <Toon color="#8A5A36" tex="wood" />
        </mesh>
        <mesh position={[0, 0.35, 0]}>
          <boxGeometry args={[0.7, 0.7, 0.4]} />
          <Toon color={WOOD} tex="planks" />
        </mesh>
        <mesh position={[0.1, 0.78, 0]} rotation={[0, 0.3, 0]}>
          <boxGeometry args={[0.3, 0.05, 0.22]} />
          <Toon color="#7E3B32" />
        </mesh>
      </group>
      <group position={[31.0, 0, -14.75]}>
        <RigidBody type="fixed" colliders={false} userData={WOOD_DATA}>
          <CuboidCollider args={[0.7, 0.9, 0.1]} position={[0, 0.9, 0]} />
        </RigidBody>
        {[-0.62, 0.62].map((px) => (
          <mesh key={px} position={[px, 0.9, 0]} castShadow>
            <boxGeometry args={[0.1, 1.8, 0.1]} />
            <Toon color={DARK} tex="wood" />
          </mesh>
        ))}
        <mesh position={[0, 1.15, 0]} castShadow>
          <boxGeometry args={[1.2, 0.8, 0.06]} />
          <Toon color="#B08A5A" tex="wood" />
        </mesh>
        {[[-0.3, 1.25], [0.25, 1.3], [0.0, 1.0], [-0.32, 0.95]].map(([px, py], i) => (
          <mesh key={i} position={[px, py, 0.04]} rotation={[0, 0, (i - 1.5) * 0.06]}>
            <planeGeometry args={[0.36, 0.26]} />
            <Toon color="#FFF6E4" />
          </mesh>
        ))}
        <group position={[0, 1.8, 0]}>
          <JapaneseRoof w={1.6} d={0.6} h={0.3} color={NAVY} overhang={0.15} upturn={0.3} />
        </group>
      </group>
    </group>
  );
}

/** Rocks around the pond and the plunge pool, lily pads, and the vermilion arched bridge. */
function PondStones() {
  const rim = useMemo(() => {
    let s = 7123;
    const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    const out: { p: [number, number, number]; s: number; rot: number }[] = [];
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2;
      const px = TEMPLE_POND.x + Math.cos(a) * TEMPLE_POND.rx * 1.04;
      const pz = TEMPLE_POND.z + Math.sin(a) * TEMPLE_POND.rz * 1.04;
      // leave the bridge's two ends and the plunge pool's mouth open
      if (Math.abs(pz - ARCH_BRIDGE.z) < 1.0 && (px < TEMPLE_POND.x - 2 || px > TEMPLE_POND.x + 2)) continue;
      if (Math.abs(px - PLUNGE.x) < 1.2 && pz < TEMPLE_POND.z - 1.5) continue;
      out.push({ p: [px, 0.06, pz], s: 0.22 + r() * 0.16, rot: r() * 6 });
    }
    for (let i = 0; i < 12; i++) {
      const a = Math.PI + (i / 11) * Math.PI;
      out.push({ p: [PLUNGE.x + Math.cos(a) * PLUNGE.rx * 1.1, 0.06, PLUNGE.z + Math.sin(a) * PLUNGE.rz * 1.1 + 0.2], s: 0.2 + r() * 0.14, rot: r() * 6 });
    }
    return out;
  }, []);
  return (
    <group>
      {rim.map((s, i) => (
        <Rock key={i} variant={i % 5} kind="flat" position={s.p} rotation={[0, s.rot, 0]} scale={[s.s * 1.3, s.s * 0.95, s.s]} color={i % 4 ? STONE : STONE_DARK} castShadow receiveShadow />
      ))}
      {[[33.2, -17.6, 0.2], [36.4, -19.9, 0.17], [35.6, -17.2, 0.15], [33.6, -19.8, 0.18]].map(([px, pz, s], i) => (
        <mesh key={i} position={[px, 0.05, pz]} rotation={[-Math.PI / 2, 0, i]}>
          <circleGeometry args={[s, 10, 0.4, Math.PI * 1.8]} />
          <Toon color="#5E8C4A" />
        </mesh>
      ))}
    </group>
  );
}

function ArchBridge() {
  const { x0, x1, top0, top1, h, halfWidth, z } = ARCH_BRIDGE;
  const t = 0.1;
  const ramps = [
    { a: [x0, 0], b: [top0, h] },
    { a: [top0, h], b: [top1, h] },
    { a: [top1, h], b: [x1, 0] },
  ] as const;
  // deck planks following the arc
  const planks = useMemo(() => {
    const out: { x: number; y: number; ang: number }[] = [];
    for (let x = x0 + 0.15; x < x1; x += 0.3) {
      let y: number;
      let ang = 0;
      if (x < top0) { y = ((x - x0) / (top0 - x0)) * h; ang = Math.atan2(h, top0 - x0); }
      else if (x <= top1) y = h;
      else { y = ((x1 - x) / (x1 - top1)) * h; ang = -Math.atan2(h, x1 - top1); }
      out.push({ x, y, ang });
    }
    return out;
  }, [x0, x1, top0, top1, h]);
  const yAt = (x: number) => (x < top0 ? ((x - x0) / (top0 - x0)) * h : x <= top1 ? h : ((x1 - x) / (x1 - top1)) * h);
  const railPosts = [x0 + 0.2, (x0 + top0) / 2, top0, (top0 + top1) / 2, top1, (top1 + x1) / 2, x1 - 0.2];
  return (
    <group>
      <RigidBody type="fixed" colliders={false} userData={WOOD_DATA}>
        {ramps.map(({ a, b }, i) => {
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
          const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
          return (
            <group key={i}>
              <CuboidCollider args={[len / 2, t, halfWidth]} position={[(a[0] + b[0]) / 2 + t * Math.sin(ang), (a[1] + b[1]) / 2 - t * Math.cos(ang), z]} rotation={[0, 0, ang]} friction={0} />
              {[-1, 1].map((s) => (
                <CuboidCollider key={s} args={[len / 2, 0.35, 0.05]} position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.35, z + s * (halfWidth + 0.02)]} rotation={[0, 0, ang]} />
              ))}
            </group>
          );
        })}
      </RigidBody>
      {planks.map((p, i) => (
        <mesh key={i} position={[p.x, p.y - 0.04, z]} rotation={[0, 0, p.ang]} castShadow receiveShadow>
          <boxGeometry args={[0.28, 0.08, halfWidth * 2]} />
          <Toon color={i % 2 ? '#8A5A36' : '#7A4E30'} tex="wood" />
        </mesh>
      ))}
      {/* vermilion sides and rails, golden post caps */}
      {[-1, 1].map((s) => (
        <group key={s}>
          {railPosts.map((px) => (
            <group key={px} position={[px, yAt(px), z + s * (halfWidth + 0.02)]}>
              <mesh position={[0, 0.35, 0]} castShadow>
                <boxGeometry args={[0.1, 0.7, 0.1]} />
                <Toon color={RED} tex="wood" />
              </mesh>
              <mesh position={[0, 0.74, 0]}>
                <sphereGeometry args={[0.07, 8, 6]} />
                <Toon color={GOLD} />
              </mesh>
            </group>
          ))}
          {ramps.map(({ a, b }, i) => {
            const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
            const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
            return (
              <group key={i}>
                <mesh position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.62, z + s * (halfWidth + 0.02)]} rotation={[0, 0, ang]} castShadow>
                  <boxGeometry args={[len, 0.07, 0.08]} />
                  <Toon color={RED} tex="wood" />
                </mesh>
                <mesh position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.08, z + s * (halfWidth + 0.02)]} rotation={[0, 0, ang]}>
                  <boxGeometry args={[len, 0.16, 0.06]} />
                  <Toon color={RED} tex="wood" />
                </mesh>
              </group>
            );
          })}
        </group>
      ))}
    </group>
  );
}

// ── Terrace, stair, waterfall wall ────────────────────────────────────────────

function Terrace() {
  const { x0, x1, z0, z1 } = TERRACE;
  const n0 = NICHE.x - NICHE.w / 2;
  const n1 = NICHE.x + NICHE.w / 2;
  const back = z1 - NICHE.depth;
  // the platform, cut around the niche behind the waterfall
  const blocks: { x0: number; x1: number; z0: number; z1: number; y0: number }[] = [
    { x0, x1, z0, z1: back, y0: 0 },
    { x0, x1: n0, z0: back, z1, y0: 0 },
    { x0: n1, x1, z0: back, z1, y0: 0 },
    { x0: n0, x1: n1, z0: back, z1, y0: NICHE.h },
  ];
  return (
    <group>
      <RigidBody type="fixed" colliders={false} userData={STONE_DATA}>
        {blocks.map((b, i) => (
          <CuboidCollider key={i} args={[(b.x1 - b.x0) / 2, (H - b.y0) / 2, (b.z1 - b.z0) / 2]} position={[(b.x0 + b.x1) / 2, (H + b.y0) / 2, (b.z0 + b.z1) / 2]} />
        ))}
      </RigidBody>
      {blocks.map((b, i) => (
        <mesh key={i} position={[(b.x0 + b.x1) / 2, (H + b.y0) / 2 - 0.02, (b.z0 + b.z1) / 2]} castShadow receiveShadow>
          <boxGeometry args={[b.x1 - b.x0, H - b.y0 - 0.04, b.z1 - b.z0]} />
          <Toon color={STONE} tex="stone" />
          <Ink thickness={0.02} />
        </mesh>
      ))}
      {/* the terrace's top: moss-green lawn with a stone coping along the front */}
      <mesh position={[(x0 + x1) / 2, H - 0.005, (z0 + z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[x1 - x0 - 0.1, z1 - z0 - 0.1]} />
        <Toon color="#7FA65A" />
      </mesh>
      <mesh position={[(x0 + x1) / 2, H + 0.04, z1 - 0.2]} receiveShadow>
        <boxGeometry args={[x1 - x0, 0.08, 0.4]} />
        <Toon color={STONE_DARK} tex="stone" />
      </mesh>
      {/* the niche's back and floor, dark */}
      <mesh position={[NICHE.x, NICHE.h / 2, back + 0.01]}>
        <planeGeometry args={[NICHE.w, NICHE.h]} />
        <Toon color="#3C3A40" />
      </mesh>
      {/* a low stone balustrade along the edge, open at the stair and over the waterfall */}
      {[[x0 + 0.3, STAIRS.x0 - 0.2], [STAIRS.x1 + 0.2, WATERFALL.x - 0.9], [WATERFALL.x + 0.9, x1 - 0.3]].map(([a, b], i) => (
        <group key={i}>
          <RigidBody type="fixed" colliders={false} userData={STONE_DATA}>
            <CuboidCollider args={[(b - a) / 2, 0.28, 0.1]} position={[(a + b) / 2, H + 0.28, z1 - 0.15]} />
          </RigidBody>
          <mesh position={[(a + b) / 2, H + 0.48, z1 - 0.15]} castShadow>
            <boxGeometry args={[b - a, 0.08, 0.2]} />
            <Toon color={STONE} tex="stone" />
          </mesh>
          {Array.from({ length: Math.max(2, Math.round((b - a) / 1.2) + 1) }, (_, k) => k).map((k, _i, arr) => (
            <mesh key={k} position={[a + ((b - a) * k) / (arr.length - 1), H + 0.24, z1 - 0.15]} castShadow>
              <boxGeometry args={[0.16, 0.48, 0.16]} />
              <Toon color={STONE_DARK} tex="stone" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Stairs() {
  const { x0, x1, zBottom, zTop, steps } = STAIRS;
  const run = Math.abs(zTop - zBottom);
  const len = Math.hypot(run, H);
  const ang = Math.atan2(H, run);
  const t = 0.12;
  const zc = (zBottom + zTop) / 2;
  const xc = (x0 + x1) / 2;
  return (
    <group>
      <RigidBody type="fixed" colliders={false} userData={STONE_DATA}>
        {/* a ramp under the steps (rotation about x tilts it up toward -z) */}
        <CuboidCollider args={[(x1 - x0) / 2, t, len / 2]} position={[xc, H / 2 - t * Math.cos(ang), zc - t * Math.sin(ang)]} rotation={[ang, 0, 0]} friction={0} />
        {[-1, 1].map((s) => (
          <CuboidCollider key={s} args={[0.2, 0.9, run / 2]} position={[s > 0 ? x1 + 0.2 : x0 - 0.2, 0.6, zc]} />
        ))}
      </RigidBody>
      {Array.from({ length: steps }, (_, i) => {
        const z = zBottom - ((i + 0.5) / steps) * run;
        const y = ((i + 1) / steps) * H;
        return (
          <mesh key={i} position={[xc, y / 2, z]} castShadow receiveShadow>
            <boxGeometry args={[x1 - x0, y, run / steps + 0.02]} />
            <Toon color={i % 2 ? STONE : '#B3AC9F'} tex="stone" />
          </mesh>
        );
      })}
      {/* the cheek walls, with a lantern post at the foot of each */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s > 0 ? x1 + 0.2 : x0 - 0.2, (H + 0.5) / 2, zc]} castShadow>
            <boxGeometry args={[0.4, H + 0.5, run]} />
            <Toon color={STONE_DARK} tex="stone" />
            <Ink thickness={0.015} />
          </mesh>
          <Banner position={[s > 0 ? x1 + 0.3 : x0 - 0.3, H, zTop - 0.5]} h={3.4} />
        </group>
      ))}
    </group>
  );
}

/** The spring on the terrace: rocks, and the stone channel that carries it to the edge. */
function Spring() {
  return (
    <group>
      <RigidBody type="fixed" colliders={false} userData={STONE_DATA}>
        <CylinderCollider args={[0.6, 0.9]} position={[SPRING.x, H + 0.6, SPRING.z - 0.5]} />
      </RigidBody>
      <Rock variant={1} position={[SPRING.x - 0.4, H + 0.45, SPRING.z - 0.5]} scale={[0.9, 0.8, 0.8]} color={STONE_DARK} castShadow contact={false} />
      <Rock variant={3} position={[SPRING.x + 0.45, H + 0.35, SPRING.z - 0.35]} scale={[0.7, 0.65, 0.7]} color={STONE} castShadow contact={false} />
      <Rock variant={2} position={[SPRING.x, H + 0.9, SPRING.z - 0.7]} scale={[0.6, 0.6, 0.55]} color="#9A9184" castShadow contact={false} />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[SPRING.x + s * 0.55, H + 0.08, (SPRING.z + TERRACE.z1) / 2 + 0.1]} receiveShadow>
          <boxGeometry args={[0.18, 0.16, Math.abs(TERRACE.z1 - SPRING.z) - 0.1]} />
          <Toon color={STONE_DARK} tex="stone" />
        </mesh>
      ))}
    </group>
  );
}

// ── Buildings on the terrace ──────────────────────────────────────────────────

function Residence() {
  const { x, z, w, d } = RESIDENCE;
  const plinth = 0.45;
  const wallH = 2.9;
  const top = H + plinth + wallH;
  const front = RESIDENCE_FRONT;
  const plaque = useBoardTexture('SEDE DE MIKAGE', 512, 128);
  const posts = [-w / 2, -w / 2 + 2, -1.25, 1.25, w / 2 - 2, w / 2];
  return (
    <group>
      <RigidBody type="fixed" colliders={false} userData={WOOD_DATA}>
        <CuboidCollider args={[w / 2, (plinth + wallH) / 2, d / 2]} position={[x, H + (plinth + wallH) / 2, z]} />
        {/* the veranda, its step and the porch posts */}
        <CuboidCollider args={[w / 2, plinth / 2, 0.45]} position={[x, H + plinth / 2, front + 0.45]} />
        <CuboidCollider args={[1.5, 0.11, 0.15]} position={[x, H + 0.11, front + 1.05]} />
        {[-1, 1].map((s) => <CuboidCollider key={s} args={[0.15, 1.5, 0.15]} position={[x + s * 1.35, H + 1.5, front + 0.95]} />)}
      </RigidBody>
      {/* stone plinth and veranda */}
      <mesh position={[x, H + plinth / 2, z + 0.45]} castShadow receiveShadow>
        <boxGeometry args={[w + 0.2, plinth, d + 0.9]} />
        <Toon color={STONE} tex="stone" />
        <Ink thickness={0.02} />
      </mesh>
      <mesh position={[x, H + plinth + 0.02, front + 0.45]} receiveShadow>
        <boxGeometry args={[w, 0.05, 0.9]} />
        <Toon color="#8A5A36" tex="planks" />
      </mesh>
      <mesh position={[x, H + 0.11, front + 1.05]} castShadow receiveShadow>
        <boxGeometry args={[3.0, 0.22, 0.3]} />
        <Toon color={STONE_DARK} tex="stone" />
      </mesh>
      {/* walls: dark wainscot, white plaster, wooden frames */}
      <mesh position={[x, H + plinth + wallH / 2, z]} castShadow receiveShadow>
        <boxGeometry args={[w, wallH, d]} />
        <Toon color={PLASTER} tex="plaster" />
        <Ink thickness={0.02} />
      </mesh>
      <mesh position={[x, H + plinth + 0.45, front + 0.005]}>
        <boxGeometry args={[w, 0.9, 0.04]} />
        <Toon color={DARK} tex="planks" />
      </mesh>
      {/* shoji windows along the front, either side of the door */}
      {[-3.6, -2.4, 2.4, 3.6].map((px) => (
        <group key={px} position={[x + px, H + plinth + 1.65, front + 0.03]}>
          <mesh>
            <boxGeometry args={[0.96, 0.9, 0.04]} />
            <Toon color={DARK} tex="wood" />
          </mesh>
          <mesh position={[0, 0, 0.025]}>
            <planeGeometry args={[0.84, 0.78]} />
            <Toon color="#FFF6E2" emissive="#FFD9A0" emissiveIntensity={0.45} />
          </mesh>
          {[-0.21, 0.21].map((u) => (
            <mesh key={u} position={[u, 0, 0.03]}>
              <boxGeometry args={[0.025, 0.78, 0.015]} />
              <Toon color={WOOD} />
            </mesh>
          ))}
          <mesh position={[0, 0, 0.03]}>
            <boxGeometry args={[0.84, 0.025, 0.015]} />
            <Toon color={WOOD} />
          </mesh>
        </group>
      ))}
      {/* vermilion posts with golden caps along the front */}
      {posts.map((px) => (
        <group key={px} position={[x + px, 0, front + 0.06]}>
          <mesh position={[0, H + plinth + wallH / 2, 0]} castShadow>
            <boxGeometry args={[0.22, wallH, 0.22]} />
            <Toon color={RED} tex="wood" />
          </mesh>
          <mesh position={[0, top - 0.08, 0]}>
            <boxGeometry args={[0.28, 0.12, 0.28]} />
            <Toon color={GOLD} />
          </mesh>
        </group>
      ))}
      <mesh position={[x, top - 0.25, front + 0.06]}>
        <boxGeometry args={[w + 0.3, 0.28, 0.26]} />
        <Toon color={RED} tex="wood" />
        <Ink thickness={0.015} />
      </mesh>
      {/* the great doors: dark wood, golden studs and the paw */}
      {[-1, 1].map((s) => (
        <group key={s} position={[x + s * 0.62, H + plinth + 1.2, front + 0.04]}>
          <mesh castShadow>
            <boxGeometry args={[1.2, 2.4, 0.08]} />
            <Toon color="#4A2E20" tex="planks" />
          </mesh>
          {[-0.8, 0, 0.8].map((y) => (
            <mesh key={y} position={[0, y, 0.05]}>
              <boxGeometry args={[1.12, 0.06, 0.02]} />
              <Toon color={GOLD} />
            </mesh>
          ))}
        </group>
      ))}
      <group position={[x, H + plinth + 1.75, front + 0.1]}>
        <PawEmblem scale={1.0} />
      </group>
      <mesh position={[x, H + plinth + 2.72, front + 0.1]}>
        <boxGeometry args={[2.0, 0.42, 0.05]} />
        <meshBasicMaterial map={plaque} />
      </mesh>
      {/* the entrance porch with its own curved roof */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[x + s * 1.35, H + plinth + 1.3, front + 0.95]} castShadow>
          <cylinderGeometry args={[0.13, 0.15, 2.6, 10]} />
          <Toon color={RED} tex="wood" />
          <Ink thickness={0.012} />
        </mesh>
      ))}
      <RoofFade box={[x - 2.3, H + plinth + 2.4, front - 0.6, x + 2.3, H + plinth + 3.5, front + 1.8]}>
        <group position={[x, H + plinth + 2.6, front + 0.6]}>
          <JapaneseRoof w={3.6} d={1.6} h={0.7} color={NAVY} overhang={0.35} upturn={0.6} />
        </group>
      </RoofFade>
      {[-1, 1].map((s) => (
        <PaperLantern key={s} position={[x + s * 1.35, H + plinth + 2.35, front + 1.25]} color="#E8A33D" />
      ))}
      {/* two-tier palace roof with golden ridges (see-through while it hides the cat: coming out of the
          residence, the camera starts behind the cat, over this roof) */}
      <RoofFade box={[x - w / 2 - 1.8, top - 0.2, z - d / 2 - 1.8, x + w / 2 + 1.8, top + 3.4, z + d / 2 + 1.8]}>
      <group position={[x, top, z]}>
        <JapaneseRoof w={w + 1.6} d={d + 1.8} h={1.5} color={NAVY} overhang={0.9} upturn={0.55} />
      </group>
      <mesh position={[x, top + 1.45, z]}>
        <boxGeometry args={[w - 2.4, 0.5, d - 2.6]} />
        <Toon color={PLASTER} tex="plaster" />
      </mesh>
      <group position={[x, top + 1.65, z]}>
        <JapaneseRoof w={w - 1.2} d={d - 1.4} h={1.1} color={NAVY} overhang={0.7} upturn={0.6} />
      </group>
      <mesh position={[x, top + 2.82, z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.1, 0.1, w - 3.6, 8]} />
        <Toon color={GOLD} emissive={GOLD} emissiveIntensity={0.15} />
      </mesh>
      {/* golden cat-ear finials at the ridge ends */}
      {[-1, 1].map((s) => (
        <group key={s} position={[x + s * ((w - 3.6) / 2 + 0.1), top + 2.95, z]}>
          {[-0.12, 0.12].map((u) => (
            <mesh key={u} position={[0, 0.12, u]} rotation={[u * 2, 0, 0]}>
              <coneGeometry args={[0.1, 0.32, 4]} />
              <Toon color={GOLD} emissive={GOLD} emissiveIntensity={0.2} />
            </mesh>
          ))}
        </group>
      ))}
      </RoofFade>
    </group>
  );
}

function BellPavilion() {
  const { x, z, half } = BELL;
  return (
    <group position={[x, H, z]}>
      <RigidBody type="fixed" colliders={false} userData={STONE_DATA}>
        <CuboidCollider args={[half + 0.25, 0.15, half + 0.25]} position={[0, 0.15, 0]} />
        {[[-half, -half], [half, -half], [-half, half], [half, half]].map(([px, pz]) => (
          <CuboidCollider key={`${px}${pz}`} args={[0.13, 1.6, 0.13]} position={[px, 1.6, pz]} />
        ))}
      </RigidBody>
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[half * 2 + 0.5, 0.3, half * 2 + 0.5]} />
        <Toon color={STONE} tex="stone" />
        <Ink thickness={0.015} />
      </mesh>
      {[[-half, -half], [half, -half], [-half, half], [half, half]].map(([px, pz]) => (
        <mesh key={`${px}${pz}`} position={[px, 1.75, pz]} castShadow>
          <cylinderGeometry args={[0.12, 0.14, 2.9, 10]} />
          <Toon color={RED} tex="wood" />
          <Ink thickness={0.012} />
        </mesh>
      ))}
      {/* the beam the bell hangs from (the nest sits on it) */}
      <mesh position={[0, 3.12, 0]} castShadow>
        <boxGeometry args={[half * 2 + 0.4, 0.22, 0.24]} />
        <Toon color={WOOD} tex="wood" />
      </mesh>
      <RoofFade box={[x - 2.2, H + 3.1, z - 2.2, x + 2.2, H + 4.5, z + 2.2]}>
        <group position={[0, 3.3, 0]}>
          <JapaneseRoof w={3.4} d={3.4} h={1.0} color={NAVY} overhang={0.45} upturn={0.55} />
        </group>
      </RoofFade>
    </group>
  );
}

function ArchivePavilion() {
  const { x, z, w, d } = ARCHIVE;
  const wallH = 2.5;
  const shelves = [-1.6, -0.55, 0.5, 1.55];
  return (
    <group position={[x, H, z]}>
      <RigidBody type="fixed" colliders={false} userData={WOOD_DATA}>
        <CuboidCollider args={[w / 2, wallH / 2, 0.15]} position={[0, wallH / 2, -d / 2]} />
        {[-1, 1].map((s) => <CuboidCollider key={s} args={[0.15, wallH / 2, d / 2]} position={[s * w / 2, wallH / 2, 0]} />)}
        <CuboidCollider args={[0.7, 0.4, 0.4]} position={[0.6, 0.4, -0.55]} />
        <CuboidCollider args={[w / 2 - 0.3, 0.9, 0.25]} position={[0, 0.9, -d / 2 + 0.4]} />
      </RigidBody>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[w, 0.04, d]} />
        <Toon color="#8A5A36" tex="planks" />
      </mesh>
      {/* back and side walls */}
      <mesh position={[0, wallH / 2, -d / 2]} castShadow receiveShadow>
        <boxGeometry args={[w, wallH, 0.3]} />
        <Toon color={PLASTER} tex="plaster" />
        <Ink thickness={0.015} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * w / 2, wallH / 2, 0]} castShadow>
          <boxGeometry args={[0.3, wallH, d]} />
          <Toon color={PLASTER} tex="plaster" />
          <Ink thickness={0.015} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 2 - 0.02), wallH / 2, d / 2 - 0.05]} castShadow>
          <boxGeometry args={[0.24, wallH, 0.24]} />
          <Toon color={RED} tex="wood" />
        </mesh>
      ))}
      {/* the scroll cabinet along the back wall: cubbies full of rolled scrolls */}
      <mesh position={[0, 0.9, -d / 2 + 0.4]} castShadow>
        <boxGeometry args={[w - 0.6, 1.8, 0.5]} />
        <Toon color={WOOD} tex="wood" />
      </mesh>
      {shelves.map((sx) => [0.45, 0.95, 1.45].map((y, k) => (
        <group key={`${sx}${y}`} position={[sx, y, -d / 2 + 0.66]}>
          {[-0.25, 0, 0.25].map((u, j) => (
            <mesh key={u} position={[u, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.07, 0.07, 0.04, 10]} />
              <Toon color={['#F6ECD2', '#E8D9B5', '#F0E2C4'][(j + k) % 3]} />
            </mesh>
          ))}
        </group>
      )))}
      {/* the reading table */}
      <mesh position={[0.6, 0.55, -0.55]} castShadow>
        <boxGeometry args={[1.4, 0.08, 0.8]} />
        <Toon color="#8A5A36" tex="wood" />
        <Ink thickness={0.012} />
      </mesh>
      {[[-0.6, -0.32], [0.6, -0.32], [-0.6, 0.32], [0.6, 0.32]].map(([px, pz]) => (
        <mesh key={`${px}${pz}`} position={[0.6 + px, 0.26, -0.55 + pz]}>
          <boxGeometry args={[0.07, 0.52, 0.07]} />
          <Toon color={DARK} />
        </mesh>
      ))}
      <mesh position={[0.2, 0.62, -0.55]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 0.4, 8]} />
        <Toon color="#F6ECD2" />
      </mesh>
      <PaperLantern position={[-1.4, 2.1, 0.2]} color="#E8A33D" />
      <RoofFade box={[x - w / 2 - 1.0, H + wallH - 0.1, z - d / 2 - 1.1, x + w / 2 + 1.0, H + wallH + 1.1, z + d / 2 + 1.0]}>
        <group position={[0, wallH, -0.1]}>
          <JapaneseRoof w={w + 0.8} d={d + 1.0} h={0.9} color={NAVY} overhang={0.5} upturn={0.45} />
        </group>
      </RoofFade>
    </group>
  );
}

/** The founder statue: the young messenger who woke the village in the night of the Great Flood. */
function FounderStatue() {
  const [x, z] = [21.5, -27.6];
  const c = '#9FA4A8';
  return (
    <group position={[x, H, z]}>
      <RigidBody type="fixed" colliders={false} userData={STONE_DATA}>
        <CuboidCollider args={[0.4, 1.1, 0.4]} position={[0, 1.1, 0]} />
      </RigidBody>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.8, 0.6, 0.8]} />
        <Toon color={STONE_DARK} tex="stone" />
        <Ink thickness={0.015} />
      </mesh>
      {/* a running cat, a scroll in its mouth, one ear torn */}
      <mesh position={[0, 0.95, 0]} rotation={[0.25, 0, 0]} scale={[0.75, 0.8, 1.3]} castShadow>
        <sphereGeometry args={[0.3, 12, 9]} />
        <Toon color={c} tex="stone" />
        <Ink thickness={0.012} />
      </mesh>
      <mesh position={[0, 1.3, 0.32]} castShadow>
        <sphereGeometry args={[0.2, 12, 9]} />
        <Toon color={c} tex="stone" />
      </mesh>
      <mesh position={[-0.1, 1.5, 0.3]} rotation={[0, 0, 0.3]}>
        <coneGeometry args={[0.07, 0.16, 4]} />
        <Toon color={c} tex="stone" />
      </mesh>
      <mesh position={[0.1, 1.46, 0.3]} rotation={[0, 0, -0.3]} scale={[1, 0.6, 1]}>
        <coneGeometry args={[0.07, 0.16, 4]} />
        <Toon color={c} tex="stone" />
      </mesh>
      <mesh position={[0, 1.24, 0.5]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 0.36, 8]} />
        <Toon color="#D8CFA0" />
      </mesh>
      {[[-0.12, 0.25], [0.12, 0.25], [-0.12, -0.25], [0.12, -0.25]].map(([px, pz], i) => (
        <mesh key={i} position={[px, 0.72, pz]} rotation={[pz > 0 ? 0.4 : -0.4, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.3, 6]} />
          <Toon color={c} tex="stone" />
        </mesh>
      ))}
    </group>
  );
}

/** The old watch tower and the stacked stones that climb to it. */
function WatchTower() {
  return (
    <group>
      <RigidBody type="fixed" colliders={false} userData={STONE_DATA}>
        {TOWER_STEPS.map((s, i) => (
          <CuboidCollider key={i} args={[s.w / 2, s.h / 2, s.d / 2]} position={[s.x, s.h / 2, s.z]} />
        ))}
        <CuboidCollider args={[TOWER.w / 2, TOWER.h / 2, TOWER.d / 2]} position={[TOWER.x, TOWER.h / 2, TOWER.z]} />
        {/* the railing: three sides, open toward the stones (west) */}
        <CuboidCollider args={[TOWER.w / 2, 0.45, 0.05]} position={[TOWER.x, TOWER.h + 0.45, TOWER.z - TOWER.d / 2]} />
        <CuboidCollider args={[TOWER.w / 2, 0.45, 0.05]} position={[TOWER.x, TOWER.h + 0.45, TOWER.z + TOWER.d / 2]} />
        <CuboidCollider args={[0.05, 0.45, TOWER.d / 2]} position={[TOWER.x + TOWER.w / 2, TOWER.h + 0.45, TOWER.z]} />
      </RigidBody>
      {TOWER_STEPS.map((s, i) => (
        <group key={i}>
          <mesh position={[s.x, H + (s.h - H) / 2, s.z]} castShadow receiveShadow>
            <boxGeometry args={[s.w, s.h - H, s.d]} />
            <Toon color={i ? STONE : STONE_DARK} tex="stone" />
            <Ink thickness={0.015} />
          </mesh>
          <mesh position={[s.x, s.h - 0.02, s.z]}>
            <boxGeometry args={[s.w + 0.06, 0.06, s.d + 0.06]} />
            <Toon color="#B3AC9F" tex="stone" />
          </mesh>
        </group>
      ))}
      <mesh position={[TOWER.x, H + (TOWER.h - H) / 2, TOWER.z]} castShadow receiveShadow>
        <boxGeometry args={[TOWER.w, TOWER.h - H, TOWER.d]} />
        <Toon color={STONE} tex="stone" />
        <Ink thickness={0.02} />
      </mesh>
      <mesh position={[TOWER.x, TOWER.h, TOWER.z]} receiveShadow>
        <boxGeometry args={[TOWER.w + 0.1, 0.08, TOWER.d + 0.1]} />
        <Toon color="#8A5A36" tex="planks" />
      </mesh>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
        <mesh key={`${sx}${sz}`} position={[TOWER.x + sx * (TOWER.w / 2 - 0.08), TOWER.h + 1.1, TOWER.z + sz * (TOWER.d / 2 - 0.08)]} castShadow>
          <boxGeometry args={[0.12, 2.2, 0.12]} />
          <Toon color={RED} tex="wood" />
        </mesh>
      ))}
      {[[0, -1], [0, 1], [1, 0]].map(([sx, sz]) => (
        <mesh key={`r${sx}${sz}`} position={[TOWER.x + sx * (TOWER.w / 2 - 0.05), TOWER.h + 0.8, TOWER.z + sz * (TOWER.d / 2 - 0.05)]}>
          <boxGeometry args={[sx ? 0.06 : TOWER.w, 0.07, sz ? 0.06 : TOWER.d]} />
          <Toon color={RED} tex="wood" />
        </mesh>
      ))}
      <RoofFade box={[TOWER.x - 1.9, TOWER.h + 2.0, TOWER.z - 1.9, TOWER.x + 1.9, TOWER.h + 3.1, TOWER.z + 1.9]}>
        <group position={[TOWER.x, TOWER.h + 2.2, TOWER.z]}>
          <JapaneseRoof w={2.8} d={2.8} h={0.8} color={NAVY} overhang={0.35} upturn={0.5} />
        </group>
      </RoofFade>
    </group>
  );
}

/** Trees, bamboo and flowering shrubs: each one framing something (the gate, the pond, the stair, the corners). */
function Planting() {
  const bamboo = useMemo(() => {
    const out: [number, number][] = [];
    const j = JADE_PAWS.find((p) => p.id === 'jade_bambu')!.at;
    for (let x = BAMBOO_GROVE.x0 + 0.6; x < BAMBOO_GROVE.x1; x += 1.45) {
      for (let z = BAMBOO_GROVE.z1 - 0.6; z > BAMBOO_GROVE.z0; z -= 1.5) {
        // a way in from the east, and the little hollow where the jade paw waits
        if (Math.hypot(x - j[0], z - j[2]) < 1.4) continue;
        if (Math.abs(z - j[2]) < 0.75 && x > j[0]) continue;
        out.push([x + ((x * 7) % 0.3), z]);
      }
    }
    return out;
  }, []);
  const hydrangeas: [number, number, string][] = [
    [38.8, -21.7, '#B58FE0'], [39.8, -16.9, '#8FA8E8'], [21.4, -16.4, '#E89FC0'], [33.4, -15.0, '#E89FC0'],
    [38.6, -27.4, '#8FA8E8'], [24.2, -29.6, '#E89FC0'],
  ];
  return (
    <group>
      {bamboo.map(([x, z], i) => <Bamboo key={i} position={[x, 0, z]} seed={i + 21} />)}
      <SakuraTree position={[21.6, 0, -15.3]} scale={1.15} seed={31} />
      <SakuraTree position={[39.7, 0, -15.3]} scale={1.2} seed={33} />
      <SakuraTree position={[39.5, H, -24.4]} scale={1.1} seed={35} />
      <SakuraTree position={[21.6, H, -35.0]} scale={1.0} seed={37} />
      <MapleTree position={[31.6, 0, -21.6]} scale={0.95} seed={6} />
      <PineTree position={[40.0, 0, -21.3]} scale={1.05} />
      <PineTree position={[33.2, H, -35.4]} scale={1.0} />
      <PineTree position={[21.3, H, -31.6]} scale={0.95} />
      {hydrangeas.map(([x, z, c], i) => (
        <group key={i} position={[x, z < TERRACE.z1 ? H : 0, z]}>
          {[[0, 0.35, 0, 0.42], [0.25, 0.3, 0.15, 0.3], [-0.22, 0.32, -0.12, 0.32]].map(([px, py, pz, r], k) => (
            <mesh key={k} position={[px, py, pz]} castShadow>
              <icosahedronGeometry args={[r, 1]} />
              <Toon color={k === 0 ? '#5E8C4A' : c} />
            </mesh>
          ))}
        </group>
      ))}
      {/* stone lanterns along the entrance walk */}
      {[[25.8, -15.7], [29.4, -15.7], [25.8, -18.3], [29.4, -18.3]].map(([x, z]) => (
        <StoneLantern key={`${x}${z}`} position={[x, 0, z]} />
      ))}
    </group>
  );
}

export function MikagePrecinct() {
  return (
    <group>
      <Walls />
      <GreatGate />
      <GuardianCat position={[23.9, 0, -13.1]} rotY={0} />
      <GuardianCat position={[31.3, 0, -13.1]} rotY={0} kitten />
      <Banner position={[22.4, 0, -13.4]} />
      <Banner position={[32.8, 0, -13.4]} />
      <Paving />
      <Basin />
      <GuardPost />
      <PondStones />
      <ArchBridge />
      <Terrace />
      <Stairs />
      <Spring />
      <Residence />
      <BellPavilion />
      <ArchivePavilion />
      <FounderStatue />
      <WatchTower />
      <Planting />
    </group>
  );
}

// ── What moves and changes ────────────────────────────────────────────────────

function Water() {
  const pond = usePondMaterial('#BFE8E0', '#5FA8B8');
  const fall = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 256;
    const g = c.getContext('2d')!;
    g.fillStyle = '#9AD6EE';
    g.fillRect(0, 0, 64, 256);
    let s = 99;
    const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.5})`;
      g.fillRect(r() * 64, r() * 256, 1 + r() * 3, 14 + r() * 40);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const channel = useMemo(() => {
    const t = fall.clone();
    t.needsUpdate = true;
    t.repeat.set(1, 0.5);
    return t;
  }, [fall]);
  const foam = useRef<THREE.Group>(null);
  useFrame(({ clock }, d) => {
    fall.offset.y += d * 1.1;
    channel.offset.y += d * 0.5;
    foam.current?.children.forEach((m, i) => m.scale.setScalar(0.75 + 0.25 * Math.sin(clock.elapsedTime * 3 + i * 1.9)));
  });
  return (
    <group userData={{ dynamic: true }}>
      <mesh position={[TEMPLE_POND.x, 0.035, TEMPLE_POND.z]} rotation={[-Math.PI / 2, 0, 0]} scale={[TEMPLE_POND.rx, TEMPLE_POND.rz, 1]}>
        <circleGeometry args={[1, 48]} />
        <primitive object={pond} attach="material" />
      </mesh>
      <mesh position={[PLUNGE.x, 0.037, PLUNGE.z]} rotation={[-Math.PI / 2, 0, 0]} scale={[PLUNGE.rx, PLUNGE.rz, 1]}>
        <circleGeometry args={[1, 32]} />
        <primitive object={pond} attach="material" />
      </mesh>
      {/* the channel on the terrace and the sheet of water over the edge */}
      <mesh position={[SPRING.x, H + 0.03, (SPRING.z + TERRACE.z1) / 2 + 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.9, Math.abs(TERRACE.z1 - SPRING.z) - 0.1]} />
        <meshBasicMaterial map={channel} transparent opacity={0.9} />
      </mesh>
      <mesh position={[WATERFALL.x, H / 2 + 0.02, TERRACE.z1 + 0.08]}>
        <planeGeometry args={[WATERFALL.w, H + 0.05]} />
        <meshBasicMaterial map={fall} transparent opacity={0.82} side={THREE.DoubleSide} />
      </mesh>
      <group ref={foam}>
        {[-0.4, 0, 0.4].map((u) => (
          <mesh key={u} position={[WATERFALL.x + u, 0.12, TERRACE.z1 + 0.35]}>
            <sphereGeometry args={[0.3, 10, 8]} />
            <meshBasicMaterial color="#F4FBFF" transparent opacity={0.7} />
          </mesh>
        ))}
      </group>
      <Sparkles count={14} scale={[1.6, 1.2, 0.8]} position={[WATERFALL.x, 0.6, TERRACE.z1 + 0.5]} size={2.5} speed={0.6} color="#EAF8FF" opacity={0.8} />
    </group>
  );
}

/** Koi circling slowly in the pond. */
function TempleKoi() {
  const fish = useMemo(() => {
    let s = 4321;
    const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    return ['#F28C38', '#F28C38', '#FBF8F2', '#E8662A', '#FBF1E6', '#F2B238'].map((c) => ({
      c, a: 0.6 + r() * 1.6, b: 0.5 + r() * 1.1, speed: (0.18 + r() * 0.2) * (r() > 0.5 ? 1 : -1), phase: r() * 6.3,
    }));
  }, []);
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    const t = windTime.value;
    group.current?.children.forEach((m, i) => {
      const f = fish[i];
      const a = t * f.speed + f.phase;
      m.position.set(TEMPLE_POND.x + Math.cos(a) * f.a, 0.02, TEMPLE_POND.z + Math.sin(a) * f.b);
      // facing along the path
      m.rotation.y = Math.atan2(-Math.sin(a) * f.a * Math.sign(f.speed), Math.cos(a) * f.b * Math.sign(f.speed)) + Math.sin(t * 6 + i) * 0.12;
    });
  });
  return (
    <group ref={group} userData={{ dynamic: true }}>
      {fish.map((f, i) => (
        <mesh key={i} scale={[0.09, 0.05, 0.24]}>
          <sphereGeometry args={[1, 10, 6]} />
          <Toon color={f.c} />
        </mesh>
      ))}
    </group>
  );
}

/** The bronze bell: it sways on its own until the rope is tied; then the nest with its chicks shows. */
function BellAndNest() {
  const tied = useGameStore((s) => !!s.progress.flags.ninho_sino);
  const bell = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!bell.current) return;
    const t = clock.elapsedTime;
    // every few seconds a small swing (a bird landing on the rope), until it is tied
    const k = tied ? 0 : Math.max(0, Math.sin(t * 0.45)) ** 6;
    bell.current.rotation.x = Math.sin(t * 3.2) * 0.12 * k;
  });
  const { x, z } = BELL;
  return (
    <group position={[x, H, z]} userData={{ dynamic: true }}>
      <group ref={bell} position={[0, 3.0, 0]}>
        <mesh position={[0, -0.85, 0]} castShadow>
          <cylinderGeometry args={[0.42, 0.55, 1.2, 18, 1, true]} />
          <Toon color="#7C6A3C" side={THREE.DoubleSide} />
          <Ink thickness={0.012} />
        </mesh>
        <mesh position={[0, -0.2, 0]}>
          <sphereGeometry args={[0.42, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <Toon color="#7C6A3C" />
        </mesh>
        {[-0.55, -1.0].map((y) => (
          <mesh key={y} position={[0, y, 0]}>
            <torusGeometry args={[y < -0.8 ? 0.53 : 0.47, 0.025, 6, 20]} />
            <Toon color={GOLD} />
          </mesh>
        ))}
      </group>
      {/* the striker log and its rope (tied to the post once the mystery is solved) */}
      <mesh position={[0.95, 1.95, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.9, 8]} />
        <Toon color="#9B7048" tex="bark" />
      </mesh>
      <mesh position={tied ? [1.05, 1.5, -0.4] : [1.3, 1.3, 0]} rotation={tied ? [0.9, 0, 0] : [0, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1.1, 5]} />
        <Toon color="#C9B48C" />
      </mesh>
      {tied && (
        <group position={[-0.6, 3.27, 0]}>
          <mesh scale={[1, 0.45, 1]}>
            <torusGeometry args={[0.16, 0.07, 6, 12]} />
            <Toon color="#B08A5A" tex="thatch" />
          </mesh>
          {[-0.06, 0.06].map((u) => (
            <group key={u} position={[u, 0.07, 0]}>
              <mesh>
                <sphereGeometry args={[0.055, 8, 6]} />
                <Toon color="#8FC3E8" />
              </mesh>
              <mesh position={[0, 0.01, 0.055]} rotation={[Math.PI / 2, 0, 0]}>
                <coneGeometry args={[0.015, 0.04, 4]} />
                <Toon color="#F2B238" />
              </mesh>
            </group>
          ))}
        </group>
      )}
    </group>
  );
}

const useLanterns = create<{ pulled: string[]; set: (p: string[]) => void }>((set) => ({ pulled: [], set: (pulled) => set({ pulled }) }));
const toast = (icon: string, text: string) => emit({ type: 'toast', icon, text });

/** One guardian lantern: its carving, its flame, and lighting it. */
function GuardianLantern({ piece }: { piece: string }) {
  const [x, z] = GUARDIAN_LANTERNS[piece];
  const look = GUARDIAN_LOOK[piece];
  const solved = useGameStore((s) => !!s.progress.flags.lanternas_acesas);
  const lit = useLanterns((s) => s.pulled.includes(piece)) || solved;
  const flame = useRef<THREE.Mesh>(null);
  const plate = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = '#3A3340';
    g.fillRect(0, 0, 128, 128);
    g.font = '84px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(look.icon, 64, 70);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [look.icon]);
  useFrame(({ clock }) => {
    if (flame.current) flame.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 11 + x) * 0.12);
  });

  const light = () => {
    const p = useGameStore.getState().progress;
    if (p.flags.lanternas_acesas) return;
    if (!p.missions.lanternas_guardias?.steps.includes('rolo')) {
      toast('🏮', `Uma lanterna de pedra com um(a) ${look.name.toLowerCase()} gravado(a). Dizem que o Arquivista Bunko sabe a ordem de acendê-las.`);
      return;
    }
    const r = press(LANTERN_PUZZLE, useLanterns.getState().pulled, piece);
    if (r.result === 'repeat') return;
    if (r.result === 'progress') {
      emit({ type: 'sfx', name: 'chime' });
      useLanterns.getState().set(r.pulled);
      return;
    }
    if (r.result === 'wrong') {
      const broke = brokenRule(LANTERN_PUZZLE, r.attempt);
      emit({ type: 'sfx', name: 'challenge_wrong' });
      useGameStore.getState().recordPractice('logica', false);
      useLanterns.getState().set([]);
      toast('💨', `As quatro chamas tremeram e apagaram. Este verso não bateu: "${broke?.text ?? ''}"`);
      return;
    }
    useLanterns.getState().set(r.pulled);
    useGameStore.getState().runActions(LANTERNS_LIT);
    toast('🌊', 'As quatro lanternas brilham juntas... e lá embaixo, atrás da cascata, uma pedra se arrasta!');
  };

  useSpot(`lanterna_${piece}`, [x, H, z], 1.1, () => {
    if (useGameStore.getState().progress.flags.lanternas_acesas || useLanterns.getState().pulled.includes(piece)) return null;
    return `Acender a lanterna do ${look.name.toLowerCase()}`;
  }, light, 1.7);

  return (
    <group userData={{ dynamic: true }}>
      <StoneLantern position={[x, H, z]} lit={lit} />
      <mesh position={[x, H + 0.42, z + 0.24]}>
        <planeGeometry args={[0.28, 0.28]} />
        <meshBasicMaterial map={plate} />
      </mesh>
      {lit && (
        <mesh ref={flame} position={[x, H + 1.08, z]}>
          <sphereGeometry args={[0.12, 8, 6]} />
          <meshBasicMaterial color="#FFB347" />
        </mesh>
      )}
    </group>
  );
}

/** The slab that shuts the niche behind the waterfall: it sinks once the lanterns are lit. */
function NicheSlab() {
  const open = useGameStore((s) => !!s.progress.flags.lanternas_acesas);
  const slab = useRef<THREE.Mesh>(null);
  useFrame((_s, d) => {
    if (!slab.current) return;
    const want = open ? -NICHE.h + 0.06 : 0;
    slab.current.position.y += (NICHE.h / 2 + want - slab.current.position.y) * Math.min(1, d * 1.5);
  });
  return (
    <group userData={{ dynamic: true }}>
      {!open && (
        <RigidBody type="fixed" colliders={false} userData={STONE_DATA}>
          <CuboidCollider args={[NICHE.w / 2, NICHE.h / 2, 0.12]} position={[NICHE.x, NICHE.h / 2, TERRACE.z1 - 0.15]} />
        </RigidBody>
      )}
      <mesh ref={slab} position={[NICHE.x, NICHE.h / 2, TERRACE.z1 - 0.15]} castShadow>
        <boxGeometry args={[NICHE.w, NICHE.h, 0.22]} />
        <Toon color="#9C958A" tex="stone" />
        <Ink thickness={0.015} />
      </mesh>
      {open && <Sparkles count={10} scale={[1.2, 1, 1]} position={[NICHE.x, 0.7, TERRACE.z1 - 0.6]} size={3} speed={0.3} color="#FFE7A0" opacity={0.8} />}
    </group>
  );
}

/** The kitten's jade paws, while she is looking for them. */
function JadePaws() {
  const active = useGameStore((s) => s.progress.missions.patas_de_jade?.status === 'active');
  const flags = useGameStore((s) => s.progress.flags);
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    group.current?.children.forEach((g, i) => {
      g.rotation.y = clock.elapsedTime * 1.2 + i;
    });
  });
  if (!active) return null;
  return (
    <group ref={group} userData={{ dynamic: true }}>
      {JADE_PAWS.filter((j) => !flags[j.id]).map((j) => (
        <group key={j.id} position={[j.at[0], j.at[1] + 0.3, j.at[2]]}>
          <group rotation={[-0.4, 0, 0]}>
            <PawEmblem scale={0.9} color="#5FC48C" />
          </group>
          <mesh position={[0, -0.25, 0]}>
            <sphereGeometry args={[0.06, 6, 5]} />
            <meshBasicMaterial color="#9FF0C4" transparent opacity={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function PrecinctLife() {
  return (
    <group>
      <Water />
      <TempleKoi />
      <BellAndNest />
      {GUARDIANS.map((g) => <GuardianLantern key={g} piece={g} />)}
      <NicheSlab />
      <JadePaws />
      {/* petals drifting from the cherries and fireflies over the pond */}
      <group userData={{ dynamic: true }}>
        <Sparkles count={26} scale={[18, 4, 7]} position={[30.6, 2.4, -17.6]} size={4} speed={0.25} color="#F7B6CB" opacity={0.85} />
        <Sparkles count={16} scale={[14, 3, 9]} position={[30.6, H + 1.8, -29]} size={3.5} speed={0.2} color="#F7B6CB" opacity={0.8} />
        <Sparkles count={12} scale={[7, 1.6, 5]} position={[TEMPLE_POND.x, 0.9, TEMPLE_POND.z]} size={2.2} speed={0.35} color="#FFF3A0" opacity={0.9} />
      </group>
    </group>
  );
}
