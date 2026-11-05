const V = "viagem-v2";
const SHELL = ["./", "index.html", "places.js", "manifest.webmanifest", "icon-192.png",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("viagem-v") && k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Azulejos do mapa: guardar à medida que os vês (funciona com pouca rede)
  if (url.hostname === "tile.openstreetmap.org") {
    e.respondWith(caches.open("viagem-tiles").then(async c => {
      const hit = await c.match(e.request); if (hit) return hit;
      const r = await fetch(e.request); if (r.ok) c.put(e.request, r.clone()); return r;
    }));
    return;
  }
  if (url.hostname.includes("tiktok") || url.hostname.includes("instagram")) return;
  // Resto: rede primeiro (para receberes atualizações), cache se estiveres sem rede
  e.respondWith(fetch(e.request).then(r => { if (r.ok) caches.open(V).then(c => c.put(e.request, r.clone())); return r; }).catch(() => caches.match(e.request)));
});
