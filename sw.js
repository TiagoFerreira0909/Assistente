// Service worker: guarda os ficheiros da app para funcionar sem internet.
// Sempre que alterares ficheiros, muda o número da versão para o iPhone atualizar.
const VERSAO = 'assistente-v5';
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

// ----- Notificações -----
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { corpo: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'Assistente', {
    body: d.corpo || '',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    data: { url: d.url || './' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
    for (const j of janelas) if ('focus' in j) return j.focus();
    return self.clients.openWindow(url);
  }));
});
