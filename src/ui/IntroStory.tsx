import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { INTRO_PANELS } from '../data/story';
import { emit } from '../systems/events';

/**
 * The short intro of a new game (Etapa 8 da expansão): four panels, the village, the Great Flood, a basket on
 * the river, and Shinichi on the morning the fish went missing. The player moves it on (button, Enter/Space or
 * the pad), can go back, and can skip it. Opens by itself once on a new save (IntroTrigger) and again from the
 * Jornada panel. It is a panel, so the game is paused behind it.
 */
export function IntroStory() {
  const [i, setI] = useState(0);
  const close = () => useGameStore.getState().openPanel(null);
  const last = i === INTRO_PANELS.length - 1;
  const next = () => {
    emit({ type: 'sfx', name: 'ui_select' });
    if (last) close();
    else setI(i + 1);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'ArrowRight') {
        e.preventDefault();
        next();
      } else if (e.code === 'ArrowLeft' && i > 0) setI(i - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const p = INTRO_PANELS[i];
  return (
    <div className="panel-overlay intro-overlay" role="dialog" aria-modal="true" aria-label="Introdução">
      <div className="intro-card">
        <div className="intro-scene" aria-hidden>{p.scene}</div>
        <h2>{p.title}</h2>
        <p>{p.text}</p>
        <div className="intro-dots" aria-label={`Quadro ${i + 1} de ${INTRO_PANELS.length}`}>
          {INTRO_PANELS.map((_, k) => <span key={k} className={k === i ? 'on' : ''} />)}
        </div>
        <div className="intro-actions">
          {i > 0 ? <button className="btn btn-ghost" onClick={() => setI(i - 1)}>◀ Voltar</button> : <button className="btn btn-ghost" onClick={close}>Pular</button>}
          <button className="btn btn-primary" onClick={next} autoFocus>{last ? '🐾 Começar a aventura' : 'Continuar ▶'}</button>
        </div>
      </div>
    </div>
  );
}

/** Opens the intro once, the first time a new save starts playing. */
export function IntroTrigger() {
  const phase = useGameStore((s) => s.phase);
  useEffect(() => {
    if (phase !== 'playing') return;
    const s = useGameStore.getState();
    if (s.progress.flags.intro_vista || Object.keys(s.progress.missions).length > 0) return;
    s.setFlag('intro_vista', true);
    s.openPanel('intro');
  }, [phase]);
  return null;
}
