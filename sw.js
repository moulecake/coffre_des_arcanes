const CACHE_NAME = 'arcane-vault-cache-v2.2.0';
// Chemin de base DÉDUIT de l'emplacement du Service Worker (scope) : aucun préfixe de dépôt écrit en dur
// → fonctionne à l'identique sur /coffre_des_arcanes/ (officiel) et /coffre_des_arcanes_dev/ (test) sans rien changer.
const BASE = self.registration.scope;                     // ex. https://moulecake.github.io/coffre_des_arcanes/
const IS_LOCAL = ['localhost', '127.0.0.1', '[::1]'].includes(self.location.hostname);   // Live Server : pas de cache (évite le code périmé)
const FILES_TO_CACHE = [
  BASE,
  BASE + 'index.html',
  BASE + 'style.css',
  BASE + 'script.js',
  BASE + 'data.js',
  BASE + 'patchnotes.js',
  BASE + 'clicker/',
  BASE + 'clicker/index.html',
  BASE + 'clicker/style.css',
  BASE + 'clicker/core.js',
  BASE + 'clicker/passives.js',
  BASE + 'clicker/spells.js',
  BASE + 'android-chrome-192x192.png',
  BASE + 'android-chrome-512x512.png',
  BASE + 'apple-touch-icon.png',
  BASE + 'favicon-32x32.png',
  BASE + 'favicon-16x16.png',
  BASE + 'favicon.ico'
];

self.addEventListener('install', event => {
  if (IS_LOCAL) { event.waitUntil(self.skipWaiting()); return; }
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
  if (IS_LOCAL || event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') return caches.match(BASE + 'index.html');
      });
    })
  );
});

// ============================================================
// NOTIFICATIONS PUSH (Firebase Cloud Messaging) — le serveur (GitHub Actions, scripts/send-push.js) envoie des messages « data » :
// { title, body, url, tag }. Rien n'est affiché si l'app est déjà ouverte et visible (le joueur est déjà là).
// ============================================================
self.addEventListener('push', event => {
  let p = {};
  try { p = event.data ? event.data.json() : {}; } catch (e) { p = {}; }
  const d = Object.assign({}, p.notification || {}, p.data || {});     // FCM enveloppe le contenu : on accepte les deux formes
  const title = d.title || 'Le Coffre des Arcanes';
  const options = {
    body: d.body || '',
    icon: BASE + 'android-chrome-192x192.png',
    badge: BASE + 'android-chrome-192x192.png',
    tag: d.tag || 'arcanes',                                          // une notification par type : pas d'empilement
    renotify: true,
    data: { url: d.url || BASE }
  };
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.some(c => c.visibilityState === 'visible')) return;    // joueur présent → pas de notification
      return self.registration.showNotification(title, options);
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || BASE;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) { if ('focus' in c) { return c.focus(); } }
      return self.clients.openWindow(url);
    })
  );
});
