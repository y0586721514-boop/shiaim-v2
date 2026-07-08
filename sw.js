/* ================================================================
   Service Worker — שיאים 2.0
   גרסת cache אחת ויחידה (CACHE_VERSION) — אין יותר חוסר סנכרון
   בין sw לבין ?v= בקבצים (תיקון באג 16).
   מעלים גרסה כאן בכל פריסה — והלקוחות מתעדכנים אוטומטית.
   ================================================================ */

const CACHE_VERSION = 'shiaim-v2.1.0';

const ASSETS = [
  './',
  './index.html',
  './app.css',
  './manifest.json',
  './shiaim-logo.jpg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/config.js',
  './js/util.js',
  './js/api.js',
  './js/state.js',
  './js/panels.js',
  './js/projects.js',
  './js/documents.js',
  './js/calculator.js',
  './js/wings.js',
  './js/settings.js',
  './js/main.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* network-first לקבצי האפליקציה: תמיד מנסים להביא גרסה טרייה,
   ואם אין רשת — מגישים מה-cache (קריאה אופליין). */
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
