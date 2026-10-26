import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { useAudioSettings } from '../audio/audioSettings';
import { MISSIONS } from '../data/missions';
import { availableSteps } from '../systems/progression';
import { abilityState, now, FARO_COOLDOWN, MIADO_COOLDOWN, SHURIKEN_COOLDOWN, DASH_COOLDOWN } from '../game/systems/playerState';
import { press } from '../game/systems/input';
import { WorldMap } from './WorldMap';
import { useTouchUi } from './TouchControls';
import { levelProgress } from '../systems/leveling';
import { onGameEvent } from '../systems/events';
import { currentObjective, isFirstSteps } from '../systems/objective';
import { playerPosition } from '../game/systems/playerState';

/** "Missões da Vila": the followed mission as a checklist (done steps ticked, current ones open). */
function VillageMissions() {
  const progress = useGameStore((s) => s.progress);
  const openPanel = useGameStore((s) => s.openPanel);
  const id = progress.tracked;
  const mission = id ? MISSIONS[id] : null;
  if (!mission || progress.missions[mission.id]?.status !== 'active') return null;
  const mp = progress.missions[mission.id];
  const open = availableSteps(mission, progress).map((st) => st.id);
  // done steps and the ones available now; later steps stay secret until unlocked
  const shown = mission.steps.filter((st) => mp.steps.includes(st.id) || open.includes(st.id));
  const hidden = mission.steps.length - shown.length;
  return (
    <button className="hud-mission hud-glass" onClick={() => openPanel('missions')} title="Abrir registro de missões (J)">
      <div className="hud-mission-kicker">Missões da Vila</div>
      <div className="mission-title">{mission.title}</div>
      <ul className="mission-checklist">
        {shown.map((st) => {
          const done = mp.steps.includes(st.id);
          return (
            <li key={st.id} className={done ? 'done' : 'open'}>
              <span className="check" aria-hidden>{done ? '✓' : ''}</span>
              <span>
                {st.description}
                {st.counter && !done && <span className="mission-count"> {Math.min(progress.counters[st.counter.id] ?? 0, st.counter.goal)}/{st.counter.goal}</span>}
              </span>
            </li>
          );
        })}
        {hidden > 0 && <li className="more">+ {hidden} {hidden > 1 ? 'etapas' : 'etapa'} a descobrir</li>}
      </ul>
    </button>
  );
}

/**
 * With no mission active (a new game, or between missions), the goal in one line (Etapa 7). Before, this
 * corner stayed empty and a new player had nothing to read.
 */
function NextObjective() {
  const progress = useGameStore((s) => s.progress);
  const touch = useTouchUi();
  const tracked = progress.tracked && progress.missions[progress.tracked]?.status === 'active';
  if (tracked) return null;
  const goal = currentObjective(progress, playerPosition);
  if (!goal) return null;
  const first = isFirstSteps(progress);
  return (
    <div className="hud-mission hud-objective hud-glass" role="status" aria-live="polite">
      <div className="hud-mission-kicker">{first ? 'Seu primeiro passo' : 'Próximo passo'}</div>
      <div className="mission-title">{goal.text}</div>
      <p className="objective-how">
        {first ? 'Siga as patinhas douradas no chão. ' : `Perdeu o rumo? ${touch ? 'Toque em 👃' : 'Aperte 4'} para farejar o caminho. `}
        Chegando perto, {touch ? 'toque no botão de conversar' : <>aperte <kbd>E</kbd> para conversar</>}.
      </p>
    </div>
  );
}

/** Big banner when Shinichi levels up (the 3D burst is in LivingWorld). */
function LevelUpBanner() {
  const [level, setLevel] = useState<number | null>(null);
  useEffect(() => {
    let timer = 0;
    const off = onGameEvent((e) => {
      if (e.type !== 'levelUp') return;
      setLevel(e.level);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setLevel(null), 2800);
    });
    return () => {
      off();
      window.clearTimeout(timer);
    };
  }, []);
  if (level === null) return null;
  return (
    <div className="levelup-banner" key={level} aria-live="polite">
      <span className="levelup-kicker">Subiu de nível!</span>
      <span className="levelup-num">Nv. {level}</span>
      <span className="levelup-rank">{useGameStore.getState().player.rank}</span>
    </div>
  );
}

/** Coins and gems fly from the middle of the screen (where Shinichi is) into their HUD counter. */
function RewardFly() {
  const [flyers, setFlyers] = useState<{ id: number; kind: 'coin' | 'gem'; dx: number; dy: number; delay: number }[]>([]);
  useEffect(() => {
    let next = 0;
    return onGameEvent((e) => {
      if (e.type !== 'coins' && e.type !== 'gems') return;
      const kind = e.type === 'coins' ? 'coin' : 'gem';
      const pill = document.querySelector<HTMLElement>(`[data-pill="${kind}"]`);
      if (!pill) return;
      const r = pill.getBoundingClientRect();
      const sx = window.innerWidth / 2;
      const sy = window.innerHeight * 0.55;
      const n = Math.min(kind === 'coin' ? 6 : 4, Math.max(1, Math.ceil(e.amount / (kind === 'coin' ? 5 : 1))));
      const batch = Array.from({ length: n }, (_, i) => ({
        id: next++,
        kind: kind as 'coin' | 'gem',
        dx: r.left + 18 - sx,
        dy: r.top + r.height / 2 - sy,
        delay: i * 70,
      }));
      setFlyers((f) => [...f, ...batch]);
      window.setTimeout(() => {
        pill.classList.remove('bump');
        void pill.offsetWidth; // restart the animation
        pill.classList.add('bump');
      }, 650 + (n - 1) * 70);
      window.setTimeout(() => setFlyers((f) => f.filter((x) => !batch.includes(x))), 900 + n * 70);
    });
  }, []);
  return (
    <>
      {flyers.map((f) => (
        <span
          key={f.id}
          className={`reward-fly ${f.kind}`}
          style={{ '--dx': `${f.dx}px`, '--dy': `${f.dy}px`, '--jx': `${(f.id % 5 - 2) * 14}px`, animationDelay: `${f.delay}ms` } as React.CSSProperties}
        />
      ))}
    </>
  );
}

function ControlsBar() {
  return (
    <div className="controls-bar" aria-hidden>
      <span><kbd>WASD</kbd> Mover</span>
      <span><kbd>Shift</kbd> Correr</span>
      <span><kbd>Espaço</kbd> Pular</span>
      <span><kbd>E</kbd> Interagir</span>
      <span><kbd>C</kbd> Agachar</span>
    </div>
  );
}

function AbilityBar() {
  const abilities = useGameStore((s) => s.progress.abilities);
  const potions = useGameStore((s) => s.progress.inventory.pocao_energia ?? 0);
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 150);
    return () => window.clearInterval(id);
  }, []);
  const t = now();
  const cd = (readyAt: number, total: number) => Math.max(0, readyAt - t) / total;

  const slots = [
    {
      key: '1', icon: '✴️', name: 'Shuriken de Treino', desc: 'Acerta alvos e mecanismos (passa pelos moradores sem machucar)',
      locked: false, cooldown: cd(abilityState.shurikenReadyAt, SHURIKEN_COOLDOWN), active: false, onClick: () => press('shuriken'),
    },
    {
      key: '2', icon: '💨', name: 'Impulso Ninja', desc: 'Arrancada rápida; funciona uma vez no ar',
      locked: false, cooldown: cd(abilityState.dashReadyAt, DASH_COOLDOWN), active: false, onClick: () => press('dash'),
    },
    {
      key: '3', icon: '🧪', name: 'Poção de Energia', desc: potions > 0 ? `Mais rápido e pulo mais alto por 10 s (${potions} na mochila)` : 'Nenhuma poção — procure em baús e desafios',
      locked: potions === 0, cooldown: 0, active: abilityState.boostUntil > t, count: potions, onClick: () => press('pocao'),
    },
    {
      key: '4', icon: '👃', name: 'Faro Ninja', desc: 'Revela segredos e mostra patinhas até o objetivo',
      locked: !abilities.includes('faro'), cooldown: cd(abilityState.faroReadyAt, FARO_COOLDOWN), active: abilityState.faroUntil > t, onClick: () => press('faro'),
    },
    {
      key: 'R', icon: '😺', name: 'Miado Ninja', desc: 'Os moradores reagem ao seu miado',
      locked: !abilities.includes('miado'), cooldown: cd(abilityState.miadoReadyAt, MIADO_COOLDOWN), active: false, onClick: () => press('miado'),
    },
    {
      key: '␣²', icon: '🌀', name: 'Salto Duplo', desc: abilities.includes('double_jump') ? 'Pule de novo no ar (Espaço)' : 'Bloqueado — treine com o Mestre Lótus',
      locked: !abilities.includes('double_jump'), cooldown: 0, active: false, passive: true,
    },
  ];

  return (
    <div className="ability-bar">
      {slots.map((s) => (
        <button
          key={s.name}
          className={`ability ${s.locked ? 'locked' : ''} ${s.active ? 'active' : ''}`}
          title={`${s.name} — ${s.desc}`}
          aria-label={`${s.name} (${s.key})`}
          disabled={s.locked || !!s.passive}
          onClick={s.onClick}
        >
          <span className="ability-icon">{s.locked ? '🔒' : s.icon}</span>
          {s.cooldown > 0 && <span className="ability-cd" style={{ height: `${s.cooldown * 100}%` }} />}
          {'count' in s && (s.count ?? 0) > 0 && <span className="ability-count">{s.count}</span>}
          <span className="ability-key">{s.key}</span>
        </button>
      ))}
    </div>
  );
}

export function HUD() {
  const player = useGameStore((s) => s.player);
  const phase = useGameStore((s) => s.phase);
  const openPanel = useGameStore((s) => s.openPanel);
  const muted = useAudioSettings((s) => s.muted);
  const toggleMute = useAudioSettings((s) => s.toggleMute);

  const lp = levelProgress(player.xp);

  return (
    <>
      <div className="hud-stats hud-glass">
        <div className="hud-avatar" />
        <div className="hud-info">
          <div className="hud-name">
            Shinichi <span className="hud-rank">Nv. {player.level}<span className="hud-rank-name"> · {player.rank}</span></span>
          </div>
          <div className="hud-xp-bar">
            <div className="hud-xp-fill" style={{ width: `${Math.min(100, (lp.current / lp.span) * 100)}%` }} />
          </div>
          <div className="hud-xp-text">{lp.current}/{lp.span} XP</div>
        </div>
      </div>

      <div className="hud-right">
        <div className="hud-currency">
          <div className="hud-pill hud-glass" data-pill="coin" title="Moedas de Pata"><span className="coin" />{player.coins}</div>
          <div className="hud-pill hud-glass" data-pill="gem" title="Gemas do Saber: ganhe resolvendo desafios"><span className="gem" />{player.gems ?? 0}</div>
        </div>
        <div className="hud-buttons">
          <button className="hud-btn hud-glass" onClick={() => openPanel('inventory')} title="Mochila (I)"><span>🎒</span><small>Mochila</small></button>
          <button className="hud-btn hud-glass" onClick={() => openPanel('missions')} title="Missões (J)"><span>📜</span><small>Missões</small></button>
          <button className="hud-btn hud-glass" onClick={() => openPanel('journey')} title="Jornada e saberes (K)"><span>📖</span><small>Jornada</small></button>
          <button className="hud-btn hud-glass" onClick={() => openPanel('map')} title="Mapa (M)"><span>🗺️</span><small>Mapa</small></button>
          <button className="hud-btn hud-glass" onClick={() => openPanel('settings')} title="Configurações"><span>⚙️</span><small>Ajustes</small></button>
          <button className="hud-btn hud-glass" onClick={() => toggleMute()} title={muted ? 'Ativar som' : 'Silenciar'}><span>{muted ? '🔇' : '🔊'}</span><small>Som</small></button>
        </div>
        {phase === 'playing' && <VillageMissions />}
        {phase === 'playing' && <NextObjective />}
      </div>

      {phase === 'playing' && (
        <div className="minimap hud-glass" onClick={() => openPanel('map')} title="Abrir mapa (M)">
          <WorldMap size={150} window={34} />
          <span className="minimap-n">N</span>
        </div>
      )}

      {phase === 'playing' && <ControlsBar />}
      {phase === 'playing' && <AbilityBar />}
      <LevelUpBanner />
      <RewardFly />
    </>
  );
}
