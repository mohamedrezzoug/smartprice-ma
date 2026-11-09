const CACHE = 'smartprice-ma-v4';
// Works under any sub-path (GitHub Pages): BASE = folder where sw.js lives.
const BASE = new URL('./', self.location).pathname;
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll([BASE, BASE + 'manifest.webmanifest', BASE + 'icon.svg', BASE + 'icons/icon-192.png', BASE + 'icons/icon-512.png'])));
});
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));

const put = (req, res) => { if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; };

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  // Privacy: never cache third-party location services (geocoding, store search, map tiles).
  // Their URLs/responses contain the user's position. Let the browser handle them normally.
  if (!sameOrigin && !FONT_HOSTS.includes(url.host)) return;
  // Pages: network first so new deployments show up, cache as offline fallback.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => put(BASE, res)).catch(() => caches.match(BASE)));
    return;
  }
  // Static assets (hashed by Vite) and fonts: cache first.
  e.respondWith(caches.match(req).then(cached => cached || fetch(req).then(res => put(req, res))));
});

// Background Sync: tell an open page to push the queued prices (Chrome/Android).
self.addEventListener('sync', e => {
  if (e.tag === 'sp-sync') {
    e.waitUntil(self.clients.matchAll({ includeUncontrolled: true }).then(cs => cs.forEach(c => c.postMessage({ type: 'sp-sync' }))));
  }
});

// Tapping a price notification focuses the app (or opens it).
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => cs.length ? cs[0].focus() : self.clients.openWindow(BASE)));
});
