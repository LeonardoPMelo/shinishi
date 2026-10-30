import type { Condition, Mission, MissionStep, Progress } from '../types';

export const emptyProgress = (): Progress => ({
  missions: {},
  flags: {},
  counters: {},
  inventory: {},
  abilities: [],
  tracked: null,
  learning: {},
  solved: [],
  equipped: {},
});

const list = (v?: string | string[]) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

export function isStepDone(p: Progress, ref: string): boolean {
  const [missionId, stepId] = ref.split('.');
  return p.missions[missionId]?.steps.includes(stepId) ?? false;
}

export function checkCondition(cond: Condition | undefined, p: Progress, coins = 0): boolean {
  if (!cond) return true;
  if (cond.coins !== undefined && coins < cond.coins) return false;
  if (cond.active && p.missions[cond.active]?.status !== 'active') return false;
  if (!list(cond.done).every((m) => p.missions[m]?.status === 'done')) return false;
  if (cond.notStarted && p.missions[cond.notStarted]) return false;
  if (cond.notDone && p.missions[cond.notDone]?.status === 'done') return false;
  if (!list(cond.step).every((r) => isStepDone(p, r))) return false;
  if (list(cond.notStep).some((r) => isStepDone(p, r))) return false;
  if (!list(cond.flag).every((f) => p.flags[f])) return false;
  if (list(cond.notFlag).some((f) => p.flags[f])) return false;
  if (cond.item && (p.inventory[cond.item.id] ?? 0) < (cond.item.count ?? 1)) return false;
  if (cond.counter && (p.counters[cond.counter.id] ?? 0) < cond.counter.atLeast) return false;
  if (cond.ability && !p.abilities.includes(cond.ability)) return false;
  if (cond.wearing && !Object.values(p.equipped ?? {}).includes(cond.wearing)) return false;
  return true;
}

function prerequisites(mission: Mission, index: number): string[] {
  const step = mission.steps[index];
  if (step.after) return step.after;
  return index === 0 ? [] : [mission.steps[index - 1].id];
}

/** Steps the player can work on right now (unlocked and not yet done). */
export function availableSteps(mission: Mission, p: Progress): MissionStep[] {
  const done = p.missions[mission.id]?.steps ?? [];
  return mission.steps.filter(
    (s, i) => !done.includes(s.id) && prerequisites(mission, i).every((d) => done.includes(d))
  );
}

export function isStepAvailable(mission: Mission, stepId: string, p: Progress): boolean {
  return availableSteps(mission, p).some((s) => s.id === stepId);
}

export interface ParsedAction {
  cmd: string;
  arg: string;
  amount: number;
}

export function parseActions(actions: string | undefined): ParsedAction[] {
  if (!actions) return [];
  return actions
    .split(';')
    .map((a) => a.trim())
    .filter(Boolean)
    .map((a) => {
      const [cmd, arg = '', amount] = a.split(':');
      return { cmd, arg, amount: amount === undefined ? 1 : Number(amount) };
    });
}
