// =====================================================
//  Lembretes (como os Lembretes do iPhone)
//  Cada lembrete: { id, titulo, notas, data, hora, repetir, dia, prioridade, notificar,
//                   concluido, concluidoEm, criado }
//  data 'YYYY-MM-DD' ou '' (sem data); hora 'HH:MM' ou '' (dia todo)
// =====================================================
const REPETICOES = {
  nunca:   { nome: 'Nunca',            curto: '' },
  diario:  { nome: 'Todos os dias',    curto: 'Diário' },
  semanal: { nome: 'Todas as semanas', curto: 'Semanal' },
  mensal:  { nome: 'Todos os meses',   curto: 'Mensal' },
  anual:   { nome: 'Todos os anos',    curto: 'Anual' },
};
const PRIORIDADES = [['0', 'Nenhuma'], ['1', 'Baixa'], ['2', 'Média'], ['3', 'Alta']];
const HORA_DIA_TODO = '09:00'; // lembretes sem hora avisam a esta hora

let lemSep = (() => { try { return localStorage.getItem('lemSep') || 'porfazer'; } catch { return 'porfazer'; } })();

function agoraHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Data seguinte de um lembrete que se repete (mensal/anual mantêm o dia original, ex.: 31 → 30)
function proximaRepeticao(iso, repetir, dia) {
  if (repetir === 'diario') { const d = lerData(iso); d.setDate(d.getDate() + 1); return paraISO(d); }
  return proximaCobranca(iso, repetir, dia);
}

// Em que grupo aparece: atrasado, hoje, amanha, proximos, semdata
function grupoLembrete(l, hoje = hojeISO()) {
  if (!l.data) return 'semdata';
  if (l.data < hoje || (l.data === hoje && l.hora && l.hora < agoraHHMM())) return 'atrasado';
  if (l.data === hoje) return 'hoje';
  if (diasEntre(hoje, l.data) === 1) return 'amanha';
  return 'proximos';
}

function textoQuando(l) {
  if (!l.data) return '';
  const falta = diasEntre(hojeISO(), l.data);
  const dia = falta === 0 ? 'Hoje' : falta === 1 ? 'Amanhã' : falta === -1 ? 'Ontem'
    : maiuscula(lerData(l.data).toLocaleDateString('pt-PT', { weekday: falta > 0 && falta < 7 ? 'long' : undefined, day: 'numeric', month: 'short',
      year: l.data.slice(0, 4) !== hojeISO().slice(0, 4) ? 'numeric' : undefined }));
  return l.hora ? `${dia}, ${l.hora}` : dia;
}

function ordenarLembretes(a, b) {
  return (a.data || '9999').localeCompare(b.data || '9999')
    || (a.hora || '99').localeCompare(b.hora || '99')
    || (b.prioridade || 0) - (a.prioridade || 0)
    || a.criado - b.criado;
}

// Marca como feito; se se repete, passa para a próxima data (como no iPhone)
async function alternarConcluido(l) {
  if (!l.concluido && l.repetir && l.repetir !== 'nunca' && l.data) {
    const n = { ...l };
    const hoje = hojeISO();
    let voltas = 0;
    do { n.data = proximaRepeticao(n.data, n.repetir, n.dia); } while (n.data < hoje && voltas++ < 1000);
    await DB.guardar('lembretes', n);
  } else {
    await DB.guardar('lembretes', { ...l, concluido: !l.concluido, concluidoEm: l.concluido ? null : Date.now() });
  }
}

// ===== Vista =====
async function vistaLembretes() {
  const todos = await DB.todos('lembretes');
  const porFazer = todos.filter((l) => !l.concluido).sort(ordenarLembretes);
  const feitos = todos.filter((l) => l.concluido).sort((a, b) => (b.concluidoEm || 0) - (a.concluidoEm || 0));

  conteudo.append(segmentos([['porfazer', `Por fazer${porFazer.length ? ` (${porFazer.length})` : ''}`], ['concluidos', 'Concluídos']], lemSep, (v) => {
    lemSep = v; try { localStorage.setItem('lemSep', v); } catch {}
    redesenhar();
  }));
  botaoAdicionar(() => abrirLembrete());

  if (lemSep === 'concluidos') {
    if (!feitos.length) { conteudo.append(el('div', { class: 'vazio' }, el('div', { class: 'grande-ic' }, '✅'), 'Ainda não concluíste nenhum lembrete.')); return; }
    const lista = el('div', { class: 'lista' });
    feitos.slice(0, 100).forEach((l) => lista.append(linhaLembrete(l)));
    conteudo.append(lista);
    conteudo.append(el('button', { class: 'btn perigo', onclick: async () => {
      if (!confirm(`Apagar os ${feitos.length} lembretes concluídos?`)) return;
      for (const l of feitos) await DB.apagar('lembretes', l.id);
      redesenhar();
    } }, 'Apagar concluídos'));
    return;
  }

  if (!porFazer.length) {
    conteudo.append(el('div', { class: 'vazio' },
      el('div', { class: 'grande-ic' }, '⏰'),
      'Sem lembretes por fazer. Toca em + para criar um, com data, hora e notificação se quiseres.'));
    return;
  }
  const GRUPOS = [['atrasado', 'Atrasados'], ['hoje', 'Hoje'], ['amanha', 'Amanhã'], ['proximos', 'Próximos'], ['semdata', 'Sem data']];
  const hoje = hojeISO();
  for (const [g, nome] of GRUPOS) {
    const doGrupo = porFazer.filter((l) => grupoLembrete(l, hoje) === g);
    if (!doGrupo.length) continue;
    conteudo.append(el('div', { class: 'dia' + (g === 'atrasado' ? ' atrasado' : '') }, el('span', {}, nome), el('span', {}, String(doGrupo.length))));
    const lista = el('div', { class: 'lista' });
    doGrupo.forEach((l) => lista.append(linhaLembrete(l)));
    conteudo.append(lista);
  }
}

function linhaLembrete(l) {
  const visto = el('button', { type: 'button', class: 'visto' + (l.concluido ? ' feito' : ''), 'aria-label': l.concluido ? 'Marcar por fazer' : 'Marcar como feito' });
  visto.onclick = async (e) => {
    e.stopPropagation();
    visto.classList.toggle('feito');
    await alternarConcluido(l);
    setTimeout(redesenhar, 350);
  };
  const atrasado = !l.concluido && grupoLembrete(l) === 'atrasado';
  const detalhes = [
    l.data ? textoQuando(l) : '',
    l.repetir && l.repetir !== 'nunca' ? '🔁 ' + REPETICOES[l.repetir].curto : '',
    l.notificar && l.data ? '🔔' : '',
    l.notas ? l.notas.split('\n')[0] : '',
  ].filter(Boolean).join(' · ');
  return el('div', { class: 'linha lembrete' + (l.concluido ? ' concluido' : ''), onclick: () => abrirLembrete(l) },
    visto,
    el('div', { class: 'meio' },
      el('b', {}, l.prioridade ? el('span', { class: 'prioridade' }, '!'.repeat(l.prioridade) + ' ') : null, l.titulo),
      detalhes ? el('span', { class: atrasado ? 'atrasado' : '' }, detalhes) : null));
}

// Bloco para o Início: atrasados e de hoje
async function lembretesInicio() {
  const hoje = hojeISO();
  const lista = (await DB.todos('lembretes'))
    .filter((l) => !l.concluido && l.data && l.data <= hoje)
    .sort(ordenarLembretes);
  if (!lista.length) return null;
  const caixa = el('div');
  caixa.append(el('div', { class: 'secao' }, el('h2', {}, 'Lembretes de hoje'),
    el('button', { onclick: () => { lemSep = 'porfazer'; irPara('lembretes'); } }, 'Ver todos')));
  const l2 = el('div', { class: 'lista' });
  lista.slice(0, 6).forEach((l) => l2.append(linhaLembrete(l)));
  caixa.append(l2);
  return caixa;
}

// ===== Formulário =====
function abrirLembrete(l = null) {
  const titulo = el('input', { placeholder: 'Ex.: Ligar ao médico', value: l?.titulo || '' });
  const notas = el('textarea', { placeholder: 'Notas (opcional)', class: 'curta' });
  notas.value = l?.notas || '';

  // Depois das 23h a próxima hora redonda já é amanhã (senão o lembrete novo nascia atrasado)
  const amanha = () => { const x = new Date(); x.setDate(x.getDate() + 1); return paraISO(x); };
  const data = el('input', { type: 'date', value: l?.data || (!l?.hora && proximaHoraRedonda() === '00:00' ? amanha() : hojeISO()) });
  const hora = el('input', { type: 'time', value: l?.hora || proximaHoraRedonda() });
  const temData = segmentos([['sem', 'Sem data'], ['com', 'Com data']], l ? (l.data ? 'com' : 'sem') : 'com', () => atualizar());
  const temHora = segmentos([['dia', 'Dia todo'], ['hora', 'A uma hora']], l ? (l.hora ? 'hora' : 'dia') : 'hora', () => atualizar());
  const repetir = el('select', {}, ...Object.entries(REPETICOES).map(([k, r]) =>
    el('option', { value: k, selected: k === (l?.repetir || 'nunca') }, r.nome)));
  const notificar = segmentos([['sim', '🔔 Avisar'], ['nao', 'Sem aviso']], l?.notificar === false ? 'nao' : 'sim', () => atualizar());
  const prioridade = segmentos(PRIORIDADES, String(l?.prioridade || 0));
  const ajudaNotif = el('div', { class: 'ajuda' });

  const zonaData = el('div', {},
    el('div', { class: 'dois' }, campo('Dia', data), campo('Hora', hora)),
    campo(null, temHora),
    campo('Repetir', repetir),
    campo('Notificação', notificar, ajudaNotif));

  function atualizar() {
    zonaData.style.display = temData.valor === 'com' ? '' : 'none';
    hora.disabled = temHora.valor !== 'hora';
    hora.parentElement.style.opacity = hora.disabled ? .4 : 1;
    ajudaNotif.textContent = notificar.valor !== 'sim' ? 'Não recebes notificação; o lembrete aparece só na app.'
      : temHora.valor === 'hora' ? 'Recebes uma notificação no telemóvel à hora marcada (precisa das notificações ativas em Conta).'
      : `Recebes uma notificação às ${HORA_DIA_TODO.replace(':00', 'h')} desse dia (precisa das notificações ativas em Conta).`;
  }
  data.onchange = atualizar; hora.onchange = atualizar;
  atualizar();

  abrirFolha({
    titulo: l ? 'Editar lembrete' : 'Novo lembrete',
    corpo: el('div', {},
      campo(null, titulo), campo(null, notas),
      campo('Data', temData), zonaData,
      campo('Prioridade', prioridade)),
    guardar: async () => {
      if (!titulo.value.trim()) return 'Escreve o que queres lembrar.';
      const comData = temData.valor === 'com';
      if (comData && !data.value) return 'Escolhe o dia.';
      if (comData && temHora.valor === 'hora' && !hora.value) return 'Escolhe a hora.';
      const d = comData ? data.value : '';
      const h = comData && temHora.valor === 'hora' ? hora.value : '';
      await DB.guardar('lembretes', {
        id: l?.id || DB.novoId(),
        titulo: titulo.value.trim(), notas: notas.value.trim(),
        // Mantém o dia original (ex.: 31 num lembrete mensal) se a data não foi mudada
        data: d, hora: h, dia: !d ? null : l?.dia && l.data === d ? l.dia : lerData(d).getDate(),
        repetir: d ? repetir.value : 'nunca',
        notificar: !!d && notificar.valor === 'sim',
        prioridade: +prioridade.valor,
        concluido: l?.concluido || false, concluidoEm: l?.concluidoEm || null,
        criado: l?.criado || Date.now(),
      });
    },
    apagar: l ? () => DB.apagar('lembretes', l.id) : null,
  });
  if (!l) setTimeout(() => titulo.focus(), 300);
}

function proximaHoraRedonda() {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return `${String(d.getHours()).padStart(2, '0')}:00`;
}

// ===== Notificações enquanto a app está aberta =====
// Com a app fechada, quem avisa é a função "avisos" na nuvem (a cada 5 minutos).
// As duas usam a mesma "tag", por isso o iPhone mostra só uma notificação.
let temporizadoresLembretes = [];
async function agendarLembretesLocais() {
  temporizadoresLembretes.forEach(clearTimeout);
  temporizadoresLembretes = [];
  if (!('Notification' in window) || Notification.permission !== 'granted' || !('serviceWorker' in navigator)) return;
  const agora = Date.now();
  for (const l of await DB.todos('lembretes')) {
    if (l.concluido || !l.notificar || !l.data) continue;
    const [y, m, d] = l.data.split('-').map(Number);
    const [hh, mm] = (l.hora || HORA_DIA_TODO).split(':').map(Number);
    const falta = new Date(y, m - 1, d, hh, mm).getTime() - agora;
    if (falta <= 0 || falta > 86400000) continue;
    temporizadoresLembretes.push(setTimeout(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(`⏰ ${l.titulo}`, {
          body: l.notas || (l.hora ? `Hoje às ${l.hora}` : 'Hoje'),
          icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
          tag: `lem-${l.id}-${l.data}-${l.hora || 'dia'}`,
          data: { url: './' },
        });
      } catch {}
      if (vistaAtual === 'lembretes' || vistaAtual === 'inicio') { if (!document.querySelector('dialog[open]')) redesenhar(); }
    }, falta));
  }
}
DB.aoMudar(() => agendarLembretesLocais());
