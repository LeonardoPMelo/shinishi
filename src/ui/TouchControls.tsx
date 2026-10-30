import { useEffect, useRef, useState } from 'react';
import { input, press } from '../game/systems/input';
import { useUiSettings } from '../store/uiSettings';
import { useGameStore } from '../store/gameStore';
import { usePad } from '../game/systems/gamepad';
import { useZone } from '../game/systems/zone';

const RADIUS = 52;

function useCoarsePointer() {
  const [coarse, setCoarse] = useState(() => window.matchMedia('(pointer: coarse)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const on = () => setCoarse(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return coarse;
}

/** Whether the on-screen touch controls are in use (the setting, or "auto" on a touch screen). */
export function useTouchUi() {
  const mode = useUiSettings((s) => s.touch);
  const coarse = useCoarsePointer();
  // a game controller in use on a phone or tablet: the on-screen stick and buttons step aside
  const pad = usePad((s) => s.active);
  return mode === 'on' || (mode === 'auto' && coarse && !pad);
}

function Joystick() {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const pointer = useRef<number | null>(null);

  const update = (clientX: number, clientY: number) => {
    const rect = base.current!.getBoundingClientRect();
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    setKnob({ x: dx, y: dy });
    input.stickX = dx / RADIUS;
    input.stickY = -dy / RADIUS;
  };
  const release = () => {
    pointer.current = null;
    setKnob({ x: 0, y: 0 });
    input.stickX = 0;
    input.stickY = 0;
  };

  return (
    <div
      ref={base}
      className="joystick"
      onPointerDown={(e) => {
        pointer.current = e.pointerId;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => pointer.current === e.pointerId && update(e.clientX, e.clientY)}
      onPointerUp={release}
      onPointerCancel={release}
      aria-label="Mover"
    >
      <div className="joystick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

/** On-screen controls for phones and tablets. Drag on the scene to turn the camera. */
export function TouchControls() {
  const phase = useGameStore((s) => s.phase);
  const show = useTouchUi();
  const [crouch, setCrouch] = useState(false);
  const wild = useZone((s) => s.zone === 'selvagem');

  useEffect(() => {
    document.body.classList.toggle('touch-ui', show);
  }, [show]);

  // crouch is a toggle on touch (one thumb is already on the stick); never leave it stuck on
  useEffect(() => {
    if (show) input.crouch = phase === 'playing' && crouch;
  }, [crouch, show, phase]);

  if (!show || phase !== 'playing') return null;

  const tap = (fn: () => void) => (e: React.PointerEvent) => {
    e.preventDefault();
    fn();
  };

  return (
    <div className="touch-controls">
      <Joystick />
      <div className="touch-buttons">
        <button className="touch-btn jump" onPointerDown={tap(() => { press('jump'); input.jumpHeld = true; })} onPointerUp={() => (input.jumpHeld = false)} onPointerCancel={() => (input.jumpHeld = false)} onPointerLeave={() => (input.jumpHeld = false)} aria-label="Pular">⤒</button>
        <button className="touch-btn act" onPointerDown={tap(() => press('interact'))} aria-label="Interagir">E</button>
        {wild && <button className="touch-btn small attack" onPointerDown={tap(() => press('attack'))} aria-label="Patada">👊</button>}
        <button className="touch-btn small faro" onPointerDown={tap(() => press('faro'))} aria-label="Faro Ninja">👃</button>
        <button className="touch-btn small miado" onPointerDown={tap(() => press('miado'))} aria-label="Miado Ninja">😺</button>
        <button className="touch-btn small emote" onPointerDown={tap(() => press('emote'))} aria-label="Comemorar">🎉</button>
        <button className="touch-btn small shuriken" onPointerDown={tap(() => press('shuriken'))} aria-label="Shuriken de treino">✴️</button>
        <button className="touch-btn small dash" onPointerDown={tap(() => press('dash'))} aria-label="Impulso Ninja">💨</button>
 <button className={`touch-btn small crouch ${crouch ? 'on' : ''}`} onPointerDown={tap(() => setCrouch((c) => !c))} aria-label="Agachar" aria-pressed={crouch}>🐾</button>
        <button className="touch-btn small pocao" onPointerDown={tap(() => press('pocao'))} aria-label="Poção de Energia">🧪</button>
      </div>
    </div>
  );
}
