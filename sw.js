const CACHE_NAME = 'arcane-vault-cache-v2.0.2';
const BASE = '/coffre_des_arcanes/';
const FILES_TO_CACHE = [
  BASE + 'index.html',
  BASE + 'style.css',
  BASE + 'script.js',
  BASE + 'data.js',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // On sécurise chaque ajout un par un pour éviter le crash global
        return Promise.all(
          FILES_TO_CACHE.map(url => {
            return cache.add(url).catch(err => {
              console.warn(`[Service Worker] Fichier introuvable ignoré du cache : ${url}`, err);
            });
          })
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') return caches.match(BASE + 'index.html');
      });
    })
  );
});
