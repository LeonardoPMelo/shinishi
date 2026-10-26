import { useEffect } from 'react';
import { audio } from './engine';
import { music, stinger, type TrackId } from './music';
import { playSfx } from './sfx';
import { ambience } from './ambience';
import { onGameEvent } from '../systems/events';
import { useGameStore } from '../store/gameStore';
import { MISSIONS } from '../data/missions';
import { NPC_DEFINITIONS } from '../data/npcs';
import { GARDEN } from '../data/world';
import { checkCondition } from '../systems/progression';
import { playerPosition } from '../game/systems/playerState';

/**
 * Connects game events and state to the audio system. Game logic never calls audio directly;
 * it only emits events, so audio can be muted, replaced or removed without touching missions.
 */

function inGarden() {
  return playerPosition.x < GARDEN.maxX && playerPosition.z < GARDEN.maxZ;
}

function inForest() {
  return playerPosition.z > 25.5;
}

/** Music rules, highest priority first. Dialogue never restarts the area music. */
function desiredTrack(previous: TrackId | null): { id: TrackId; immediate: boolean } {
  const s = useGameStore.getState();
  if (s.phase === 'menu') return { id: 'menu', immediate: true };
  if (s.celebrations.length > 0) return { id: 'festival', immediate: true };
  if (s.phase === 'challenge') return { id: 'puzzle', immediate: true };
  if (s.phase === 'dialogue' && s.activeDialogue) {
    const node = s.activeDialogue.tree[s.activeDialogue.currentNodeId];
    if (s.activeDialogue.npcId === 'kuro') return { id: 'secret', immediate: true };
    if (node?.mood === 'sad') return { id: 'emotional', immediate: true };
    if (previous === 'emotional' || previous === 'secret') return { id: previous, immediate: true };
  }
  if (inGarden()) return { id: 'secret', immediate: false };
  const flags = s.progress.flags;
  const nearPlaza = Math.hypot(playerPosition.x, playerPosition.z) < 13;
  if (nearPlaza && flags.lanternas_escuras && !flags.lanternas_reacesas) return { id: 'investigation', immediate: false };
  if (nearPlaza && flags.festival_aceso) return { id: 'festival', immediate: false };
  if (inForest()) {
    return { id: s.progress.missions.treino?.status === 'active' ? 'training' : 'forest', immediate: false };
  }
  const tracked = s.progress.tracked ? MISSIONS[s.progress.tracked] : null;
  if (tracked && s.progress.missions[tracked.id]?.status === 'active') {
    if (tracked.category === 'investigação') return { id: 'investigation', immediate: false };
    if (tracked.category === 'cômica') return { id: 'comic', immediate: false };
  }
  return { id: 'village', immediate: false };
}

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__audio = { audio, music, playSfx };
}

export function AudioBridge() {
  // Unlock audio on the first real user gesture only.
  useEffect(() => {
    const unlock = () => audio.unlock();
    const opts = { capture: true } as const;
    window.addEventListener('pointerdown', unlock, opts);
    window.addEventListener('keydown', unlock, opts);
    window.addEventListener('touchstart', unlock, opts);
    return () => {
      window.removeEventListener('pointerdown', unlock, opts);
      window.removeEventListener('keydown', unlock, opts);
      window.removeEventListener('touchstart', unlock, opts);
    };
  }, []);

  // Game events → sound effects and stingers.
  useEffect(() => {
    let lastBigMoment = 0;
    return onGameEvent((e) => {
      const now = performance.now();
      switch (e.type) {
        case 'sfx':
          playSfx(e.name, { position: e.position });
          break;
        case 'dialogueOpen':
          playSfx('ui_open');
          break;
        case 'dialogueClose':
          playSfx('ui_close');
          break;
        case 'missionStart':
          stinger('missionStart');
          lastBigMoment = now;
          break;
        case 'step':
          if (now - lastBigMoment > 400) stinger('step');
          break;
        case 'missionComplete':
          stinger('victory');
          lastBigMoment = now;
          break;
        case 'coins':
          if (now - lastBigMoment > 600) playSfx('coin');
          break;
        case 'gems':
          // after the coin, so both read when a challenge pays out
          setTimeout(() => playSfx('gem'), now - lastBigMoment > 600 ? 180 : 700);
          break;
        case 'item':
          if (e.itemId === 'peixe') playSfx('pickup_fish');
          else if (now - lastBigMoment > 600) playSfx(e.itemId === 'pata_dourada' ? 'coin' : 'item');
          break;
        case 'levelUp':
          setTimeout(() => stinger('levelUp'), 900);
          break;
        case 'ability':
          stinger('learn');
          break;
        case 'secret':
          stinger('secret');
          break;
        case 'challenge':
          playSfx(e.result === 'correct' ? 'challenge_correct' : 'challenge_wrong');
          break;
      }
    });
  }, []);

  // Buttons give a soft click everywhere in the UI.
  useEffect(() => {
    const onClick = (ev: MouseEvent) => {
      if ((ev.target as HTMLElement | null)?.closest('button')) playSfx('ui_select');
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // Adaptive music, ducking and ambience.
  useEffect(() => {
    let candidate: TrackId | null = null;
    let candidateSince = 0;
    const id = window.setInterval(() => {
      const s = useGameStore.getState();
      const { id: wanted, immediate } = desiredTrack(music.playing);
      const t = performance.now();
      if (wanted !== candidate) {
        candidate = wanted;
        candidateSince = t;
      }
      // Area changes must hold for a moment so walking along a border doesn't flip tracks.
      if (wanted !== music.playing && (immediate || t - candidateSince > 1500)) {
        music.request(wanted, wanted === 'festival' || wanted === 'puzzle' ? 1.2 : 2.4);
      }

      if (audio.ready) {
        if (s.phase === 'paused') audio.duck(0.35, 0.25);
        else if (s.phase === 'dialogue') audio.duck(0.7, 0.6);
        else audio.duck(1, 1);
      }

      ambience.update({
        x: playerPosition.x,
        z: playerPosition.z,
        inGarden: inGarden(),
        inForest: inForest(),
        active: s.phase !== 'menu' && s.phase !== 'paused',
        nekoSleeping: s.progress.missions.fantasma?.status !== 'done',
        npcPositions: NPC_DEFINITIONS
          .filter((n) => checkCondition(n.visibleWhen, s.progress))
          .map((n) => ({ pos: [n.position[0], 1, n.position[2]] as [number, number, number], voice: n.voice })),
      });
    }, 300);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
