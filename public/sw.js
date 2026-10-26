/*
 * Service worker of the installed game (PWA). Paths are relative to this file, so it works at "/" and at
 * "/<repository>/" on GitHub Pages alike.
 *  - Pages (navigation): network first, so a new version shows up on the next visit; offline, the cached one.
 *  - Everything else (code, models, sounds, images, fonts): served from the cache at once and refreshed in
 *    the background (stale-while-revalidate). The game becomes playable offline after one full session.
 *  - Partial requests (Range) go straight to the network: the asset checker reads only the first bytes.
 * Bump VERSION to drop every old cache.
 */
const VERSION = 'shinichi-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './paw.svg', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !FONT_HOSTS.includes(url.hostname)) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./').then((hit) => hit || caches.match('./index.html'))),
    );
    return;
  }

  event.respondWith(
    caches.open(VERSION).then((cache) =>
      cache.match(req).then((hit) => {
        const fresh = fetch(req)
          .then((res) => {
            if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
            return res;
          })
          .catch(() => hit || Response.error());
        if (hit) {
          event.waitUntil(fresh.catch(() => undefined));
          return hit;
        }
        return fresh;
      }),
    ),
  );
});
