import { useState, useEffect, useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { checkCondition } from '../systems/progression';
import { playSfx } from '../audio/sfx';
import { useFamilySettings } from '../store/familySettings';

const TYPEWRITER_SPEED = 34;

const SPEAKERS: Record<string, { icon: string; pitch: number; color: string }> = {
  'Chef Hana': { icon: '🍱', pitch: 520, color: '#D9477A' },
  Boku: { icon: '🎒', pitch: 300, color: '#5E8C4A' },
  Luna: { icon: '🌙', pitch: 760, color: '#8E5CC2' },
  Tanuki: { icon: '🦝', pitch: 520, color: '#7A5A3E' },
  'Mestre Kuma': { icon: '🐻', pitch: 180, color: '#5A4032' },
  'Mestre Lótus': { icon: '🪷', pitch: 240, color: '#5B3E86' },
  Taro: { icon: '🔥', pitch: 640, color: '#C8302C' },
  Kiko: { icon: '⚙️', pitch: 700, color: '#D9822B' },
  'Guarda Roku': { icon: '🛡️', pitch: 260, color: '#5E6A7A' },
  'Dona Neko': { icon: '💤', pitch: 380, color: '#7FA6D9' },
  Sora: { icon: '🧭', pitch: 580, color: '#3E8A55' },
  Kuro: { icon: '🌑', pitch: 240, color: '#2A2630' },
  Shinichi: { icon: '', pitch: 560, color: '#F08A2C' },
};

export function DialogBox() {
  const dialogue = useGameStore((s) => s.activeDialogue);
  const progress = useGameStore((s) => s.progress);
  const coins = useGameStore((s) => s.player.coins);
  const chooseOption = useGameStore((s) => s.chooseOption);
  const closeDialogue = useGameStore((s) => s.closeDialogue);
  const [shown, setShown] = useState(0);
  const childName = useFamilySettings((s) => s.childName);
  const birthdayOn = useFamilySettings((s) => s.birthdayArt);

  const node = dialogue ? dialogue.tree[dialogue.currentNodeId] : null;
  const birthday = birthdayOn && childName ? `E hoje também comemoramos o aniversário de ${childName}! 🎂` : '';
  const fullText = (node?.text ?? '').replace('{aniversario}', birthday).trim();
  const typing = shown < fullText.length;
  const speaker = SPEAKERS[node?.speaker ?? ''] ?? { icon: '📜', pitch: 450, color: '#8C6440' };

  useEffect(() => {
    setShown(0);
    if (!node) return;
    let i = 0;
    const id = window.setInterval(() => {
      i++;
      setShown(i);
      const ch = fullText[i - 1];
      if (i % 2 === 0 && ch && /[\p{L}\p{N}]/u.test(ch)) playSfx('blip', { pitch: speaker.pitch });
      if (i >= fullText.length) window.clearInterval(id);
    }, 1000 / TYPEWRITER_SPEED);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id, dialogue?.currentNodeId, dialogue?.npcId]);

  const options = useMemo(
    () => (node?.options ?? []).filter((o) => checkCondition(o.when, progress, coins)),
    [node, progress, coins]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!node) return;
      if (typing && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        setShown(fullText.length);
        return;
      }
      if (typing) return;
      const n = Number(e.key);
      if (n >= 1 && n <= options.length) {
        chooseOption(options[n - 1].nextNodeId, options[n - 1].action);
      } else if ((e.code === 'Enter' || e.code === 'Space') && options.length === 1) {
        e.preventDefault();
        chooseOption(options[0].nextNodeId, options[0].action);
      } else if ((e.code === 'Enter' || e.code === 'Space') && options.length === 0) {
        closeDialogue();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [node, typing, options, fullText, chooseOption, closeDialogue]);

  if (!dialogue || !node) return null;
  const text = fullText.slice(0, shown);

  return (
    <div className="dialogue-overlay" onClick={typing ? () => setShown(fullText.length) : undefined}>
      <div className={`dialogue-box panel mood-${node.mood ?? 'neutral'}`} key={node.id}>
        <div className="dialogue-speaker" style={{ background: speaker.color }}>
          {node.speaker === 'Shinichi'
            ? <span className="dialogue-speaker-icon portrait" />
            : <span className="dialogue-speaker-icon">{speaker.icon}</span>}
          <span className="dialogue-speaker-name">{node.speaker}</span>
        </div>

        <div className="dialogue-text">
          {text.split('\n').map((line, i, arr) => (
            <span key={i}>
              {line}
              {i < arr.length - 1 && <br />}
            </span>
          ))}
          {typing && <span className="typing-cursor">▎</span>}
        </div>

        {!typing && options.length > 0 && (
          <div className="dialogue-options">
            {options.map((opt, i) => (
              <button key={i} className="dialogue-option" onClick={() => chooseOption(opt.nextNodeId, opt.action)}>
                <kbd>{i + 1}</kbd> {opt.label}
              </button>
            ))}
          </div>
        )}
        {!typing && options.length === 0 && (
          <button className="dialogue-continue" onClick={closeDialogue}>Continuar ▶</button>
        )}
        {typing && <div className="dialogue-skip-hint">Clique ou Enter para avançar</div>}
      </div>
    </div>
  );
}
