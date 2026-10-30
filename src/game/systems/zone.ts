import { create } from 'zustand';
import type { Vec3 } from '../../types';
import { INTERIORS_BY_ID, insideDoor, outsideDoor } from '../../data/interiors';
import { abilityState, cameraAngle, playerBody, playerPosition } from './playerState';
import { emit, onGameEvent } from '../../systems/events';
import { TRAIL_GATE, WILD_GATE, WILD_RESPAWN } from '../../data/wild';
import { faintHandler, refillHearts } from './hearts';

/**
 * Where Shinichi is: outdoors, or inside one of the houses (Etapa 4 da expansão). Not saved: a reload always
 * starts outdoors (the progress made inside is in the save like any other).
 *
 * Going through a door: the screen fades out, the cat is placed on the other side (on a spot measured to be
 * clear of walls, tests/interiors.test.ts), the camera turns to look the way the cat walks, and the screen
 * fades back in. The outdoor world is hidden while inside (GameScene.tsx).
 */
export interface ZoneState {
  /** 'outdoor' or an interior id. */
  zone: string;
  /** The screen is dark (door transition). */
  fading: boolean;
}

export const useZone = create<ZoneState>(() => ({ zone: 'outdoor', fading: false }));

const FADE_MS = 260;
let busy = false;

/** Indoor camera: higher and a bit closer, looking into the open-topped room. */
const INDOOR_VIEW = { phi: 0.78, distance: 6.2 };
const OUTDOOR_VIEW = { phi: 0.42, distance: 7 };

function place(at: Vec3, heading: number, view: { phi: number; distance: number }) {
  const b = playerBody.current;
  if (b) {
    b.setTranslation({ x: at[0], y: at[1] + 0.8, z: at[2] }, true);
    b.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }
  playerPosition.set(at[0], at[1] + 0.8, at[2]);
  // behind the cat, looking where it is heading
  cameraAngle.theta = heading + Math.PI;
  cameraAngle.phi = view.phi;
  cameraAngle.distance = view.distance;
  abilityState.trail = null;
}

function travel(zone: string, at: Vec3, heading: number, view: { phi: number; distance: number }) {
  if (busy) return;
  busy = true;
  useZone.setState({ fading: true });
  emit({ type: 'sfx', name: 'ui_open' });
  window.setTimeout(() => {
    place(at, heading, view);
    useZone.setState({ zone });
    window.setTimeout(() => {
      useZone.setState({ fading: false });
      busy = false;
    }, FADE_MS);
  }, FADE_MS);
}

/** Walk in through the house's front door. */
export function enterInterior(id: string) {
  const def = INTERIORS_BY_ID[id];
  if (!def) return;
  // inside, the cat comes in through the south wall and faces north (-z)
  travel(id, insideDoor(def).spot, Math.PI, def.view ?? INDOOR_VIEW);
}

/** Back out to the spot in front of the house, facing away from it. */
export function exitInterior(id: string) {
  const def = INTERIORS_BY_ID[id];
  if (!def) return;
  const out = outsideDoor(def);
  travel('outdoor', out.spot, out.heading, OUTDOOR_VIEW);
}

/**
 * The wild lands (Etapa 7 da expansão) are a zone like a house: far from the village, the village hidden while
 * there. The gates are world objects with a TRAVEL action (data/wild.ts); the store only emits the event.
 */
export const WILD_ZONE = 'selvagem';

export function enterWild() {
  refillHearts();
  travel(WILD_ZONE, WILD_GATE.arrive, WILD_GATE.heading, OUTDOOR_VIEW);
}

export function leaveWild() {
  refillHearts();
  travel('outdoor', TRAIL_GATE.out, TRAIL_GATE.heading, OUTDOOR_VIEW);
}

/** Out of hearts: the screen fades and the cat wakes by the campfire, hearts full, bag untouched. */
function faintToCamp() {
  window.setTimeout(() => {
    // facing the campfire
    travel(WILD_ZONE, WILD_RESPAWN, -Math.PI / 2, OUTDOOR_VIEW);
    window.setTimeout(refillHearts, FADE_MS);
  }, 450);
}
faintHandler.current = faintToCamp;

onGameEvent((e) => {
  if (e.type !== 'travel') return;
  if (e.to === WILD_ZONE) enterWild();
  else if (e.to === 'vila') leaveWild();
});

if (import.meta.env.DEV) Object.assign(window as unknown as Record<string, unknown>, { __zone: useZone, __enter: enterInterior, __exit: exitInterior, __wild: enterWild, __leaveWild: leaveWild });
