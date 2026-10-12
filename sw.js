/* generated at build time */
const CACHE = 'calc-hub-424dbab66b';
const FILES = ["./","index.html","assets/index-SaSNqAuQ.js","assets/index-CWPORNWs.css","manifest.webmanifest","favicon.svg","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png"];
const scope = self.registration.scope;
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new URL(f, scope).href))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('calc-hub-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(new URL('index.html', scope).href, copy)); return r; }).catch(() => caches.match(new URL('index.html', scope).href).then((r) => r || caches.match(new URL('./', scope).href))));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return r; })));
});
