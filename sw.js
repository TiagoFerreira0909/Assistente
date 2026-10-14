// Service worker: guarda os ficheiros da app para funcionar sem internet.
// Sempre que alterares ficheiros, muda o número da versão para o iPhone atualizar.
const VERSAO = 'assistente-v4';
const FICHEIROS = [
  './', 'index.html', 'style.css', 'db.js', 'app.js', 'financas.js', 'nuvem.js', 'arranque.js', 'manifest.json',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(FICHEIROS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Tenta a internet primeiro (para apanhar atualizações); sem rede usa a cópia guardada
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => { const c = r.clone(); caches.open(VERSAO).then((k) => k.put(e.request, c)); return r; })
      .catch(() => caches.match(e.request))
  );
});
