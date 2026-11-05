const V = "viagem-v3";
const SHELL = ["./", "index.html", "places.js", "manifest.webmanifest", "icon-192.png",
  "https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.min.js"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
// Só apaga caches antigas desta app (não mexe nas do assistente)
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("viagem-v") && k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  // Mapa e miniaturas: guardar à medida que os vês (funciona com pouca rede)
  if (url.hostname === "tiles.openfreemap.org" || url.pathname.includes("/thumbs/")) {
    e.respondWith(caches.open("viagem-map").then(async c => {
      const hit = await c.match(e.request); if (hit) return hit;
      const r = await fetch(e.request); if (r.ok) c.put(e.request, r.clone()); return r;
    }));
    return;
  }
  if (url.hostname.includes("tiktok") || url.hostname.includes("instagram")) return;
  // Resto: rede primeiro (para receberes atualizações), cache se estiveres sem rede
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const cl = r.clone(); caches.open(V).then(c => c.put(e.request, cl)); } return r; }).catch(() => caches.match(e.request)));
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
