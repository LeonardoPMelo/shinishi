import { useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { useFamilySettings } from '../store/familySettings';
import { MISSIONS } from '../data/missions';

const CONFETTI_COLORS = ['#F08A2C', '#FFC93C', '#5FD068', '#5E7FC4', '#F49AB8', '#D9473A'];

function Confetti() {
  const pieces = useMemo(
    () => Array.from({ length: 70 }).map((_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 1.2,
      duration: 2.4 + Math.random() * 2,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      round: Math.random() > 0.6,
    })),
    []
  );
  return (
    <div className="confetti">
      {pieces.map((p, i) => (
        <i key={i} style={{ left: `${p.left}%`, background: p.color, borderRadius: p.round ? '50%' : 2, animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s` }} />
      ))}
    </div>
  );
}

/** Celebration card shown once per completed mission (queued if several finish together). */
export function MissionComplete() {
  const missionId = useGameStore((s) => s.celebrations[0]);
  const dismiss = useGameStore((s) => s.dismissCelebration);
  const birthdayArt = useFamilySettings((s) => s.birthdayArt);
  const childName = useFamilySettings((s) => s.childName);
  const mission = missionId ? MISSIONS[missionId] : null;
  if (!mission) return null;
  const chapter = mission.id === 'kuro' ? 1 : mission.id === 'lanternas_apagadas' ? 2 : 0;
  const chapterEnd = chapter > 0;

  return (
    <>
      <div className="celebrate" onClick={(e) => e.target === e.currentTarget && dismiss()}>
        <div className="celebrate-card panel" key={mission.id}>
          <div className={`celebrate-art ${birthdayArt ? 'birthday' : ''}`} role="img" aria-label="Shinichi comemorando" />
          <div className="celebrate-body">
            <span className="celebrate-kicker">{chapterEnd ? `Capítulo ${chapter} completo!` : 'Missão completa!'}</span>
            <h2>{mission.title}</h2>
            <p className="celebrate-lesson">💡 {mission.lesson}</p>
            <div className="rewards">
              <span className="reward"><span className="reward-icon">⭐</span>+{mission.rewards.xp} XP</span>
              <span className="reward"><span className="reward-icon">🪙</span>+{mission.rewards.coins} moedas</span>
              {!!mission.rewards.gems && <span className="reward"><span className="reward-icon">💎</span>+{mission.rewards.gems} {mission.rewards.gems > 1 ? 'gemas' : 'gema'}</span>}
              {mission.rewards.badges?.map((b) => (
                <span key={b} className="reward"><span className="reward-icon">🏅</span>{b}</span>
              ))}
              {Object.keys(mission.rewards.items ?? {}).length > 0 && <span className="reward"><span className="reward-icon">🎒</span>Item novo!</span>}
            </div>
            {chapterEnd && (
              <p>{chapter === 1
                ? 'O Capítulo 2 começa quando você ajudar mais moradores: festival, escada do Mirante e muito mais!'
                : 'O Capítulo 3 ainda está em desenvolvimento. A vila continua aberta para explorar, jogar bola e procurar segredos!'}</p>
            )}
            {childName && <p className="celebrate-name">Muito bem, {childName}! 🎉</p>}
            <button className="btn btn-primary" onClick={dismiss} autoFocus>Uhuul! Continuar ▶</button>
          </div>
        </div>
      </div>
      <Confetti />
    </>
  );
}
