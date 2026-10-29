import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { create } from 'zustand';
import { useInteractable, type Interactable } from './interaction';

/**
 * What the HUD shows during a timed test (Etapa 5 da expansão): the Circuit of the Paws for now.
 * Not saved: a run in progress is lost on reload, like any half-done puzzle.
 */
export interface TrainingHud {
  /** Run start (performance.now() / 1000), or null when nothing is timed. */
  startedAt: number | null;
  /** "Ponto 2 de 5: Plataforma média" */
  label: string;
  set: (p: Partial<Omit<TrainingHud, 'set'>>) => void;
}

export const useTraining = create<TrainingHud>((set) => ({ startedAt: null, label: '', set: (p) => set(p) }));

/**
 * Registers an E-interaction at a fixed spot. The registered item calls through a ref, so its label and
 * action always see the latest render's state (same pattern as the temple puzzles).
 */
export function useSpot(id: string, pos: THREE.Vector3Tuple, radius: number, label: () => string | null, onInteract: () => void, tagHeight = 1.6) {
  const fns = useRef({ label, onInteract });
  fns.current = { label, onInteract };
  const item = useMemo<Interactable>(() => ({
    id,
    position: new THREE.Vector3(...pos),
    radius,
    tagHeight,
    label: () => fns.current.label(),
    onInteract: () => fns.current.onInteract(),
  }), [id, pos[0], pos[1], pos[2], radius, tagHeight]); // eslint-disable-line react-hooks/exhaustive-deps
  useInteractable(item);
}

/** A picture drawn on a canvas once (emoji or a few letters), for signs and lever plates. */
export function useIconTexture(text: string, bg = '#FFF3D9', fg = '#2A1E16') {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(64, 64, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.font = '72px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 70);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [text, bg, fg]);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}
