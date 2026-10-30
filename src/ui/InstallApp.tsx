import { useEffect, useState } from 'react';

/**
 * "Instalar o jogo" (Etapa 10 da expansão, pendência 3). Browsers that can install a PWA (Chrome, Edge,
 * Android) fire `beforeinstallprompt`: we keep it and offer a real button. Where they don't (iPhone/iPad
 * Safari, Firefox), the section says how to do it by hand. Already installed: it says so.
 */

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

export const isInstalled = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: fullscreen)').matches || window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true);

const isIOS = () => typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

export function InstallApp() {
  const [, refresh] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  useEffect(() => {
    const l = () => refresh((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  if (isInstalled()) return <p className="setting-note">✅ O jogo já está instalado neste aparelho.</p>;
  if (deferred) {
    return (
      <>
        <button className="btn btn-secondary" onClick={async () => {
          const p = deferred;
          if (!p) return;
          await p.prompt();
          const choice = await p.userChoice;
          deferred = null;
          setResult(choice.outcome === 'accepted' ? 'Instalado! Procure o ícone do Shinichi.' : 'Tudo bem, dá para instalar depois.');
        }}>📲 Instalar o jogo</button>
        {result && <p className="setting-note">{result}</p>}
        <p className="setting-note">Instalado, ele abre em tela cheia, com ícone próprio, e funciona sem internet depois de jogar uma vez.</p>
      </>
    );
  }
  return (
    <p className="setting-note">
      {isIOS()
        ? 'No iPhone ou iPad (Safari): toque em Compartilhar (□↑) e depois em "Adicionar à Tela de Início".'
        : 'Para instalar: no Chrome ou no Edge, use o ícone de instalar na barra de endereço (ou o menu ⋮ → "Instalar Shinichi"). No celular Android, menu ⋮ → "Adicionar à tela inicial".'}
      {' '}Depois de jogar uma vez, ele funciona sem internet.
    </p>
  );
}
