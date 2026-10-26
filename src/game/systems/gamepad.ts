import { create } from 'zustand';
import { input, press, type PressKey } from './input';
import { cameraAngle, cameraInput } from './playerState';
import { useGameStore } from '../../store/gameStore';
import { useUiSettings } from '../../store/uiSettings';

/**
 * Game controllers (Gamepad API): Xbox, PlayStation, Switch Pro and generic pads, by USB or Bluetooth, on a
 * computer or a phone. Browsers expose them only after a button is pressed on the page.
 *
 * In play the pad writes to the same `input` object as the keyboard and the touch stick. Anywhere else
 * (menu, dialogue, challenge, panels, pause) it moves the focus between the buttons on screen and presses
 * them, so every screen works without a mouse.
 *
 * Buttons use the "standard" layout, named by position (bottom = A on Xbox, ✕ on PlayStation):
 *   left stick / D-pad move · right stick camera · bottom jump · left interact · top faro · right miado
 *   LB dash · RB shuriken · LT crouch · RT (or L3) run · D-pad up potion · Start pause · Select map
 */

/** Button indices of the standard mapping. */
export const BTN = {
  BOTTOM: 0, RIGHT: 1, LEFT: 2, TOP: 3, LB: 4, RB: 5, LT: 6, RT: 7,
  SELECT: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, DPAD_LEFT: 14, DPAD_RIGHT: 15,
} as const;

export const DEADZONE = 0.2;

/** Radial dead zone, rescaled so the stick still reaches 1 at the edge and starts from 0 just past the zone. */
export function applyDeadzone(x: number, y: number, dz = DEADZONE): [number, number] {
  const m = Math.hypot(x, y);
  if (m <= dz) return [0, 0];
  const k = Math.min(1, (m - dz) / (1 - dz)) / m;
  return [x * k, y * k];
}

export type PadStyle = 'xbox' | 'playstation' | 'nintendo' | 'generic';

export function padStyle(id: string): PadStyle {
  const s = id.toLowerCase();
  // vendor ids first (054c Sony, 057e Nintendo, 045e Microsoft): a DualShock 4 reports only "Wireless Controller"
  if (/045e|xbox|xinput/.test(s)) return 'xbox';
  if (/054c|playstation|dualshock|dualsense/.test(s)) return 'playstation';
  if (/057e|nintendo|switch|pro controller|joy-con/.test(s)) return 'nintendo';
  return 'generic';
}

/** What is printed on each face button, by position. */
export const FACE_LABELS: Record<PadStyle, { bottom: string; right: string; left: string; top: string }> = {
  xbox: { bottom: 'A', right: 'B', left: 'X', top: 'Y' },
  generic: { bottom: 'A', right: 'B', left: 'X', top: 'Y' },
  playstation: { bottom: '✕', right: '○', left: '□', top: '△' },
  // Nintendo prints the letters swapped: bottom is B, right is A
  nintendo: { bottom: 'B', right: 'A', left: 'Y', top: 'X' },
};

export type Dir = 'up' | 'down' | 'left' | 'right';
export interface Box { x: number; y: number; w: number; h: number }

/**
 * Spatial focus: the nearest box in the given direction. Distance along the direction counts once and the
 * sideways offset counts more, so a grid (the challenge keypad) moves the way it looks.
 */
export function pickInDirection(from: Box, boxes: Box[], dir: Dir): number {
  const cx = from.x + from.w / 2;
  const cy = from.y + from.h / 2;
  let best = -1;
  let bestScore = Infinity;
  boxes.forEach((b, i) => {
    const bx = b.x + b.w / 2;
    const by = b.y + b.h / 2;
    const dx = bx - cx;
    const dy = by - cy;
    let along: number;
    let side: number;
    if (dir === 'up') { along = -dy; side = Math.abs(dx); }
    else if (dir === 'down') { along = dy; side = Math.abs(dx); }
    else if (dir === 'left') { along = -dx; side = Math.abs(dy); }
    else { along = dx; side = Math.abs(dy); }
    if (along <= 4) return;
    const score = along + side * 2.5;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

interface PadState {
  /** A controller is plugged in / paired. */
  connected: boolean;
  name: string;
  style: PadStyle;
  /** The last thing the player touched was the controller (hints show its buttons, touch controls hide). */
  active: boolean;
  /** Brief "controller connected" notice. */
  notice: string | null;
}

export const usePad = create<PadState>(() => ({ connected: false, name: '', style: 'generic', active: false, notice: null }));

/** Label of a face button for the connected controller, e.g. faceLabel('bottom') → "✕" on a PlayStation pad. */
export function useFaceLabel(pos: 'bottom' | 'right' | 'left' | 'top') {
  return usePad((s) => FACE_LABELS[s.style][pos]);
}

// ---------------------------------------------------------------------------------------------------------
// Polling

const FOCUSABLE = 'button:not([disabled]), select:not([disabled]), input:not([disabled]):not([type=hidden]), [tabindex]:not([tabindex="-1"])';
/** The screen in front, most specific first: the pad only moves between the buttons of that one. */
const LAYERS = ['.crash-screen', '.celebrate', '.challenge-overlay', '.panel-overlay', '.dialogue-overlay', '.pause-overlay', '.tour-overlay', '.main-menu'];

function visible(el: Element) {
  const r = (el as HTMLElement).getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const cs = getComputedStyle(el as HTMLElement);
  return cs.visibility !== 'hidden' && cs.display !== 'none';
}

function activeLayer(): HTMLElement | null {
  for (const sel of LAYERS) {
    const all = Array.from(document.querySelectorAll<HTMLElement>(sel)).filter(visible);
    if (all.length) return all[all.length - 1];
  }
  return null;
}

function focusables(layer: HTMLElement) {
  return Array.from(layer.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(visible);
}

function box(el: Element): Box {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

function focusEl(el: HTMLElement) {
  el.focus({ preventScroll: false });
  el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
}

/** The button a screen would want first: the main action, else the first one. */
function firstChoice(items: HTMLElement[]) {
  return items.find((e) => e.matches('.btn-primary, .dialogue-option, .dialogue-continue, [autofocus]')) ?? items[0];
}

function key(code: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code === 'Escape' ? 'Escape' : code, bubbles: true }));
}

/** Sets a form value the way React notices (it listens to the native input/change events). */
function setNative(el: HTMLInputElement | HTMLSelectElement, value: string, event: 'input' | 'change') {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event(event, { bubbles: true }));
}

/** Left/right on a slider or a list changes its value instead of moving away. */
function adjust(el: HTMLElement, step: number): boolean {
  if (el instanceof HTMLSelectElement) {
    const i = Math.max(0, Math.min(el.options.length - 1, el.selectedIndex + step));
    if (i !== el.selectedIndex) setNative(el, el.options[i].value, 'change');
    return true;
  }
  if (el instanceof HTMLInputElement && el.type === 'range') {
    const min = Number(el.min || 0);
    const max = Number(el.max || 100);
    const unit = Number(el.step) > 0 ? Number(el.step) : (max - min) / 20;
    setNative(el, String(Math.max(min, Math.min(max, Number(el.value) + unit * step))), 'input');
    return true;
  }
  return false;
}

function moveFocus(dir: Dir) {
  const layer = activeLayer();
  if (!layer) return;
  const items = focusables(layer);
  if (!items.length) return;
  const current = document.activeElement as HTMLElement | null;
  if (!current || !layer.contains(current) || !items.includes(current)) {
    focusEl(firstChoice(items));
    return;
  }
  if ((dir === 'left' || dir === 'right') && adjust(current, dir === 'left' ? -1 : 1)) return;
  const others = items.filter((e) => e !== current);
  const i = pickInDirection(box(current), others.map(box), dir);
  if (i >= 0) focusEl(others[i]);
}

function confirm() {
  const layer = activeLayer();
  if (!layer) return;
  // dialogue still typing: the first press shows the whole line, like a click on the box
  if (layer.matches('.dialogue-overlay') && !layer.querySelector('.dialogue-option, .dialogue-continue')) {
    layer.click();
    return;
  }
  const items = focusables(layer);
  const current = document.activeElement as HTMLElement | null;
  if (current && layer.contains(current) && items.includes(current)) {
    if (current instanceof HTMLInputElement && current.type === 'text') {
      current.form?.requestSubmit();
      return;
    }
    current.click();
    return;
  }
  const first = items.length ? firstChoice(items) : null;
  if (first) focusEl(first);
}

function back() {
  const layer = activeLayer();
  const close = layer?.querySelector<HTMLElement>('.panel-close, .challenge-close');
  if (close && visible(close)) close.click();
  else key('Escape');
}

let raf = 0;
let installed = false;
const prev: boolean[] = [];
/** Inputs this module set on the shared `input`, so it only clears what it set (never the keyboard's). */
const owned = { stick: false, run: false, crouch: false, jump: false };
const repeat = { dir: null as Dir | null, next: 0 };
let lastT = 0;

function pressedNow(gp: Gamepad, i: number) {
  const b = gp.buttons[i];
  return !!b && (b.pressed || b.value > 0.5);
}

function poll(t: number) {
  raf = requestAnimationFrame(poll);
  step(t);
}

/** One reading of the controller (called every animation frame). */
function step(t: number) {
  const dt = Math.min(0.05, lastT ? (t - lastT) / 1000 : 0.016);
  lastT = t;
  const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter((g): g is Gamepad => !!g && g.connected) : [];
  const gp = pads.find((g) => g.mapping === 'standard') ?? pads[0];
  if (!gp) {
    release();
    return;
  }
  if (!usePad.getState().connected) usePad.setState({ connected: true, name: describe(gp), style: padStyle(gp.id) });
  const now = gp.buttons.map((_, i) => pressedNow(gp, i));
  const down = (i: number) => now[i] && !prev[i];
  const [lx, ly] = applyDeadzone(gp.axes[0] ?? 0, gp.axes[1] ?? 0);
  const [rx, ry] = applyDeadzone(gp.axes[2] ?? 0, gp.axes[3] ?? 0);
  const any = now.some(Boolean) || lx !== 0 || ly !== 0 || rx !== 0 || ry !== 0;
  if (any && !usePad.getState().active) usePad.setState({ active: true });

  const game = useGameStore.getState();
  const layer = activeLayer();
  const playing = game.phase === 'playing' && !game.panel && !layer;
  // a screen is up with nothing selected (it just opened, or its buttons just appeared, like the dialogue
  // options after the typing): select its main button, so the first press of the pad acts
  if (layer && usePad.getState().active) {
    const items = focusables(layer);
    if (items.length && !items.includes(document.activeElement as HTMLElement)) focusEl(firstChoice(items));
  }

  if (playing) {
    // movement: stick, or the D-pad as a digital stick (up is forward)
    let mx = lx;
    let my = -ly;
    if (now[BTN.DPAD_LEFT]) mx = -1;
    if (now[BTN.DPAD_RIGHT]) mx = 1;
    if (now[BTN.DOWN]) my = -1;
    if (mx !== 0 || my !== 0) {
      input.stickX = mx;
      input.stickY = my;
      owned.stick = true;
    } else if (owned.stick) {
      input.stickX = input.stickY = 0;
      owned.stick = false;
    }
    const run = now[BTN.RT] || now[BTN.L3];
    if (run !== owned.run) input.run = owned.run = run;
    const crouch = now[BTN.LT];
    if (crouch !== owned.crouch) input.crouch = owned.crouch = crouch;
    if (now[BTN.BOTTOM] !== owned.jump) input.jumpHeld = owned.jump = now[BTN.BOTTOM];

    const actions: [number, PressKey][] = [
      [BTN.BOTTOM, 'jump'], [BTN.LEFT, 'interact'], [BTN.TOP, 'faro'], [BTN.RIGHT, 'miado'],
      [BTN.LB, 'dash'], [BTN.RB, 'shuriken'], [BTN.UP, 'pocao'],
    ];
    for (const [b, k] of actions) if (down(b)) press(k);

    // camera: right stick, at the mouse's sensitivity and inversion settings
    if (rx !== 0 || ry !== 0) {
      const ui = useUiSettings.getState();
      const speed = 2.6 * ui.cameraSensitivity * dt;
      cameraAngle.theta -= rx * speed;
      cameraAngle.phi = Math.max(0.2, Math.min(1.0, cameraAngle.phi + ry * speed * 0.6 * (ui.invertY ? -1 : 1)));
      cameraInput.lastManual = performance.now() / 1000;
    }
    if (down(BTN.START)) key('Escape');
    if (down(BTN.SELECT)) key('KeyM');
  } else {
    release();
    // menus: D-pad or left stick moves the focus (held: repeats), bottom confirms, right goes back
    let dir: Dir | null = null;
    if (now[BTN.UP] || ly < -0.6) dir = 'up';
    else if (now[BTN.DOWN] || ly > 0.6) dir = 'down';
    else if (now[BTN.DPAD_LEFT] || lx < -0.6) dir = 'left';
    else if (now[BTN.DPAD_RIGHT] || lx > 0.6) dir = 'right';
    if (dir) {
      if (dir !== repeat.dir) {
        moveFocus(dir);
        repeat.dir = dir;
        repeat.next = t + 380;
      } else if (t >= repeat.next) {
        moveFocus(dir);
        repeat.next = t + 140;
      }
    } else repeat.dir = null;
    if (down(BTN.BOTTOM)) confirm();
    if (down(BTN.RIGHT)) back();
    if (down(BTN.START)) {
      // Start resumes from the pause, and starts the game from the main menu
      if (game.phase === 'paused' && !game.panel) key('Escape');
      else confirm();
    }
    if (down(BTN.SELECT) && game.panel === 'map') key('KeyM');
  }
  gp.buttons.forEach((_, i) => (prev[i] = now[i]));
}

/** Lets go of everything the pad was holding (it was unplugged, or a menu opened). */
function release() {
  if (owned.stick) input.stickX = input.stickY = 0;
  if (owned.run) input.run = false;
  if (owned.crouch) input.crouch = false;
  if (owned.jump) input.jumpHeld = false;
  owned.stick = owned.run = owned.crouch = owned.jump = false;
}

function describe(gp: Gamepad) {
  // "Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)" → "Xbox Wireless Controller"
  return gp.id.replace(/\s*\(.*\)\s*$/, '').trim() || 'Controle';
}

export function installGamepad() {
  if (installed || typeof window === 'undefined' || !('getGamepads' in navigator)) return;
  installed = true;
  let noticeTimer = 0;
  window.addEventListener('gamepadconnected', (e) => {
    const gp = (e as GamepadEvent).gamepad;
    usePad.setState({ connected: true, name: describe(gp), style: padStyle(gp.id), active: true, notice: `🎮 ${describe(gp)} conectado` });
    window.clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => usePad.setState({ notice: null }), 3500);
    if (!raf) raf = requestAnimationFrame(poll);
  });
  window.addEventListener('gamepaddisconnected', () => {
    const left = Array.from(navigator.getGamepads()).some((g) => g && g.connected);
    if (!left) {
      release();
      usePad.setState({ connected: false, active: false, notice: '🎮 Controle desconectado' });
      window.clearTimeout(noticeTimer);
      noticeTimer = window.setTimeout(() => usePad.setState({ notice: null }), 3000);
    }
  });
  // keyboard, mouse or touch take the hints back from the pad
  const toOther = () => {
    if (usePad.getState().active) usePad.setState({ active: false });
  };
  window.addEventListener('keydown', (e) => e.isTrusted && toOther());
  window.addEventListener('pointerdown', (e) => e.isTrusted && toOther());
  // a pad paired before the page loaded shows up only after its first button press; poll from the start
  raf = requestAnimationFrame(poll);
}

// dev: state, and a manual reading for tests when the window gets no animation frames
if (import.meta.env.DEV) Object.assign(window as unknown as Record<string, unknown>, { __pad: usePad, __padStep: step });
