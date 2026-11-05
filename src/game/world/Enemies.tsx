import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useRapier } from '@react-three/rapier';
import * as THREE from 'three';
import { getGradient, Ink, Toon } from '../materials';
import {
  ENEMIES, calmEnemy, enemyStep, hearNoise, hitEnemy, isActive, makeEnemy, pawTargets, rallyAllies, resetEnemy, stepPinecones, throwPinecone,
  type CombatCat, type CombatEnv, type Enemy, type EnemyKind, type HitResult, type Pinecone,
} from '../../systems/combat';
import { ENEMY_SPAWNS, WILD, WILD_CODE_ACTIONS, inWall, inWildRiver, toLocal, w, type EnemySpawn } from '../../data/wild';
import { WILD2_SPAWNS, WILD2_CODE_ACTIONS } from '../../data/wild2';
import { checkCondition } from '../../systems/progression';
import { useGameStore } from '../../store/gameStore';
import { useUiSettings } from '../../store/uiSettings';
import { emit } from '../../systems/events';
import { abilityState, now, playerMotion, playerPosition } from '../systems/playerState';
import { combatWorld, hurtPlayer, useHearts } from '../systems/hearts';
import { useZone } from '../systems/zone';
import { registerTarget } from '../systems/shuriken';
import { spawnParticles } from '../systems/particles';
import { spawnRing } from '../systems/vfx';
import { useSpot, useIconTexture } from '../systems/training';
import { interactFallback } from '../systems/interaction';
import { press } from '../systems/input';
import { assetFileExists } from '../assets/catalog';
import { EnemyModel, clipFor, enemyAsset, pickClip, playClip, type EnemyRig } from './EnemyModel';

/**
 * The creatures of the wild lands (Etapa 7 da expansão). Their minds are systems/combat.ts (unit-tested); this
 * feeds them the cat and the world (ray casts against the fixed colliders), turns what they do into hits,
 * pinecones and sounds, and draws them: rigged Blender models with their own clips (EnemyModel.tsx; the toon
 * shapes below are drawn while a model loads, or if its file is missing), with a mark over the head for what
 * they are thinking (! seen you, ? heard something, 💫 dizzy, 💤 asleep), a red glow while they wind up
 * (the moment to get out of the way) and a puff of smoke when they give up and run home.
 *
 * They come back, healed, every time the cat enters the region (the boar only until it is calmed or beaten,
 * which is saved). After a faint they all walk back home.
 */

const toast = (icon: string, text: string) => emit({ type: 'toast', icon, text });
const run = (a: string) => useGameStore.getState().runActions(a);
const inZone = () => useZone.getState().zone === 'selvagem';

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

/** Creatures farther than this from the camera are not drawn (the fog starts at 42 m). */
const DRAW_FAR = 45;

/** Where the calmed boar lies, out of the way (2 m to the side of its post). */
export const BOAR_ASIDE = 2.0;

/** Every creature of the region: the first ones (data/wild.ts) and the Espinho band's (data/wild2.ts). */
const ALL_SPAWNS: EnemySpawn[] = [...ENEMY_SPAWNS, ...WILD2_SPAWNS];
/** Drawn standing on a lookout (the fight itself is on the ground plane). */
const ELEVATION: Record<string, number> = Object.fromEntries(ALL_SPAWNS.filter((s) => s.y).map((s) => [s.id, s.y!]));
const toWorldPoint = ([x, z]: [number, number]) => {
  const p = w(x, z);
  return { x: p[0], z: p[2] };
};

function spawnAll(): Enemy[] {
  const progress = useGameStore.getState().progress;
  const list = ALL_SPAWNS.filter((s) => checkCondition(s.when, progress)).map((s) => {
    const [x, , z] = w(s.at[0], s.at[1]);
    return makeEnemy(s.id, s.kind, x, z, s.r, s.heading ?? 0, { route: s.route?.map(toWorldPoint), rest: s.rest, post: s.post });
  });
  // the calmed boar stays, asleep and happy by the canyon wall (beaten, it has moved away for good)
  if (progress.flags.javali_calmo && !progress.flags.javali_vencido) {
    const s = ENEMY_SPAWNS.find((x) => x.kind === 'javali')!;
    const [x, , z] = w(s.at[0] + BOAR_ASIDE, s.at[1]);
    const boar = makeEnemy(s.id, 'javali', x, z, 0, s.heading ?? 0);
    calmEnemy(boar);
    list.push(boar);
  }
  return list;
}

// ── Looks ─────────────────────────────────────────────────────────────────────

/** One material per creature, so the hit flash and the windup glow are its own. */
function useSkin(color: string) {
  return useMemo(() => new THREE.MeshToonMaterial({ color, gradientMap: getGradient() }), [color]);
}

function Hedgehog({ skin }: { skin: THREE.Material }) {
  return (
    <group>
      <mesh position={[0, 0.3, 0]} scale={[1, 0.8, 1.15]} material={skin} castShadow>
        <sphereGeometry args={[0.36, 12, 10]} />
      </mesh>
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i % 8) / 8 * Math.PI * 2;
        const ring = i < 8 ? 0 : 1;
        return (
          <mesh key={i} position={[Math.cos(a) * (0.28 - ring * 0.08), 0.42 + ring * 0.14, -0.05 + Math.sin(a) * (0.3 - ring * 0.08) - 0.06]} rotation={[-Math.sin(a) * 0.9 - 0.5, 0, Math.cos(a) * 0.9]}>
            <coneGeometry args={[0.06, 0.3, 5]} />
            <Toon color="#5A4434" />
          </mesh>
        );
      })}
      {/* the face, the bandit mask and the little nose */}
      <mesh position={[0, 0.3, 0.33]} scale={[1, 0.9, 0.8]}>
        <sphereGeometry args={[0.17, 10, 8]} />
        <Toon color="#E8D2B0" />
      </mesh>
      <mesh position={[0, 0.36, 0.42]}>
        <boxGeometry args={[0.3, 0.07, 0.04]} />
        <Toon color="#8C2E2E" />
      </mesh>
      {[-0.07, 0.07].map((x) => (
        <mesh key={x} position={[x, 0.36, 0.445]}>
          <sphereGeometry args={[0.025, 6, 5]} />
          <meshBasicMaterial color="#1E1A1A" />
        </mesh>
      ))}
      <mesh position={[0, 0.27, 0.5]}>
        <sphereGeometry args={[0.035, 6, 5]} />
        <meshBasicMaterial color="#2A1E1E" />
      </mesh>
    </group>
  );
}

function Fox({ skin }: { skin: THREE.Material }) {
  return (
    <group>
      <mesh position={[0, 0.45, 0]} rotation={[Math.PI / 2, 0, 0]} material={skin} castShadow>
        <capsuleGeometry args={[0.18, 0.4, 4, 10]} />
      </mesh>
      <mesh position={[0, 0.72, 0.3]} material={skin} castShadow>
        <sphereGeometry args={[0.2, 12, 10]} />
      </mesh>
      <mesh position={[0, 0.68, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.09, 0.2, 8]} />
        <Toon color="#F4EAD8" />
      </mesh>
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} position={[x, 0.93, 0.27]} rotation={[0, 0, -x * 2]}>
          <coneGeometry args={[0.07, 0.18, 4]} />
          <Toon color="#C8602A" />
        </mesh>
      ))}
      {/* ninja mask band and eyes */}
      <mesh position={[0, 0.76, 0.42]}>
        <boxGeometry args={[0.36, 0.08, 0.1]} />
        <Toon color="#2E2A36" />
      </mesh>
      {[-0.07, 0.07].map((x) => (
        <mesh key={x} position={[x, 0.77, 0.475]}>
          <sphereGeometry args={[0.025, 6, 5]} />
          <meshBasicMaterial color="#F2E27A" />
        </mesh>
      ))}
      {[[-0.12, 0.15], [0.12, 0.15], [-0.12, -0.15], [0.12, -0.15]].map(([x, z], i) => (
        // legs hang from the hip so they swing (Enemies' frame loop moves the ones tagged `leg`)
        <group key={`${x}${z}`} position={[x, 0.3, z]} userData={LEG[TROT[i]]}>
          <mesh position={[0, -0.15, 0]}>
            <cylinderGeometry args={[0.04, 0.035, 0.3, 6]} />
            <Toon color="#3A2A22" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.55, -0.42]} rotation={[0.9, 0, 0]}>
        <capsuleGeometry args={[0.1, 0.3, 4, 8]} />
        <Toon color="#D9733A" />
      </mesh>
      <mesh position={[0, 0.72, -0.62]}>
        <sphereGeometry args={[0.1, 8, 6]} />
        <Toon color="#F4EAD8" />
      </mesh>
    </group>
  );
}

function Spirit({ skin }: { skin: THREE.Material }) {
  return (
    <group>
      <mesh position={[0, 0.9, 0]} scale={[1, 1.2, 1]} material={skin}>
        <sphereGeometry args={[0.38, 14, 12]} />
      </mesh>
      <mesh position={[0, 0.45, 0]} material={skin}>
        <coneGeometry args={[0.34, 0.6, 12, 1, true]} />
      </mesh>
      {[-0.12, 0.12].map((x) => (
        <mesh key={x} position={[x, 0.98, 0.33]}>
          <sphereGeometry args={[0.06, 8, 6]} />
          <meshBasicMaterial color="#1E2A3A" transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function Boar({ skin }: { skin: THREE.Material }) {
  return (
    <group>
      <mesh position={[0, 0.65, 0]} scale={[1, 0.85, 1.4]} material={skin} castShadow>
        <sphereGeometry args={[0.65, 14, 12]} />
      </mesh>
      {/* rocky plates on the back */}
      {[[-0.25, 1.1, -0.2], [0.2, 1.12, 0.1], [0, 1.15, -0.5], [0.1, 1.05, 0.45]].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[i, i * 0.7, 0]}>
          <dodecahedronGeometry args={[0.2, 0]} />
          <Toon color="#7E776C" tex="stone" />
        </mesh>
      ))}
      <mesh position={[0, 0.6, 0.85]} material={skin}>
        <sphereGeometry args={[0.36, 12, 10]} />
      </mesh>
      <mesh position={[0, 0.52, 1.18]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.14, 0.16, 0.14, 10]} />
        <Toon color="#C99A8A" />
      </mesh>
      {[-0.17, 0.17].map((x) => (
        <mesh key={x} position={[x, 0.45, 1.12]} rotation={[0.4, 0, x * 2]}>
          <coneGeometry args={[0.04, 0.24, 6]} />
          <Toon color="#F4EAD8" />
        </mesh>
      ))}
      {[-0.15, 0.15].map((x) => (
        <mesh key={`e${x}`} position={[x, 0.74, 1.12]}>
          <sphereGeometry args={[0.035, 6, 5]} />
          <meshBasicMaterial color="#1E1A1A" />
        </mesh>
      ))}
      {[[-0.32, 0.4], [0.32, 0.4], [-0.32, -0.45], [0.32, -0.45]].map(([x, z], i) => (
        <group key={`${x}${z}`} position={[x, 0.36, z]} userData={LEG[TROT[i]]}>
          <mesh position={[0, -0.18, 0]}>
            <cylinderGeometry args={[0.1, 0.09, 0.36, 7]} />
            <Toon color="#4A3E36" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** The badger guard: stocky, black and white face, a little helmet and a round wooden shield held in front. */
function Badger({ skin }: { skin: THREE.Material }) {
  return (
    <group>
      <mesh position={[0, 0.5, 0]} scale={[1.15, 0.85, 1.3]} material={skin} castShadow>
        <sphereGeometry args={[0.42, 14, 12]} />
      </mesh>
      <mesh position={[0, 0.62, 0.5]} scale={[1, 0.9, 1.1]} castShadow>
        <sphereGeometry args={[0.25, 12, 10]} />
        <Toon color="#F2EFE8" />
      </mesh>
      {[-0.11, 0.11].map((x) => (
        <mesh key={x} position={[x, 0.66, 0.6]} scale={[0.35, 1, 1]}>
          <sphereGeometry args={[0.17, 8, 6]} />
          <Toon color="#2A2A30" />
        </mesh>
      ))}
      {[-0.08, 0.08].map((x) => (
        <mesh key={`e${x}`} position={[x, 0.68, 0.74]}>
          <sphereGeometry args={[0.025, 6, 5]} />
          <meshBasicMaterial color="#F2E27A" />
        </mesh>
      ))}
      <mesh position={[0, 0.58, 0.76]}>
        <sphereGeometry args={[0.04, 6, 5]} />
        <meshBasicMaterial color="#1E1A1A" />
      </mesh>
      {/* helmet */}
      <mesh position={[0, 0.82, 0.45]} scale={[1, 0.6, 1]}>
        <sphereGeometry args={[0.24, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Toon color="#7A6A4E" />
        <Ink thickness={0.01} />
      </mesh>
      {/* the shield */}
      <group position={[0.22, 0.5, 0.62]} rotation={[0, 0.25, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.06, 16]} />
          <Toon color="#8C5A36" tex="planks" />
          <Ink thickness={0.012} />
        </mesh>
        <mesh position={[0, 0, 0.035]}>
          <circleGeometry args={[0.1, 12]} />
          <Toon color="#B8A07A" />
        </mesh>
      </group>
      {[[-0.28, 0.32], [0.28, 0.32], [-0.28, -0.35], [0.28, -0.35]].map(([x, z], i) => (
        <group key={`${x}${z}`} position={[x, 0.28, z]} userData={LEG[TROT[i]]}>
          <mesh position={[0, -0.14, 0]}>
            <cylinderGeometry args={[0.08, 0.07, 0.28, 7]} />
            <Toon color="#2A2A30" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** The ninja weasel: long and low, a black mask and a red scarf flying behind. */
function Weasel({ skin }: { skin: THREE.Material }) {
  return (
    <group>
      <mesh position={[0, 0.34, 0]} rotation={[Math.PI / 2, 0, 0]} material={skin} castShadow>
        <capsuleGeometry args={[0.13, 0.62, 4, 10]} />
      </mesh>
      <mesh position={[0, 0.3, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.1, 0.4, 4, 8]} />
        <Toon color="#F2E2C2" />
      </mesh>
      <mesh position={[0, 0.48, 0.5]} material={skin} castShadow>
        <sphereGeometry args={[0.15, 12, 10]} />
      </mesh>
      <mesh position={[0, 0.5, 0.6]}>
        <boxGeometry args={[0.3, 0.06, 0.12]} />
        <Toon color="#1E1A22" />
      </mesh>
      {[-0.06, 0.06].map((x) => (
        <mesh key={x} position={[x, 0.51, 0.665]}>
          <sphereGeometry args={[0.022, 6, 5]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
      ))}
      {[-0.08, 0.08].map((x) => (
        <mesh key={`o${x}`} position={[x, 0.62, 0.46]}>
          <sphereGeometry args={[0.045, 8, 6]} />
          <Toon color="#7A4E2E" />
        </mesh>
      ))}
      {/* the red scarf, and its two tails */}
      <mesh position={[0, 0.42, 0.38]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.12, 0.035, 6, 14]} />
        <Toon color="#C8302C" />
      </mesh>
      {[-0.05, 0.05].map((x, i) => (
        <mesh key={`s${x}`} position={[x, 0.46, 0.08]} rotation={[0.25 + i * 0.15, 0, 0]}>
          <boxGeometry args={[0.06, 0.02, 0.5]} />
          <Toon color="#C8302C" />
        </mesh>
      ))}
      <mesh position={[0, 0.36, -0.52]} rotation={[1.2, 0, 0]}>
        <capsuleGeometry args={[0.06, 0.34, 4, 6]} />
        <Toon color="#5E3A22" />
      </mesh>
      {[[-0.09, 0.22], [0.09, 0.22], [-0.09, -0.24], [0.09, -0.24]].map(([x, z], i) => (
        <group key={`${x}${z}`} position={[x, 0.2, z]} userData={LEG[TROT[i]]}>
          <mesh position={[0, -0.1, 0]}>
            <cylinderGeometry args={[0.035, 0.03, 0.2, 6]} />
            <Toon color="#5E3A22" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** The fox archer: a grey fox with a bow and a quiver of pinecones. */
function FoxArcher({ skin }: { skin: THREE.Material }) {
  return (
    <group>
      <Fox skin={skin} />
      <group position={[0.24, 0.6, 0.25]}>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.3, 0.02, 5, 16, Math.PI * 1.1]} />
          <Toon color="#7A5236" />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.006, 0.006, 0.6, 4]} />
          <Toon color="#EDE6D6" />
        </mesh>
      </group>
      <mesh position={[-0.12, 0.62, -0.18]} rotation={[0.35, 0, 0.2]}>
        <cylinderGeometry args={[0.07, 0.06, 0.38, 8]} />
        <Toon color="#5A3B28" />
      </mesh>
      <mesh position={[-0.14, 0.86, -0.25]}>
        <coneGeometry args={[0.06, 0.12, 7]} />
        <Toon color="#7A5236" />
      </mesh>
    </group>
  );
}

/** The Chefe Espinho: a big hedgehog with golden-tipped spines, a red cape and a crown of spines. */
function Chief({ skin }: { skin: THREE.Material }) {
  return (
    <group>
      <group scale={1.6}>
        <Hedgehog skin={skin} />
      </group>
      <mesh position={[0, 0.72, -0.25]} rotation={[0.35, 0, 0]}>
        <coneGeometry args={[0.62, 0.9, 10, 1, true]} />
        <Toon color="#8C2E2E" side={THREE.DoubleSide} />
      </mesh>
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={i} position={[(i - 2) * 0.1, 1.08, 0.36 - Math.abs(i - 2) * 0.04]}>
          <coneGeometry args={[0.04, 0.2, 5]} />
          <Toon color="#D9A520" emissive="#D9A520" emissiveIntensity={0.2} />
        </mesh>
      ))}
    </group>
  );
}

/** Leg tags: the two diagonals swing in opposite phase (constants: inline userData objects reset on render). */
const LEG = [{ leg: 1 }, { leg: -1 }];
/** Legs listed front-left, front-right, back-left, back-right: a trot moves the diagonals together. */
const TROT = [0, 1, 1, 0];

const LOOK: Record<EnemyKind, { color: string }> = {
  ourico: { color: '#8C6A4E' },
  raposa: { color: '#D9733A' },
  espirito: { color: '#CFE6F5' },
  javali: { color: '#7A6656' },
  texugo: { color: '#6E6A70' },
  doninha: { color: '#9A6238' },
  arqueira: { color: '#9AA0A8' },
  chefe: { color: '#5E4434' },
};
/** Height of the health bar over each kind, and where the mark sits over its head. */
const TOP: Record<EnemyKind, number> = { ourico: 1.0, raposa: 1.3, espirito: 1.7, javali: 1.7, texugo: 1.25, doninha: 0.95, arqueira: 1.3, chefe: 1.75 };

/** The marks over the head. */
type Mark = 'alert' | 'search' | 'dizzy' | 'sleep' | 'calm' | null;
function markOf(e: Enemy): Mark {
  if (e.mode === 'sleep') return 'sleep';
  if (e.mode === 'calm') return 'calm';
  if (e.mode === 'stunned' && e.timer > 0.45) return 'dizzy';
  if (e.mode === 'alert' || e.mode === 'chase' || e.mode === 'windup' || e.mode === 'attack') return 'alert';
  if (e.mode === 'distracted') return 'search';
  return null;
}

function Creature({ e, register }: { e: Enemy; register: (id: string, g: CreatureRefs) => void }) {
  const look = LOOK[e.kind];
  const skin = useSkin(look.color);
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const marks = useRef<THREE.Group>(null);
  const bar = useRef<THREE.Mesh>(null);
  const tex = {
    alert: useIconTexture('❗', '#FFF3D9', '#C0392B'),
    search: useIconTexture('❓', '#FFF3D9', '#2E5A8C'),
    dizzy: useIconTexture('💫', '#FFF3D9'),
    sleep: useIconTexture('💤', '#FFF3D9'),
    calm: useIconTexture('💗', '#FFF3D9'),
  };
  useEffect(() => {
    if (e.kind === 'espirito') {
      skin.transparent = true;
      skin.depthWrite = false;
    }
  }, [e.kind, skin]);
  // the model's mixer and materials, once it has loaded (read by the frame loop through the box)
  const rigBox = useRef<EnemyRig | null>(null);
  useEffect(() => {
    if (root.current && body.current && marks.current && bar.current) register(e.id, { root: root.current, body: body.current, marks: marks.current, bar: bar.current, skin, rig: rigBox });
  }, [e.id, register, skin]);
  const top = TOP[e.kind];
  const shapes = (
    <>
      {e.kind === 'ourico' && <Hedgehog skin={skin} />}
      {e.kind === 'raposa' && <Fox skin={skin} />}
      {e.kind === 'espirito' && <Spirit skin={skin} />}
      {e.kind === 'javali' && <Boar skin={skin} />}
      {e.kind === 'texugo' && <Badger skin={skin} />}
      {e.kind === 'doninha' && <Weasel skin={skin} />}
      {e.kind === 'arqueira' && <FoxArcher skin={skin} />}
      {e.kind === 'chefe' && <Chief skin={skin} />}
    </>
  );
  const onRig = useCallback((r: EnemyRig) => {
    rigBox.current = r;
  }, []);
  return (
    <group ref={root} userData={{ dynamic: true }}>
      <group ref={body}>
        {assetFileExists(enemyAsset(e.kind)) ? (
          <Suspense fallback={shapes}>
            <EnemyModel kind={e.kind} onReady={onRig} />
          </Suspense>
        ) : shapes}
      </group>
      <group ref={marks} position={[0, top + 0.25, 0]}>
        {(Object.keys(tex) as (keyof typeof tex)[]).map((k) => (
          <sprite key={k} name={k} scale={[0.42, 0.42, 1]} visible={false}>
            <spriteMaterial map={tex[k]} transparent depthTest={false} />
          </sprite>
        ))}
      </group>
      <mesh ref={bar} position={[0, top, 0]} visible={false}>
        <planeGeometry args={[0.6, 0.07]} />
        <meshBasicMaterial color="#E84A3A" depthTest={false} transparent />
      </mesh>
    </group>
  );
}

interface CreatureRefs { root: THREE.Group; body: THREE.Group; marks: THREE.Group; bar: THREE.Mesh; skin: THREE.MeshToonMaterial; rig: { current: EnemyRig | null }; legs?: THREE.Object3D[]; last?: { x: number; z: number }; flashWas?: number }

// ── The fight ─────────────────────────────────────────────────────────────────

const RESULT_TIPS: Partial<Record<HitResult, (e: Enemy) => string>> = {
  blocked: (e) => e.kind === 'javali'
    ? 'A pele de pedra do javali aguenta tudo... espere ele bater nas pedras e ficar tonto!'
    : e.kind === 'texugo'
      ? 'Toc! O escudo do texugo segura tudo. Deixe ele investir e errar: tonto (💫), ele baixa o escudo.'
      : e.kind === 'chefe'
        ? 'Os espinhos do Chefe estão em pé! Espere a investida dele errar (💫). Contra uma barraca ou pedra, ele fica tonto mais tempo.'
        : 'Ai! Espinhos em pé. Espere o ouriço investir e ficar tonto (💫), aí sim.',
  unseen: () => 'O golpe atravessou a névoa. Ligue o Faro (Q) para ver o espírito de verdade.',
};

export function Enemies() {
  const active = useZone((s) => s.zone === 'selvagem');
  const { world, rapier } = useRapier();
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const refs = useRef(new Map<string, CreatureRefs>());
  const register = useMemo(() => (id: string, g: CreatureRefs) => refs.current.set(id, g), []);
  useEffect(() => {
    // dev: which clip each creature is playing (__enemyRigs.get('raposa_pedras').rig.current.clip)
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__enemyRigs = refs.current;
  }, []);
  const cones = useRef<THREE.Group>(null);
  const seen = useRef({ swipe: -1, noise: -1, tips: new Set<string>() });
  /** How high each pinecone in flight was thrown from (an archer on a lookout). */
  const coneFrom = useRef(new Map<Pinecone, number>());
  const rng = useMemo(() => seeded(4242), []);

  const env = useMemo<CombatEnv>(() => {
    const flags = rapier.QueryFilterFlags.ONLY_FIXED | rapier.QueryFilterFlags.EXCLUDE_SENSORS;
    const ray = new rapier.Ray({ x: 0, y: 0.45, z: 0 }, { x: 1, y: 0, z: 0 });
    return {
      ground(x, z) {
        const l = toLocal(x, z);
        if (l.x < WILD.minX || l.x > WILD.maxX || l.z < WILD.minZ || l.z > WILD.maxZ) return false;
        return !inWall(l.x, l.z, 0.3) && !inWildRiver(l.x, l.z, false);
      },
      free(ax, az, bx, bz) {
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 1e-4) return true;
        ray.origin = { x: ax, y: 0.45, z: az };
        ray.dir = { x: (bx - ax) / len, y: 0, z: (bz - az) / len };
        return !world.castRay(ray, len, true, flags);
      },
    };
  }, [world, rapier]);

  // a visit: everybody back, healed; leaving: nobody left behind
  useEffect(() => {
    const list = active ? spawnAll() : [];
    combatWorld.enemies = list;
    combatWorld.pinecones.forEach((p) => (p.alive = false));
    refs.current.clear();
    setEnemies(list);
  }, [active]);
  // the story moves on during a visit (Hissui sends his guards away; the pact): the creatures whose spawn
  // condition no longer holds leave now, not at the next visit. Calmed or beaten ones stay to finish their scene.
  useEffect(() => useGameStore.subscribe((s, prev) => {
    if (s.progress === prev.progress || combatWorld.enemies.length === 0) return;
    const stay = combatWorld.enemies.filter((e) => {
      const spawn = ALL_SPAWNS.find((x) => x.id === e.id);
      return !isActive(e) || !spawn || checkCondition(spawn.when, s.progress);
    });
    if (stay.length === combatWorld.enemies.length) return;
    combatWorld.enemies = stay;
    setEnemies(stay);
  }), []);
  // after a faint, they walk back to their posts (the beaten ones stay beaten until the next visit)
  useEffect(() => useHearts.subscribe((s, prev) => {
    if (s.fainted && !prev.fainted) combatWorld.enemies.forEach((e) => resetEnemy(e, true));
  }), []);
  // the interact button with nothing in reach swipes, here
  useEffect(() => {
    interactFallback.current = active ? () => press('attack') : null;
    return () => {
      interactFallback.current = null;
    };
  }, [active]);

  // shurikens hit them too (and the aim assist picks them)
  useEffect(() => {
    if (!active) return;
    const offs = enemies.map((e) => {
      const position = new THREE.Vector3(e.x, 0.5, e.z);
      return registerTarget({
        id: `bicho_${e.id}`,
        get position() {
          position.set(e.x, (e.kind === 'espirito' ? 0.9 : e.kind === 'javali' || e.kind === 'chefe' ? 0.7 : 0.45) + (ELEVATION[e.id] ?? 0), e.z);
          return isActive(e) ? position : position.set(e.x, -50, e.z);
        },
        radius: e.kind === 'javali' || e.kind === 'chefe' ? 0.9 : 0.55,
        onHit: () => strike(e, 'shuriken'),
      });
    });
    return () => offs.forEach((off) => off());
  }, [active, enemies]); // eslint-disable-line react-hooks/exhaustive-deps

  function catNow(): CombatCat {
    const phase = useGameStore.getState().phase;
    return {
      x: playerPosition.x, z: playerPosition.z, crouch: playerMotion.crouch, speed: playerMotion.speed,
      faro: abilityState.faroUntil > now(), active: phase === 'playing' && !useHearts.getState().fainted,
    };
  }

  function strike(e: Enemy, by: 'paw' | 'shuriken') {
    const r = hitEnemy(e, 1, catNow(), env);
    if (r === 'hit' || r === 'defeated') {
      emit({ type: 'sfx', name: by === 'paw' ? 'kick' : 'target_hit' });
      spawnParticles('sparkle', [e.x, 0.6, e.z], 8, '#FFFFFF');
      // the impact mark: a quick ring where the blow landed (Etapa 9)
      spawnRing([e.x, 0.55, e.z], { color: '#FFF3C4', size: 0.9, life: 0.25 });
    } else if (r === 'blocked') spawnRing([e.x, 0.55, e.z], { color: '#9AA4B0', size: 0.6, life: 0.2 });
    if (r === 'defeated') defeated(e);
    const tip = RESULT_TIPS[r];
    if (tip && !seen.current.tips.has(`${r}${e.kind}`)) {
      seen.current.tips.add(`${r}${e.kind}`);
      emit({ type: 'sfx', name: 'denied' });
      toast(e.kind === 'espirito' ? '🌫️' : '🦔', tip(e));
    }
  }

  function defeated(e: Enemy) {
    const spec = ENEMIES[e.kind];
    emit({ type: 'sfx', name: 'poof' });
    spawnParticles('smoke', [e.x, 0.5, e.z], 14);
    if (e.kind === 'javali') {
      run(WILD_CODE_ACTIONS.javali_vencido);
      toast('🐗', 'O Javali Rochoso bufou, sacudiu a poeira e foi dormir em outro lugar. O desfiladeiro está livre!');
      return;
    }
    if (e.kind === 'chefe') {
      run(`COINS:${spec.reward.coins};${WILD2_CODE_ACTIONS.chefe}`);
      toast('🦔', `O Chefe Espinho largou a coroa, gritou "isso não acabou!"... e fugiu com o bando todo. +${spec.reward.coins} moedas`);
      return;
    }
    run(`COINS:${spec.reward.coins};${WILD_CODE_ACTIONS.bicho}${spec.reward.item ? `;GIVE:${spec.reward.item}` : ''}`);
    toast('💨', `${spec.name} desistiu e fugiu para casa! +${spec.reward.coins} moedas`);
  }

  // the boar takes a tuna treat (no fight at all)
  const boarHome = useMemo(() => {
    const s = ENEMY_SPAWNS.find((x) => x.kind === 'javali')!;
    return w(s.at[0], s.at[1]);
  }, []);
  useSpot('javali_petisco', boarHome, 3.0, () => {
    if (!inZone()) return null;
    const boar = combatWorld.enemies.find((e) => e.kind === 'javali');
    if (!boar || !isActive(boar) || (boar.mode !== 'sleep' && boar.mode !== 'alert')) return null;
    return (useGameStore.getState().progress.inventory.petisco_atum ?? 0) > 0 ? 'Oferecer um Petisco de Atum ao javali' : null;
  }, () => {
    const boar = combatWorld.enemies.find((e) => e.kind === 'javali');
    if (!boar || !calmEnemy(boar)) return;
    run(WILD_CODE_ACTIONS.javali_calmo);
    // it ambles to the side of the canyon and lies down, happy
    boar.x += BOAR_ASIDE;
    spawnParticles('sparkle', [boar.x, 1.2, boar.z], 12, '#FF9FC2');
    toast('🐗', 'Nhac! O javali mastiga o atum de olhos fechados, se arrasta para o canto e volta a roncar. Caminho livre!');
  }, 1.8);

  useFrame(({ clock, camera }, raw) => {
    const dt = Math.min(raw, 0.05);
    const list = combatWorld.enemies;
    if (!active || list.length === 0) return;
    const playing = useGameStore.getState().phase === 'playing';
    const cat = catNow();
    const level = useUiSettings.getState().combatLevel;

    if (playing) {
      // a noise (a shuriken in the rocks): the ones nearby go and look
      const noise = combatWorld.noise;
      if (noise && noise.time > seen.current.noise) {
        seen.current.noise = noise.time;
        for (const e of list) hearNoise(e, noise.x, noise.z);
      }
      // the paw swipe
      const swipe = abilityState.lastSwipe;
      if (swipe.time > seen.current.swipe) {
        seen.current.swipe = swipe.time;
        for (const e of pawTargets({ x: playerPosition.x, z: playerPosition.z, heading: swipe.heading }, list)) strike(e, 'paw');
      }
      for (const e of list) {
        for (const ev of enemyStep(e, dt, cat, env, rng, level)) {
          if (ev.type === 'hitCat') hurtPlayer(ev.damage, ev.fromX, ev.fromZ);
          else if (ev.type === 'throw') {
            coneFrom.current.set(throwPinecone(combatWorld.pinecones, ev.x, ev.z, ev.dx, ev.dz), ELEVATION[e.id] ?? 0);
            emit({ type: 'sfx', name: 'shuriken' });
          } else if (ev.type === 'bonk') {
            emit({ type: 'sfx', name: 'thwack' });
            spawnParticles('dust', [e.x, 0.4, e.z], 8);
          } else if (ev.type === 'wake') {
            emit({ type: 'sfx', name: 'voice_grunt' });
            if (e.kind === 'javali') toast('🐗', 'O Javali Rochoso acordou! Saia da frente da investida... ou fuja para longe dele.');
          } else if (ev.type === 'alert' && e.kind !== 'espirito') {
            emit({ type: 'sfx', name: 'voice_chitter' });
            // the alarm: the band close by comes to look (working together)
            if (rallyAllies(e, list, cat.x, cat.z) > 0 && !seen.current.tips.has('rally')) {
              seen.current.tips.add('rally');
              toast('📣', 'Deram o alarme! Os outros do bando vêm olhar onde você estava. Esconda-se agachado ou saia de perto.');
            }
            if (e.kind === 'chefe' && !seen.current.tips.has('chefe')) {
              seen.current.tips.add('chefe');
              toast('🦔', 'O Chefe Espinho te viu! Ele avisa (brilho vermelho) antes de investir: saia da frente e acerte quando ele ficar tonto.');
            }
          }
        }
      }
      const hit = stepPinecones(combatWorld.pinecones, dt, cat, env);
      if (hit) hurtPlayer(1, hit.x - hit.dx, hit.z - hit.dz);
    }

    // draw
    const t = clock.elapsedTime;
    const faro = cat.faro;
    for (const e of list) {
      const g = refs.current.get(e.id);
      if (!g) continue;
      const gone = e.mode === 'defeated' && e.timer <= 0;
      // past the fog it is not drawn at all (its mind keeps running): 20 creatures were ~0.3 M triangles a frame
      const far = Math.hypot(e.x - camera.position.x, e.z - camera.position.z) > DRAW_FAR;
      g.root.visible = !gone && !far;
      if (gone || far) continue;
      // walking legs: how far it moved this frame sets the stride (still when standing)
      if (!g.legs) {
        g.legs = [];
        g.body.traverse((o) => {
          if (o.userData.leg) g.legs!.push(o);
        });
      }
      const moved = g.last ? Math.hypot(e.x - g.last.x, e.z - g.last.z) / Math.max(dt, 1e-3) : 0;
      g.last = { x: e.x, z: e.z };
      const swing = Math.min(1, moved / 2.5) * 0.6 * Math.sin(t * (6 + moved * 2));
      for (const leg of g.legs) leg.rotation.x = swing * leg.userData.leg;
      g.root.position.set(e.x, ELEVATION[e.id] ?? 0, e.z);
      g.root.rotation.y = e.heading;
      const spec = ENEMIES[e.kind];
      // the model: its clip follows the state, the step follows the real speed
      const rig = g.rig.current;
      if (rig) {
        // struck this frame: the flash has just come on
        const struck = e.flash > 0 && !(g.flashWas ?? 0);
        g.flashWas = e.flash;
        const clip = pickClip(rig, clipFor(e.mode, moved, spec.walk, spec.run), t, struck);
        const scale = clip === 'walk' ? THREE.MathUtils.clamp(moved / Math.max(spec.walk, 0.8), 0.6, 1.8)
          : clip === 'run' ? THREE.MathUtils.clamp(moved / spec.run, 0.7, 1.6)
            : clip === 'attack' && spec.attack.kind === 'charge' ? 0.6 / spec.attack.time : 1;
        playClip(rig, clip, scale);
        rig.mixer.update(dt);
      }
      // giving up: shrinks into the puff of smoke
      const k = e.mode === 'defeated' ? Math.max(0.05, e.timer / 1.4) : 1;
      g.body.scale.setScalar(k);
      let bob = 0;
      if (e.kind === 'espirito') bob = 0.15 * Math.sin(t * 2 + e.home.x);
      // (the model's walk and run already bounce)
      if (!rig && (e.mode === 'patrol' || e.mode === 'chase' || e.mode === 'retreat' || e.mode === 'distracted')) bob += Math.abs(Math.sin(t * 10)) * 0.05;
      g.body.position.y = bob;
      // the windup: shakes and glows red; a hit: flashes white; asleep or calmed: lying low
      const shaking = e.mode === 'windup';
      g.body.position.x = shaking ? Math.sin(t * 60) * 0.04 : 0;
      // (the model lies down and wobbles in its own sleep and stunned clips)
      g.body.rotation.z = rig ? 0 : e.mode === 'sleep' || e.mode === 'calm' ? 0.5 : e.mode === 'stunned' ? Math.sin(t * 8) * 0.15 : 0;
      const glow = shaking ? 0.5 + 0.4 * Math.sin(t * 20) : 0;
      for (const m of rig ? rig.lit : [g.skin]) {
        m.emissive.set(e.flash > 0 ? '#FFFFFF' : '#FF3A2A');
        m.emissiveIntensity = e.flash > 0 ? 0.9 : glow;
      }
      if (e.kind === 'espirito') for (const m of rig ? rig.all : [g.skin]) m.opacity = faro ? 0.8 : 0.12;
      // the mark over the head
      const m = markOf(e);
      for (const c of g.marks.children) c.visible = c.name === m && (e.kind !== 'espirito' || faro || m === 'alert');
      g.marks.position.y = TOP[e.kind] + 0.25 + 0.06 * Math.sin(t * 4);
      // health, once hurt
      g.bar.visible = isActive(e) && e.hp < spec.hp && (e.kind !== 'espirito' || faro);
      g.bar.scale.x = e.hp / spec.hp;
      g.bar.lookAt(g.bar.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0, 1)));
    }
    // the pinecones in flight
    const pool = cones.current?.children ?? [];
    combatWorld.pinecones.forEach((p, i) => {
      const mesh = pool[i];
      if (!mesh) return;
      mesh.visible = p.alive;
      if (p.alive) {
        const from = coneFrom.current.get(p) ?? 0;
        mesh.position.set(p.x, 0.6 + from * Math.max(0, 1 - p.age / 0.8) + Math.sin((p.age / 1.6) * Math.PI) * 0.8, p.z);
        mesh.rotation.x += dt * 12;
      }
    });
    for (let i = combatWorld.pinecones.length; i < pool.length; i++) pool[i].visible = false;
  });

  return (
    <group visible={active}>
      {enemies.map((e) => <Creature key={e.id} e={e} register={register} />)}
      <group ref={cones}>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} visible={false} userData={{ dynamic: true }}>
            <coneGeometry args={[0.1, 0.24, 7]} />
            <Toon color="#7A5236" />
            <Ink thickness={0.01} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
