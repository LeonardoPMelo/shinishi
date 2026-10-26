/**
 * Dev-only check of the first minute (Etapa 7). A simulated new player: resets the save, presses
 * "Começar", waits for the golden prints, walks where they point (the camera stays behind the cat, as
 * set by the game), presses E near the villager and reads the dialogue to the end. Timings are real
 * seconds (each frame is a busy-waited ~16 ms). The save is reset again at the end.
 *
 *   __onb.firstMinute()   → synchronous (React is flushed every frame); the result also lands in window.__onbRes
 */
import { abilityState, playerPosition, playerBody, now, SPAWN } from '../game/systems/playerState';
import { input, press } from '../game/systems/input';
import { flushSync } from 'react-dom';
import { useGameStore } from '../store/gameStore';
import { currentObjective } from '../systems/objective';

type AnyWin = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const w = () => window as unknown as AnyWin;

function frame() {
  const t = performance.now();
  while (performance.now() - t < 16) { /* real time for the frame */ }
  w().__r3f.advance(performance.now() / 1000);
}

/** Renders pending React updates now (the HUD, the dialogue): the loop is synchronous, so it works with the window hidden. */
const render = () => flushSync(() => {});
const readTrail = () => abilityState.trail;

function firstMinute(limit = 40) {
  const store = useGameStore;
  store.getState().resetGame();
  // a new game starts at the spawn point, with the default camera
  const body = playerBody.current!;
  body.setTranslation({ x: SPAWN.x, y: SPAWN.y + 0.2, z: SPAWN.z }, true);
  body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  abilityState.trail = null;
  Object.assign(w().__cam, { theta: 0, phi: 0.42, distance: 7 });
  for (let k = 0; k < 10; k++) frame();
  store.getState().startGame();
  const t0 = now();
  const at = (): number => +(now() - t0).toFixed(1);
  const out: Record<string, number | string | null> = {
    objectiveText: null, objectiveShown: null, firstPrints: null, reachedVillager: null, dialogueOpen: null, missionActive: null, tracker: null,
    dialogueScreens: 0, dialogueWords: 0, mission: null, closest: null,
  };
  const cam = w().__cam;
  w().__onbRes = null;
  w().__onbI = 0;
  for (let i = 0; i < limit * 60 && out.missionActive === null; i++) {
    frame();
    w().__onbI = i;
    render();
    const s = store.getState();
    if (out.objectiveShown === null && document.querySelector('.hud-objective')) {
      out.objectiveShown = at();
      out.objectiveText = (document.querySelector('.hud-objective .mission-title') as HTMLElement | null)?.innerText ?? null;
    }
    const live = readTrail();
    const trail = live && now() < live.until ? live : null;
    if (trail && out.firstPrints === null) out.firstPrints = at();
    if (s.phase === 'dialogue') {
      if (out.dialogueOpen === null) out.dialogueOpen = at();
      if (out.reachedVillager === null) out.reachedVillager = at();
      input.stickX = input.stickY = 0;
      // a fast click-through (the time a child spends reading is theirs; the screens and words are counted)
      if (i % 20 === 0) {
        (document.querySelector('.dialogue-overlay') as HTMLElement | null)?.click(); // finish the typing
        render();
        const opt = document.querySelector('.dialogue-option') as HTMLButtonElement | null;
        const next = document.querySelector('.dialogue-continue') as HTMLButtonElement | null;
        const text = (document.querySelector('.dialogue-text') as HTMLElement | null)?.innerText ?? '';
        if (opt || next) {
          out.dialogueScreens = (out.dialogueScreens as number) + 1;
          out.dialogueWords = (out.dialogueWords as number) + text.split(/\s+/).filter(Boolean).length;
          (opt ?? next)!.click();
          render();
        }
      }
    } else if (s.phase === 'playing') {
      const goal = currentObjective(s.progress, playerPosition)?.position;
      // only walks once the prints have shown the way (before that, a new player looks around)
      if (goal && out.firstPrints !== null) {
        const dx = goal[0] - playerPosition.x;
        const dz = goal[2] - playerPosition.z;
        const d = Math.hypot(dx, dz);
        out.closest = Math.min((out.closest as number | null) ?? Infinity, +d.toFixed(2));
        // the [E] tag shows within the villager's reach: a child presses E as soon as they see it
        if (d < 3 && i % 15 === 0) press('interact');
        if (d < 1.6) {
          input.stickX = input.stickY = 0;
          if (out.reachedVillager === null) out.reachedVillager = at();
        } else {
          const th = cam.theta;
          input.stickY = (dx * -Math.sin(th) + dz * -Math.cos(th)) / d;
          input.stickX = (dx * Math.cos(th) + dz * -Math.sin(th)) / d;
        }
      }
    }
    const active = Object.keys(s.progress.missions).find((id) => s.progress.missions[id].status === 'active');
    if (active) {
      out.missionActive = at();
      out.mission = active;
      for (let k = 0; k < 10; k++) {
        frame();
        render();
      }
      out.tracker = (document.querySelector('.hud-mission:not(.hud-objective) .mission-title') as HTMLElement | null)?.innerText ?? null;
    }
  }
  input.stickX = input.stickY = 0;
  out.endedAt = `${playerPosition.x.toFixed(1)}, ${playerPosition.z.toFixed(1)}`;
  store.getState().resetGame();
  w().__onbRes = out;
  return out;
}

w().__onb = {
  input,
  firstMinute: (limit?: number) => {
    try {
      return firstMinute(limit);
    } catch (e) {
      w().__onbRes = { error: String((e as Error)?.stack ?? e) };
      return w().__onbRes;
    }
  },
};
