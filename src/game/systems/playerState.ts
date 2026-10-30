import * as THREE from 'three';
import type { RapierRigidBody } from '@react-three/rapier';

// Module-level shared state updated each frame; read by NPCs, camera, audio and UI without re-renders.
export const SPAWN = new THREE.Vector3(0, 1, 3.4);
export const playerPosition = new THREE.Vector3(0, 0.7, 3.4);
export const playerFacing = { angle: Math.PI, /** dev: forces the facing (scene captures) */ force: null as number | null };
export const cameraAngle = { theta: 0, phi: 0.42, distance: 7 };
/** When the player last turned the camera by something other than the mouse or touch (the gamepad's right stick), in seconds. */
export const cameraInput = { lastManual: 0 };
export const playerBody: { current: RapierRigidBody | null } = { current: null };
/** True while Shinichi stands on something (written by the controller every frame). */
export const playerGround = { grounded: true };
/** Sneaking and horizontal speed (m/s), written by the controller; the animals react to them (Etapa 4). */
export const playerMotion = { crouch: false, speed: 0 };

export const abilityState = {
  faroUntil: 0,
  faroReadyAt: 0,
  miadoReadyAt: 0,
  shurikenReadyAt: 0,
  dashReadyAt: 0,
  /** Energy potion: faster and springier until this time. */
  boostUntil: 0,
  /** Grilled fish: springier (jump only) until this time (Etapa 6). */
  jumpUntil: 0,
  /** Catnip tea: seconds of Faro to start on the next frame, cooldown or not (0 = none; Etapa 6). */
  faroRequest: 0,
  /** Faro trail: glowing paw prints from here to the current objective. */
  trail: null as null | { from: THREE.Vector3; to: THREE.Vector3; until: number },
  /** Last time and place Shinichi meowed; NPCs nearby react once per meow. */
  lastMeow: { time: -1, position: new THREE.Vector3() },
  /** The last celebration (emote, key G): villagers nearby react (NPC.tsx). */
  lastEmote: { time: -1, position: new THREE.Vector3() },
  emoteReadyAt: 0,
};

export const FARO_DURATION = 6;
export const FARO_COOLDOWN = 12;
export const MIADO_COOLDOWN = 2.5;
export const EMOTE_COOLDOWN = 2.2;
export const SHURIKEN_COOLDOWN = 0.55;
export const DASH_COOLDOWN = 1.1;
export const BOOST_DURATION = 10;

export const now = () => performance.now() / 1000;

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__cam = cameraAngle;
  (window as unknown as Record<string, unknown>).__player = { playerPosition, playerBody, playerFacing };
}
