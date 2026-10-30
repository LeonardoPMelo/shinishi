import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Physics, useRapier } from '@react-three/rapier';
import * as THREE from 'three';
import { Shinichi } from './entities/Shinichi';
import { NPC } from './entities/NPC';
import { Ground } from './world/Ground';
import { Buildings } from './world/Buildings';
import { Props } from './world/Props';
import { SkyDome } from './world/SkyDome';
import { River } from './world/River';
import { Foliage } from './world/Foliage';
import { Shurikens } from './world/Shurikens';
import { TargetRange } from './world/TargetRange';
import { FaroTrail } from './world/FaroTrail';
import { Forest } from './world/Forest';
import { SecretGarden } from './world/SecretGarden';
import { Outskirts } from './world/Outskirts';
import { TempleOfRiddles } from './world/TempleOfRiddles';
import { EastDistrict } from './world/EastDistrict';
import { WestDistrict } from './world/WestDistrict';
import { AncientGrove } from './world/AncientGrove';
import { WorldObjects } from './world/WorldObjects';
import { StaticMerge, SHADOW_LAYER } from './StaticMerge';
import { Backdrop } from './world/Backdrop';
import { MiranteTerrace, MiranteStairs, MushroomsAndTreehouse } from './world/Mirante';
import { PlayThings } from './world/PlayThings';
import { LivingWorld } from './world/LivingWorld';
import { Fauna } from './world/Fauna';
import { TreeLine } from './world/TreeLine';
import { Interiors } from './world/Interiors';
import { WildRegion, TrailGateVillage } from './world/WildRegion';
import { Enemies } from './world/Enemies';
import { useZone } from './systems/zone';
import { FirstSteps } from './systems/FirstSteps';
import { DemoTour } from './systems/tour';
import { PostFX, AutoQuality } from './Effects';
import { WindClock, FoliageFade, ShadowBudget, SmallCull } from './materials';
import { Particles } from './systems/particles';
import { VfxRings } from './systems/vfx';
import { useRenderProfile } from '../store/uiSettings';
import { useLighting } from './timeOfDay';
import { skySH, skyIntensity } from './skyLight';
import { ThirdPersonCamera } from './systems/ThirdPersonCamera';
import { InteractionManager } from './systems/interaction';
import { InteractTag } from './systems/InteractTag';
import { AudioListenerSync } from '../audio/AudioListenerSync';
import { installKeyboard } from './systems/input';
import { playerPosition } from './systems/playerState';
import { NPC_DEFINITIONS } from '../data/npcs';
import { useGameStore } from '../store/gameStore';

/**
 * The merged scenery casts through position-only proxies on SHADOW_LAYER (StaticMerge). three.js tests
 * a caster's layers against the *main* camera, and builds the main draw list before the shadow pass, so
 * the layer is switched on only while the shadow map renders: the proxies never reach the main pass.
 */
function shadowLayerOnlyInShadowPass(gl: THREE.WebGLRenderer) {
  const sm = gl.shadowMap as THREE.WebGLShadowMap & { render: (lights: THREE.Light[], scene: THREE.Scene, camera: THREE.Camera) => void };
  const render = sm.render;
  sm.render = function (lights, scene, camera) {
    const had = camera.layers.isEnabled(SHADOW_LAYER);
    camera.layers.enable(SHADOW_LAYER);
    try {
      render.call(this, lights, scene, camera);
    } finally {
      if (!had) camera.layers.disable(SHADOW_LAYER);
    }
  };
  return () => {
    sm.render = render;
  };
}

/**
 * Light from the whole sky as a light probe built from the sky dome's colors (skyLight.ts, Etapa 3). It
 * replaces the hemisphere + ambient pair at the same brightness, and adds the side the sun is on.
 */
function SkyLight() {
  const l = useLighting();
  const probe = useMemo(() => {
    const sh = skySH(l);
    return new THREE.LightProbe(sh, skyIntensity(l, sh));
  }, [l]);
  return <primitive object={probe} />;
}

/** Sun that follows the player so shadows stay crisp across the whole (larger) map. */
function FollowSun() {
  const light = useRef<THREE.DirectionalLight>(null);
  const profile = useRenderProfile();
  const { sun } = useLighting();
  const mapSize = profile.shadowMap;
  const frame = useRef(0);
  const gl = useThree((st) => st.gl);
  useEffect(() => shadowLayerOnlyInShadowPass(gl), [gl]);
  useFrame(({ gl }) => {
    // on the cheaper profiles the shadow map is redrawn every other frame (it follows slow things)
    const every = profile.shadowEvery;
    gl.shadowMap.autoUpdate = every === 1;
    if (every > 1 && frame.current++ % every === 0) gl.shadowMap.needsUpdate = true;
    const l = light.current;
    if (!l) return;
    const x = Math.round(playerPosition.x / 2) * 2;
    const z = Math.round(playerPosition.z / 2) * 2;
    l.position.set(x + sun.offset[0], sun.offset[1], z + sun.offset[2]);
    l.target.position.set(x, 0, z);
    l.target.updateMatrixWorld();
  });
  return (
    <directionalLight
      key={mapSize}
      ref={light}
      position={sun.offset}
      intensity={sun.intensity}
      color={sun.color}
      castShadow={profile.shadows}
      shadow-mapSize={[mapSize, mapSize]}
      shadow-bias={-0.0004}
      shadow-normalBias={0.03}
      shadow-camera-far={70}
      shadow-camera-left={-22}
      shadow-camera-right={22}
      shadow-camera-top={22}
      shadow-camera-bottom={-22}
    />
  );
}

function DevHandle() {
  const state = useThree();
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__r3f = state;
  }, [state]);
  return null;
}

/**
 * Puts the fixed bodies (walls, fences, rocks: ~290 of ~330) to sleep, every 2 s for the ones mounted
 * later (Etapa 1b). @react-three/rapier re-reads and re-decomposes the transform of every awake body each
 * frame to sync its object, and fixed bodies report awake: ~1 ms of CPU per frame for things that never
 * move. Collisions are unaffected (checked with qa.walls: the cat still stops at every wall).
 */
function SleepFixedBodies() {
  const { world } = useRapier();
  const next = useRef(0);
  useFrame((state) => {
    if (state.clock.elapsedTime < next.current) return;
    next.current = state.clock.elapsedTime + 2;
    world.forEachRigidBody((b) => {
      if (b.isFixed() && !b.isSleeping()) b.sleep();
    });
  });
  return null;
}

/** Dev only: exposes the physics world for QA queries (dev/qa.ts `space`). */
function ExposePhysics() {
  const { world, rapier } = useRapier();
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__rapier = { world, rapier };
  }, [world, rapier]);
  return null;
}

function Scene() {
  const phase = useGameStore((s) => s.phase);
  // inside a house (Etapa 4 da expansão) the outdoor world is not drawn: only the room, the cat and the
  // villagers and objects inside (WorldObjects and NPCs draw by distance)
  const outdoor = useZone((s) => s.zone === 'outdoor');
  // the wild lands (Etapa 7) are outdoors too, far away: the village's animals live there as well
  const wild = useZone((s) => s.zone === 'selvagem');
  const profile = useRenderProfile();
  const active = phase !== 'menu';
  const light = useLighting();

  return (
    <>
      <SkyLight />
      <FollowSun />
      <directionalLight position={light.fill.position} intensity={light.fill.intensity} color={light.fill.color} />

      <fog attach="fog" args={[light.fog.color, light.fog.near, light.fog.far]} />
      <SkyDome />
      <group visible={outdoor}>
        <StaticMerge chunk={0}>
          <Backdrop />
        </StaticMerge>
        <TreeLine />
      </group>
      <WindClock />
      <FoliageFade />
      <ShadowBudget />
      <SmallCull />
      <AutoQuality />
      {profile.postfx && <PostFX bloom={profile.bloom} msaa={profile.msaa} scale={profile.scale} tint={light.grade} exposure={light.exposure} saturation={light.saturation} />}

      <Physics gravity={[0, -18, 0]}>
        {import.meta.env.DEV && <ExposePhysics />}
        <SleepFixedBodies />
        <ThirdPersonCamera active={active} />
        <group visible={outdoor}>
        <StaticMerge>
          <Ground />
          <Buildings />
          <Props />
          <River />
          <Forest />
          <SecretGarden />
          <Outskirts />
          <TempleOfRiddles />
          <EastDistrict />
          <WestDistrict />
          <AncientGrove />
          <MiranteTerrace />
          <MiranteStairs />
          <MushroomsAndTreehouse />
        </StaticMerge>
        <Foliage />
        <PlayThings />
        <TrailGateVillage />
        </group>
        <Interiors />
        <WildRegion />
        <Enemies />
        <Shurikens />
        <TargetRange />
        <FaroTrail />
        <WorldObjects />
        <Shinichi />
        {NPC_DEFINITIONS.map((npc) => (
          <NPC key={npc.id} npc={npc} />
        ))}
        <group visible={outdoor || wild}>
          <Fauna />
        </group>
      </Physics>

      <Particles />
      <VfxRings />
      <group visible={outdoor}>
        <LivingWorld />
      </group>
      <FirstSteps />
      <DemoTour />
      <DevHandle />
      <InteractionManager />
      <InteractTag />
      <AudioListenerSync />
    </>
  );
}

export function GameScene() {
  useEffect(() => installKeyboard(), []);
  const profile = useRenderProfile();
  // canvas at the screen's pixel ratio (capped by the profile). With post-processing, the adaptive scale
  // shrinks only the internal render targets (PostFX enlarges and sharpens at the end); without it,
  // the canvas itself is scaled.
  const native = Math.min(window.devicePixelRatio || 1, profile.dprMax);
  const dpr = Math.max(0.5, profile.postfx ? native : native * profile.scale);
  return (
    <Canvas
      // the post-processing chain antialiases on its own target; a multisampled screen buffer on top
      // only costs fill rate. The canvas is rebuilt only when a manual setting turns post-processing on/off.
      key={profile.postfx ? 'fx' : 'plain'}
      shadows
      flat
      dpr={dpr}
      gl={{ antialias: !profile.postfx, powerPreference: 'high-performance' }}
      camera={{ position: [0, 6, 12], fov: 55, near: 0.1, far: 400 }}
      style={{ width: '100%', height: '100%' }}
    >
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
    </Canvas>
  );
}
