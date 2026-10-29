import type { PlayerStats, Progress, MissionProgress, SkillRecord } from '../types';
import { MISSIONS } from '../data/missions';
import { emptyProgress } from '../systems/progression';
import { levelForXp } from '../systems/leveling';

/**
 * Repairs a saved game before the store uses it. A save from an older version, cut short, or edited by hand
 * used to reach the game with fields missing (`progress.flags`, `progress.counters`...), and the first
 * component that read one crashed the whole game on every load, menu included, with no way out.
 *
 * Every field is checked and filled from the defaults: numbers must be finite and not negative, lists must be
 * lists of text, missions and steps must exist in the current game data. Level and rank are recomputed from
 * the XP. A valid save comes out unchanged.
 */

type Rank = PlayerStats['rank'];

export interface SanitizeDefaults {
  player: PlayerStats;
  baseAbilities: string[];
  rankFor: (level: number) => Rank;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback);
const strings = (v: unknown) => (Array.isArray(v) ? Array.from(new Set(v.filter((x): x is string => typeof x === 'string'))) : []);

function record<T>(v: unknown, keep: (x: unknown) => T | undefined): Record<string, T> {
  const out: Record<string, T> = {};
  if (!isObj(v)) return out;
  for (const [k, x] of Object.entries(v)) {
    const y = keep(x);
    if (y !== undefined) out[k] = y;
  }
  return out;
}

export function sanitizePlayer(raw: unknown, d: SanitizeDefaults): PlayerStats {
  const p = isObj(raw) ? raw : {};
  const xp = Math.floor(num(p.xp, d.player.xp));
  const level = levelForXp(xp);
  const maxHp = num(p.maxHp, d.player.maxHp) || d.player.maxHp;
  return {
    xp,
    level,
    rank: d.rankFor(level),
    coins: Math.floor(num(p.coins, d.player.coins)),
    gems: Math.floor(num(p.gems, d.player.gems)),
    hp: Math.min(maxHp, num(p.hp, maxHp)),
    maxHp,
    completedMissions: strings(p.completedMissions).filter((id) => MISSIONS[id]),
    badges: strings(p.badges),
  };
}

function mission(id: string, v: unknown): MissionProgress | undefined {
  const m = MISSIONS[id];
  if (!m || !isObj(v) || (v.status !== 'active' && v.status !== 'done')) return undefined;
  const known = new Set(m.steps.map((s) => s.id));
  return { status: v.status, steps: strings(v.steps).filter((s) => known.has(s)) };
}

export function sanitizeProgress(raw: unknown, d: SanitizeDefaults): Progress {
  const base = emptyProgress();
  const p = isObj(raw) ? raw : {};
  const missions: Progress['missions'] = {};
  if (isObj(p.missions)) {
    for (const [id, v] of Object.entries(p.missions)) {
      const m = mission(id, v);
      if (m) missions[id] = m;
    }
  }
  const abilities = strings(p.abilities);
  for (const a of d.baseAbilities) if (!abilities.includes(a)) abilities.push(a);
  const tracked = typeof p.tracked === 'string' && missions[p.tracked]?.status === 'active' ? p.tracked : null;
  return {
    ...base,
    missions,
    flags: record(p.flags, (x) => (typeof x === 'boolean' ? x : undefined)),
    counters: record(p.counters, (x) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : undefined)),
    inventory: record(p.inventory, (x) => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? Math.floor(x) : undefined)),
    abilities,
    tracked,
    learning: record<SkillRecord>(p.learning, (x) =>
      isObj(x) ? { solved: Math.floor(num(x.solved, 0)), firstTry: Math.floor(num(x.firstTry, 0)), wrong: Math.floor(num(x.wrong, 0)) } : undefined,
    ),
    solved: strings(p.solved),
  };
}

/** The persisted part of the store ({ player, progress }), repaired. */
export function sanitizeSave(raw: unknown, d: SanitizeDefaults): { player: PlayerStats; progress: Progress } {
  const s = isObj(raw) ? raw : {};
  return { player: sanitizePlayer(s.player, d), progress: sanitizeProgress(s.progress, d) };
}
