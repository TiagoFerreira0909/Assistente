const V = "viagem-v11";
const SHELL = ["./", "index.html", "app.js?v=11", "places.js?v=11", "fun.js?v=11", "manifest.webmanifest", "icon-192.png",
  "https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.min.js"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
// Só apaga versões antigas desta app (não mexe nas caches do assistente nem no mapa guardado)
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("viagem-v") && k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  // Miniaturas e fotos do mural: guardar à medida que as vês
  if (url.pathname.includes("/viagem/thumbs/") || (url.hostname.endsWith("openfreemap.org") && url.pathname.startsWith("/sprites/")) || url.pathname.includes("/storage/v1/object/public/viagem-fotos/")) {
    e.respondWith(caches.open("viagem-map").then(async c => {
      const hit = await c.match(e.request); if (hit) return hit;
      const r = await fetch(e.request); if (r.ok) c.put(e.request, r.clone()); return r;
    }));
    return;
  }
  // O mapa é tratado pela própria app; vídeos e a nuvem vão sempre à rede
  if (url.hostname.endsWith("openfreemap.org") || url.hostname.includes("tiktok") || url.hostname.includes("instagram") || url.hostname.endsWith("supabase.co")) return;
  // Resto: rede primeiro (para receberes atualizações), cache se estiveres sem rede
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const cl = r.clone(); caches.open(V).then(c => c.put(e.request, cl)); } return r; })
    .catch(() => caches.match(e.request, {ignoreSearch: e.request.mode === "navigate"}).then(r => r || (e.request.mode === "navigate" ? caches.match("index.html") : r))));
});
// Tocar na notificação abre a app no sítio
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const id = e.notification.data?.id;
  e.waitUntil(clients.matchAll({type:"window", includeUncontrolled:true}).then(cs => {
    const c = cs.find(c => c.url.includes("/viagem/"));
    if (c) { c.postMessage({open:id}); return c.focus(); }
    return clients.openWindow("./#" + encodeURIComponent(id || ""));
  }));
});
