// Mapa da Viagem — extras para a noite: passaporte dos pubs, ranking da Guinness,
// caderno de whisky, bingo e "Levar-me a casa". Usa o estado e as funções de app.js.
"use strict";

Object.assign(ICON, {
  pint:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l-1.4 16.2A2 2 0 0 1 14.6 21H9.4a2 2 0 0 1-2-1.8z"/><path d="M6.4 8h11.2"/></svg>',
  stamp:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6l-1 7h3a2 2 0 0 1 2 2v3H5v-3a2 2 0 0 1 2-2h3z"/><path d="M5 19h14"/></svg>',
  glass:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h10l-1 9a4 4 0 0 1-8 0z"/><path d="M8 8h8M12 16v5M9 21h6"/></svg>',
  dice:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.3" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.3" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.3" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.3" fill="currentColor"/></svg>',
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10M10 20v-5h4v5"/></svg>',
  wheel:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/></svg>',
  star:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.8 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.3l-5.7 3 1.1-6.3-4.6-4.5 6.4-.9z"/></svg>',
});

Object.assign(S, {
  rates: store.get("rates", {}),       // {lugar: {aparelho: {p,h,t,name,at}}}
  whiskies: store.get("whiskies", {}), // {uid: {...}}
  bingo: store.get("bingo", {}),       // {aparelho: {name, cells:[...16]}}
  home: store.get("home", {}),         // {edi:[lng,lat], dub:[lng,lat]}
});
const myName = () => S.name || "Eu";
const nameOf = (dev, n) => dev === S.device ? "Tu" : (n || "Alguém");

// ───────── Sincronização dos extras ─────────
const _applyRemote = applyRemote;
applyRemote = function(key, v){
  const i = key.indexOf(":"), type = key.slice(0,i), id = key.slice(i+1);
  if (type === "rate"){
    const j = id.lastIndexOf(":"), place = id.slice(0,j), dev = id.slice(j+1);
    S.rates[place] = S.rates[place] || {}; if (v) S.rates[place][dev] = v; else delete S.rates[place][dev];
    store.set("rates", S.rates); return true;
  }
  if (type === "whisky"){ if (v) S.whiskies[id] = v; else delete S.whiskies[id]; store.set("whiskies", S.whiskies); return true; }
  if (type === "bingo"){ if (v) S.bingo[id] = v; else delete S.bingo[id]; store.set("bingo", S.bingo); return true; }
  if (type === "home"){ if (v) S.home[id] = v; else delete S.home[id]; store.set("home", S.home); drawHome(); return true; }
  return _applyRemote(key, v);
};
// Ao ligar a partilha, envia também os extras que já existem neste telemóvel
const _startShare = startShare;
startShare = async function(code){
  for (const [place, by] of Object.entries(S.rates)) if (by[S.device]) S.outbox[`rate:${place}:${S.device}`] = by[S.device];
  for (const [uid, w] of Object.entries(S.whiskies)) if (w.by === S.device) S.outbox["whisky:"+uid] = w;
  if (S.bingo[S.device]) S.outbox["bingo:"+S.device] = S.bingo[S.device];
  for (const [c, ll] of Object.entries(S.home)) S.outbox["home:"+c] = ll;
  store.set("outbox", S.outbox);
  const r = await _startShare(code);
  if (!S.name) askName();
  return r;
};
function askName(){
  modal(`<div class="mhead"><h4>Como te chamas?</h4><button class="x" data-close aria-label="Fechar">${ICON.x}</button></div>
    <form id="nf"><label for="nf-name">O teu nome aparece no mural, no bingo e nas notas da Guinness<input id="nf-name" required autocomplete="given-name" placeholder="ex.: Tiago"></label>
    <button class="btn dark" type="submit">Guardar</button></form>`);
  $("#nf").onsubmit = e => {
    e.preventDefault(); S.name = $("#nf-name").value.trim(); if (!S.name) return;
    store.set("name", S.name);
    if (S.bingo[S.device]){ S.bingo[S.device].name = S.name; store.set("bingo", S.bingo); change("bingo:"+S.device, S.bingo[S.device]); }
    closeModal(); toast("Olá, " + S.name);
  };
}

// ───────── Passaporte dos pubs ─────────
const BADGES = [
  {id:"first", label:"Primeira pint", test:v => v.length >= 1},
  {id:"five", label:"5 pubs", test:v => v.length >= 5},
  {id:"ten", label:"10 pubs", test:v => v.length >= 10},
  {id:"edi", label:"Edimburgo completa", test:v => pubs("edi").every(p => v.includes(p.id))},
  {id:"dub", label:"Dublin completa", test:v => pubs("dub").every(p => v.includes(p.id))},
  {id:"trad", label:"Música ao vivo", test:v => pubs().filter(p => p.trad).some(p => v.includes(p.id))},
  {id:"old", label:"Os mais antigos", test:v => ["sheepheid","brazenhead"].every(id => v.includes(id))},
  {id:"whisky", label:"Bares de whisky", test:v => pubs().filter(p => p.whisky).filter(p => v.includes(p.id)).length >= 3},
];
const pubs = city => PLACES.filter(p => p.pub && (!city || p.city === city));
function openPassport(){
  const visited = pubs().filter(p => isDone(p.id)).map(p => p.id);
  const got = BADGES.filter(b => b.test(visited));
  const city = c => `<h5 class="psec">${CITY[c].name} <small>${pubs(c).filter(p => isDone(p.id)).length} de ${pubs(c).length}</small></h5>
    <div class="stamps">${pubs(c).map(p => `<button class="stamp ${isDone(p.id) ? "on" : ""}" data-id="${esc(p.id)}"><span class="sc">${isDone(p.id) ? ICON.check : ICON.pint}</span><span class="sn">${esc(p.name.replace(/^The /,""))}</span></button>`).join("")}</div>`;
  modal(`<div class="mhead"><h4>Passaporte dos pubs</h4><button class="x" data-close aria-label="Fechar">${ICON.x}</button></div>
    <p class="hint">Cada pub onde marcares "Já fui" ganha um carimbo.${S.code ? " O passaporte é do grupo todo." : ""}</p>
    <div class="badges">${BADGES.map(b => `<span class="badge ${got.includes(b) ? "on" : ""}">${ICON.star}${b.label}</span>`).join("")}</div>
    ${city("edi")}${city("dub")}`);
  $("#mbox").querySelectorAll(".stamp").forEach(b => b.onclick = () => { closeModal(); openDetail(b.dataset.id, true); });
}

// ───────── Ranking da Guinness ─────────
const rateDraft = {}; // notas a meio (só ficam guardadas com as três preenchidas)
const CRIT = [["p","Tirada"],["h","Espuma"],["t","Sabor"]];
const avg = r => (r.p + r.h + r.t) / 3;
function placeScore(id){
  const rs = Object.values(S.rates[id] || {}); if (!rs.length) return null;
  return {score: rs.reduce((s,r) => s + avg(r), 0) / rs.length, n: rs.length};
}
const stars = (v, max = 5) => `<span class="stars">${Array.from({length:max}, (_,i) => `<i class="${i < Math.round(v) ? "on" : ""}">${ICON.star}</i>`).join("")}</span>`;
function guinnessBlock(p){
  const mine = rateDraft[p.id] || S.rates[p.id]?.[S.device] || {p:0,h:0,t:0};
  const sc = placeScore(p.id);
  return `<section class="gblock" id="gblock"><h4>${ICON.pint}A Guinness daqui ${sc ? `<small>${sc.score.toFixed(1).replace(".",",")} · ${sc.n} ${sc.n === 1 ? "voto" : "votos"}</small>` : ""}</h4>
    ${CRIT.map(([k,l]) => `<div class="rate"><span>${l}</span><span class="rstars" data-k="${k}">${[1,2,3,4,5].map(n => `<button data-n="${n}" class="${n <= mine[k] ? "on" : ""}" aria-label="${l} ${n}">${ICON.star}</button>`).join("")}</span></div>`).join("")}
  </section>`;
}
function wireGuinness(p){
  document.querySelectorAll("#gblock .rstars button").forEach(b => b.onclick = () => {
    const k = b.parentElement.dataset.k, n = +b.dataset.n;
    const cur = {...(rateDraft[p.id] || S.rates[p.id]?.[S.device] || {p:0,h:0,t:0})};
    rateDraft[p.id] = cur;
    cur[k] = cur[k] === n ? 0 : n; cur.name = S.name; cur.at = Date.now();
    S.rates[p.id] = S.rates[p.id] || {};
    const complete = cur.p && cur.h && cur.t;
    if (complete) S.rates[p.id][S.device] = cur; else delete S.rates[p.id][S.device];
    store.set("rates", S.rates); change(`rate:${p.id}:${S.device}`, complete ? cur : null);
    b.parentElement.querySelectorAll("button").forEach(x => x.classList.toggle("on", +x.dataset.n <= cur[k]));
    if (complete) toast("Nota guardada");
  });
}
function openRanking(){
  const list = Object.keys(S.rates).map(id => ({p:byId(id), s:placeScore(id)})).filter(x => x.p && x.s).sort((a,b) => b.s.score - a.s.score);
  modal(`<div class="mhead"><h4>Ranking da Guinness</h4><button class="x" data-close aria-label="Fechar">${ICON.x}</button></div>
    <p class="hint">Dá nota à pint em cada pub (na ficha do sítio): tirada, espuma e sabor.${S.code ? " Conta a média de todos." : ""}</p>
    ${list.length ? `<ol class="rank">${list.map((x,i) => `<li><button data-id="${esc(x.p.id)}"><span class="pos">${i+1}</span><span class="rn"><b>${esc(x.p.name)}</b><small>${CITY[x.p.city].name} · ${x.s.n} ${x.s.n === 1 ? "voto" : "votos"}</small></span>${stars(x.s.score)}<span class="rv">${x.s.score.toFixed(1).replace(".",",")}</span></button></li>`).join("")}</ol>`
      : `<p class="hint" style="padding:10px 0 20px">Ainda sem notas. Abre um pub e avalia a Guinness.</p>`}`);
  $("#mbox").querySelectorAll(".rank button").forEach(b => b.onclick = () => { closeModal(); openDetail(b.dataset.id, true); });
}

// ───────── Caderno de whisky ─────────
const SMOKE = ["Nada fumado","Pouco","Médio","Muito fumado"];
function openWhisky(){
  const list = Object.entries(S.whiskies).map(([uid,w]) => ({uid, ...w})).sort((a,b) => b.score - a.score || b.at - a.at);
  modal(`<div class="mhead"><h4>Caderno de whisky</h4><button class="x" data-close aria-label="Fechar">${ICON.x}</button></div>
    <button class="btn dark" id="w-add" style="width:100%;margin-bottom:12px">Nova prova</button>
    ${list.length ? `<div class="wlist">${list.map(w => `<article class="wcard">
      <header><b>${esc(w.name)}</b>${stars(w.score)}</header>
      <small>${esc(SMOKE[w.smoke] || "")}${w.place && byId(w.place) ? " · " + esc(byId(w.place).name) : ""} · ${esc(nameOf(w.by, w.byName))}</small>
      ${w.note ? `<p>${esc(w.note)}</p>` : ""}
      ${w.by === S.device ? `<button class="link" data-del="${esc(w.uid)}" style="text-align:left;padding-top:6px">Apagar</button>` : ""}
    </article>`).join("")}</div>`
      : `<p class="hint">Aponta aqui cada whisky que provarem, para saberem qual comprar no fim.</p>`}
    <p class="hint" style="margin-top:12px">Bares de whisky no mapa: ${pubs("edi").filter(p => p.whisky).map(p => esc(p.name)).join(", ")}.</p>`);
  $("#w-add").onclick = () => whiskyForm();
  $("#mbox").querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
    if (!b.dataset.armed){ b.dataset.armed = 1; b.textContent = "Toca outra vez para apagar"; return; }
    delete S.whiskies[b.dataset.del]; store.set("whiskies", S.whiskies); change("whisky:"+b.dataset.del, null); openWhisky();
  });
}
function whiskyForm(){
  const near = S.me ? all().filter(p => p.pub || p.cat === "beber").sort((a,b) => dist(S.me,[a.lng,a.lat]) - dist(S.me,[b.lng,b.lat]))[0] : null;
  const w = {score:0, smoke:1};
  modal(`<div class="mhead"><h4>Nova prova</h4><button class="x" data-close aria-label="Fechar">${ICON.x}</button></div>
    <form id="wf">
      <label for="wf-name">Whisky<input id="wf-name" required placeholder="ex.: Lagavulin 16"></label>
      <label>Nota<span class="rstars big" id="wf-score">${[1,2,3,4,5].map(n => `<button type="button" data-n="${n}" aria-label="${n} estrelas">${ICON.star}</button>`).join("")}</span></label>
      <label>Fumado<div class="seg" id="wf-smoke">${SMOKE.map((s,i) => `<button type="button" data-i="${i}" aria-pressed="${i===1}">${s}</button>`).join("")}</div></label>
      <label for="wf-note">Como era<textarea id="wf-note" placeholder="Doce, salgado, a fumo de turfa…"></textarea></label>
      ${near && dist(S.me,[near.lng,near.lat]) < 200 ? `<label class="chk"><input type="checkbox" id="wf-here" checked> Provado em ${esc(near.name)}</label>` : ""}
      <button class="btn dark" type="submit">Guardar</button>
    </form>`);
  $("#wf-score").onclick = e => { const b = e.target.closest("button"); if (!b) return; w.score = +b.dataset.n; $("#wf-score").querySelectorAll("button").forEach(x => x.classList.toggle("on", +x.dataset.n <= w.score)); };
  $("#wf-smoke").onclick = e => { const b = e.target.closest("button"); if (!b) return; w.smoke = +b.dataset.i; $("#wf-smoke").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); };
  $("#wf").onsubmit = e => {
    e.preventDefault();
    const uid = uuid();
    const rec = {name:$("#wf-name").value.trim(), score:w.score, smoke:w.smoke, note:$("#wf-note").value.trim(),
      place: $("#wf-here")?.checked ? near.id : null, by:S.device, byName:S.name, at:Date.now()};
    if (!rec.name) return;
    S.whiskies[uid] = rec; store.set("whiskies", S.whiskies); change("whisky:"+uid, rec); openWhisky(); toast("Prova guardada");
  };
}

// ───────── Bingo da noite ─────────
const BINGO = [
  "Dizer “Sláinte” a um local", "Ouvir música tradicional ao vivo", "Fazer o “split the G”", "Provar haggis",
  "Provar um whisky fumado", "Pint no pub mais antigo", "Foto com o castelo à noite", "Provar Irn-Bru",
  "Um local recomenda-te um pub", "Cantar o refrão com o pub inteiro", "Fish & chips depois da meia-noite", "Selfie com a Molly Malone",
  "Pôr do sol no Calton Hill", "Brinde com um desconhecido", "Apanhar chuva e não desistir", "Comprar uma garrafa de whisky",
];
const LINES = (() => { const L = []; for (let i = 0; i < 4; i++){ L.push([0,1,2,3].map(j => i*4+j)); L.push([0,1,2,3].map(j => j*4+i)); } L.push([0,5,10,15], [3,6,9,12]); return L; })();
const lines = cells => LINES.filter(l => l.every(i => cells[i])).length;
function openBingo(){
  const me = S.bingo[S.device] || {name:S.name, cells:Array(16).fill(false)};
  const others = Object.entries(S.bingo).filter(([d]) => d !== S.device);
  modal(`<div class="mhead"><h4>Bingo da noite</h4><button class="x" data-close aria-label="Fechar">${ICON.x}</button></div>
    <p class="hint">Toca num quadrado quando o fizeres. Linha completa (horizontal, vertical ou diagonal) = Bingo.</p>
    <div class="bingo" id="bingo">${BINGO.map((t,i) => `<button class="${me.cells[i] ? "on" : ""}" data-i="${i}">${esc(t)}</button>`).join("")}</div>
    <div class="bscore" id="bscore"></div>
    ${others.length ? `<h5 class="psec">O grupo</h5><ul class="blist">${others.map(([d,b]) => `<li><b>${esc(b.name || "Alguém")}</b><span>${b.cells.filter(Boolean).length}/16 · ${lines(b.cells)} ${lines(b.cells) === 1 ? "linha" : "linhas"}</span></li>`).join("")}</ul>` : ""}`);
  const score = () => { const n = lines(me.cells); $("#bscore").textContent = `${me.cells.filter(Boolean).length} de 16 · ${n} ${n === 1 ? "linha" : "linhas"}`; };
  score();
  $("#bingo").onclick = e => {
    const b = e.target.closest("button"); if (!b) return;
    const before = lines(me.cells), i = +b.dataset.i;
    me.cells[i] = !me.cells[i]; me.name = S.name; b.classList.toggle("on", me.cells[i]);
    S.bingo[S.device] = me; store.set("bingo", S.bingo); change("bingo:"+S.device, me);
    score();
    if (lines(me.cells) > before){ toast("BINGO!"); $("#bingo").classList.remove("win"); void $("#bingo").offsetWidth; $("#bingo").classList.add("win"); }
  };
}


// ───────── Roleta do sim ou não ─────────
let wheelRot = 0;
function openRoleta(){
  const segs = Array.from({length:8}, (_,i) => i % 2 === 0 ? "Sim" : "Não");
  modal(`<div class="mhead"><h4>Sim ou não?</h4><button class="x" data-close aria-label="Fechar">${ICON.x}</button></div>
    <input id="rq" placeholder="A pergunta (opcional): mais uma?" style="margin-bottom:16px">
    <div class="wheelbox"><span class="pointer"></span>
      <div class="wheel" id="wheel" style="transform:rotate(${wheelRot}deg)">${segs.map((t,i) => `<span class="wl" style="transform:rotate(${i*45+22.5}deg)"><b>${t}</b></span>`).join("")}</div>
      <button class="hub" id="spin">Rodar</button>
    </div>
    <p class="wres" id="wres" aria-live="polite">&nbsp;</p>`);
  const wheel = $("#wheel"), res = $("#wres");
  let busy = false;
  const spin = () => {
    if (busy) return; busy = true; res.innerHTML = "&nbsp;";
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const extra = Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / 2**32 * 360);
    wheelRot += (reduce ? 0 : 360*6) + extra;
    wheel.style.transition = reduce ? "none" : "transform 3.6s cubic-bezier(.12,.75,.15,1)";
    wheel.style.transform = `rotate(${wheelRot}deg)`;
    setTimeout(() => {
      const a = (360 - (wheelRot % 360)) % 360;          // ângulo da roda debaixo do ponteiro
      const sim = Math.floor(a / 45) % 2 === 0;
      const q = $("#rq")?.value.trim();
      res.innerHTML = `<b class="${sim ? "sim" : "nao"}">${sim ? "Sim!" : "Não."}</b>${q ? `<small>${esc(q)}</small>` : ""}`;
      busy = false;
    }, reduce ? 50 : 3700);
  };
  $("#spin").onclick = spin;
  wheel.onclick = spin;
}

// ───────── Levar-me a casa ─────────
function goHome(){
  const h = S.home[S.city];
  if (!h) return setHome();
  location.href = `https://www.google.com/maps/dir/?api=1&destination=${h[1]},${h[0]}&travelmode=walking`;
}
function setHome(){
  const h = S.home[S.city];
  modal(`<div class="mhead"><h4>Alojamento em ${CITY[S.city].name}</h4><button class="x" data-close aria-label="Fechar">${ICON.x}</button></div>
    <p class="hint" style="margin-bottom:12px">${h ? "Já está marcado." : "Marca onde vais dormir. Depois o botão da casinha mostra o caminho a pé até lá."}${S.code ? " Fica igual para o grupo todo." : ""}</p>
    <div class="actions" style="flex-direction:column">
      <button class="btn dark" id="h-here" ${S.me ? "" : "disabled"}>Estou no alojamento agora</button>
      <button class="btn" id="h-pick">Escolher no mapa</button>
      ${h ? `<a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${h[1]},${h[0]}&travelmode=walking">${ICON.walk}Ir para lá</a>` : ""}
    </div>
    ${h ? `<button class="link" id="h-del">Apagar alojamento</button>` : ""}`);
  const save = ll => { S.home[S.city] = ll; store.set("home", S.home); change("home:"+S.city, ll); drawHome(); toast("Alojamento guardado"); };
  $("#h-here").onclick = () => { if (S.me){ save(S.me); closeModal(); } };
  $("#h-pick").onclick = () => { closeModal(); pickPoint("Move o mapa até ao alojamento", ll => save(ll)); };
  const del = $("#h-del");
  if (del) del.onclick = () => { delete S.home[S.city]; store.set("home", S.home); change("home:"+S.city, null); drawHome(); closeModal(); };
}
function pickPoint(text, done){
  document.body.classList.add("picking");
  const cr = document.createElement("div"); cr.className = "cross"; cr.innerHTML = `<div class="mk noimg" style="--c:#111">${ICON.home}</div>`;
  const bar = document.createElement("div"); bar.className = "pickbar glass";
  bar.innerHTML = `<p>${esc(text)}</p><button class="btn" id="pp-c">Cancelar</button><button class="btn dark" id="pp-o">Usar</button>`;
  document.body.append(cr, bar);
  const end = () => { cr.remove(); bar.remove(); document.body.classList.remove("picking"); };
  $("#pp-c").onclick = end;
  $("#pp-o").onclick = () => { const c = map.getCenter(); end(); done([c.lng, c.lat]); };
}
let homeMarker = null;
function drawHome(){
  if (!map) return;
  homeMarker?.remove(); homeMarker = null;
  const h = S.home[S.city]; if (!h) return;
  const el = document.createElement("div"); el.innerHTML = `<div class="mk noimg homemk" style="--c:#111">${ICON.home}</div>`;
  el.onclick = e => { e.stopPropagation(); setHome(); };
  homeMarker = new maplibregl.Marker({element:el}).setLngLat(h).addTo(map);
}

// ───────── Ligações à app ─────────
const _openDetail = openDetail;
openDetail = function(id, fly){
  _openDetail(id, fly);
  const p = byId(id); if (!p) return;
  if (p.pub || p.guinness){
    const vids = $("#detail .vids") || $("#detail .actions");
    vids.insertAdjacentHTML("afterend", guinnessBlock(p));
    wireGuinness(p);
  }
  if (p.pub){ const d = $("#done"); if (d && !isDone(id)) d.innerHTML = `${ICON.stamp}Carimbar`; }
};
const _openMenu = openMenu;
openMenu = function(){
  _openMenu();
  $("#mbox .menu").insertAdjacentHTML("beforeend", `
    <button class="mrow" id="m-roleta">${ICON.wheel}<span><b>Sim ou não?</b><small>Quando não conseguem decidir</small></span></button>
    <h5 class="psec" style="margin:10px 4px 0">Para a noite</h5>
    <button class="mrow" id="m-pass">${ICON.stamp}<span><b>Passaporte dos pubs</b><small>${pubs().filter(p => isDone(p.id)).length} de ${pubs().length} carimbos</small></span></button>
    <button class="mrow" id="m-rank">${ICON.pint}<span><b>Ranking da Guinness</b><small>A melhor pint da viagem, votada por todos</small></span></button>
    <button class="mrow" id="m-whisky">${ICON.glass}<span><b>Caderno de whisky</b><small>${Object.keys(S.whiskies).length} provas</small></span></button>
    <button class="mrow" id="m-bingo">${ICON.dice}<span><b>Bingo da noite</b><small>16 desafios, quem faz linha primeiro</small></span></button>
    <button class="mrow" id="m-home">${ICON.home}<span><b>Alojamento</b><small>${S.home[S.city] ? "Marcado em " + CITY[S.city].name : "Ainda por marcar em " + CITY[S.city].name}</small></span></button>`);
  $("#m-pass").onclick = openPassport;
  $("#m-rank").onclick = openRanking;
  $("#m-whisky").onclick = openWhisky;
  $("#m-bingo").onclick = openBingo;
  $("#m-roleta").onclick = openRoleta;
  $("#m-home").onclick = setHome;
};
const _setCity = setCity;
setCity = function(c, move){ _setCity(c, move); drawHome(); };
$("#menu").onclick = openMenu; // o botão tinha ficado com o menu antigo
$("#home").innerHTML = ICON.home;
$("#home").onclick = goHome;
(function waitMap(){ if (map && map.loaded()) drawHome(); else setTimeout(waitMap, 300); })();
