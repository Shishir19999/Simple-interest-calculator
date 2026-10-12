import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';

const STATIC = ['manifest.webmanifest', 'favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];

/** Emits sw.js with the list of built files so the whole app works offline after the first visit. */
function offlineWorker() {
  return {
    name: 'offline-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = ['./', 'index.html', ...Object.keys(bundle).filter((f) => f !== 'sw.js'), ...STATIC];
      const version = createHash('sha1').update(files.join('|') + Object.values(bundle).map((b) => (b.code || b.source || '').length).join(',')).digest('hex').slice(0, 10);
      const source = `/* generated at build time */
const CACHE = 'calc-hub-${version}';
const FILES = ${JSON.stringify(files)};
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
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [offlineWorker()],
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 700 },
});
