/**
 * Single source of player input. Keyboard and touch controls both write here;
 * gameplay code reads it every frame without React re-renders.
 */
export const input = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  run: false,
  /** Held: sneak low and quiet (C or Ctrl). */
  crouch: false,
  jumpHeld: false,
  /** Analog stick from touch controls, -1..1 (y forward). */
  stickX: 0,
  stickY: 0,
};

/** One-shot presses, consumed by whoever handles them. */
const pressed = new Set<string>();

export type PressKey = 'jump' | 'interact' | 'faro' | 'miado' | 'shuriken' | 'dash' | 'pocao';

export function press(key: PressKey) {
  pressed.add(key);
}

export function consume(key: PressKey): boolean {
  return pressed.delete(key);
}

export function clearPresses() {
  pressed.clear();
}

let installed = false;

export function installKeyboard() {
  if (installed) return;
  installed = true;

  const setKey = (code: string, down: boolean) => {
    switch (code) {
      case 'KeyW': case 'ArrowUp': input.forward = down; return true;
      case 'KeyS': case 'ArrowDown': input.backward = down; return true;
      case 'KeyA': case 'ArrowLeft': input.left = down; return true;
      case 'KeyD': case 'ArrowRight': input.right = down; return true;
      case 'ShiftLeft': case 'ShiftRight': input.run = down; return true;
      case 'Space': input.jumpHeld = down; return true;
      case 'KeyC': case 'ControlLeft': input.crouch = down; return true;
    }
    return false;
  };

  window.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    if (setKey(e.code, true) && e.code === 'Space') e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'Space') press('jump');
    if (e.code === 'KeyE') press('interact');
    // Ninja abilities on 1–4 (design brief); Q and R stay as shortcuts for Faro and Miado.
    if (e.code === 'Digit1' || e.code === 'Numpad1') press('shuriken');
    if (e.code === 'Digit2' || e.code === 'Numpad2') press('dash');
    if (e.code === 'Digit3' || e.code === 'Numpad3') press('pocao');
    if (e.code === 'Digit4' || e.code === 'Numpad4' || e.code === 'KeyQ') press('faro');
    if (e.code === 'KeyR') press('miado');
  });
  window.addEventListener('keyup', (e) => setKey(e.code, false));
  window.addEventListener('blur', () => {
    input.forward = input.backward = input.left = input.right = input.run = input.crouch = input.jumpHeld = false;
  });
}
