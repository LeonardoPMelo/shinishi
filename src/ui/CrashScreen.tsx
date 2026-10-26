import { Component, type ReactNode } from 'react';

/**
 * Anything that breaks the game while it loads or runs (a model that fails to download, a missing WebGL)
 * used to leave a blank dark page. This shows what happened and how to recover instead. The save lives in
 * the browser (localStorage) and is untouched.
 */
function Screen({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="crash-screen" role="alert">
      <div className="crash-card">
        <h1>{title}</h1>
        <p>{detail}</p>
        <p className="crash-note">O progresso salvo continua guardado neste navegador.</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Tentar de novo</button>
      </div>
    </div>
  );
}

export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function NoWebGL() {
  return (
    <Screen
      title="Este navegador não consegue desenhar o jogo em 3D"
      detail="O WebGL está desligado ou indisponível. Atualize o Chrome, Edge ou Firefox e ative a aceleração de hardware nas configurações do navegador."
    />
  );
}

export class CrashBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[Shinichi] falha ao carregar ou desenhar o jogo:', error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const offline = typeof navigator !== 'undefined' && !navigator.onLine;
    return (
      <Screen
        title="Algo atrapalhou o carregamento do jogo"
        detail={offline
          ? 'Parece que a internet caiu antes de todos os arquivos chegarem. Conecte-se e tente de novo.'
          : `Um arquivo do jogo não carregou (${error.message}). Recarregar costuma resolver.`}
      />
    );
  }
}
