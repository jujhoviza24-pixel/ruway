// Service worker mínimo: es lo que Android exige para poder instalar la app.
const CACHE = 'ruway-v1';
const BASICOS = ['./', './index.html', './manifest.json',
                 './iconos/icono-192.png', './iconos/icono-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASICOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Nunca cachear las llamadas a Google: siempre datos frescos.
  if (url.hostname.indexOf('google') !== -1) return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
