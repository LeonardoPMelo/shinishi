import { useEffect, useState } from 'react';
import { ABILITY_INFO } from '../data/abilities';
import { onGameEvent, type GameEvent } from '../systems/events';
import { MISSIONS } from '../data/missions';
import { ITEMS } from '../data/items';
import { useGameStore } from '../store/gameStore';

interface Toast {
  id: number;
  icon: string;
  text: string;
  tone: 'gold' | 'green' | 'blue' | 'plain';
}

let nextId = 0;

function toToast(e: GameEvent): Omit<Toast, 'id'> | null {
  switch (e.type) {
    case 'missionStart': return { icon: '📜', text: `Nova missão: ${MISSIONS[e.missionId]?.title ?? ''}`, tone: 'blue' };
    case 'step': {
      const step = MISSIONS[e.missionId]?.steps.find((s) => s.id === e.stepId);
      return step ? { icon: '✔', text: step.description, tone: 'green' } : null;
    }
    case 'coins': return { icon: '🪙', text: `+${e.amount} moedas`, tone: 'gold' };
    case 'gems': return { icon: '💎', text: `+${e.amount} ${e.amount > 1 ? 'Gemas' : 'Gema'} do Saber`, tone: 'blue' };
    case 'xp': return { icon: '⭐', text: `+${e.amount} XP`, tone: 'gold' };
    case 'item': {
      const item = ITEMS[e.itemId];
      return item ? { icon: item.icon, text: `${item.name}${e.amount > 1 ? ` ×${e.amount}` : ''}`, tone: 'plain' } : null;
    }
    case 'ability': {
      const a = ABILITY_INFO[e.abilityId];
      return a ? { icon: a.icon, text: `Nova técnica: ${a.name}! ${a.does[0].toUpperCase()}${a.does.slice(1)}`, tone: 'blue' } : null;
    }
    case 'secret': return { icon: '✨', text: 'Segredo descoberto!', tone: 'blue' };
    case 'toast': return { icon: e.icon ?? '💬', text: e.text, tone: 'plain' };
    default: return null;
  }
}

/** Small stacked notifications. Rewards inside the celebration screen are not repeated here. */
export function RewardNotification() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let muteRewardsUntil = 0;
    return onGameEvent((e) => {
      if (e.type === 'missionComplete') {
        muteRewardsUntil = performance.now() + 800;
        return;
      }
      const reward = e.type === 'coins' || e.type === 'xp' || e.type === 'gems';
      // the mission and challenge screens already list what was earned
      if (reward && (performance.now() < muteRewardsUntil || useGameStore.getState().phase === 'challenge')) return;
      const t = toToast(e);
      if (!t) return;
      const toast = { ...t, id: nextId++ };
      setToasts((prev) => [...prev.slice(-3), toast]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== toast.id)), 3600);
    });
  }, []);

  if (toasts.length === 0) return null;
  return (
    <div className="notifications" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`notification panel tone-${t.tone}`}>
          <span>{t.icon}</span> {t.text}
        </div>
      ))}
    </div>
  );
}
