// =====================================================
//  Datas importantes (aniversários, prazos, pagamentos)
//  + ligação ao Google Calendar (calendário subscrito por link)
// =====================================================
const TIPOS_DATA = {
  aniversario: { nome: 'Aniversário', ic: '🎂', repetir: 'anual' },
  prazo:       { nome: 'Prazo',       ic: '⏳', repetir: 'nao' },
  pagamento:   { nome: 'Pagamento',   ic: '💳', repetir: 'mensal' },
  outro:       { nome: 'Outro',       ic: '📌', repetir: 'nao' },
};
const REPETICOES = [['nao', 'Uma vez'], ['mensal', 'Mensal'], ['anual', 'Anual']];

// Dia do mês "seguro": 31 → 30/28/29 quando o mês é mais curto (como nas subscrições)
function dataNoMes(ano, mes, dia) {
  const ultimo = new Date(ano, mes + 1, 0).getDate();
  return new Date(ano, mes, Math.min(dia, ultimo));
}

// Próxima vez que a data acontece (hoje incluído). Para datas que não se repetem, devolve a própria data.
function proximaOcorrencia(d, hoje = hojeISO()) {
  if (d.repetir !== 'anual' && d.repetir !== 'mensal') return d.data;
  if (d.data >= hoje) return d.data;
  const o = lerData(d.data), h = lerData(hoje);
  if (d.repetir === 'anual') {
    let n = dataNoMes(h.getFullYear(), o.getMonth(), o.getDate());
    if (paraISO(n) < hoje) n = dataNoMes(h.getFullYear() + 1, o.getMonth(), o.getDate());
    return paraISO(n);
  }
  let n = dataNoMes(h.getFullYear(), h.getMonth(), o.getDate());
  if (paraISO(n) < hoje) n = dataNoMes(h.getFullYear(), h.getMonth() + 1, o.getDate());
  return paraISO(n);
}

function textoQuando(falta, iso) {
  if (falta === 0) return 'Hoje';
  if (falta === 1) return 'Amanhã';
  if (falta === -1) return 'Ontem';
  if (falta > 1 && falta <= 30) return `Daqui a ${falta} dias`;
  if (falta < -1 && falta >= -30) return `Há ${-falta} dias`;
  return dataBonita(iso);
}

// Descrição curta de uma data (ex.: "Amanhã · faz 30 anos")
function infoData(d, hoje = hojeISO()) {
  const prox = proximaOcorrencia(d, hoje);
  const falta = diasEntre(hoje, prox);
  const partes = [textoQuando(falta, prox)];
  if (d.tipo === 'aniversario' && !d.semAno && d.repetir === 'anual') {
    const anos = lerData(prox).getFullYear() - lerData(d.data).getFullYear();
    if (anos > 0) partes.push(falta === 0 ? `faz ${anos} anos hoje` : `faz ${anos} anos`);
  }
  if (d.repetir === 'anual' && Math.abs(falta) > 30) partes[0] = maiuscula(lerData(prox).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' }));
  if (d.repetir === 'mensal') partes.push('todos os meses');
  return { prox, falta, texto: partes.join(' · ') };
}

function linhaData(d, hoje = hojeISO()) {
  const t = TIPOS_DATA[d.tipo] || TIPOS_DATA.outro;
  const i = infoData(d, hoje);
  return el('div', { class: 'linha' + (i.falta < 0 ? ' pausa' : ''), onclick: () => abrirData(d) },
    el('div', { class: 'icone' }, t.ic),
    el('div', { class: 'meio' }, el('b', {}, d.nome),
      el('span', { class: i.falta >= 0 && i.falta <= 3 ? 'alerta' : '' }, i.texto)),
    el('div', { class: 'valor data-dia' },
      String(lerData(i.prox).getDate()),
      el('small', {}, lerData(i.prox).toLocaleDateString('pt-PT', { month: 'short' }).replace('.', ''))));
}

// Datas dos próximos N dias (usado no Início)
async function proximasDatas(dias) {
  const hoje = hojeISO();
  return (await DB.todos('datas'))
    .map((d) => ({ d, i: infoData(d, hoje) }))
    .filter(({ i }) => i.falta >= 0 && i.falta <= dias)
    .sort((a, b) => a.i.prox.localeCompare(b.i.prox))
    .map(({ d }) => d);
}

async function vistaDatas() {
  const hoje = hojeISO();
  const todas = (await DB.todos('datas')).map((d) => ({ d, i: infoData(d, hoje) }));
  botaoAdicionar(() => abrirData());

  conteudo.append(await cartaoCalendario());

  if (!todas.length) {
    conteudo.append(el('div', { class: 'vazio' },
      el('div', { class: 'grande-ic' }, '📅'),
      'Guarda aqui aniversários, prazos e pagamentos importantes. Toca em + para adicionar.'));
    return;
  }

  const grupos = [
    ['Próximos 30 dias', ({ i }) => i.falta >= 0 && i.falta <= 30],
    ['Mais tarde', ({ i }) => i.falta > 30],
    ['Já passaram', ({ i }) => i.falta < 0],
  ];
  for (const [nome, filtro] of grupos) {
    const lista = todas.filter(filtro)
      .sort((a, b) => nome === 'Já passaram' ? b.i.prox.localeCompare(a.i.prox) : a.i.prox.localeCompare(b.i.prox));
    if (!lista.length) continue;
    conteudo.append(el('div', { class: 'secao' }, el('h2', {}, nome)));
    conteudo.append(el('div', { class: 'lista' }, ...lista.map(({ d }) => linhaData(d, hoje))));
  }
}

function abrirData(dt = null) {
  let tipo = dt?.tipo || 'aniversario';
  let mexeuRepetir = !!dt;
  const nome = el('input', { placeholder: 'Ex.: Aniversário da Ana, IRS, Seguro do carro', value: dt?.nome || '' });
  const data = el('input', { type: 'date', value: dt?.data || hojeISO() });
  const repetir = segmentos(REPETICOES, dt?.repetir || TIPOS_DATA[tipo].repetir, () => { mexeuRepetir = true; atualizar(); });
  const semAno = segmentos([['nao', 'Sei o ano'], ['sim', 'Não sei o ano']], dt?.semAno ? 'sim' : 'nao');
  const campoAno = campo('Ano de nascimento', semAno, 'Se souberes o ano, mostramos a idade que vai fazer.');
  const notas = el('textarea', { placeholder: 'Notas (opcional)', style: 'min-height:90px' });
  notas.value = dt?.notas || '';
  const noCal = segmentos([['sim', 'Mostrar'], ['nao', 'Não mostrar']], dt?.noCalendario === false ? 'nao' : 'sim');

  const chips = el('div', { class: 'chips' });
  for (const [k, t] of Object.entries(TIPOS_DATA)) {
    const b = el('button', { type: 'button', class: k === tipo ? 'ativo' : '' }, `${t.ic} ${t.nome}`);
    b.onclick = () => {
      tipo = k;
      chips.querySelectorAll('button').forEach((x) => x.classList.toggle('ativo', x === b));
      // Ao mudar o tipo, sugere a repetição habitual (se ainda não foi escolhida à mão)
      if (!mexeuRepetir) {
        repetir.valor = t.repetir;
        repetir.querySelectorAll('button').forEach((x, i) => x.classList.toggle('ativo', REPETICOES[i][0] === t.repetir));
      }
      atualizar();
    };
    chips.append(b);
  }
  function atualizar() {
    campoAno.style.display = tipo === 'aniversario' && repetir.valor === 'anual' ? '' : 'none';
  }
  atualizar();

  // Adicionar só esta data ao Google Calendar (sem ligação; abre o Google com o evento preenchido)
  const soEsta = el('button', { type: 'button', class: 'btn claro largo', onclick: () => {
    if (!nome.value.trim() || !data.value) return;
    window.open(linkEventoGoogle({ nome: nome.value.trim(), data: data.value, tipo, repetir: repetir.valor, notas: notas.value.trim() }), '_blank');
  } }, 'Adicionar só esta ao Google Calendar');

  abrirFolha({
    titulo: dt ? 'Editar data' : 'Nova data',
    corpo: el('div', {},
      campo('Tipo', chips),
      campo('Nome', nome),
      campo('Data', data),
      campo('Repetir', repetir),
      campoAno,
      campo('Notas', notas),
      campo('No Google Calendar', noCal, 'Se ligaste o Google Calendar (no ecrã Datas), esta data aparece lá sozinha.'),
      dt ? soEsta : null,
    ),
    guardar: async () => {
      if (!nome.value.trim()) return 'Dá um nome à data.';
      if (!data.value) return 'Escolhe a data.';
      await DB.guardar('datas', {
        id: dt?.id || DB.novoId(),
        nome: nome.value.trim(), data: data.value, tipo, repetir: repetir.valor,
        semAno: tipo === 'aniversario' && semAno.valor === 'sim',
        notas: notas.value.trim(), noCalendario: noCal.valor === 'sim',
        criada: dt?.criada || Date.now(),
      });
    },
    apagar: dt ? () => DB.apagar('datas', dt.id) : null,
  });
  if (!dt) setTimeout(() => nome.focus(), 300);
}

// ----- Google Calendar -----
// Como funciona: a app cria um link secreto; a função "calendario" no Supabase devolve as datas
// nesse link em formato de calendário (.ics). O Google Calendar subscreve o link e vai buscá-lo
// sozinho várias vezes por dia — as datas novas aparecem lá sem fazer nada.

function iso8(iso) { return iso.replace(/-/g, ''); }
function diaSeguinte(iso) { const d = lerData(iso); d.setDate(d.getDate() + 1); return paraISO(d); }

// Regra de repetição (igual à da função na nuvem): dias 29–31 caem no último dia nos meses mais curtos
function regraRepeticao(d) {
  const o = lerData(d.data), dia = o.getDate();
  if (d.repetir === 'anual') {
    return o.getMonth() === 1 && dia === 29 ? 'RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=28,29;BYSETPOS=-1' : 'RRULE:FREQ=YEARLY';
  }
  if (d.repetir === 'mensal') {
    if (dia <= 28) return 'RRULE:FREQ=MONTHLY';
    const dias = []; for (let x = 28; x <= dia; x++) dias.push(x);
    return `RRULE:FREQ=MONTHLY;BYMONTHDAY=${dias.join(',')};BYSETPOS=-1`;
  }
  return '';
}

function linkEventoGoogle(d) {
  const t = TIPOS_DATA[d.tipo] || TIPOS_DATA.outro;
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${t.ic} ${d.nome}`,
    dates: `${iso8(d.data)}/${iso8(diaSeguinte(d.data))}`,
  });
  if (d.notas) p.set('details', d.notas);
  const r = regraRepeticao(d);
  if (r) p.set('recur', r);
  return 'https://calendar.google.com/calendar/render?' + p.toString();
}

async function configCalendario() { return DB.um('definicoes', 'calendario'); }
function linkCalendario(token) { return `${NUVEM.url}/functions/v1/calendario?t=${token}`; }
function novoToken() {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function cartaoCalendario() {
  const cfg = await configCalendario();
  if (cfg?.token) {
    return el('div', { class: 'lista' }, el('div', { class: 'linha', onclick: () => abrirCalendario() },
      el('div', { class: 'icone' }, '🔗'),
      el('div', { class: 'meio' }, el('b', {}, 'Google Calendar'), el('span', {}, 'Ligado · as datas aparecem lá sozinhas')),
      el('div', { class: 'valor suave' }, '›')));
  }
  let escondida = false;
  try { escondida = localStorage.getItem('dicaCalendario') === 'nao'; } catch {}
  if (escondida) {
    return el('button', { class: 'link', style: 'width:100%;margin-top:-6px', onclick: () => abrirCalendario() }, '🔗 Ligar ao Google Calendar');
  }
  return el('div', { class: 'aviso dica' },
    el('div', { class: 'aviso-topo' }, el('span', {}, '📆'), el('b', {}, 'Ver no Google Calendar')),
    el('p', {}, 'Liga uma vez e as tuas datas passam a aparecer no Google Calendar, sempre atualizadas.'),
    el('div', { class: 'aviso-botoes' },
      el('button', { class: 'btn', onclick: () => abrirCalendario() }, 'Ligar'),
      el('button', { class: 'btn claro', onclick: () => { try { localStorage.setItem('dicaCalendario', 'nao'); } catch {} redesenhar(); } }, 'Agora não')));
}

async function abrirCalendario() {
  const corpo = el('div');
  abrirFolha({ titulo: 'Google Calendar', corpo });
  await preencherCalendario(corpo);
}

async function preencherCalendario(corpo) {
  corpo.innerHTML = '';
  const deNovo = () => preencherCalendario(corpo);
  const passo = (n, texto) => el('div', { class: 'passo' }, el('span', {}, String(n)), el('div', {}, texto));

  if (!Nuvem.sessao) {
    corpo.append(
      el('p', { class: 'ajuda', style: 'margin:0 4px 14px' }, 'Para o Google Calendar receber as tuas datas, elas têm de estar guardadas na nuvem. Entra na tua conta primeiro.'),
      el('button', { class: 'btn largo', onclick: () => { folha.close(); ecraLogin(); } }, 'Entrar'));
    return;
  }

  const cfg = await configCalendario();
  if (!cfg?.token) {
    corpo.append(
      el('p', { class: 'ajuda', style: 'margin:0 4px 14px' },
        'Vamos criar um link privado com as tuas datas. Depois adicionas esse link ao Google Calendar uma única vez, e a partir daí as datas novas ou alteradas aparecem lá sozinhas.'),
      el('button', { class: 'btn largo', onclick: async () => {
        await DB.guardar('definicoes', { id: 'calendario', token: novoToken(), criado: Date.now() });
        deNovo(); // a sincronização corre sozinha logo a seguir
      } }, 'Criar link do calendário'));
    return;
  }

  const link = linkCalendario(cfg.token);
  const caixaLink = el('input', { readonly: true, value: link, onfocus: (e) => e.target.select() });
  const copiar = el('button', { class: 'btn largo', onclick: async () => {
    try { await navigator.clipboard.writeText(link); copiar.textContent = 'Link copiado ✓'; }
    catch { caixaLink.focus(); caixaLink.select(); copiar.textContent = 'Seleciona e copia o link acima'; }
  } }, 'Copiar link');
  const webcal = link.replace(/^https:/, 'webcal:');
  const estado = el('div', { class: 'ajuda', style: 'margin:8px 4px 14px' });
  const testar = el('button', { class: 'btn claro largo', onclick: async () => {
    estado.textContent = 'A verificar…';
    try {
      await Nuvem.sincronizar();
      const r = await fetch(link, { cache: 'no-store' });
      const txt = await r.text();
      if (r.ok && txt.includes('BEGIN:VCALENDAR')) {
        const n = (txt.match(/BEGIN:VEVENT/g) || []).length;
        estado.textContent = `✅ Está a funcionar: o link tem ${n} ${n === 1 ? 'data' : 'datas'}.`;
      } else if (/function was not found/i.test(txt)) {
        estado.textContent = '⚠️ A função "calendario" ainda não está publicada no Supabase.';
      } else {
        estado.textContent = `⚠️ O link ainda não funciona (${r.status}). Espera uns segundos e tenta outra vez.`;
      }
    } catch { estado.textContent = '⚠️ Não foi possível verificar. Confirma que tens internet e que a função "calendario" está publicada no Supabase.'; }
  } }, 'Verificar se o link funciona');

  corpo.append(
    el('div', { class: 'secao', style: 'margin-top:4px' }, el('h2', {}, 'O teu link')),
    campo(null, caixaLink, 'É privado: quem tiver este link consegue ver as tuas datas. Não o partilhes.'),
    copiar,
    el('div', { class: 'secao' }, el('h2', {}, 'Adicionar ao Google')),
    el('div', { class: 'passos' },
      passo(1, 'No computador, abre calendar.google.com (no telemóvel a app do Google não deixa adicionar links).'),
      passo(2, 'À esquerda, em "Outros calendários", carrega em + e escolhe "A partir do URL".'),
      passo(3, 'Cola o link e carrega em "Adicionar calendário". Está feito!')),
    el('a', { class: 'btn claro largo', style: 'display:block;text-align:center;text-decoration:none;margin-bottom:10px',
      href: 'https://calendar.google.com/calendar/r/settings/addbyurl', target: '_blank', rel: 'noopener' }, 'Abrir o Google Calendar'),
    el('p', { class: 'ajuda', style: 'margin:0 4px 14px' },
      'O Google vai buscar o link sozinho algumas vezes por dia, por isso uma data nova pode demorar umas horas a aparecer lá. No telemóvel, vês as datas na app Google Calendar (calendário "Assistente — Datas").'),
    el('a', { class: 'link', style: 'display:block;text-align:center', href: webcal }, 'Ou adicionar ao Calendário do iPhone'),
    el('div', { class: 'secao' }, el('h2', {}, 'Confirmar')),
    testar, estado,
    el('button', { class: 'btn perigo', onclick: async () => {
      if (!confirm('Criar um link novo? O link antigo deixa de funcionar e tens de o substituir no Google Calendar.')) return;
      await DB.guardar('definicoes', { ...cfg, token: novoToken(), criado: Date.now() });
      deNovo();
    } }, 'Criar link novo'),
    el('button', { class: 'btn perigo', onclick: async () => {
      if (!confirm('Desligar? O Google Calendar deixa de receber as datas (remove também o calendário "Assistente — Datas" no Google).')) return;
      await DB.apagar('definicoes', 'calendario');
      folha.close(); redesenhar();
    } }, 'Desligar o Google Calendar'),
  );
}
