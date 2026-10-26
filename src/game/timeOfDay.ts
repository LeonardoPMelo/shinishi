import { useUiSettings } from '../store/uiSettings';

/**
 * Lighting presets. "entardecer" is the art direction (references 11 and 14): a low golden sun
 * from the west, pink-orange sky, warm fog and glowing lanterns. "dia" keeps the bright midday look.
 */
export interface Lighting {
  sky: { top: string; mid: string; horizon: string; sunDir: [number, number, number]; sunGlow: string; clouds: string };
  fog: { color: string; near: number; far: number };
  hemi: { sky: string; ground: string; intensity: number };
  ambient: { color: string; intensity: number };
  /** Sun offset from the player (the shadow camera follows the player). */
  sun: { offset: [number, number, number]; color: string; intensity: number };
  fill: { position: [number, number, number]; color: string; intensity: number };
  /** Color multiplier applied by the final grade (post-processing). */
  grade: [number, number, number];
  /** Exposure before the tone curve, and the grade's saturation (Etapa 3). */
  exposure: number;
  saturation: number;
}

export const LIGHTING: Record<'entardecer' | 'dia', Lighting> = {
  entardecer: {
    sky: { top: '#4A5FB0', mid: '#F2A08A', horizon: '#FFD58F', sunDir: [-0.78, 0.2, 0.36], sunGlow: '#FFB45E', clouds: '#FFD7C4' },
    fog: { color: '#F4C6A4', near: 42, far: 150 },
    hemi: { sky: '#FFD2AA', ground: '#8C7FB0', intensity: 1.0 },
    ambient: { color: '#FFE8D6', intensity: 0.16 },
    sun: { offset: [-20, 10, 8], color: '#FFB574', intensity: 2.6 },
    fill: { position: [16, 9, -6], color: '#A9B8FF', intensity: 0.45 },
    grade: [1.07, 0.98, 0.87],
    exposure: 1,
    saturation: 1.1,
  },
  dia: {
    sky: { top: '#3B8FE8', mid: '#8CCBFF', horizon: '#E8F4FF', sunDir: [0.45, 0.65, 0.4], sunGlow: '#FFEBB3', clouds: '#FFFFFF' },
    fog: { color: '#D4EBFA', near: 48, far: 150 },
    hemi: { sky: '#D8EEFF', ground: '#7DB55C', intensity: 1.0 },
    ambient: { color: '#FFFFFF', intensity: 0.18 },
    sun: { offset: [12, 26, 9], color: '#FFF1D6', intensity: 2.5 },
    fill: { position: [-14, 10, -10], color: '#BFD9FF', intensity: 0.55 },
    grade: [1, 1, 1],
    // midday grass read as neon green with the old 1.12
    exposure: 1,
    saturation: 1.0,
  },
};

export function useLighting(): Lighting {
  return LIGHTING[useUiSettings((s) => s.timeOfDay)];
}
