// =====================================================
//  Núcleo da app: navegação, utilitários, folha, Início e Notas
// =====================================================
const conteudo = document.getElementById('conteudo');
const titulo = document.getElementById('titulo');
const folha = document.getElementById('folha');

// Ícones (SVG) da barra de navegação
const ICONES = {
  inicio: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  financas: '<rect x="2.5" y="6" width="19" height="14" rx="3"/><path d="M2.5 10h19M16 15h2"/><path d="M5 6l9-3 2 3"/>',
  notas: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  lembretes: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  datas: '<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
};
function svg(nome) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONES[nome]}</svg>`;
}

const VERSAO_APP = 16; // aparece no ecrã da Conta, para confirmar que o iPhone tem a versão nova

// ===== Navegação =====
const VISTAS = {
  inicio:    { nome: 'Início',    titulo: () => saudacao(), desenhar: vistaInicio },
  financas:  { nome: 'Finanças',  desenhar: () => vistaFinancas() },
  notas:     { nome: 'Notas',     desenhar: vistaNotas },
  lembretes: { nome: 'Lembretes', desenhar: () => vistaLembretes() },
  datas:     { nome: 'Datas',     desenhar: () => vistaDatas() },
};
let vistaAtual = 'inicio';

const barra = document.getElementById('barra');
for (const [chave, v] of Object.entries(VISTAS)) {
  const b = el('button', { 'data-vista': chave, onclick: () => irPara(chave) });
  b.innerHTML = svg(chave) + v.nome;
  barra.append(b);
}

// Os desenhos correm em fila: se dois pedidos chegarem ao mesmo tempo (ex.: sincronização
// e cobranças ao abrir a app), não ficam os dois no ecrã (conteúdo duplicado)
let filaDesenho = Promise.resolve();
function irPara(nome) {
  filaDesenho = filaDesenho.then(() => desenharVista(nome)).catch((e) => console.error(e));
  return filaDesenho;
}
async function desenharVista(nome) {
  vistaAtual = nome;
  barra.querySelectorAll('button').forEach((b) => b.classList.toggle('ativo', b.dataset.vista === nome));
  const v = VISTAS[nome];
  titulo.textContent = v.titulo ? v.titulo() : v.nome;
  document.querySelectorAll('.fab').forEach((f) => f.remove());
  conteudo.innerHTML = '';
  await v.desenhar();
  try { localStorage.setItem('ultimaVista', nome); } catch {}
}
function redesenhar() {
  const y = window.scrollY;
  irPara(vistaAtual).then(() => window.scrollTo(0, y));
}

// ===== Utilitários =====
function el(tag, attrs = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat()) if (f !== null && f !== undefined && f !== false) e.append(f);
  return e;
}

// useGrouping 'always': 5 000,00 € e 10 000,00 € escritos da mesma maneira
const fmtEuro = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', useGrouping: 'always' });
// "|| 0" evita mostrar "-0,00 €" quando o resultado é quase zero
function euro(v) { return fmtEuro.format(Math.round((v || 0) * 100) / 100 || 0); }
function euroSinal(v) { const r = Math.round((v || 0) * 100) / 100 || 0; return (r > 0 ? '+' : r < 0 ? '−' : '') + fmtEuro.format(Math.abs(r)); }

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function maiuscula(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function dataCurta(ts) {
  return new Date(ts).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function saudacao() {
  const h = new Date().getHours();
  return h < 6 ? 'Boa noite' : h < 13 ? 'Bom dia' : h < 20 ? 'Boa tarde' : 'Boa noite';
}

function botaoAdicionar(acao) {
  const b = el('button', { class: 'fab', onclick: acao, 'aria-label': 'Adicionar' });
  b.innerHTML = svg('mais');
  document.body.append(b);
}

function emBreve(icone, texto) {
  conteudo.append(el('div', { class: 'em-breve' },
    el('div', {}, icone), el('p', {}, texto), el('p', {}, 'Ainda por fazer.')));
}

// Controlo segmentado: devolve o elemento; o valor está em .valor
function segmentos(opcoes, valor, aoMudar) {
  const caixa = el('div', { class: 'segmentos' });
  caixa.valor = valor;
  for (const [v, texto] of opcoes) {
    const b = el('button', { type: 'button', class: v === valor ? 'ativo' : '' }, texto);
    b.onclick = () => {
      caixa.valor = v;
      caixa.querySelectorAll('button').forEach((x) => x.classList.toggle('ativo', x === b));
      aoMudar && aoMudar(v);
    };
    caixa.append(b);
  }
  return caixa;
}

function campo(rotulo, controlo, ajuda) {
  return el('div', { class: 'campo' }, rotulo ? el('label', {}, rotulo) : null, controlo,
    ajuda ? el('div', { class: 'ajuda' }, ajuda) : null);
}

// Converte "1.234,56" ou "1234.56" num número
function lerNumero(txt) {
  if (typeof txt === 'number') return txt;
  let s = String(txt || '').trim().replace(/\s|€/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); // "1.500" = mil e quinhentos
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}

// ===== Folha (janela que sobe de baixo) =====
// Estrutura: topo fixo (Cancelar · título · Guardar) + corpo com scroll + rodapé fixo com botão Guardar.
// O rodapé fica sempre visível, mesmo com o teclado aberto.
// abrirFolha({ titulo, corpo, guardar: async () => true|'mensagem de erro'|false (fica aberta), apagar })
function abrirFolha({ titulo: t, corpo, guardar, apagar, textoGuardar = 'Guardar' }) {
  folha.innerHTML = '';
  const erro = el('div', { class: 'erro' });
  let ocupado = false;
  async function fazerGuardar() {
    if (ocupado) return;
    ocupado = true;
    try {
      const r = await guardar();
      if (r === false) return; // a própria função já mudou o conteúdo da folha (ex.: passo seguinte)
      if (r === true || r === undefined) { folha.close(); redesenhar(); }
      else { erro.textContent = r; corpoEl.scrollTo({ top: 0, behavior: 'smooth' }); }
    } finally { ocupado = false; }
  }
  const cancelar = el('button', { type: 'button', onclick: () => folha.close() }, guardar ? 'Cancelar' : 'Fechar');
  const ok = guardar
    ? el('button', { type: 'button', class: 'guardar', onclick: fazerGuardar }, textoGuardar)
    : el('span', { class: 'espaco-topo' });
  const corpoEl = el('div', { class: 'folha-corpo' }, erro, corpo,
    apagar ? el('button', { type: 'button', class: 'btn perigo', onclick: async () => {
      if (!confirm('Tens a certeza que queres apagar?')) return;
      await apagar(); folha.close(); redesenhar();
    } }, 'Apagar') : null);
  folha.append(el('div', { class: 'folha-caixa' },
    el('div', { class: 'folha-topo' }, cancelar, el('b', {}, t), ok),
    corpoEl,
    guardar ? el('div', { class: 'folha-rodape' },
      el('button', { type: 'button', class: 'btn largo', onclick: fazerGuardar }, textoGuardar)) : null,
  ));
  // Ao escrever num campo, garante que fica visível acima do teclado
  corpoEl.addEventListener('focusin', (e) => {
    setTimeout(() => e.target.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 350);
  });
  document.documentElement.classList.add('folha-aberta');
  ajustarFolha();
  if (!folha.open) folha.showModal();
  corpoEl.scrollTop = 0;
}
folha.addEventListener('close', () => document.documentElement.classList.remove('folha-aberta'));
// Fecha ao tocar fora da folha
folha.addEventListener('click', (e) => { if (e.target === folha) folha.close(); });

// Encaixa a folha no espaço visível (acima do teclado do iPhone)
// (a folha ocupa exatamente a parte do ecrã que se vê; a caixa encosta em baixo)
function ajustarFolha() {
  const vv = window.visualViewport;
  const topo = vv ? vv.offsetTop : 0;
  const altura = vv ? vv.height : window.innerHeight;
  folha.style.top = Math.round(topo) + 'px';
  folha.style.height = Math.round(altura) + 'px';
}
if (window.visualViewport) {
  visualViewport.addEventListener('resize', ajustarFolha);
  visualViewport.addEventListener('scroll', ajustarFolha);
}

// ===== Início =====
async function vistaInicio() {
  const hoje = maiuscula(new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' }));
  conteudo.append(el('p', { class: 'subtitulo' }, hoje));

  // Avisos de depósitos a prazo que terminaram
  const fin = await carregarFinancas();
  conteudo.append(avisosDepositos(fin.contas, fin.saldos));

  // Sugestão para ativar notificações (se houver depósitos a prazo)
  try {
    const recs = await DB.todos('recorrentes');
    if (Nuvem.sessao && (fin.contas.some((c) => c.tipo === 'deposito') || recs.some((r) => r.notificar) || (await DB.todos('lembretes')).some((l) => l.notificar && !l.concluido)) && Nuvem.notif.suportado()
        && localStorage.getItem('dicaNotif') !== 'nao' && await Nuvem.notif.estado() === 'inativo') {
      conteudo.append(el('div', { class: 'aviso dica' },
        el('div', { class: 'aviso-topo' }, el('span', {}, '🔔'), el('b', {}, 'Ativa as notificações')),
        el('p', {}, 'Para receberes os lembretes à hora certa e saberes quando um depósito termina ou uma subscrição é cobrada, mesmo com a app fechada.'),
        el('div', { class: 'aviso-botoes' },
          el('button', { class: 'btn', onclick: () => abrirMinhaConta() }, 'Ativar'),
          el('button', { class: 'btn claro', onclick: () => { localStorage.setItem('dicaNotif', 'nao'); redesenhar(); } }, 'Agora não'))));
    }
  } catch {}

  // Resumo financeiro (vem do financas.js)
  const r = await resumoFinanceiro();
  conteudo.append(el('div', { class: 'destaque toque', onclick: () => irPara('financas') },
    el('small', {}, 'Património total'),
    el('div', { class: 'grande' }, euro(r.total)),
    el('div', { class: 'linha-dupla' },
      el('div', {}, el('small', {}, 'Entradas este mês'), el('b', {}, euro(r.receitas))),
      el('div', {}, el('small', {}, 'Saídas este mês'), el('b', {}, euro(r.despesas))),
    ),
  ));

  // Ações rápidas
  const rapida = (ic, texto, acao) =>
    el('button', { class: 'toque', onclick: acao }, el('span', { class: 'ic' }, ic), texto);
  conteudo.append(el('div', { class: 'rapidas' },
    rapida('💸', 'Despesa', () => abrirMovimento(null, 'despesa')),
    rapida('💰', 'Receita', () => abrirMovimento(null, 'receita')),
    rapida('⏰', 'Lembrete', () => abrirLembrete()),
    rapida('📝', 'Nota', () => abrirNota()),
    rapida('📅', 'Data', () => abrirData()),
  ));

  // Lembretes de hoje (e atrasados)
  const lem = await lembretesInicio();
  if (lem) conteudo.append(lem);

  // Próximas cobranças (subscrições nos próximos 7 dias)
  const hojeI = hojeISO();
  const proximas = (await DB.todos('recorrentes'))
    .filter((r) => r.ativa !== false && r.proximaData && diasEntre(hojeI, r.proximaData) <= 7)
    .sort((a, b) => a.proximaData.localeCompare(b.proximaData));
  if (proximas.length) {
    conteudo.append(el('div', { class: 'secao' }, el('h2', {}, 'Próximas cobranças'),
      el('button', { onclick: () => { finSep = 'subscricoes'; irPara('financas'); } }, 'Ver todas')));
    const lista = el('div', { class: 'lista' });
    for (const r of proximas) {
      const falta = diasEntre(hojeI, r.proximaData);
      lista.append(el('div', { class: 'linha', onclick: () => abrirSubscricao(r) },
        el('div', { class: 'icone' }, (CATEGORIAS.despesa.find(([n]) => n === r.categoria) || [, '🔁'])[1]),
        el('div', { class: 'meio' }, el('b', {}, r.nome), el('span', {}, falta === 0 ? 'Hoje' : falta === 1 ? 'Amanhã' : `Daqui a ${falta} dias`)),
        el('div', { class: 'valor neg' }, euroSinal(-r.valor))));
    }
    conteudo.append(lista);
  }

  // Próximas datas (aniversários, prazos… nos próximos 14 dias)
  const datas = await proximasDatas(14);
  if (datas.length) {
    conteudo.append(el('div', { class: 'secao' }, el('h2', {}, 'Próximas datas'),
      el('button', { onclick: () => irPara('datas') }, 'Ver todas')));
    conteudo.append(el('div', { class: 'lista' }, ...datas.map((d) => linhaData(d))));
  }

  // Notas recentes
  const notas = (await DB.todos('notas')).sort((a, b) => b.atualizada - a.atualizada).slice(0, 3);
  if (notas.length) {
    conteudo.append(el('div', { class: 'secao' }, el('h2', {}, 'Notas recentes'),
      el('button', { onclick: () => irPara('notas') }, 'Ver todas')));
    notas.forEach((n) => conteudo.append(cartaoNota(n)));
  }
}

// ===== Notas =====
let filtroNotas = '';

async function vistaNotas() {
  const pesquisa = el('input', { class: 'pesquisa', type: 'search', placeholder: 'Pesquisar', value: filtroNotas });
  const lista = el('div');
  pesquisa.addEventListener('input', () => { filtroNotas = pesquisa.value; desenharLista(); });
  conteudo.append(pesquisa, lista);
  botaoAdicionar(() => abrirNota());

  async function desenharLista() {
    const termo = filtroNotas.toLowerCase();
    const notas = (await DB.todos('notas'))
      .filter((n) => (n.titulo + ' ' + n.texto).toLowerCase().includes(termo))
      .sort((a, b) => b.atualizada - a.atualizada);
    lista.innerHTML = '';
    if (!notas.length) {
      lista.append(el('div', { class: 'vazio' },
        el('div', { class: 'grande-ic' }, '📝'),
        termo ? 'Nenhuma nota encontrada.' : 'Ainda não tens notas. Toca em + para criar.'));
      return;
    }
    notas.forEach((n) => lista.append(cartaoNota(n)));
  }
  await desenharLista();
}

function cartaoNota(n) {
  return el('div', { class: 'cartao nota toque', onclick: () => abrirNota(n) },
    el('h3', {}, n.titulo || 'Sem título'),
    n.texto ? el('p', {}, n.texto) : null,
    el('small', {}, dataCurta(n.atualizada)));
}

function abrirNota(nota = null) {
  const t = el('input', { placeholder: 'Título', value: nota ? nota.titulo : '' });
  const x = el('textarea', { placeholder: 'Escreve aqui…' });
  x.value = nota ? nota.texto : '';
  abrirFolha({
    titulo: nota ? 'Editar nota' : 'Nova nota',
    corpo: el('div', {}, campo(null, t), campo(null, x)),
    guardar: async () => {
      const titulo = t.value.trim(), texto = x.value.trim();
      if (!titulo && !texto) return 'A nota está vazia.';
      await DB.guardar('notas', {
        id: nota ? nota.id : DB.novoId(), titulo, texto,
        criada: nota ? nota.criada : Date.now(), atualizada: Date.now(),
      });
    },
    apagar: nota ? () => DB.apagar('notas', nota.id) : null,
  });
  if (!nota) setTimeout(() => t.focus(), 300);
}
