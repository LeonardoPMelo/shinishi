import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Quality = 'alta' | 'media' | 'baixa';

interface UiSettings {
  touch: 'auto' | 'on' | 'off';
  cameraSensitivity: number;
  /** What the player chose. 'auto' starts high and steps down if the frame rate stays low. */
  quality: Quality | 'auto';
  /** @deprecated kept for old saves; the auto mode now uses `autoLevel`. */
  autoQuality: Quality;
  /** Auto mode: rung of AUTO_LADDER in use (0 = best). Remembered between sessions. */
  autoLevel: number;
  /** Lighting preset (see game/timeOfDay.ts). */
  timeOfDay: 'entardecer' | 'dia';
  /** Accessibility (Etapa 7). "auto" follows the system's "reduce motion" preference. */
  reduceMotion: 'auto' | 'on' | 'off';
  /** Interface text size: 1, 1.15 or 1.3. */
  textScale: number;
  /** Drag up to look down (flight-style camera). */
  invertY: boolean;
  setReduceMotion: (v: UiSettings['reduceMotion']) => void;
  setTextScale: (v: number) => void;
  setInvertY: (v: boolean) => void;
  setTimeOfDay: (v: UiSettings['timeOfDay']) => void;
  setTouch: (v: UiSettings['touch']) => void;
  setCameraSensitivity: (v: number) => void;
  setQuality: (v: UiSettings['quality']) => void;
  setAutoQuality: (v: Quality) => void;
  setAutoLevel: (v: number) => void;
}

export const useUiSettings = create<UiSettings>()(
  persist(
    (set) => ({
      touch: 'auto',
      cameraSensitivity: 1,
      quality: 'auto',
      autoQuality: 'alta',
      autoLevel: 0,
      timeOfDay: 'entardecer',
      reduceMotion: 'auto',
      textScale: 1,
      invertY: false,
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setTextScale: (textScale) => set({ textScale: Math.max(1, Math.min(1.3, textScale)) }),
      setInvertY: (invertY) => set({ invertY }),
      setTimeOfDay: (timeOfDay) => set({ timeOfDay }),
      setTouch: (touch) => set({ touch }),
      setCameraSensitivity: (cameraSensitivity) => set({ cameraSensitivity }),
      setQuality: (quality) => set({ quality, autoQuality: 'alta' }),
      setAutoQuality: (autoQuality) => set({ autoQuality }),
      setAutoLevel: (autoLevel) => set({ autoLevel: Math.max(0, Math.min(AUTO_LADDER.length - 1, autoLevel)) }),
    }),
    {
      name: 'shinichi-ui',
      partialize: (s) => ({ touch: s.touch, cameraSensitivity: s.cameraSensitivity, quality: s.quality, timeOfDay: s.timeOfDay, autoLevel: s.autoLevel, reduceMotion: s.reduceMotion, textScale: s.textScale, invertY: s.invertY }),
    }
  )
);

/** Whether motion should be reduced now: the setting, or the system preference when it is "auto". */
export function reducedMotion(mode = useUiSettings.getState().reduceMotion) {
  if (mode !== 'auto') return mode === 'on';
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Feature set: in "auto" the game always keeps the high-quality look (lighting, shadows, color grade,
 * fur, full grass) and adapts cheaper knobs instead (see AUTO_LADDER). Switching those features on
 * and off recompiled every shader and made the picture flat, which read as a freeze plus "the lights
 * went out".
 */
export function useEffectiveQuality(): Quality {
  return useUiSettings((s) => (s.quality === 'auto' ? 'alta' : s.quality));
}

/** How a frame is rendered. Nothing here needs a shader recompile to change. */
export interface RenderProfile {
  /** Highest device pixel ratio used, before `scale`. */
  dprMax: number;
  /** Internal resolution factor (1 = native). */
  scale: number;
  bloom: boolean;
  /** MSAA samples of the post-processing target. */
  msaa: 0 | 2 | 4;
  shadowMap: 1024 | 2048;
  /** Re-render the shadow map every N frames (2 = 30 Hz at 60 fps). */
  shadowEvery: 1 | 2 | 3 | 4;
  shadows: boolean;
  postfx: boolean;
  /**
   * Detail distance factor (1 = full): scales how far decoration, world objects and villagers are drawn.
   * On integrated GPUs the frame cost follows the number of draw calls, not the resolution (Etapa 1).
   */
  detail: number;
  /** The pebbles in the dirt paths (the costliest part of the ground shader, Etapa 2). Off from rung 4. */
  pebbles: boolean;
}

/**
 * Auto mode, best to cheapest. Shadows and the color grade never turn off here. Measured on an AMD Vega 8
 * (Etapa 1): bloom ~6 ms and the shadow pass ~6 ms, while resolution mattered little because the frame
 * cost follows the number of draw calls. So the ladder drops bloom first, then refreshes the shadow map
 * less often (the sun follows the player, so a 20–30 Hz shadow update is hard to notice), and shortens the
 * detail distance; resolution goes down gently, last.
 */
export const AUTO_LADDER: Pick<RenderProfile, 'scale' | 'bloom' | 'msaa' | 'shadowMap' | 'shadowEvery' | 'detail' | 'pebbles'>[] = [
  { scale: 1, bloom: true, msaa: 4, shadowMap: 2048, shadowEvery: 1, detail: 1, pebbles: true },
  { scale: 1, bloom: false, msaa: 4, shadowMap: 2048, shadowEvery: 1, detail: 1, pebbles: true },
  { scale: 1, bloom: false, msaa: 2, shadowMap: 2048, shadowEvery: 2, detail: 0.9, pebbles: true },
  { scale: 0.9, bloom: false, msaa: 2, shadowMap: 2048, shadowEvery: 2, detail: 0.8, pebbles: true },
  { scale: 0.8, bloom: false, msaa: 2, shadowMap: 1024, shadowEvery: 3, detail: 0.72, pebbles: false },
  // MSAA stays on to the end: at low resolution it is cheap, and jagged toon outlines were the ugliest step
  { scale: 0.72, bloom: false, msaa: 2, shadowMap: 1024, shadowEvery: 3, detail: 0.65, pebbles: false },
  { scale: 0.66, bloom: false, msaa: 2, shadowMap: 1024, shadowEvery: 4, detail: 0.6, pebbles: false },
];

export function renderProfile(quality: UiSettings['quality'], autoLevel: number): RenderProfile {
  if (quality === 'alta') return { dprMax: 1.75, scale: 1, bloom: true, msaa: 4, shadowMap: 2048, shadowEvery: 1, shadows: true, postfx: true, detail: 1, pebbles: true };
  if (quality === 'media') return { dprMax: 1.25, scale: 1, bloom: false, msaa: 4, shadowMap: 1024, shadowEvery: 2, shadows: true, postfx: true, detail: 0.85, pebbles: true };
  if (quality === 'baixa') return { dprMax: 1, scale: 1, bloom: false, msaa: 0, shadowMap: 1024, shadowEvery: 1, shadows: false, postfx: false, detail: 0.65, pebbles: false };
  const rung = AUTO_LADDER[Math.max(0, Math.min(AUTO_LADDER.length - 1, autoLevel))];
  return { dprMax: 1.5, shadows: true, postfx: true, ...rung };
}

/** Current detail distance factor, read every few frames by the distance culls (no React re-render). */
export function detailFactor() {
  const s = useUiSettings.getState();
  return renderProfile(s.quality, s.autoLevel).detail;
}

export function useRenderProfile(): RenderProfile {
  const quality = useUiSettings((s) => s.quality);
  const level = useUiSettings((s) => s.autoLevel);
  return renderProfile(quality, level);
}

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__ui = useUiSettings;
}
