import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { create } from 'zustand';
import * as THREE from 'three';
import { playerBody, SPAWN } from './playerState';
import { reducedMotion } from '../../store/uiSettings';

/**
 * "Passeio pela vila" (Etapa 7): a demonstration route started from the main menu. The camera visits
 * seven places, each with a one-line caption, and returns to the menu. Nothing is saved: the cat walks
 * along (so shadows, grass and detail follow the shot, they are all centered on him) and goes back to the
 * spawn point at the end; progress and settings are untouched.
 */
export interface TourStop {
  x: number;
  z: number;
  /** Camera direction, radians around the stop (0 = camera to the south, looking north). */
  angle: number;
  title: string;
  caption: string;
}

// angles picked from 8 test views per stop: the ones with no roof or canopy between the camera and the place
export const TOUR: TourStop[] = [
  { x: 0.8, z: 7.5, angle: 0, title: 'Praça da Fonte', caption: 'O coração da vila. Os moradores pedem ajuda aqui.' },
  { x: 6, z: 2, angle: Math.PI * 1.75, title: 'Mercado', caption: 'Compare preços e ajude o Boku a fechar as contas.' },
  { x: 0.4, z: 18.5, angle: 0, title: 'Ponte do rio', caption: 'A ponte, as pedras no rio e o caminho para o sul.' },
  { x: -6, z: 31, angle: Math.PI * 1.5, title: 'Floresta de treino', caption: 'O Mestre Lótus ensina quem observa antes de pular.' },
  { x: -1.2, z: 45, angle: Math.PI * 1.5, title: 'Bosque Antigo', caption: 'Trilhas sob as árvores, cervos e a Árvore Anciã.' },
  { x: 24, z: 4, angle: Math.PI * 0.75, title: 'Bairro das Glicínias', caption: 'Um lago de carpas, hortas e terraços de chá.' },
  { x: -22, z: 6, angle: Math.PI * 0.5, title: 'Bambuzal', caption: 'Bambu alto e uma fonte termal fumegante.' },
];

/** Seconds on each stop. */
export const STOP_SECONDS = 6.5;

interface TourState {
  active: boolean;
  index: number;
  start: () => void;
  stop: () => void;
  next: () => void;
}

export const useTour = create<TourState>((set, get) => ({
  active: false,
  index: 0,
  start: () => set({ active: true, index: 0 }),
  stop: () => set({ active: false, index: 0 }),
  next: () => {
    const i = get().index + 1;
    if (i >= TOUR.length) set({ active: false, index: 0 });
    else set({ index: i });
  },
}));

/** Where the camera sits for a stop, `t` seconds in: a slow quarter-orbit (none with reduced motion). */
export function tourCamera(stop: TourStop, t: number, still: boolean, out = new THREE.Vector3()) {
  const a = stop.angle + (still ? 0 : (t / STOP_SECONDS - 0.5) * 0.5);
  return out.set(stop.x + Math.sin(a) * 9, 4.6, stop.z + Math.cos(a) * 9);
}

function teleport(x: number, z: number, y = 0.8) {
  const b = playerBody.current;
  if (!b) return;
  b.setTranslation({ x, y, z }, true);
  b.setLinvel({ x: 0, y: 0, z: 0 }, true);
}

export function DemoTour() {
  const camera = useThree((s) => s.camera);
  const shown = useRef(-1);
  const since = useRef(0);
  const look = useRef(new THREE.Vector3());
  useFrame((_s, dt) => {
    const { active, index, next } = useTour.getState();
    if (!active) {
      if (shown.current >= 0) {
        teleport(SPAWN.x, SPAWN.z, SPAWN.y + 1);
        shown.current = -1;
      }
      return;
    }
    const stop = TOUR[index];
    if (shown.current !== index) {
      shown.current = index;
      since.current = 0;
      // the cat stands a little off the centre, in the shot
      teleport(stop.x + Math.sin(stop.angle) * 2.2, stop.z + Math.cos(stop.angle) * 2.2);
    }
    since.current += Math.min(dt, 0.1);
    tourCamera(stop, since.current, reducedMotion(), camera.position);
    camera.lookAt(look.current.set(stop.x, 0.9, stop.z));
    if (since.current >= STOP_SECONDS) next();
  });
  return null;
}

if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__tour = { TOUR, useTour };
