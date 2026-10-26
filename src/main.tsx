import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// dev: checks that every id in the game data points somewhere real (see systems/validateData.ts)
if (import.meta.env.DEV) import('./systems/validateData');
// dev: QA harness that drives the real controller (see dev/qa.ts)
if (import.meta.env.DEV) import('./dev/qa');
// dev: fixed-camera performance bench (see dev/bench.ts)
if (import.meta.env.DEV) import('./dev/bench');
// dev: foot-slide measurement of the locomotion clips (see dev/gait.ts)
if (import.meta.env.DEV) import('./dev/gait');
// dev: route captures and the tight-spot camera report (see dev/composition.ts)
if (import.meta.env.DEV) import('./dev/composition');
// dev: the first minute of a new player (see dev/onboarding.ts)
if (import.meta.env.DEV) import('./dev/onboarding');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Installed game (PWA): the service worker caches the game for offline play. Production only: in
// development it would serve stale modules. Registered at the deploy path ("/" or "/<repository>/").
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch((e) => {
      console.warn('[Shinichi] service worker não registrado:', e);
    });
  });
}
