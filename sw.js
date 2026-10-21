/* Magic Games — service worker (v1.1 Cinematic Layers scheme).
   Strategy:
   • The app shell (HTML, manifest, icons) is precached on install.
   • Every other same-origin GET (game chunks, data JSONs such as the quiz
     banks and chess puzzles) is cache-first: on first open it is fetched
     from the network and stored at runtime, so after each game has been
     opened once while online, the whole hub works fully offline.
   • Bumping CACHE_VERSION ships a clean cache: on activate, every older
     cache is deleted, so a new deploy fully replaces the previous one.
   • Cross-origin requests (the Cairo webfont) pass through untouched. */
const CACHE_VERSION = 'magic-games-v4';
const CORE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // Individual adds so one missing file never breaks the whole install.
      Promise.allSettled(CORE.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // fonts etc. pass through

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          // Offline navigation fallback to the shell.
          if (request.mode === 'navigate') return caches.match('/index.html');
          return new Response('', { status: 504, statusText: 'Offline' });
        });
    })
  );
});
