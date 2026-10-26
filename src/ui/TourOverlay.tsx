import { useEffect } from 'react';
import { TOUR, useTour } from '../game/systems/tour';

/** Caption, progress and exit for the "Passeio pela vila" demonstration route (Etapa 7). */
export function TourOverlay() {
  const index = useTour((s) => s.index);
  const stop = useTour((s) => s.stop);
  const next = useTour((s) => s.next);
  const place = TOUR[index];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') stop();
      else if (e.code === 'ArrowRight' || e.code === 'Space' || e.code === 'Enter') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stop, next]);

  return (
    <div className="tour-overlay">
      <div className="tour-caption" key={index} aria-live="polite">
        <span className="tour-kicker">Passeio pela vila · {index + 1}/{TOUR.length}</span>
        <h2>{place.title}</h2>
        <p>{place.caption}</p>
        <div className="tour-dots" aria-hidden>
          {TOUR.map((t, i) => <span key={t.title} className={i === index ? 'on' : i < index ? 'seen' : ''} />)}
        </div>
      </div>
      <div className="tour-actions">
        <button className="btn btn-secondary" onClick={next}>Próximo ▸</button>
        <button className="btn btn-ghost" onClick={stop}>Voltar ao menu (Esc)</button>
      </div>
    </div>
  );
}
