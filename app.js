// ===== Navegação entre módulos =====
const conteudo = document.getElementById('conteudo');
const titulo = document.getElementById('titulo');

const VISTAS = {
  inicio:    { titulo: 'Início',    desenhar: vistaInicio },
  financas:  { titulo: 'Finanças',  desenhar: () => emBreve('💶', 'Receitas, despesas, categorias e gráficos.') },
  notas:     { titulo: 'Notas',     desenhar: vistaNotas },
  lembretes: { titulo: 'Lembretes', desenhar: () => emBreve('⏰', 'Lembretes com data e hora e notificações.') },
  datas:     { titulo: 'Datas',     desenhar: () => emBreve('📅', 'Aniversários, prazos e pagamentos.') },
};

document.querySelectorAll('.barra button').forEach((btn) => {
  btn.addEventListener('click', () => irPara(btn.dataset.vista));
});

function irPara(nome) {
  document.querySelectorAll('.barra button').forEach((b) =>
    b.classList.toggle('ativo', b.dataset.vista === nome));
  titulo.textContent = VISTAS[nome].titulo;
  conteudo.innerHTML = '';
  document.querySelectorAll('.fab').forEach((f) => f.remove());
  VISTAS[nome].desenhar();
  localStorage.setItem('ultimaVista', nome);
}

// ===== Utilitários =====
function el(tag, attrs = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const f of filhos) e.append(f);
  return e;
}

function dataCurta(ts) {
  return new Date(ts).toLocaleDateString('pt-PT', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function botaoAdicionar(acao) {
  document.body.append(el('button', { class: 'fab', onclick: acao, 'aria-label': 'Adicionar' }, '+'));
}

function emBreve(icone, texto) {
  conteudo.append(el('div', { class: 'em-breve' },
    el('div', {}, icone), el('p', {}, texto), el('p', {}, 'Ainda por fazer.')));
}

// ===== Início =====
async function vistaInicio() {
  const notas = await DB.todos('notas');
  let hoje = new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
  hoje = hoje.charAt(0).toUpperCase() + hoje.slice(1);

  conteudo.append(
    el('p', { style: 'color:var(--suave);margin:0 0 14px' }, hoje),
    el('div', { class: 'grelha' },
      resumo('📝 Notas', notas.length, 'notas'),
      resumo('⏰ Lembretes', '–', 'lembretes'),
      resumo('💶 Saldo do mês', '–', 'financas'),
      resumo('📅 Próximas datas', '–', 'datas'),
    ),
  );

  const recentes = notas.sort((a, b) => b.atualizada - a.atualizada).slice(0, 3);
  if (recentes.length) {
    conteudo.append(el('h3', { style: 'margin:22px 0 10px' }, 'Notas recentes'));
    recentes.forEach((n) => conteudo.append(cartaoNota(n)));
  }
}

function resumo(nome, valor, vista) {
  return el('div', { class: 'cartao clicavel', onclick: () => irPara(vista) },
    el('small', {}, nome), el('div', { class: 'numero' }, String(valor)));
}

// ===== Notas =====
let filtroNotas = '';

async function vistaNotas() {
  const pesquisa = el('input', {
    class: 'pesquisa', type: 'search', placeholder: 'Pesquisar notas', value: filtroNotas,
  });
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
      lista.append(el('div', { class: 'vazio' }, termo ? 'Nenhuma nota encontrada.' : 'Ainda não tens notas. Toca em + para criar.'));
      return;
    }
    notas.forEach((n) => lista.append(cartaoNota(n)));
  }
  desenharLista();
}

function cartaoNota(n) {
  return el('div', { class: 'cartao clicavel', onclick: () => abrirNota(n) },
    el('h3', {}, n.titulo || 'Sem título'),
    el('p', {}, n.texto || ''),
    el('small', {}, dataCurta(n.atualizada)));
}

const dlgNota = document.getElementById('dlgNota');
const notaTitulo = document.getElementById('notaTitulo');
const notaTexto = document.getElementById('notaTexto');
const btnApagarNota = document.getElementById('btnApagarNota');
let notaAtual = null;

function abrirNota(nota = null) {
  notaAtual = nota;
  notaTitulo.value = nota ? nota.titulo : '';
  notaTexto.value = nota ? nota.texto : '';
  btnApagarNota.style.visibility = nota ? 'visible' : 'hidden';
  dlgNota.showModal();
  if (!nota) notaTitulo.focus();
}

dlgNota.addEventListener('close', async () => {
  if (dlgNota.returnValue !== 'guardar') return;
  const t = notaTitulo.value.trim();
  const x = notaTexto.value.trim();
  if (!t && !x) return;
  await DB.guardar('notas', {
    id: notaAtual ? notaAtual.id : DB.novoId(),
    titulo: t,
    texto: x,
    criada: notaAtual ? notaAtual.criada : Date.now(),
    atualizada: Date.now(),
  });
  irPara(localStorage.getItem('ultimaVista') || 'notas');
});

btnApagarNota.addEventListener('click', async () => {
  if (!notaAtual || !confirm('Apagar esta nota?')) return;
  await DB.apagar('notas', notaAtual.id);
  dlgNota.close('apagada');
  irPara(localStorage.getItem('ultimaVista') || 'notas');
});

// ===== Arranque =====
irPara(localStorage.getItem('ultimaVista') || 'inicio');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
