import { describe, expect, it } from 'vitest';
import { validateData } from '../src/systems/validateData';
import { useGameStore } from '../src/store/gameStore';
import { NPC_DEFINITIONS } from '../src/data/npcs';
import { MISSIONS, MISSION_ORDER } from '../src/data/missions';
import { availableSteps, checkCondition } from '../src/systems/progression';

/** Data integrity and a full campaign played through the same data the game uses. */

describe('dados do jogo', () => {
  it('nenhuma referência quebrada e toda etapa tem como ser concluída', () => {
    const r = validateData();
    expect(r.errors).toEqual([]);
    expect(r.flagsOnlyRead).toEqual([]);
    expect(r.countersOnlyRead).toEqual([]);
  });
});

describe('campanha completa', () => {
  it('todas as missões podem ser iniciadas pelos moradores e concluídas, sem travar', () => {
    const st = () => useGameStore.getState();
    st().resetGame();
    useGameStore.setState({ phase: 'playing', celebrations: [] });
    const stepActions = validateData().stepActions;
    const strip = (a: string) => a.split(';').filter((x) => !x.startsWith('CHALLENGE:') && x !== 'CLOSE').join(';');

    for (let iter = 0; iter < 400; iter++) {
      let acted = false;
      const s = st();
      // a villager offers the mission when its condition holds
      for (const npc of NPC_DEFINITIONS) {
        for (const o of npc.offers ?? []) {
          if (!s.progress.missions[o.mission] && checkCondition(o.when, s.progress, s.player.coins) && checkCondition(npc.visibleWhen, s.progress)) {
            st().startMission(o.mission);
            acted = true;
          }
        }
      }
      if (acted) continue;
      // missions nobody offers (collectibles) start on their own once the first mystery is solved
      for (const id of MISSION_ORDER) {
        const offered = NPC_DEFINITIONS.some((n) => (n.offers ?? []).some((o) => o.mission === id));
        if (!st().progress.missions[id] && !offered && st().progress.missions.peixes?.status === 'done') {
          st().startMission(id);
          acted = true;
          break;
        }
      }
      if (acted) continue;
      // one available step, completed by the same data action the game would run
      outer: for (const [id, mp] of Object.entries(st().progress.missions)) {
        if (mp.status !== 'active') continue;
        for (const step of availableSteps(MISSIONS[id], st().progress)) {
          if (step.counter) {
            st().bumpCounter(step.counter.id, step.counter.goal - (st().progress.counters[step.counter.id] ?? 0));
          } else {
            const a = stepActions[`${id}.${step.id}`] ?? `STEP:${id}.${step.id}`;
            if (a.includes('COINS:-')) st().addCoins(40);
            st().runActions(strip(a));
            useGameStore.setState({ phase: 'playing', activeDialogue: null, activeChallenge: null });
          }
          acted = true;
          break outer;
        }
      }
      if (!acted) break;
    }

    const notDone = MISSION_ORDER.filter((id) => st().progress.missions[id]?.status !== 'done');
    expect(notDone).toEqual([]);
    expect(st().player.level).toBeGreaterThanOrEqual(5);
  });
});
