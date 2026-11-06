// Mapa da Viagem — lógica da app
"use strict";

// ───────── Ícones ─────────
const ICON = {
  comer:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10M17 3c-1.7 1-3 3-3 6s1.3 3 3 3v9"/></svg>',
  beber:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l-1.5 7a4.5 4.5 0 0 1-9 0zM12 15v6M8 21h8"/></svg>',
  ver:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  fazer:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z"/></svg>',
  play:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  walk:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4" r="2"/><path d="m9 21 2-6 3 3v3M7 11l3-3 4 1 2 4h3M10 8l-1 5"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>',
  bell:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>',
  cloud:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 13v8M8 17l4 4 4-4"/><path d="M20 16.6A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.3"/></svg>',
  people:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M21.5 20a6.5 6.5 0 0 0-4-6"/></svg>',
  book:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6.5A2.5 2.5 0 0 0 4 21.5 2.5 2.5 0 0 0 6.5 24H20"/></svg>',
  more:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  camera:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  heart:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-9.6-9.1C.9 8.6 2.9 4.5 6.8 4.5c2.1 0 3.6 1.2 5.2 3 1.6-1.8 3.1-3 5.2-3 3.9 0 5.9 4.1 4.4 7.4C19.5 16.4 12 21 12 21z"/></svg>',
  grid:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="14" height="14" rx="2.5"/><path d="M7 3h11.5A2.5 2.5 0 0 1 21 5.5V17"/><path d="m3 16 4-4 4 4 2-2 4 4"/></svg>',
  sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 18a5 5 0 0 0-10 0M12 2v7M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M23 22H1M16 5l-4 4-4-4"/></svg>',
};
const CATS = {comer:{label:"Comer",color:"var(--comer)"}, beber:{label:"Beber",color:"var(--beber)"}, ver:{label:"Ver",color:"var(--ver)"}, fazer:{label:"Fazer",color:"var(--fazer)"}};
const CITY = {
  edi:{name:"Edimburgo", center:[-3.196,55.9515], zoom:13.6, box:[-3.30,55.90,-3.10,56.00]},
  dub:{name:"Dublin", center:[-6.265,53.344], zoom:13.6, box:[-6.40,53.30,-6.03,53.40]},
};
const NEAR_M = 150, NEAR_AGAIN_H = 6, SMALL_Z = 13.2;
const SB = { url:"https://putvpneoexwblbbqemer.supabase.co", key:"sb_publishable_rtIQLaakc9LH2c2PRuQTcA_AgpMYizi" };
const MAP_CACHE = "viagem-map";

// ───────── Estado ─────────
const store = {
  get(k,d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } },
  set(k,v){ try{ v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};
let doneAt = store.get("doneAt", null);
if (!doneAt){ doneAt = {}; store.get("done", []).forEach(id => doneAt[id] = Date.now()); store.set("doneAt", doneAt); }
const S = {
  city: store.get("city","edi"), filter:null, selected:null,
  doneAt, mine: store.get("mine",[]), notes: store.get("notes",{}),
  alerts: store.get("alerts", false), notified: store.get("notified",{}),
  code: store.get("shareCode", null), since: store.get("shareSince", null), outbox: store.get("outbox", {}),
  posts: store.get("posts", {}), likes: store.get("likes", {}),
  name: store.get("name", ""), device: store.get("device", null),
  me:null, follow:false,
};
if (!S.device){ S.device = [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2,"0")).join(""); store.set("device", S.device); }
const isDone = id => !!S.doneAt[id];
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const all = () => PLACES.concat(S.mine.map(p => ({...p, mine:true})));
const byId = id => all().find(p => p.id === id);
const img = p => (typeof THUMBS !== "undefined" && THUMBS.has(p.id)) ? `thumbs/${encodeURIComponent(p.id)}.jpg` : null;
function thumbHTML(p){
  const c = CATS[p.cat] || CATS.ver, u = img(p);
  return u ? `<span class="th" style="--c:${c.color};background-image:url('${u}')"></span>`
           : `<span class="th" style="--c:${c.color}">${ICON[p.cat]||ICON.ver}</span>`;
}
function toast(m){ const t=document.createElement("div"); t.className="toast"; t.textContent=m; document.body.appendChild(t); setTimeout(()=>t.remove(),2600); }

// ───────── Mapa com cache própria (para funcionar sem internet) ─────────
async function cachedFetch(url, {networkFirst=false} = {}){
  let cache = null; try{ cache = await caches.open(MAP_CACHE); }catch(e){}
  if (cache && !networkFirst){ const hit = await cache.match(url); if (hit) return hit; }
  try{
    const r = await fetch(url);
    if (r.ok && cache) cache.put(url, r.clone());
    if (r.ok || !cache) return r;
  }catch(e){ if (!cache) throw e; }
  const hit = cache && await cache.match(url);
  if (hit) return hit;
  throw new Error("offline");
}
const toOfm = u => u.replace(/^https:\/\//, "ofm://");
maplibregl.addProtocol("ofm", async (params) => {
  const url = "https://" + params.url.slice(6);
  const isTileJson = /\/planet$/.test(url);
  const r = await cachedFetch(url, {networkFirst: isTileJson && !store.get("offlinePack", null)});
  if (params.type === "json"){
    const j = await r.json();
    if (Array.isArray(j.tiles)) j.tiles = j.tiles.map(toOfm);
    return {data:j};
  }
  return {data: await r.arrayBuffer()};
});
async function loadStyle(){
  const r = await cachedFetch("https://tiles.openfreemap.org/styles/positron", {networkFirst: !store.get("offlinePack", null)});
  const s = await r.json();
  for (const src of Object.values(s.sources)){
    if (src.url) src.url = toOfm(src.url);
    if (src.tiles) src.tiles = src.tiles.map(toOfm);
  }
  if (s.glyphs) s.glyphs = toOfm(s.glyphs);
  return s;
}

let map, markers = {};
async function initMap(){
  let style;
  try{ style = await loadStyle(); }catch(e){ style = {version:8, sources:{}, layers:[{id:"bg", type:"background", paint:{"background-color":"#eeeeec"}}]}; toast("Sem internet e sem mapa guardado"); }
  map = new maplibregl.Map({ container:"map", style, center:CITY[S.city].center, zoom:CITY[S.city].zoom,
    attributionControl:false, pitchWithRotate:false, dragRotate:false });
  map.addControl(new maplibregl.AttributionControl({compact:true, customAttribution:'<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'}), "bottom-right");
  map.touchZoomRotate.disableRotation();
  map.on("zoom", () => { const s = map.getZoom() < SMALL_Z; Object.values(markers).forEach(m => m.getElement().firstChild.classList.toggle("small", s)); });
  map.on("dragstart", () => { S.follow = false; $("#locate").classList.remove("on"); });
  map.on("load", () => { drawMarkers(); routeHash(); });
}
function drawMarkers(){
  if (!map) return;
  Object.values(markers).forEach(m => m.remove()); markers = {};
  const small = map.getZoom() < SMALL_Z;
  for (const p of all()){
    if (p.city !== S.city || (S.filter && p.cat !== S.filter)) continue;
    const c = CATS[p.cat] || CATS.ver, u = img(p);
    const el = document.createElement("div");
    el.className = ["mk", u ? "" : "noimg", small ? "small" : "", isDone(p.id) ? "done" : "", S.selected === p.id ? "sel" : ""].join(" ");
    el.style.setProperty("--c", c.color);
    if (u) el.style.backgroundImage = `url('${u}')`; else el.innerHTML = ICON[p.cat] || ICON.ver;
    const wrap = document.createElement("div"); wrap.appendChild(el);
    if (S.selected === p.id) wrap.style.zIndex = 3;
    wrap.addEventListener("click", e => { e.stopPropagation(); openDetail(p.id, false); });
    markers[p.id] = new maplibregl.Marker({element:wrap}).setLngLat([p.lng,p.lat]).addTo(map);
  }
}

// ───────── Localização ─────────
let meMarker = null, geoStarted = false;
function startGeo(){
  if (geoStarted) return; geoStarted = true;
  if (!navigator.geolocation) return toast("Sem localização neste dispositivo");
  navigator.geolocation.watchPosition(pos => {
    const ll = [pos.coords.longitude, pos.coords.latitude], first = !S.me;
    S.me = ll;
    if (map){
      if (!meMarker){ const el = document.createElement("div"); el.className = "me"; meMarker = new maplibregl.Marker({element:el}).setLngLat(ll).addTo(map); }
      else meMarker.setLngLat(ll);
      if (first){
        const near = Object.entries(CITY).find(([k,c]) => dist(ll, c.center) < 40000);
        if (near){ if (near[0] !== S.city) setCity(near[0], false); if (!S.selected) map.jumpTo({center:ll, zoom:15}); }
      }
      if (S.follow) map.easeTo({center:ll});
    }
    renderList(); refreshMeta(); checkNear();
  }, err => { geoStarted = false; $("#locate").classList.remove("on"); if (err.code === 1) toast("Ativa a localização do Safari nas Definições"); },
  {enableHighAccuracy:true, maximumAge:5000});
}
function dist(a,b){ const R=6371000, r=x=>x*Math.PI/180, dLa=r(b[1]-a[1]), dLo=r(b[0]-a[0]);
  const h=Math.sin(dLa/2)**2+Math.cos(r(a[1]))*Math.cos(r(b[1]))*Math.sin(dLo/2)**2; return 2*R*Math.asin(Math.sqrt(h)); }
const fmt = m => m < 1000 ? `${Math.round(m/10)*10} m` : m < 20000 ? `${(m/1000).toFixed(1).replace(".",",")} km` : `${Math.round(m/1000)} km`;
const walkMin = m => { const n = Math.round(m/80); return n < 60 ? `${Math.max(1,n)} min a pé` : ""; };

// ───────── Horários ─────────
const DAYS = ["domingo","segunda","terça","quarta","quinta","sexta","sábado"];
function nowIn(tz){
  const parts = new Intl.DateTimeFormat("en-GB", {timeZone:tz, weekday:"short", hour:"2-digit", minute:"2-digit", hourCycle:"h23"}).formatToParts(new Date());
  const g = t => parts.find(p => p.type === t).value;
  return { day: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(g("weekday")), min: +g("hour")*60 + +g("minute") };
}
const hm = m => { m = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`; };
function ranges(spec){
  return (spec || "").split(",").filter(Boolean).map(r => {
    const [a,b] = r.split("-").map(t => { const [h,m] = t.split(":").map(Number); return h*60+m; });
    return [a, b <= a ? b + 1440 : b];
  });
}
function openStatus(p){
  const H = typeof HOURS !== "undefined" && HOURS[p.id]; if (!H) return null;
  const {day, min} = nowIn(CITY_TZ[p.city]);
  const today = ranges(H[day]), yest = ranges(H[(day+6)%7]).filter(r => r[1] > 1440).map(r => [r[0]-1440, r[1]-1440]);
  const cur = [...yest, ...today].find(r => r[0] <= min && min < r[1]);
  if (cur){
    const left = cur[1] - min;
    return left <= 60 ? {cls:"soon", text:`Fecha em ${left} min`} : {cls:"open", text:`Aberto até às ${hm(cur[1])}`};
  }
  const next = today.find(r => r[0] > min);
  if (next) return {cls:"closed", text:`Fechado · abre às ${hm(next[0])}`};
  for (let i = 1; i <= 7; i++){
    const r = ranges(H[(day+i)%7])[0];
    if (r) return {cls:"closed", text:`Fechado · abre ${i===1 ? "amanhã" : DAYS[(day+i)%7]} às ${hm(r[0])}`};
  }
  return {cls:"closed", text:"Fechado"};
}

// ───────── Pôr do sol ─────────
function sunset(lat, lng, date = new Date()){
  const rad = Math.PI/180, J2000 = 2451545;
  const jd = Math.floor(date.getTime()/86400000) + 2440588; // meio-dia UTC desse dia
  const n = Math.round(jd - J2000 + 0.0008);
  const Js = n - lng/360;
  const M = (357.5291 + 0.98560028*Js) % 360;
  const C = 1.9148*Math.sin(M*rad) + 0.02*Math.sin(2*M*rad) + 0.0003*Math.sin(3*M*rad);
  const L = (M + C + 180 + 102.9372) % 360;
  const Jt = J2000 + Js + 0.0053*Math.sin(M*rad) - 0.0069*Math.sin(2*L*rad);
  const dec = Math.asin(Math.sin(L*rad)*Math.sin(23.4397*rad));
  const w = Math.acos((Math.sin(-0.833*rad) - Math.sin(lat*rad)*Math.sin(dec)) / (Math.cos(lat*rad)*Math.cos(dec)));
  return new Date((Jt + w/(2*Math.PI) - 2440587.5) * 86400000);
}
function sunLine(){
  const c = CITY[S.city], tz = CITY_TZ[S.city], now = new Date();
  let t = sunset(c.center[1], c.center[0], now), tomorrow = false;
  if (t < now){ t = sunset(c.center[1], c.center[0], new Date(now.getTime() + 86400000)); tomorrow = true; }
  const time = new Intl.DateTimeFormat("pt-PT", {timeZone:tz, hour:"2-digit", minute:"2-digit"}).format(t);
  const left = Math.round((t - now)/60000);
  const extra = !tomorrow && left <= 120 ? ` · daqui a ${left >= 60 ? Math.floor(left/60)+" h "+(left%60)+" min" : left+" min"}` : "";
  return `${ICON.sun}<span>Pôr do sol ${tomorrow ? "amanhã " : ""}às ${time}${extra}</span>`;
}

// ───────── Avisos de proximidade ─────────
async function checkNear(){
  if (!S.alerts || !S.me) return;
  const now = Date.now();
  const hits = all().filter(p => !isDone(p.id) && dist(S.me,[p.lng,p.lat]) <= NEAR_M && now - (S.notified[p.id]||0) > NEAR_AGAIN_H*3600e3)
                    .sort((a,b) => dist(S.me,[a.lng,a.lat]) - dist(S.me,[b.lng,b.lat]));
  if (!hits.length) return;
  const p = hits[0];
  S.notified[p.id] = now; store.set("notified", S.notified);
  const st = openStatus(p);
  const title = `Estás perto de ${p.name}`, body = [st && st.text + ".", p.what, p.tip].filter(Boolean).join(" ");
  if ("Notification" in window && Notification.permission === "granted"){
    try{
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) await reg.showNotification(title, {body, icon: img(p) || "icon-192.png", tag:p.id, data:{id:p.id}});
      else new Notification(title, {body, icon: img(p) || "icon-192.png", tag:p.id});
    }catch(e){}
  }
  if (document.visibilityState === "visible") showNearBanner(p, title);
}
function showNearBanner(p, title){
  document.querySelector(".near")?.remove();
  const b = document.createElement("button"); b.className = "near glass";
  b.innerHTML = `${thumbHTML(p)}<span style="min-width:0"><b>${esc(title)}</b><span class="t">${esc(p.what)}</span></span>`;
  b.onclick = () => { b.remove(); openDetail(p.id, true); };
  document.body.appendChild(b); setTimeout(() => b.remove(), 9000);
}
async function toggleAlerts(){
  if (S.alerts){ S.alerts = false; store.set("alerts", false); toast("Avisos desligados"); return; }
  let perm = "Notification" in window ? Notification.permission : "unsupported";
  if (perm === "default"){ try{ perm = await Notification.requestPermission(); }catch(e){} }
  S.alerts = true; store.set("alerts", true);
  startGeo();
  toast(perm === "granted" ? `Aviso-te a menos de ${NEAR_M} m de um sítio` : "Avisos ligados só dentro da app");
  checkNear();
}
navigator.serviceWorker?.addEventListener("message", e => { if (e.data?.open) openDetail(e.data.open, true); });

// ───────── Lista ─────────
function visible(){
  const ps = all().filter(p => p.city === S.city && (!S.filter || p.cat === S.filter));
  if (S.me) ps.forEach(p => p._d = dist(S.me, [p.lng,p.lat]));
  return ps.sort((a,b) => (isDone(a.id) - isDone(b.id)) || (S.me ? a._d - b._d : a.name.localeCompare(b.name)));
}
function renderList(){
  const ps = visible(), inCity = S.me && dist(S.me, CITY[S.city].center) < 40000;
  $("#title").textContent = inCity ? "Perto de ti" : CITY[S.city].name;
  const left = ps.filter(p => !isDone(p.id)).length;
  $("#count").textContent = left < ps.length ? `${left} de ${ps.length} por ver` : `${ps.length} sítios`;
  $("#sun").innerHTML = sunLine();
  const tips = CITY_TIPS[S.city] || [];
  $("#list").innerHTML = (tips.length ? `<details class="tips"><summary>Dicas para ${CITY[S.city].name}</summary><ul>${tips.map(t => `<li>${esc(t)}</li>`).join("")}</ul></details>` : "") +
    (ps.length ? ps.map(p => { const st = openStatus(p); return `<button class="row ${isDone(p.id)?"done":""}" data-id="${esc(p.id)}">${thumbHTML(p)}
      <span class="txt"><span class="nm">${esc(p.name)}</span><span class="sub">${st ? `<span class="st ${st.cls}">${st.text}</span> · ` : ""}${esc(p.what)}</span></span>
      ${S.me ? `<span class="dist">${fmt(p._d)}</span>` : ""}</button>`; }).join("") : `<div class="empty">Nada nesta categoria.</div>`);
}
$("#list").addEventListener("click", e => { const r = e.target.closest(".row"); if (r) openDetail(r.dataset.id, true); });
setInterval(() => { if (document.visibilityState === "visible"){ if (!S.selected) renderList(); else refreshMeta(); } }, 60000);

// ───────── Detalhe ─────────
let noteTimer = null;
function openDetail(id, fly){
  const p = byId(id); if (!p) return;
  if (p.city !== S.city) setCity(p.city, false);
  S.selected = id; drawMarkers();
  const c = CATS[p.cat] || CATS.ver, done = isDone(id), vids = (p.videos||[]).map(v => VIDEOS[v] || v);
  const last = typeof LAST_ENTRY !== "undefined" && LAST_ENTRY[id];
  $("#detail").innerHTML = `
    <button class="back" id="back">‹ Todos</button>
    <div class="dtop">${thumbHTML(p)}<div style="min-width:0"><div class="kicker" style="--c:${c.color}">${c.label}${p.mine ? " · adicionado" : ""}</div><h3>${esc(p.name)}</h3><div class="meta" id="meta"></div></div></div>
    <div class="hours" id="hours"></div>
    ${p.what ? `<p>${esc(p.what)}</p>` : ""}
    ${p.tip || last ? `<p class="tip">${esc([p.tip, last].filter(Boolean).join(" "))}</p>` : ""}
    <div class="actions">
      <a class="btn dark" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=walking">${ICON.walk}Ir</a>
      <button class="btn ${done?"ok":""}" id="done">${ICON.check}${done ? "Já fui" : "Marcar como visto"}</button>
    </div>
    ${vids.length ? `<div class="vids">${vids.map(u => `<button class="vid" data-url="${esc(u)}"><span class="play">${ICON.play}</span><span><b>Ver vídeo</b><small>${esc(handle(u))}</small></span></button>`).join("")}</div>` : ""}
    <section class="diary" id="diary">
      <h4>O teu diário</h4>
      <textarea id="note" placeholder="Como foi? O que provaste?">${esc(S.notes[id]?.t || "")}</textarea>
      <div class="photos" id="photos"></div>
    </section>
    ${p.mine ? `<button class="link" id="del">Apagar este sítio</button>` : ""}`;
  $("#list").hidden = true; $("#detail").hidden = false; $("#head").hidden = true; $("#scroll").scrollTop = 0;
  refreshMeta(); renderPhotos(id); setSheet("mid");
  const off = {padding:{bottom: heights().mid, top: 90, left: 0, right: 0}};
  if (map) fly ? map.flyTo({center:[p.lng,p.lat], zoom:Math.max(map.getZoom(),15.5), duration:700, ...off}) : map.easeTo({center:[p.lng,p.lat], ...off});
  $("#back").onclick = closeDetail;
  $("#done").onclick = () => {
    const was = isDone(id);
    if (was) delete S.doneAt[id]; else S.doneAt[id] = Date.now();
    store.set("doneAt", S.doneAt); change("done:"+id, was ? null : {at:S.doneAt[id]});
    openDetail(id, false); renderList();
    if (!was){ setSheet("high"); setTimeout(() => $("#diary")?.scrollIntoView({behavior:"smooth", block:"start"}), 250); }
  };
  $("#note").addEventListener("input", e => {
    clearTimeout(noteTimer); const t = e.target.value;
    noteTimer = setTimeout(() => {
      if (t.trim()) S.notes[id] = {t, at:Date.now()}; else delete S.notes[id];
      store.set("notes", S.notes); change("note:"+id, t.trim() ? S.notes[id] : null);
    }, 600);
  });
  document.querySelectorAll(".vid").forEach(b => b.onclick = () => openVideo(b.dataset.url));
  const del = $("#del");
  if (del) del.onclick = () => {
    if (!del.dataset.armed){ del.dataset.armed = 1; del.textContent = "Toca outra vez para apagar"; return; }
    S.mine = S.mine.filter(x => x.id !== id); store.set("mine", S.mine); change("mine:"+id, null); closeDetail(); renderList(); toast("Apagado");
  };
}
function refreshMeta(){
  const p = S.selected && byId(S.selected); if (!p) return;
  const el = $("#meta"), hEl = $("#hours");
  if (el) el.textContent = S.me ? (d => [fmt(d), walkMin(d)].filter(Boolean).join(" · "))(dist(S.me, [p.lng,p.lat])) : "";
  if (hEl){ const st = openStatus(p); hEl.innerHTML = st ? `<span class="st ${st.cls}">${st.text}</span>` : ""; hEl.hidden = !st; }
}
function closeDetail(){
  if (S.selected){ S.selected = null; drawMarkers(); }
  $("#detail").hidden = true; $("#list").hidden = false; $("#head").hidden = false;
}
const handle = u => (u.match(/tiktok\.com\/(@[^/]+)/)||[])[1] || (/instagram/.test(u) ? "Instagram" : u.replace(/^https?:\/\//,"").slice(0,40));

// ───────── Fotos e mural ─────────
// Cada foto fica primeiro neste telemóvel (IndexedDB). Com a partilha ligada, é enviada
// para a nuvem e aparece no mural de todos os que têm o link da viagem.
const idb = (() => {
  let db = null;
  const open = () => db ? Promise.resolve(db) : new Promise((res, rej) => {
    const r = indexedDB.open("viagem", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("fotos", {keyPath:"id", autoIncrement:true}).createIndex("place", "place");
    r.onsuccess = () => res(db = r.result); r.onerror = () => rej(r.error);
  });
  const tx = async (mode, fn) => { const d = await open(); return new Promise((res, rej) => { const t = d.transaction("fotos", mode); const out = fn(t.objectStore("fotos")); t.oncomplete = () => res(out.result ?? out); t.onerror = () => rej(t.error); }); };
  return {
    add: rec => tx("readwrite", s => s.add(rec)),
    put: rec => tx("readwrite", s => s.put(rec)),
    del: id => tx("readwrite", s => s.delete(id)),
    all: () => tx("readonly", s => s.getAll()),
  };
})();
const urls = [];
function blobURL(b){ const u = URL.createObjectURL(b); urls.push(u); return u; }
const remoteURL = path => `${SB.url}/storage/v1/object/public/viagem-fotos/${path}`;
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2,"0")).join(""));

// Lista única de publicações: as da nuvem + as deste telemóvel ainda por enviar
async function getPosts(place){
  let local = []; try{ local = await idb.all(); }catch(e){}
  const byUid = new Map();
  for (const [uid, p] of Object.entries(S.posts)) byUid.set(uid, {uid, ...p, src: remoteURL(p.path)});
  for (const f of local){
    if (!f.uid) f.uid = "local" + f.id;
    const ex = byUid.get(f.uid);
    if (ex){ ex.src = blobURL(f.blob); ex.localId = f.id; }
    else if (!f.gone) byUid.set(f.uid, {uid:f.uid, place:f.place, by:S.device, name:S.name, at:f.at, caption:f.caption||"", src:blobURL(f.blob), localId:f.id, pending:true});
  }
  let list = [...byUid.values()];
  if (place) list = list.filter(p => p.place === place);
  return list.sort((a,b) => b.at - a.at);
}
const likesOf = uid => Object.keys(S.likes[uid] || {}).length;
const iLike = uid => !!S.likes[uid]?.[S.device];
function toggleLike(uid){
  S.likes[uid] = S.likes[uid] || {};
  if (iLike(uid)) delete S.likes[uid][S.device]; else S.likes[uid][S.device] = true;
  store.set("likes", S.likes); change(`like:${uid}:${S.device}`, iLike(uid) ? {at:Date.now()} : null);
}

async function renderPhotos(id){
  const box = $("#photos"); if (!box) return;
  const posts = await getPosts(id);
  if (S.selected !== id) return;
  box.innerHTML = posts.map(p => `<button class="ph" data-u="${esc(p.uid)}" style="background-image:url('${p.src}')">${p.by !== S.device && p.name ? `<em>${esc(p.name.split(" ")[0])}</em>` : ""}</button>`).join("") +
    `<label class="ph add">${ICON.camera}<span>Foto</span><input type="file" accept="image/*" id="photo-in" hidden></label>`;
  $("#photo-in").onchange = e => { const file = e.target.files[0]; if (file) composePost(id, file); };
  box.querySelectorAll(".ph[data-u]").forEach(b => b.onclick = () => openPost(posts.find(x => x.uid === b.dataset.u)));
}
async function composePost(place, file){
  let blob; try{ blob = await shrink(file); }catch(e){ return toast("Não consegui abrir a foto"); }
  const prev = blobURL(blob);
  modal(`<div class="mhead"><h4>${S.code ? "Publicar no mural" : "Guardar foto"}</h4><button class="x" data-close aria-label="Fechar">${ICON.x}</button></div>
    <img class="big" src="${prev}" alt="">
    <form id="pf" style="margin-top:12px">
      ${S.code && !S.name ? `<label for="pf-name">O teu nome<input id="pf-name" required placeholder="Como os outros te veem" autocomplete="given-name"></label>` : ""}
      <label for="pf-cap">Legenda<textarea id="pf-cap" placeholder="Opcional"></textarea></label>
      <button class="btn dark" type="submit">${S.code ? "Publicar" : "Guardar"}</button>
      ${S.code ? "" : `<p class="hint">Fica só neste telemóvel. Liga a partilha no menu para os outros verem.</p>`}
    </form>`);
  $("#pf").onsubmit = async e => {
    e.preventDefault();
    if ($("#pf-name")){ S.name = $("#pf-name").value.trim(); store.set("name", S.name); }
    const rec = {uid: uuid(), place, blob, at: Date.now(), caption: $("#pf-cap").value.trim()};
    try{ await idb.add(rec); }catch(err){ return toast("Não consegui guardar a foto"); }
    closeModal(); renderPhotos(place); toast(S.code ? "A publicar…" : "Foto guardada"); sync();
  };
}
function openPost(p){
  if (!p) return;
  const place = byId(p.place), mine = p.by === S.device;
  const df = new Intl.DateTimeFormat("pt-PT", {day:"numeric", month:"short", hour:"2-digit", minute:"2-digit"});
  modal(`<div class="mhead"><h4>${esc(place?.name || "")}</h4><button class="x" data-close aria-label="Fechar">${ICON.x}</button></div>
    ${postCard(p, place, df, false)}
    ${mine ? `<button class="link" id="ph-del">Apagar esta foto</button>` : ""}`);
  wireCards();
  const del = $("#ph-del");
  if (del) del.onclick = async () => {
    if (!del.dataset.armed){ del.dataset.armed = 1; del.textContent = "Toca outra vez para apagar"; return; }
    if (p.localId) await idb.del(p.localId).catch(()=>{});
    if (S.posts[p.uid]){ delete S.posts[p.uid]; store.set("posts", S.posts); change("foto:"+p.uid, null); }
    closeModal(); if (S.selected) renderPhotos(S.selected); toast("Apagada");
  };
}
function postCard(p, place, df, showPlace = true){
  const who = p.by === S.device ? "Tu" : (p.name || "Alguém");
  return `<article class="post">
    <header><span class="av">${esc(who[0].toUpperCase())}</span><span><b>${esc(who)}</b>${showPlace && place ? ` <button class="plc" data-id="${esc(place.id)}">em ${esc(place.name)}</button>` : ""}<small>${df.format(new Date(p.at))}${p.pending ? (S.code ? " · a enviar…" : " · só neste telemóvel") : ""}</small></span></header>
    <img src="${p.src}" alt="" loading="lazy">
    <footer>${p.pending ? "" : `<button class="like ${iLike(p.uid) ? "on" : ""}" data-u="${esc(p.uid)}">${ICON.heart}<span>${likesOf(p.uid) || ""}</span></button>`}${p.caption ? `<p>${esc(p.caption)}</p>` : ""}</footer>
  </article>`;
}
function wireCards(){
  $("#mbox").querySelectorAll(".like").forEach(b => b.onclick = () => { toggleLike(b.dataset.u); b.classList.toggle("on", iLike(b.dataset.u)); b.querySelector("span").textContent = likesOf(b.dataset.u) || ""; });
  $("#mbox").querySelectorAll(".plc").forEach(b => b.onclick = () => { closeModal(); openDetail(b.dataset.id, true); });
}
async function openFeed(){
  if (S.code) sync();
  const posts = await getPosts();
  const df = new Intl.DateTimeFormat("pt-PT", {day:"numeric", month:"short", hour:"2-digit", minute:"2-digit"});
  modal(`<div class="mhead"><h4>Mural</h4><button class="x" data-close aria-label="Fechar">${ICON.x}</button></div>
    ${S.code ? "" : `<p class="hint" style="margin-bottom:12px">Só tu vês estas fotos. Para as partilhar, liga a partilha no menu ⋯.</p>`}
    ${posts.length ? `<div class="feed">${posts.map(p => postCard(p, byId(p.place), df)).join("")}</div>`
      : `<p class="hint" style="padding:8px 0 20px">Ainda não há fotos. Abre um sítio e toca em <b>Foto</b> para publicar a primeira.</p>`}`);
  wireCards();
}
// Envia as fotos deste telemóvel que ainda não estão na nuvem
async function uploadPending(){
  if (!S.code) return;
  let local = []; try{ local = await idb.all(); }catch(e){ return; }
  for (const f of local){
    if (f.up || f.gone) continue;
    if (!f.uid){ f.uid = uuid(); await idb.put(f); }
    const path = `${S.code}/${f.uid}.jpg`;
    const r = await fetch(`${SB.url}/storage/v1/object/viagem-fotos/${path}`, {method:"POST", headers:{apikey:SB.key, Authorization:"Bearer "+SB.key, "Content-Type":"image/jpeg", "x-upsert":"false"}, body:f.blob});
    if (!r.ok && r.status !== 409 && r.status !== 400) throw new Error("upload " + r.status);
    const post = {place:f.place, path, by:S.device, name:S.name || "", at:f.at, caption:f.caption || ""};
    S.posts[f.uid] = post; store.set("posts", S.posts);
    S.outbox["foto:"+f.uid] = post; store.set("outbox", S.outbox);
    f.up = true; await idb.put(f);
  }
}
async function shrink(file, max = 1600){
  const bm = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bm.width, bm.height));
  const c = document.createElement("canvas"); c.width = Math.round(bm.width*k); c.height = Math.round(bm.height*k);
  c.getContext("2d").drawImage(bm, 0, 0, c.width, c.height);
  return new Promise(res => c.toBlob(b => res(b || file), "image/jpeg", 0.8));
}
async function openDiary(){
  const posts = (await getPosts()).filter(p => p.by === S.device);
  const ids = new Set([...Object.keys(S.doneAt), ...Object.keys(S.notes), ...posts.map(f => f.place)]);
  const when = id => Math.max(S.doneAt[id]||0, S.notes[id]?.at||0, ...posts.filter(f => f.place === id).map(f => f.at));
  const list = [...ids].map(byId).filter(Boolean).sort((a,b) => when(b.id) - when(a.id));
  const df = new Intl.DateTimeFormat("pt-PT", {day:"numeric", month:"short", hour:"2-digit", minute:"2-digit"});
  modal(`<div class="mhead"><h4>Diário</h4><button class="x" data-close aria-label="Fechar">${ICON.x}</button></div>
    ${list.length ? list.map(p => `<article class="entry">
      <button class="entry-h" data-id="${esc(p.id)}">${thumbHTML(p)}<span><b>${esc(p.name)}</b><small>${df.format(new Date(when(p.id)))}</small></span></button>
      ${S.notes[p.id] ? `<p>${esc(S.notes[p.id].t)}</p>` : ""}
      ${posts.some(f => f.place === p.id) ? `<div class="photos">${posts.filter(f => f.place === p.id).map(f => `<span class="ph" style="background-image:url('${f.src}')"></span>`).join("")}</div>` : ""}
    </article>`).join("") : `<p class="hint" style="padding:12px 0 20px">Ainda está vazio. Quando marcares um sítio como visto, podes escrever uma nota e juntar fotos.</p>`}`);
  $("#mbox").querySelectorAll(".entry-h").forEach(b => b.onclick = () => { closeModal(); openDetail(b.dataset.id, true); });
}

// ───────── Partilha com quem vai contigo (Supabase) ─────────
async function rpc(fn, body){
  const r = await fetch(`${SB.url}/rest/v1/rpc/${fn}`, {method:"POST", headers:{apikey:SB.key, "Content-Type":"application/json"}, body:JSON.stringify(body)});
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
function change(key, value){
  if (!S.code) return;
  S.outbox[key] = value; store.set("outbox", S.outbox); sync();
}
let syncing = null, lastSyncOk = store.get("lastSyncOk", null);
function sync(){
  if (!S.code) return Promise.resolve();
  if (syncing) return syncing.then(() => sync());
  syncing = (async () => {
    try{
      await uploadPending();
      for (const [k,v] of Object.entries({...S.outbox})){
        await rpc("viagem_gravar", {p_codigo:S.code, p_chave:k, p_valor:v});
        if (JSON.stringify(S.outbox[k]) === JSON.stringify(v)){ delete S.outbox[k]; store.set("outbox", S.outbox); }
      }
      const rows = await rpc("viagem_ler", {p_codigo:S.code, p_desde:S.since});
      let changed = false;
      for (const r of rows){
        if (r.chave in S.outbox) continue;
        changed = applyRemote(r.chave, r.valor) || changed;
        S.since = r.atualizado;
      }
      store.set("shareSince", S.since);
      lastSyncOk = Date.now(); store.set("lastSyncOk", lastSyncOk);
      if (changed){ store.set("doneAt", S.doneAt); store.set("notes", S.notes); store.set("mine", S.mine); store.set("posts", S.posts); store.set("likes", S.likes); drawMarkers(); if (S.selected && $("#modal").hidden) renderPhotos(S.selected); renderList(); if (S.selected) refreshMeta(); }
    }catch(e){ /* sem rede: tenta mais tarde */ }
    finally{ syncing = null; }
  })();
  return syncing;
}
function applyRemote(key, v){
  const i = key.indexOf(":"), type = key.slice(0,i), id = key.slice(i+1);
  if (type === "done"){ const had = isDone(id); if (v) S.doneAt[id] = v.at || Date.now(); else delete S.doneAt[id]; return had !== !!v; }
  if (type === "note"){ if (v) S.notes[id] = v; else delete S.notes[id]; return true; }
  if (type === "mine"){ S.mine = S.mine.filter(x => x.id !== id); if (v) S.mine.push(v); return true; }
  if (type === "foto"){ if (v) S.posts[id] = v; else delete S.posts[id]; return true; }
  if (type === "like"){ const [uid, dev] = id.split(":"); S.likes[uid] = S.likes[uid] || {}; if (v) S.likes[uid][dev] = true; else delete S.likes[uid][dev]; return true; }
  return false;
}
function shareLink(){ return location.origin + location.pathname + "#v=" + S.code; }
async function startShare(code){
  const fresh = !code;
  S.code = code || [...crypto.getRandomValues(new Uint8Array(12))].map(b => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join("");
  S.since = null; store.set("shareCode", S.code); store.set("shareSince", null);
  if (fresh) S.outbox["viagem:info"] = {criada: Date.now()};
  // envia o que já tens neste telemóvel
  Object.entries(S.doneAt).forEach(([id,at]) => S.outbox["done:"+id] = {at});
  Object.entries(S.notes).forEach(([id,n]) => S.outbox["note:"+id] = n);
  S.mine.forEach(p => S.outbox["mine:"+p.id] = p);
  store.set("outbox", S.outbox);
  await sync();
  if (!fresh) toast("Lista partilhada ligada");
}
function stopShare(){ S.code = null; S.since = null; S.outbox = {}; ["shareCode","shareSince","outbox"].forEach(k => store.set(k, null)); }
setInterval(() => { if (S.code && document.visibilityState === "visible") sync(); }, 20000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible"){ sync(); renderList(); } });

// ───────── Mapa offline ─────────
function tileXY(lng, lat, z){
  const n = 2**z, x = Math.floor((lng+180)/360*n);
  const r = lat*Math.PI/180, y = Math.floor((1 - Math.log(Math.tan(r) + 1/Math.cos(r))/Math.PI)/2*n);
  return [x, y];
}
async function saveOffline(onProgress){
  const cache = await caches.open(MAP_CACHE);
  const styleUrl = "https://tiles.openfreemap.org/styles/positron";
  const style = await (await fetch(styleUrl)).json();
  await cache.put(styleUrl, new Response(JSON.stringify(style), {headers:{"Content-Type":"application/json"}}));
  const tjUrl = style.sources.openmaptiles.url;
  const tj = await (await fetch(tjUrl)).json();
  await cache.put(tjUrl, new Response(JSON.stringify(tj), {headers:{"Content-Type":"application/json"}}));
  const list = [];
  const tpl = tj.tiles[0];
  for (const c of Object.values(CITY)){
    const [w,s,e,n] = c.box;
    for (let z = 5; z <= 14; z++){
      const [x0,y0] = tileXY(w, n, z), [x1,y1] = tileXY(e, s, z);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) list.push(tpl.replace("{z}",z).replace("{x}",x).replace("{y}",y));
    }
    const ne = style.sources.ne2_shaded?.tiles?.[0];
    if (ne) for (let z = 0; z <= 6; z++){ const [x,y] = tileXY(c.center[0], c.center[1], z); list.push(ne.replace("{z}",z).replace("{x}",x).replace("{y}",y)); }
  }
  const fonts = new Set(); style.layers.forEach(l => { const f = l.layout?.["text-font"]; if (Array.isArray(f)) fonts.add(f.join(",")); });
  fonts.forEach(f => ["0-255","256-511","8192-8447"].forEach(r => list.push(style.glyphs.replace("{fontstack}", encodeURIComponent(f)).replace("{range}", r))));
  if (typeof style.sprite === "string") ["", "@2x"].forEach(s => [".json",".png"].forEach(ext => list.push(style.sprite + s + ext)));
  const base = location.href.replace(/[#?].*$/, "").replace(/[^/]*$/, "");
  [...THUMBS].forEach(id => list.push(base + "thumbs/" + encodeURIComponent(id) + ".jpg"));
  ["", "index.html", "app.js?v=7", "places.js?v=7", "manifest.webmanifest", "icon-192.png"].forEach(f => list.push(base + f));
  let done = 0, bytes = 0, fails = 0;
  const queue = [...new Set(list)];
  const total = queue.length;
  const worker = async () => {
    while (queue.length){
      const u = queue.shift();
      try{
        if (!(await cache.match(u))){ const r = await fetch(u); if (r.ok){ const b = await r.clone().blob(); bytes += b.size; await cache.put(u, r); } else fails++; }
      }catch(e){ fails++; }
      onProgress(++done, total);
    }
  };
  await Promise.all(Array.from({length:6}, worker));
  try{ await navigator.storage?.persist?.(); }catch(e){}
  store.set("offlinePack", {at:Date.now(), tiles:tj.tiles[0], fails});
  return {total, fails, bytes};
}

// ───────── Menu ─────────
function openMenu(){
  const pack = store.get("offlinePack", null);
  const df = new Intl.DateTimeFormat("pt-PT", {day:"numeric", month:"short", hour:"2-digit", minute:"2-digit"});
  modal(`<div class="mhead"><h4>Mais</h4><button class="x" data-close aria-label="Fechar">${ICON.x}</button></div>
    <div class="menu">
      <button class="mrow" id="m-alerts">${ICON.bell}<span><b>Avisar quando estiver perto</b><small>A menos de ${NEAR_M} m de um sítio por ver</small></span><i class="sw ${S.alerts?"on":""}"></i></button>
      <button class="mrow" id="m-off">${ICON.cloud}<span><b>Guardar mapa para usar sem internet</b><small id="m-off-s">${pack ? "Guardado a " + df.format(new Date(pack.at)) + ". Toca para atualizar." : "Edimburgo e Dublin, cerca de 40 MB. Faz isto com Wi-Fi."}</small></span></button>
      <div class="bar" id="m-bar" hidden><i></i></div>
      <button class="mrow" id="m-share">${ICON.people}<span><b>Partilhar com quem vai contigo</b><small>${S.code ? "Ligado. " + (lastSyncOk ? "Sincronizado a " + df.format(new Date(lastSyncOk)) : "A sincronizar…") : "Todos veem o que já foi visto, as notas e as fotos"}</small></span></button>
      <button class="mrow" id="m-feed">${ICON.grid}<span><b>Mural</b><small>Fotos de todos nos sítios da viagem</small></span></button>
      <button class="mrow" id="m-diary">${ICON.book}<span><b>Diário</b><small>Notas e fotos dos sítios por onde passaste</small></span></button>
    </div>`);
  $("#m-alerts").onclick = async () => { await toggleAlerts(); $("#m-alerts .sw").classList.toggle("on", S.alerts); };
  $("#m-off").onclick = async () => {
    const b = $("#m-off"); if (b.dataset.busy) return; b.dataset.busy = 1;
    const bar = $("#m-bar"), s = $("#m-off-s"); bar.hidden = false;
    try{
      const r = await saveOffline((d,t) => { bar.firstChild.style.width = (100*d/t).toFixed(0)+"%"; s.textContent = `A guardar… ${d} de ${t}`; });
      s.textContent = r.fails ? `Guardado, mas falharam ${r.fails} partes. Tenta outra vez com melhor rede.` : `Guardado. Já podes usar sem internet.`;
    }catch(e){ s.textContent = "Precisas de internet para guardar o mapa."; }
    delete b.dataset.busy;
  };
  $("#m-share").onclick = openShare;
  $("#m-diary").onclick = openDiary;
  $("#m-feed").onclick = openFeed;
}
async function openShare(){
  if (!S.code){
    modal(`<div class="mhead"><h4>Partilhar a viagem</h4><button class="x" data-close aria-label="Fechar">${ICON.x}</button></div>
      <p class="hint" style="margin-bottom:14px">Cria um link e envia-o a quem vai contigo. Quem o abrir fica a ver o mesmo que tu: sítios já vistos, notas, sítios acrescentados e as fotos do mural.</p>
      <button class="btn dark" id="sh-new" style="width:100%">Criar link</button>`);
    $("#sh-new").onclick = async () => { $("#sh-new").textContent = "A criar…"; await startShare(); openShare(); };
    return;
  }
  const link = shareLink();
  modal(`<div class="mhead"><h4>Partilhar a viagem</h4><button class="x" data-close aria-label="Fechar">${ICON.x}</button></div>
    <p class="hint" style="margin-bottom:10px">Envia este link a quem vai contigo e pede-lhe para o abrir no Safari e adicionar ao ecrã principal.</p>
    <div class="linkbox" id="sh-link">${esc(link)}</div>
    <div class="actions" style="margin-top:10px">
      <button class="btn dark" id="sh-send">Enviar</button><button class="btn" id="sh-copy">Copiar</button>
    </div>
    <button class="link" id="sh-stop">Deixar de partilhar neste telemóvel</button>`);
  $("#sh-send").onclick = async () => { try{ await navigator.share({title:"Mapa da viagem", text:"A nossa lista de sítios para Edimburgo e Dublin", url:link}); }catch(e){} };
  $("#sh-copy").onclick = async () => { try{ await navigator.clipboard.writeText(link); toast("Link copiado"); }catch(e){ const r = document.createRange(); r.selectNodeContents($("#sh-link")); getSelection().removeAllRanges(); getSelection().addRange(r); } };
  $("#sh-stop").onclick = e => { if (!e.target.dataset.armed){ e.target.dataset.armed = 1; e.target.textContent = "Toca outra vez para confirmar"; return; } stopShare(); closeModal(); toast("Partilha desligada"); };
}

// ───────── Vídeo, modal ─────────
function openVideo(url){
  const tt = url.match(/tiktok\.com\/@[^/]+\/(video|photo)\/(\d+)/), ig = url.match(/instagram\.com\/(?:reel|p|reels)\/([^/?#]+)/);
  const src = tt ? (tt[1] === "video" ? `https://www.tiktok.com/player/v1/${tt[2]}?description=1&rel=0` : `https://www.tiktok.com/embed/v2/${tt[2]}`) : ig ? `https://www.instagram.com/p/${ig[1]}/embed` : null;
  modal(`<div class="mhead"><h4>${esc(handle(url))}</h4><button class="x" data-close aria-label="Fechar">${ICON.x}</button></div>
    ${src ? `<div class="frame"><iframe src="${src}" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe></div>` : ""}
    <a class="btn dark" style="margin-top:12px" href="${esc(url)}" target="_blank" rel="noopener">Abrir no ${ig ? "Instagram" : "TikTok"}</a>`);
}
function modal(html){ $("#mbox").innerHTML = html; $("#modal").hidden = false; $("#modal").querySelectorAll("[data-close]").forEach(b => b.onclick = closeModal); }
function closeModal(){ $("#modal").hidden = true; $("#mbox").innerHTML = ""; while (urls.length > 60) URL.revokeObjectURL(urls.shift()); }
$("#modal").addEventListener("click", e => { if (e.target.id === "modal") closeModal(); });

// ───────── Adicionar sítio ─────────
let draft = null;
function openAdd(pre){
  draft = Object.assign({name:"",url:"",cat:"comer",what:"",lat:null,lng:null}, draft, pre);
  modal(`<div class="mhead"><h4>Novo sítio</h4><button class="x" data-close aria-label="Fechar">${ICON.x}</button></div>
    <form id="f">
      <label for="f-name">Nome<input id="f-name" required value="${esc(draft.name)}" placeholder="ex.: Oink"></label>
      <label for="f-url">Link do TikTok ou Reel<input id="f-url" type="url" inputmode="url" value="${esc(draft.url)}" placeholder="Opcional"></label>
      <label>Categoria<div class="seg" id="f-cat">${Object.entries(CATS).map(([k,c]) => `<button type="button" data-cat="${k}" aria-pressed="${draft.cat===k}">${c.label}</button>`).join("")}</div></label>
      <label for="f-what">Nota<textarea id="f-what" placeholder="O que queres provar ou ver">${esc(draft.what)}</textarea></label>
      <label>Localização<div class="seg"><button type="button" id="f-here" ${S.me?"":"disabled"}>Onde estou</button><button type="button" id="f-pick">Escolher no mapa</button></div>
        <p class="hint" id="f-loc">${draft.lat != null ? "Posição escolhida ✓" : "Ainda sem posição"}</p></label>
      <button class="btn dark" type="submit">Guardar</button>
    </form>`);
  const keep = () => { draft.name=$("#f-name").value; draft.url=$("#f-url").value; draft.what=$("#f-what").value; };
  $("#f-cat").onclick = e => { const b = e.target.closest("button"); if (!b) return; draft.cat = b.dataset.cat; $("#f-cat").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x===b)); };
  $("#f-here").onclick = () => { if (!S.me) return; draft.lng=S.me[0]; draft.lat=S.me[1]; $("#f-loc").textContent = "Onde estás agora ✓"; };
  $("#f-pick").onclick = () => { keep(); closeModal(); pick(); };
  $("#f").onsubmit = e => {
    e.preventDefault(); keep();
    if (!draft.name.trim()) return;
    if (draft.lat == null){ $("#f-loc").textContent = "Falta a localização"; return; }
    const id = "m"+Date.now(), pt = [draft.lng, draft.lat];
    const city = dist(pt, CITY.edi.center) < dist(pt, CITY.dub.center) ? "edi" : "dub";
    const p = {id, city, cat:draft.cat, name:draft.name.trim(), what:draft.what.trim(), tip:"", lat:draft.lat, lng:draft.lng, videos: draft.url.trim() ? [draft.url.trim()] : []};
    S.mine.push(p); store.set("mine", S.mine); change("mine:"+id, p);
    draft = null; closeModal(); renderList(); openDetail(id, true); toast("Guardado");
  };
}
function pick(){
  document.body.classList.add("picking");
  const cr = document.createElement("div"); cr.className = "cross"; cr.innerHTML = `<div class="mk noimg" style="--c:#111">${ICON.fazer}</div>`;
  const bar = document.createElement("div"); bar.className = "pickbar glass";
  bar.innerHTML = `<p>Move o mapa até ao sítio</p><button class="btn" id="pc">Cancelar</button><button class="btn dark" id="po">Usar</button>`;
  document.body.append(cr, bar);
  const end = () => { cr.remove(); bar.remove(); document.body.classList.remove("picking"); };
  $("#pc").onclick = () => { end(); openAdd(); };
  $("#po").onclick = () => { const c = map.getCenter(); end(); openAdd({lat:c.lat, lng:c.lng}); };
}

// ───────── Cidade, filtros, botões ─────────
function setCity(c, move=true){
  S.city = c; store.set("city", c);
  document.querySelectorAll(".cities button").forEach(b => b.setAttribute("aria-pressed", b.dataset.city === c));
  S.selected = null; closeDetail(); drawMarkers(); renderList();
  if (move && map) map.flyTo({center:CITY[c].center, zoom:CITY[c].zoom, duration:900, padding:{bottom:0,top:0,left:0,right:0}});
}
document.querySelectorAll(".cities button").forEach(b => b.onclick = () => setCity(b.dataset.city));
$("#chips").innerHTML = Object.entries(CATS).map(([k,c]) => `<button class="chip glass" data-cat="${k}" style="--c:${c.color}" aria-pressed="false"><i></i>${c.label}</button>`).join("");
$("#chips").onclick = e => {
  const b = e.target.closest(".chip"); if (!b) return;
  S.filter = S.filter === b.dataset.cat ? null : b.dataset.cat;
  document.querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", x.dataset.cat === S.filter));
  S.selected = null; closeDetail(); drawMarkers(); renderList();
};
$("#menu").innerHTML = ICON.more;
$("#menu").onclick = openMenu;
$("#feed").innerHTML = ICON.grid;
$("#feed").onclick = openFeed;
$("#add").onclick = () => openAdd();
$("#locate").onclick = () => {
  S.follow = true; $("#locate").classList.add("on");
  if (!S.me) return startGeo();
  map?.flyTo({center:S.me, zoom:Math.max(map.getZoom(),15.5), duration:600});
};

// ───────── Folha deslizante ─────────
const sheet = $("#sheet");
const heights = () => ({low:138, mid:Math.round(innerHeight*.46), high:Math.round(innerHeight*.88)});
let pos = "low";
function setSheet(p){ pos = p; const h = heights()[p]; sheet.style.setProperty("--h", h+"px"); document.documentElement.style.setProperty("--peek", Math.min(h, heights().mid)+"px"); }
(() => {
  let y0=null, h0=0, moved=false; const g = $("#grab");
  g.addEventListener("pointerdown", e => { y0=e.clientY; h0=sheet.getBoundingClientRect().height; moved=false; sheet.classList.add("drag"); g.setPointerCapture(e.pointerId); });
  g.addEventListener("pointermove", e => { if (y0==null) return; const dy=y0-e.clientY; if (Math.abs(dy)>4) moved=true; sheet.style.setProperty("--h", Math.max(90, Math.min(innerHeight*.94, h0+dy))+"px"); });
  const up = () => { if (y0==null) return; sheet.classList.remove("drag"); const h=sheet.getBoundingClientRect().height, H=heights();
    if (!moved) setSheet(pos==="low"?"mid":pos==="mid"?"high":"low"); else setSheet(Object.entries(H).sort((a,b)=>Math.abs(a[1]-h)-Math.abs(b[1]-h))[0][0]); y0=null; };
  g.addEventListener("pointerup", up); g.addEventListener("pointercancel", up);
})();
addEventListener("resize", () => setSheet(pos));

// ───────── Links (#v=código para partilha, #id para abrir um sítio) ─────────
function routeHash(){
  const h = decodeURIComponent(location.hash.slice(1)); if (!h) return;
  const m = h.match(/^v=([a-z0-9]{12,64})$/);
  if (m){ history.replaceState(null, "", location.pathname); if (m[1] !== S.code) startShare(m[1]); return; }
  if (byId(h)){ history.replaceState(null, "", location.pathname); openDetail(h, true); }
}

// ───────── Arranque ─────────
setSheet("low"); renderList();
initMap();
startGeo();
sync();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
