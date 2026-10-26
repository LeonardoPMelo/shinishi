import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { SKILLS } from '../data/skills';
import { asset } from '../assetPath';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'] as const;
const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

const ENCOURAGEMENT = [
  'Ainda não... veja o que observar e tente de novo!',
  'Quase! Errar é praticar, lembra? Agora tem uma dica.',
  'Vamos juntos: veja o exemplo parecido, passo a passo.',
  'Respire fundo. Siga o exemplo com os números deste desafio.',
];

/** The three help cards, opened one at a time (each mistake, or the "Pedir ajuda" button). */
const HELP = [
  { key: 'observe', icon: '👀', title: 'O que observar' },
  { key: 'hint', icon: '💡', title: 'Dica' },
  { key: 'example', icon: '📝', title: 'Exemplo parecido' },
] as const;

const lines = (t: string) => t.split('\n').map((l, i, arr) => <span key={i}>{l}{i < arr.length - 1 && <br />}</span>);

export function MathChallenge() {
  const active = useGameStore((s) => s.activeChallenge);
  const submitAnswer = useGameStore((s) => s.submitAnswer);
  const closeChallenge = useGameStore((s) => s.closeChallenge);
  const revealHint = useGameStore((s) => s.revealHint);
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  if (!active) return null;
  const { challenge: c, attempts, hintLevel, solved, reward } = active;
  const skill = SKILLS[c.skill];

  const submit = (value: number) => {
    const result = submitAnswer(value);
    if (result === 'wrong') {
      // the message points at the help card this mistake just opened
      const level = useGameStore.getState().activeChallenge?.hintLevel ?? 1;
      setFeedback(ENCOURAGEMENT[Math.min(level - 1 + (attempts >= 3 ? 1 : 0), ENCOURAGEMENT.length - 1)]);
      setShake(true);
      setInput('');
      setTimeout(() => setShake(false), 350);
    } else setFeedback(null);
  };

  if (solved) {
    return (
      <div className="challenge-overlay">
        <div className="challenge-box challenge-success panel" style={{ maxWidth: 480 }}>
          <div className="challenge-success-icon">⭐</div>
          <h2>Resposta certa!</h2>
          <div className="challenge-success-text">
            {c.successText.split('\n').map((line, i) => <p key={i}>{line}</p>)}
          </div>
          {reward ? (
            <div className="rewards challenge-rewards">
              <span className="reward"><span className="reward-icon">⭐</span>+{reward.xp} XP</span>
              <span className="reward"><span className="reward-icon">🪙</span>+{reward.coins}</span>
              <span className="reward reward-gem"><span className="reward-icon">💎</span>+{reward.gems} {reward.gems > 1 ? 'gemas' : 'gema'}{reward.firstTry ? ' · de primeira!' : ''}</span>
            </div>
          ) : (
            <p className="challenge-replay">Você já tinha resolvido este desafio. Treino nunca é demais!</p>
          )}
          {attempts > 0 && (
            <p className="challenge-effort">🌱 Você errou {attempts} {attempts > 1 ? 'vezes' : 'vez'} e não desistiu. É assim que um ninja aprende!</p>
          )}
          <p className="challenge-skill">{skill.icon} Você treinou <b>{skill.name}</b>. Veja seus saberes em <b>Jornada</b>.</p>
          <button className="btn btn-green" onClick={closeChallenge} autoFocus>Continuar ▶</button>
        </div>
      </div>
    );
  }

  return (
    <div className="challenge-overlay">
      <div className="challenge-wrap">
        <div className="challenge-cat">
          <img src={asset('assets/ui/thinking-cut.webp')} alt="Shinichi pensando" />
          <span className="thought">Hmm...?</span>
        </div>
        <div className="challenge-box panel">
          <div className="challenge-header">
            <span className="challenge-icon">🧮</span>
            <h2>{c.title}</h2>
            <span className="challenge-skill-tag" title={skill.blurb}>{skill.icon} {skill.name}</span>
          </div>
          <div className="challenge-story">
            {c.story.split('\n').map((line, i) => <p key={i}>{line}</p>)}
          </div>
          <div className="challenge-question">{c.question}</div>

          {hintLevel > 0 && (
            <div className="challenge-help" aria-live="polite">
              {HELP.slice(0, hintLevel).map((h) => (
                <div key={h.key} className={`challenge-hint help-${h.key}`}>
                  {h.icon} <strong>{h.title}:</strong> {lines(c[h.key])}
                </div>
              ))}
            </div>
          )}

          {c.kind === 'choice' ? (
            <div className={`choice-grid ${shake ? 'shake' : ''}`}>
              {c.choices!.map((choice, i) => (
                <button key={i} className="btn btn-secondary choice-btn" onClick={() => submit(i)}>
                  <kbd>{String.fromCharCode(65 + i)}</kbd> {choice}
                </button>
              ))}
            </div>
          ) : (
            <form className="challenge-input-row" onSubmit={(e) => {
              e.preventDefault();
              const n = parseInt(input.trim(), 10);
              if (!Number.isNaN(n)) submit(n);
            }}>
              <input
                className={`challenge-input ${shake ? 'input-wrong' : ''}`}
                type="text"
                inputMode={coarse ? 'none' : 'numeric'}
                value={input}
                onChange={(e) => setInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="Sua resposta..."
                autoFocus={!coarse}
                aria-label="Sua resposta"
              />
              <button className="btn btn-primary" type="submit">Verificar ✓</button>
              {/* on-screen keypad: works with mouse, touch and keyboard alike */}
              <div className="keypad" role="group" aria-label="Teclado numérico">
                {KEYS.map((k) => (
                  <button
                    key={k}
                    type={k === 'ok' ? 'submit' : 'button'}
                    className={`keypad-key ${k === 'ok' ? 'ok' : k === 'del' ? 'del' : ''}`}
                    aria-label={k === 'del' ? 'Apagar' : k === 'ok' ? 'Verificar' : k}
                    onClick={k === 'ok' ? undefined : () => setInput((v) => (k === 'del' ? v.slice(0, -1) : (v + k).slice(0, 4)))}
                  >
                    {k === 'del' ? '⌫' : k === 'ok' ? '✓' : k}
                  </button>
                ))}
              </div>
            </form>
          )}

          {feedback && <div className="challenge-feedback wrong">{feedback}</div>}
          {hintLevel < 3 && (
            <button className="btn btn-secondary challenge-ask" onClick={revealHint}>
              🙋 {hintLevel === 0 ? 'Pedir uma ajuda' : 'Pedir mais ajuda'}
            </button>
          )}

          <button className="btn btn-ghost challenge-close" onClick={closeChallenge}>← Voltar depois (dá para tentar de novo)</button>
        </div>
      </div>
    </div>
  );
}
