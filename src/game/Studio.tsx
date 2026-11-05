import { Suspense, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ShinichiCat, type AnimState } from './entities/ShinichiCat';
import { VillagerModel, type VillagerMood } from './entities/VillagerModel';
import type { AssetName } from './assets/catalog';
import { EnemyModel, playClip, type EnemyClip, type EnemyRig } from './world/EnemyModel';
import type { EnemyKind } from '../systems/combat';

/** ?studio=cast lines up the villager models instead of Shinichi (or ?studio=cast&only=kiko,liria). */
const params = new URLSearchParams(window.location.search);
const CAST: AssetName[] = ['mestre_lotus', 'kiko', 'liria', 'sora', 'taro', 'luna', 'boku', 'hana', 'mestre_kuma', 'roku', 'neko', 'tanuki', 'kuro', 'mochi', 'bigodes', 'pipo', 'kaito', 'tsubaki', 'fuji', 'goro', 'hinoki'];
const LINEUP = params.get('studio') === 'cast' ? (params.get('only')?.split(',') as AssetName[] | undefined) ?? CAST : null;
/** ?studio=enemies lines up the wild lands' creatures (or ?studio=enemies&only=raposa,chefe); __studio.clip('walk'), any of ENEMY_CLIPS. */
const ENEMY_KINDS: EnemyKind[] = ['ourico', 'raposa', 'doninha', 'arqueira', 'texugo', 'espirito', 'javali', 'chefe'];
const BEASTS = params.get('studio') === 'enemies' ? (params.get('only')?.split(',') as EnemyKind[] | undefined) ?? ENEMY_KINDS : null;
const beastRigs = new Map<EnemyKind, EnemyRig>();
let beastClip: EnemyClip = 'idle';

function Beast({ kind, x }: { kind: EnemyKind; x: number }) {
  useFrame((_s, dt) => {
    const rig = beastRigs.get(kind);
    if (!rig) return;
    playClip(rig, beastClip);
    rig.mixer.update(dt);
  });
  return (
    <group position={[x, -0.8, 0]} rotation={[0, -0.5, 0]}>
      <EnemyModel kind={kind} onReady={(r) => beastRigs.set(kind, r)} />
    </group>
  );
}
const beastX = (i: number, list: EnemyKind[]) => {
  // the boar and the Chief are twice as wide as the others
  const w = (k: EnemyKind) => (k === 'javali' || k === 'chefe' ? 2.2 : 1.15);
  const total = list.reduce((s, k) => s + w(k), 0);
  let at = -total / 2;
  for (let k = 0; k < i; k++) at += w(list[k]);
  return at + w(list[i]) / 2;
};

function CastMember({ name, x }: { name: AssetName; x: number }) {
  const mood = useRef<VillagerMood>({ walking: false, talking: false, greeting: false, cheer: 0, walkSpeed: 0, lookYaw: 0, lookPitch: 0 });
  (window as unknown as { __castMood?: Record<string, VillagerMood> }).__castMood ??= {};
  (window as unknown as { __castMood: Record<string, VillagerMood> }).__castMood[name] = mood.current;
  return (
    <group position={[x, -0.8, 0]}>
      <VillagerModel name={name} mood={mood} scale={name === 'pipo' ? 1.3 * 0.72 : 1.3} />
    </group>
  );
}

/**
 * Dev-only portrait studio (open the game with ?studio). Shinichi alone on a transparent
 * background, with the real game materials (toon, fur shells, ink outline), so UI art
 * always matches the 3D character. Driven from the console:
 *   __shinichi.pose('victory', 1.1, 'joy')   __studio.camera([x, y, z], [tx, ty, tz], fov)
 *   __studio.save('portrait')  → POST to the dev server, written to tools/art-staging/
 */
function StudioRig() {
  const { camera, gl, scene, set } = useThree();
  const anim = useRef<AnimState>({ speed: 0, airborne: false, squash: 0, vy: 0 });
  (window as unknown as Record<string, unknown>).__studio = {
    anim: anim.current,
    camera: (pos: [number, number, number], target: [number, number, number], fov = 30) => {
      const cam = camera as THREE.PerspectiveCamera;
      cam.position.set(...pos);
      cam.fov = fov;
      cam.updateProjectionMatrix();
      cam.lookAt(...target);
    },
    size: (w: number, h: number) => set({ size: { width: w, height: h, top: 0, left: 0 } }),
    clip: (c: EnemyClip) => {
      beastClip = c;
    },
    save: async (name: string) => {
      gl.render(scene, camera);
      const data = gl.domElement.toDataURL('image/png');
      const r = await fetch(`/__studio/save?name=${encodeURIComponent(name)}`, { method: 'POST', body: data });
      return r.ok ? `saved ${name}` : `failed ${r.status}`;
    },
  };
  return (
    <>
      <ambientLight intensity={0.35} color="#FFE8D6" />
      <hemisphereLight args={['#FFE2C4', '#5E4A7A', 0.45]} />
      <directionalLight position={[2.5, 3.5, 3]} intensity={1.5} color="#FFF1DE" />
      {/* warm sunset rim from behind-left, cool fill from the other side */}
      <directionalLight position={[-3, 2.5, -2.5]} intensity={0.9} color="#FFB878" />
      <directionalLight position={[3, 1, -2]} intensity={0.5} color="#9FC4FF" />
      <Suspense fallback={null}>
        {BEASTS ? BEASTS.map((k, i) => <Beast key={k} kind={k} x={beastX(i, BEASTS)} />)
          : LINEUP ? LINEUP.map((n, i) => <CastMember key={n} name={n} x={(i - (LINEUP.length - 1) / 2) * 1.25} />) : <ShinichiCat anim={anim} />}
      </Suspense>
    </>
  );
}

export function Studio() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 0 0 / 24px 24px' }}>
      <Canvas
        flat
        gl={{ alpha: true, preserveDrawingBuffer: true, antialias: true }}
        dpr={2}
        camera={{ position: [0, 0.2, 3.2], fov: 30 }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <StudioRig />
      </Canvas>
    </div>
  );
}
