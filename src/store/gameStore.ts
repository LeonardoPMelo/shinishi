import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GamePhase, PlayerStats, DialogueTree, Challenge, Progress, Mission, Skill, ItemEffect, EquipSlot } from '../types';
import { emptyProgress, availableSteps, parseActions, checkCondition } from '../systems/progression';
import { emit } from '../systems/events';
import { levelForXp } from '../systems/leveling';
import { MISSIONS } from '../data/missions';
import { CHALLENGES } from '../data/challenges';
import { CHALLENGE_REWARD, emptySkill } from '../data/skills';
import { ALL_OFFERS } from '../data/shops';
import { sanitizeSave } from './saveSanitize';
import { buy, sell, useItem as useItemRule, equip, unequip, withItem, type BuyResult, type SellResult, type UseResult, type EquipResult } from '../systems/inventory';

export type ShopBuyResult = BuyResult | 'locked' | 'busy';

/** A second click on the same offer this soon is a double click, not a second purchase. */
export const REPEAT_BUY_MS = 350;
let lastBuy = { offer: '', at: -Infinity };

interface ActiveDialogue {
  npcId: string;
  npcName: string;
  tree: DialogueTree;
  currentNodeId: string;
}

interface ActiveChallenge {
  challenge: Challenge;
  attempts: number;
  showHint: boolean;
  /** Help cards shown: 1 observe, 2 hint, 3 worked example (wrong answers or "Pedir dica"). */
  hintLevel: number;
  solved: boolean;
  /** What solving it paid (null when it had already been solved before). */
  reward: { xp: number; coins: number; gems: number; firstTry: boolean } | null;
}

export type Panel = 'missions' | 'inventory' | 'journey' | 'map' | 'settings' | 'shop' | null;

interface GameStore {
  phase: GamePhase;
  player: PlayerStats;
  progress: Progress;
  nearbyInteractableId: string | null;
  nearbyInteractableLabel: string | null;
  activeDialogue: ActiveDialogue | null;
  activeChallenge: ActiveChallenge | null;
  panel: Panel;
  celebrations: string[];

  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  openPanel: (panel: Panel) => void;

  setNearby: (id: string | null, label: string | null) => void;

  openDialogue: (npcId: string, npcName: string, tree: DialogueTree, startId: string) => void;
  chooseOption: (nextNodeId: string | null, action?: string) => void;
  closeDialogue: () => void;

  runActions: (actions: string | undefined) => void;
  startMission: (missionId: string) => void;
  completeStep: (missionId: string, stepId: string) => void;
  completeMission: (missionId: string) => void;
  trackMission: (missionId: string) => void;
  setFlag: (flag: string, value?: boolean) => void;
  addItem: (itemId: string, amount?: number) => void;
  bumpCounter: (counterId: string, amount?: number) => void;

  openChallenge: (challengeId: string) => void;
  submitAnswer: (answer: number) => 'correct' | 'wrong';
  closeChallenge: () => void;
  /** The child asks for the next help card without having to get it wrong first. */
  revealHint: () => void;

  addXp: (amount: number) => void;
  addCoins: (amount: number) => void;
  addGems: (amount: number) => void;
  /** Sora's shop: spends gems on an offer. Bands can only be bought once. */
  /** Which shop the shop panel shows (data/shops.ts). */
  shopId: string;
  /** Buys an offer from any shop; 'locked' before its unlock, 'busy' for a repeated click (Etapa 6). */
  buyOffer: (offerId: string) => ShopBuyResult;
  /** Sells items for coins (rules in systems/inventory.ts). */
  sellItem: (itemId: string, qty?: number) => SellResult;
  /** Spends one usable item; returns its effect for the game to apply. */
  useItem: (itemId: string) => { result: UseResult; effect?: ItemEffect };
  /** Wears an item in its slot. */
  equipItem: (itemId: string) => EquipResult;
  unequipSlot: (slot: EquipSlot) => void;
  /** Learning record for any practice (challenges, the Alvo dos Números). */
  recordPractice: (skill: Skill, correct: boolean, firstTry?: boolean) => void;
  addBadge: (badge: string) => void;
  dismissCelebration: () => void;

  resetGame: () => void;
}

const initialPlayer: PlayerStats = {
  xp: 0,
  level: 1,
  rank: 'Aprendiz',
  coins: 0,
  gems: 0,
  hp: 100,
  maxHp: 100,
  completedMissions: [],
  badges: [],
};

const BASE_ABILITIES = ['faro', 'miado'];

function calcRank(level: number): PlayerStats['rank'] {
  if (level >= 9) return 'Mestre das Patas';
  if (level >= 6) return 'Guardião';
  if (level >= 3) return 'Explorador';
  return 'Aprendiz';
}

/** Completes any available step whose counter goal has been reached (repeats for chained steps). */
function settleCounterSteps(get: () => GameStore) {
  for (let guard = 0; guard < 10; guard++) {
    const { progress, completeStep } = get();
    let changed = false;
    for (const [missionId, mp] of Object.entries(progress.missions)) {
      if (mp.status !== 'active') continue;
      const mission = MISSIONS[missionId];
      if (!mission) continue;
      for (const step of availableSteps(mission, progress)) {
        if (step.counter && (progress.counters[step.counter.id] ?? 0) >= step.counter.goal) {
          completeStep(missionId, step.id);
          changed = true;
        }
      }
    }
    if (!changed) return;
  }
}

function nextTracked(progress: Progress): string | null {
  const active = Object.entries(progress.missions).find(([, m]) => m.status === 'active');
  return active ? active[0] : null;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      phase: 'menu',
      player: initialPlayer,
      progress: { ...emptyProgress(), abilities: [...BASE_ABILITIES] },
      nearbyInteractableId: null,
      nearbyInteractableLabel: null,
      activeDialogue: null,
      activeChallenge: null,
      panel: null,
      shopId: 'sora',
      celebrations: [],

      startGame: () => set({ phase: 'playing' }),
      pauseGame: () => set((s) => (s.phase === 'playing' ? { phase: 'paused' } : {})),
      resumeGame: () => set((s) => (s.phase === 'paused' ? { phase: 'playing', panel: null } : {})),
      openPanel: (panel) =>
        set((s) => {
          if (panel === null) return { panel: null, phase: s.phase === 'paused' ? 'playing' : s.phase };
          if (s.phase !== 'playing' && s.phase !== 'paused') return {};
          return { panel, phase: 'paused' };
        }),

      setNearby: (id, label) => set({ nearbyInteractableId: id, nearbyInteractableLabel: label }),

      openDialogue: (npcId, npcName, tree, startId) => {
        if (!tree[startId]) return;
        set({ phase: 'dialogue', activeDialogue: { npcId, npcName, tree, currentNodeId: startId } });
        emit({ type: 'dialogueOpen', npcId });
        get().runActions(tree[startId].onEnter);
      },

      chooseOption: (nextNodeId, action) => {
        const before = get().activeDialogue;
        if (!before) return;
        get().runActions(action);
        const after = get();
        // An action may have closed the dialogue (CLOSE) or opened a challenge.
        if (after.activeDialogue !== before || after.phase !== 'dialogue') return;
        if (nextNodeId === null || !before.tree[nextNodeId]) {
          get().closeDialogue();
          return;
        }
        set({ activeDialogue: { ...before, currentNodeId: nextNodeId } });
        get().runActions(before.tree[nextNodeId].onEnter);
      },

      closeDialogue: () => {
        if (!get().activeDialogue) return;
        set((s) => ({ phase: s.phase === 'dialogue' ? 'playing' : s.phase, activeDialogue: null }));
        emit({ type: 'dialogueClose' });
      },

      runActions: (actions) => {
        for (const { cmd, arg, amount } of parseActions(actions)) {
          const s = get();
          switch (cmd) {
            case 'START': s.startMission(arg); break;
            case 'STEP': {
              const [m, st] = arg.split('.');
              s.completeStep(m, st);
              break;
            }
            case 'FLAG': s.setFlag(arg, true); break;
            case 'UNFLAG': s.setFlag(arg, false); break;
            case 'GIVE': s.addItem(arg, amount); break;
            case 'TAKE': s.addItem(arg, -amount); break;
            case 'COINS': s.addCoins(Number(arg)); break;
            case 'GEMS': s.addGems(Number(arg)); break;
            case 'XP': s.addXp(Number(arg)); break;
            case 'COUNT': s.bumpCounter(arg, amount); break;
            case 'ABILITY':
              if (!s.progress.abilities.includes(arg)) {
                set({ progress: { ...s.progress, abilities: [...s.progress.abilities, arg] } });
                emit({ type: 'ability', abilityId: arg });
              }
              break;
            case 'TRACK': s.trackMission(arg); break;
            case 'SFX': emit({ type: 'sfx', name: arg }); break;
            // a skill practised outside the challenge box (temple puzzles)
            case 'SKILL': s.recordPractice(arg as Skill, true); break;
            case 'SECRET': emit({ type: 'secret', id: arg }); break;
            case 'CHALLENGE':
              s.closeDialogue();
              s.openChallenge(arg);
              return;
            case 'CLOSE':
              s.closeDialogue();
              return;
            // through the Trilha da Expedição (zone.ts listens; the store knows nothing about the scene)
            case 'TRAVEL': emit({ type: 'travel', to: arg }); break;
            case 'SHOP':
              s.closeDialogue();
              set({ shopId: arg || 'sora' });
              s.openPanel('shop');
              return;
          }
        }
      },

      startMission: (missionId) => {
        const s = get();
        if (!MISSIONS[missionId] || s.progress.missions[missionId]) return;
        // Side collectibles shouldn't steal the tracker from the mission the player is following.
        const current = s.progress.tracked;
        const keepCurrent = !!current && s.progress.missions[current]?.status === 'active' && MISSIONS[missionId].category === 'exploração' && !MISSIONS[missionId].giver;
        set({
          progress: {
            ...s.progress,
            missions: { ...s.progress.missions, [missionId]: { status: 'active', steps: [] } },
            tracked: keepCurrent ? current : missionId,
          },
        });
        emit({ type: 'missionStart', missionId });
        settleCounterSteps(get);
      },

      completeStep: (missionId, stepId) => {
        const s = get();
        const mission = MISSIONS[missionId];
        const mp = s.progress.missions[missionId];
        if (!mission || !mp || mp.status !== 'active' || mp.steps.includes(stepId)) return;
        if (!availableSteps(mission, s.progress).some((st) => st.id === stepId)) return;
        const steps = [...mp.steps, stepId];
        set({
          progress: {
            ...s.progress,
            missions: { ...s.progress.missions, [missionId]: { ...mp, steps } },
          },
        });
        emit({ type: 'step', missionId, stepId });
        if (mission.steps.every((st) => steps.includes(st.id))) get().completeMission(missionId);
        else settleCounterSteps(get);
      },

      completeMission: (missionId) => {
        const s = get();
        const mission: Mission | undefined = MISSIONS[missionId];
        const mp = s.progress.missions[missionId];
        if (!mission || !mp || mp.status === 'done') return;
        const progress: Progress = {
          ...s.progress,
          missions: { ...s.progress.missions, [missionId]: { ...mp, status: 'done' } },
        };
        progress.tracked = progress.tracked === missionId ? nextTracked(progress) : progress.tracked;
        set({
          progress,
          celebrations: [...s.celebrations, missionId],
          player: { ...s.player, completedMissions: [...s.player.completedMissions, missionId] },
        });
        emit({ type: 'missionComplete', missionId });
        const r = mission.rewards;
        get().addXp(r.xp);
        get().addCoins(r.coins);
        if (r.gems) get().addGems(r.gems);
        r.badges?.forEach(get().addBadge);
        Object.entries(r.items ?? {}).forEach(([id, n]) => get().addItem(id, n));
        if (r.ability) get().runActions(`ABILITY:${r.ability}`);
        get().runActions(mission.onComplete);
      },

      trackMission: (missionId) =>
        set((s) => (s.progress.missions[missionId]?.status === 'active'
          ? { progress: { ...s.progress, tracked: missionId } }
          : {})),

      setFlag: (flag, value = true) =>
        set((s) => ({ progress: { ...s.progress, flags: { ...s.progress.flags, [flag]: value } } })),

      buyOffer: (offerId) => {
        const s = get();
        const o = ALL_OFFERS[offerId];
        if (!o) return 'unknown';
        if (!checkCondition(o.when, s.progress)) return 'locked';
        const { result, bag } = buy({ player: s.player, progress: s.progress }, o);
        // a refusal (no money, already yours) is always said; only a purchase that would go through twice in a
        // blink is taken as a double click
        if (result !== 'ok') return result;
        const t = performance.now();
        if (lastBuy.offer === offerId && t - lastBuy.at < REPEAT_BUY_MS) return 'busy';
        lastBuy = { offer: offerId, at: t };
        set({ player: bag.player, progress: bag.progress });
        emit({ type: 'item', itemId: o.item, amount: o.qty });
        if (o.shop === 'sora') get().bumpCounter('compras_sora');
        emit({ type: 'sfx', name: 'coin' });
        return 'ok';
      },

      sellItem: (itemId, qty = 1) => {
        const s = get();
        const r = sell({ player: s.player, progress: s.progress }, itemId, qty);
        if (r.result !== 'ok') return r.result;
        set({ player: r.bag.player, progress: r.bag.progress });
        emit({ type: 'coins', amount: r.coins });
        emit({ type: 'sfx', name: 'coin' });
        return 'ok';
      },

      useItem: (itemId) => {
        const s = get();
        const r = useItemRule({ player: s.player, progress: s.progress }, itemId);
        if (r.result === 'ok') set({ progress: r.bag.progress });
        return { result: r.result, effect: r.effect };
      },

      equipItem: (itemId) => {
        const r = equip(get().progress, itemId);
        if (r.result === 'ok') set({ progress: r.progress });
        return r.result;
      },

      unequipSlot: (slot) => set((s) => ({ progress: unequip(s.progress, slot) })),

      addItem: (itemId, amount = 1) => {
        set((s) => ({ progress: withItem(s.progress, itemId, amount) }));
        if (amount > 0) emit({ type: 'item', itemId, amount });
      },

      bumpCounter: (counterId, amount = 1) => {
        set((s) => ({
          progress: {
            ...s.progress,
            counters: { ...s.progress.counters, [counterId]: (s.progress.counters[counterId] ?? 0) + amount },
          },
        }));
        settleCounterSteps(get);
      },

      openChallenge: (challengeId) => {
        const challenge = CHALLENGES[challengeId];
        if (!challenge) return;
        set({ phase: 'challenge', activeChallenge: { challenge, attempts: 0, showHint: false, hintLevel: 0, solved: false, reward: null } });
      },

      submitAnswer: (answer) => {
        const { activeChallenge } = get();
        if (!activeChallenge || activeChallenge.solved) return 'wrong';
        const c = activeChallenge.challenge;
        if (answer === c.answer) {
          const firstTry = activeChallenge.attempts === 0;
          const already = get().progress.solved.includes(c.id);
          // Rewards are paid once per challenge; the learning record counts every solve.
          const reward = already ? null : {
            xp: CHALLENGE_REWARD.xp,
            coins: CHALLENGE_REWARD.coins,
            gems: CHALLENGE_REWARD.gems + (firstTry ? CHALLENGE_REWARD.firstTryBonusGems : 0),
            firstTry,
          };
          set((s) => ({
            activeChallenge: { ...activeChallenge, solved: true, reward },
            progress: already ? s.progress : { ...s.progress, solved: [...s.progress.solved, c.id] },
          }));
          get().recordPractice(c.skill, true, firstTry);
          if (reward) {
            get().addXp(reward.xp);
            get().addCoins(reward.coins);
            get().addGems(reward.gems);
          }
          get().runActions(c.onSuccess);
          emit({ type: 'challenge', result: 'correct', skill: c.skill, firstTry });
          return 'correct';
        }
        const attempts = activeChallenge.attempts + 1;
        // each mistake opens the next help card (never more than three)
        const hintLevel = Math.min(3, activeChallenge.hintLevel + 1);
        set({ activeChallenge: { ...activeChallenge, attempts, hintLevel, showHint: hintLevel >= 2 } });
        get().recordPractice(c.skill, false);
        emit({ type: 'challenge', result: 'wrong', skill: c.skill });
        return 'wrong';
      },

      closeChallenge: () => set({ phase: 'playing', activeChallenge: null }),

      revealHint: () =>
        set((s) => {
          const a = s.activeChallenge;
          if (!a || a.solved || a.hintLevel >= 3) return {};
          const hintLevel = a.hintLevel + 1;
          return { activeChallenge: { ...a, hintLevel, showHint: hintLevel >= 2 } };
        }),

      addXp: (amount) => {
        const before = get().player.level;
        set((s) => {
          const xp = s.player.xp + amount;
          const level = levelForXp(xp);
          return { player: { ...s.player, xp, level, rank: calcRank(level) } };
        });
        emit({ type: 'xp', amount });
        const after = get().player.level;
        if (after > before) emit({ type: 'levelUp', level: after });
      },

      addCoins: (amount) => {
        set((s) => ({ player: { ...s.player, coins: Math.max(0, s.player.coins + amount) } }));
        if (amount > 0) emit({ type: 'coins', amount });
      },

      addGems: (amount) => {
        set((s) => ({ player: { ...s.player, gems: Math.max(0, (s.player.gems ?? 0) + amount) } }));
        if (amount > 0) emit({ type: 'gems', amount });
      },

      recordPractice: (skill, correct, firstTry = false) =>
        set((s) => {
          const r = { ...(s.progress.learning[skill] ?? emptySkill()) };
          if (correct) {
            r.solved += 1;
            if (firstTry) r.firstTry += 1;
          } else r.wrong += 1;
          return { progress: { ...s.progress, learning: { ...s.progress.learning, [skill]: r } } };
        }),

      addBadge: (badge) =>
        set((s) => ({
          player: {
            ...s.player,
            badges: s.player.badges.includes(badge) ? s.player.badges : [...s.player.badges, badge],
          },
        })),

      dismissCelebration: () => set((s) => ({ celebrations: s.celebrations.slice(1) })),

      resetGame: () =>
        set({
          player: initialPlayer,
          progress: { ...emptyProgress(), abilities: [...BASE_ABILITIES] },
          activeDialogue: null,
          activeChallenge: null,
          celebrations: [],
          panel: null,
        }),
    }),
    {
      name: 'shinichi-save',
      version: 4,
      partialize: (s) => ({ player: s.player, progress: s.progress }),
      migrate: (persisted, version) => {
        const old = persisted as { player?: PlayerStats; progress?: Progress };
        let player = old.player ?? initialPlayer;
        let progress = old.progress;
        if (version < 2 || !progress) {
          progress = { ...emptyProgress(), abilities: [...BASE_ABILITIES] };
          for (const id of player.completedMissions) {
            const mission = MISSIONS[id];
            if (mission) progress.missions[id] = { status: 'done', steps: mission.steps.map((st) => st.id) };
          }
        }
        if (version < 3) {
          // XP curve changed from flat to growing: recompute level and rank.
          const level = levelForXp(player.xp);
          player = { ...player, level, rank: calcRank(level) };
        }
        if (version < 4) {
          // Stage 6: gems, learning record, solved challenges; the 48 fish mission gained a step.
          player = { ...player, gems: player.gems ?? 0 };
          progress = { ...progress, learning: progress.learning ?? {}, solved: progress.solved ?? [] };
          const peixes = progress.missions.peixes;
          if (peixes && (peixes.status === 'done' || peixes.steps.includes('solve_math')) && !peixes.steps.includes('estoque')) {
            progress.missions = { ...progress.missions, peixes: { ...peixes, steps: [...peixes.steps, 'estoque'] } };
          }
        }
        return { player, progress };
      },
      // every load goes through the repair (store/saveSanitize.ts): a save with missing or broken fields used to
      // crash the game on start, menu included, with no way back to "Novo jogo"
      merge: (persisted, current) => ({
        ...current,
        ...sanitizeSave(persisted, { player: initialPlayer, baseAbilities: BASE_ABILITIES, rankFor: calcRank }),
      }),
    }
  )
);

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__gameStore = useGameStore;
}
