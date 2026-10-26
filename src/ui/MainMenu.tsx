import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { useFamilySettings } from '../store/familySettings';
import { Settings } from './Panels';
import { useTour } from '../game/systems/tour';
import './styles.css';

export function MainMenu() {
  const startGame = useGameStore((s) => s.startGame);
  const player = useGameStore((s) => s.player);
  const childName = useFamilySettings((s) => s.childName);
  const [settings, setSettings] = useState(false);
  const startedMissions = useGameStore((s) => Object.keys(s.progress.missions).length);
  const hasSave = player.xp > 0 || startedMissions > 0;

  return (
    <div className="main-menu">
      <div className="menu-art" />

      <div className="menu-content">
        <div className="menu-title">
          <span className="title-kicker">Uma aventura ninja</span>
          <h1 className="title-main">Shinichi</h1>
          <p className="title-sub">O Caminho do Gato Ninja</p>
        </div>

        {hasSave && (
          <div className="save-info panel">
            <span className="save-avatar" />
            <span className="rank-badge">{player.rank}</span>
            <span>Nível {player.level}</span>
            <span className="coin">{player.coins}</span>
          </div>
        )}

        <div className="menu-buttons">
          <button className="btn btn-primary" onClick={startGame}>
            {hasSave ? '▶  Continuar aventura' : '⚡  Começar aventura'}
          </button>
          <button className="btn btn-secondary" onClick={() => useTour.getState().start()}>🎬 Passeio pela vila</button>
          <button className="btn btn-secondary" onClick={() => setSettings(true)}>⚙️ Configurações</button>
          {hasSave && (
            <button
              className="btn btn-ghost menu-reset"
              onClick={() => {
                if (window.confirm('Começar um jogo novo? Todo o progresso salvo será apagado.')) {
                  useGameStore.getState().resetGame();
                }
              }}
            >
              Novo jogo
            </button>
          )}
        </div>

        <div className="controls-hint">
          <div className="hint-row">
            <span className="key">W A S D</span><span>Mover</span>
            <span className="key">Espaço</span><span>Pular</span>
            <span className="key">E</span><span>Interagir</span>
          </div>
          <div className="hint-row hint-more">Arraste o mouse para girar a câmera · as outras teclas estão em Configurações</div>
        </div>

        <p className="menu-footer">🔈 O som começa quando você clica ou aperta uma tecla. · Feito com ❤️{childName ? ` para ${childName}` : ''}</p>
      </div>

      {settings && (
        <div className="panel-overlay" onMouseDown={(e) => e.target === e.currentTarget && setSettings(false)}>
          <div className="panel game-panel" role="dialog" aria-label="Configurações">
            <header className="game-panel-head">
              <h2><span>⚙️</span> Configurações</h2>
              <button className="panel-close" onClick={() => setSettings(false)} aria-label="Fechar">✕</button>
            </header>
            <div className="game-panel-body"><Settings inGame={false} /></div>
          </div>
        </div>
      )}
    </div>
  );
}
