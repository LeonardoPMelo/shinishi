import { Suspense, lazy, useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { GameScene } from './game/GameScene';
import { MainMenu } from './ui/MainMenu';
import { HUD } from './ui/HUD';
import { DialogBox } from './ui/DialogBox';
import { MathChallenge } from './ui/MathChallenge';
import { RewardNotification } from './ui/RewardNotification';
import { MissionComplete } from './ui/MissionComplete';
import { GamePanels } from './ui/Panels';
import { TouchControls } from './ui/TouchControls';
import { AudioBridge } from './audio/AudioBridge';
import { TourOverlay } from './ui/TourOverlay';
import { useTour } from './game/systems/tour';
import { installGamepad, usePad } from './game/systems/gamepad';
import { clearPresses } from './game/systems/input';
import { useUiSettings, reducedMotion } from './store/uiSettings';
import './ui/styles.css';
import { asset } from './assetPath';
import { CrashBoundary, NoWebGL, hasWebGL } from './ui/CrashScreen';

// Dev-only portrait studio (?studio): never part of the production bundle.
const Studio = import.meta.env.DEV ? lazy(() => import('./game/Studio').then((m) => ({ default: m.Studio }))) : null;
const STUDIO = import.meta.env.DEV && new URLSearchParams(window.location.search).has('studio');

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <img className="loading-cat" src={asset('assets/ui/run-cut.webp')} alt="" />
      <div className="loading-title">Shinichi</div>
      <div className="loading-bar">
        <div className="loading-fill" />
      </div>
      <div>Preparando o Caminho do Gato Ninja...</div>
    </div>
  );
}

/** Global hotkeys for menus. Gameplay keys live in game/systems/input.ts. */
function GameController() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return;
      const s = useGameStore.getState();
      if (e.code === 'Escape') {
        if (s.panel) s.openPanel(null);
        else if (s.phase === 'playing') s.pauseGame();
        else if (s.phase === 'paused') s.resumeGame();
        else if (s.phase === 'dialogue') s.closeDialogue();
        else if (s.phase === 'challenge') s.closeChallenge();
        return;
      }
      const panels: Record<string, 'inventory' | 'missions' | 'journey' | 'map'> = { KeyI: 'inventory', KeyJ: 'missions', KeyK: 'journey', KeyM: 'map' };
      const panel = panels[e.code];
      if (panel && (s.phase === 'playing' || s.phase === 'paused')) {
        s.openPanel(s.panel === panel ? null : panel);
      }
    };
    window.addEventListener('keydown', onKey);

    // Presses made inside menus (e.g. "1" to pick a dialogue option) must not leak into gameplay.
    const unsub = useGameStore.subscribe((state, prev) => {
      if (state.phase === 'playing' && prev.phase !== 'playing') clearPresses();
    });
    return () => {
      window.removeEventListener('keydown', onKey);
      unsub();
    };
  }, []);
  return null;
}

/**
 * Game controller (systems/gamepad.ts): starts listening, marks the page while the pad is in use (a visible
 * focus ring on the selected button) and shows a short notice when one connects or disconnects.
 */
function PadBridge() {
  const active = usePad((s) => s.active);
  const notice = usePad((s) => s.notice);
  useEffect(() => installGamepad(), []);
  useEffect(() => {
    document.body.classList.toggle('pad-active', active);
  }, [active]);
  return notice ? <div className="pad-notice" role="status" aria-live="polite">{notice}</div> : null;
}

/** Accessibility settings that live on the page itself: text size and the reduced-motion class (Etapa 7). */
function A11yBridge() {
  const mode = useUiSettings((s) => s.reduceMotion);
  const textScale = useUiSettings((s) => s.textScale);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => document.body.classList.toggle('reduce-motion', reducedMotion(mode));
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [mode]);
  useEffect(() => {
    document.documentElement.style.fontSize = textScale === 1 ? '' : `${Math.round(textScale * 100)}%`;
  }, [textScale]);
  return null;
}

const WEBGL = hasWebGL();

export default function App() {
  // the page's own fallback (index.html) waits for this: the game reached its first screen
  useEffect(() => {
    (window as unknown as { __shinichiBooted?: boolean }).__shinichiBooted = true;
  }, []);
  if (STUDIO && Studio) return <Suspense fallback={null}><Studio /></Suspense>;
  if (!WEBGL) return <NoWebGL />;
  return (
    <CrashBoundary>
      <Game />
    </CrashBoundary>
  );
}

function Game() {
  const phase = useGameStore((s) => s.phase);
  const celebrating = useGameStore((s) => s.celebrations.length > 0);
  const touring = useTour((s) => s.active) && phase === 'menu';
  const hidden = phase === 'menu' && !touring;

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: 0,
        opacity: hidden ? 0 : 1,
        transition: 'opacity 0.6s ease',
        pointerEvents: hidden ? 'none' : 'auto',
      }}>
        <Suspense fallback={<LoadingScreen />}>
          <GameScene />
        </Suspense>
      </div>

      <AudioBridge />
      <GameController />
      <A11yBridge />
      <PadBridge />

      {phase === 'menu' && !touring && <MainMenu />}
      {touring && <TourOverlay />}

      {phase !== 'menu' && (
        <>
          <HUD />
          {phase === 'dialogue' && <DialogBox />}
          {phase === 'challenge' && <MathChallenge />}
          <GamePanels />
          <TouchControls />
          <RewardNotification />
          {celebrating && <MissionComplete />}
        </>
      )}
    </div>
  );
}
