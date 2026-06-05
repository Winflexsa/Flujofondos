/* Winflex · Flujo de Fondos — Service Worker
   Cachea el "shell" de la app para que abra offline en la tablet.
   Nunca cachea api.jsonbin.io (los datos van siempre frescos). */
const CACHE = 'wf-flujo-v1';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png'
];

// Librerías externas (best-effort: si fallan no rompen la instalación)
const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      c.addAll(ASSETS).then(() =>
        Promise.all(CDN.map(u =>
          fetch(u, { mode: 'cors' }).then(r => { if (r && r.ok) return c.put(u, r); }).catch(() => {})
        ))
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Solo GET; PUT/POST (sincronización) pasan directo a la red
  if (e.request.method !== 'GET') return;

  // Datos: nunca cachear JSONBin
  if (url.hostname === 'api.jsonbin.io') return;

  // Navegación: red primero (para tomar actualizaciones), con fallback offline
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Estáticos / CDN: cache primero, actualizando en segundo plano
  e.respondWith(
    caches.match(e.request).then(cached => {
      const net = fetch(e.request).then(r => {
        if (r && (r.status === 200 || r.type === 'opaque')) {
          const cp = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, cp));
        }
        return r;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
