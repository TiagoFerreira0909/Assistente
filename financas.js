// =====================================================
//  Finanças: contas, movimentos e resumo
// =====================================================

const TIPOS_CONTA = {
  corrente:     { nome: 'Conta à ordem',      ic: '🏦' },
  poupanca:     { nome: 'Poupança',           ic: '🐷' },
  deposito:     { nome: 'Depósito a prazo',   ic: '🔒' },
  certificados: { nome: 'Certificados',       ic: '📜' },
  investimento: { nome: 'Investimento',       ic: '📈' },
  dinheiro:     { nome: 'Dinheiro',           ic: '💵' },
  outro:        { nome: 'Outro',              ic: '💼' },
};

const CATEGORIAS = {
  despesa: [
    ['Supermercado', '🛒'], ['Restaurantes', '🍽️'], ['Casa', '🏠'], ['Contas', '💡'],
    ['Transportes', '🚗'], ['Saúde', '💊'], ['Lazer', '🎉'], ['Compras', '🛍️'],
    ['Subscrições', '📺'], ['Educação', '📚'], ['Viagens', '✈️'], ['Outros', '📦'],
  ],
  receita: [
    ['Salário', '💼'], ['Extra', '💸'], ['Vendas', '🏷️'], ['Presentes', '🎁'], ['Reembolsos', '↩️'], ['Outros', '📦'],
  ],
};
const IRS_JUROS = 0.28; // taxa liberatória sobre juros em Portugal

function iconeCategoria(m) {
  if (m.tipo === 'transferencia') return '🔁';
  if (m.tipo === 'juros') return '📈';
  const c = (CATEGORIAS[m.tipo] || []).find(([n]) => n === m.categoria);
  return c ? c[1] : '📦';
}

// ----- Cálculos -----
function efeitoNaConta(m, id) {
  let d = 0;
  if (m.contaId === id) d += (m.tipo === 'receita' || m.tipo === 'juros') ? m.valor : -m.valor;
  if (m.tipo === 'transferencia' && m.contaDestinoId === id) d += m.valor;
  return d;
}
function saldoConta(conta, movs) {
  return movs.reduce((s, m) => s + efeitoNaConta(m, conta.id), conta.saldoInicial || 0);
}
function jurosMensais(conta, saldo) {
  if (!conta.taxa || saldo <= 0) return 0;
  const bruto = saldo * conta.taxa / 100 / 12;
  return conta.irs === false ? bruto : bruto * (1 - IRS_JUROS);
}
function chaveMes(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function totaisMes(movs, chave) {
  let receitas = 0, despesas = 0;
  for (const m of movs) {
    if (!m.data.startsWith(chave)) continue;
    if (m.tipo === 'receita' || m.tipo === 'juros') receitas += m.valor;
    else if (m.tipo === 'despesa') despesas += m.valor;
  }
  return { receitas, despesas };
}

async function carregarFinancas() {
  const [contas, movs] = await Promise.all([DB.todos('contas'), DB.todos('financas')]);
  contas.sort((a, b) => (a.ordem ?? a.criada) - (b.ordem ?? b.criada));
  const saldos = Object.fromEntries(contas.map((c) => [c.id, saldoConta(c, movs)]));
  return { contas, movs, saldos };
}

// Usado no ecrã de Início
async function resumoFinanceiro() {
  const { contas, movs, saldos } = await carregarFinancas();
  const total = contas.reduce((s, c) => s + saldos[c.id], 0);
  return { total, ...totaisMes(movs, chaveMes(new Date())) };
}

// ----- Ecrã principal de Finanças -----
let finSep = (() => { try { return localStorage.getItem('finSep') || 'contas'; } catch { return 'contas'; } })();
let finMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

async function vistaFinancas() {
  const dados = await carregarFinancas();
  dados.recorrentes = await DB.todos('recorrentes');

  const seg = segmentos(
    [['contas', 'Contas'], ['movimentos', 'Movimentos'], ['subscricoes', 'Subscrições'], ['resumo', 'Resumo']],
    finSep,
    (v) => { finSep = v; try { localStorage.setItem('finSep', v); } catch {} desenhar(); },
  );
  seg.classList.add('quatro');
  conteudo.append(seg);
  const zona = el('div');
  conteudo.append(zona);

  botaoAdicionar(() => !dados.contas.length ? abrirConta()
    : finSep === 'subscricoes' ? abrirSubscricao() : abrirMovimento());

  function desenhar() {
    zona.innerHTML = '';
    if (finSep === 'contas') desenharContas(zona, dados);
    else if (finSep === 'movimentos') desenharMovimentos(zona, dados);
    else if (finSep === 'subscricoes') desenharSubscricoes(zona, dados);
    else desenharResumo(zona, dados);
  }
  desenhar();
}

function seletorMes(aoMudar) {
  const nome = maiuscula(finMes.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }));
  const mudar = (n) => { finMes = new Date(finMes.getFullYear(), finMes.getMonth() + n, 1); aoMudar(); };
  return el('div', { class: 'mes' },
    el('button', { onclick: () => mudar(-1), 'aria-label': 'Mês anterior' }, '‹'),
    el('b', {}, nome),
    el('button', { onclick: () => mudar(1), 'aria-label': 'Mês seguinte' }, '›'));
}

// ----- Depósitos a prazo -----
function lerData(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
function paraISO(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function diasEntre(a, b) { return Math.round((lerData(b) - lerData(a)) / 86400000); }
function dataBonita(iso) { return lerData(iso).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' }); }
function arred(v) { return Math.round(v * 100) / 100; }

// Calcula o fim do próximo prazo com a mesma duração (em meses, se possível)
function proximoFim(inicio, fim) {
  const a = lerData(inicio), b = lerData(fim);
  const meses = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
  if (meses > 0 && a.getDate() === b.getDate()) {
    const n = new Date(b.getFullYear(), b.getMonth() + meses, 1);
    const ultimoDia = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
    n.setDate(Math.min(b.getDate(), ultimoDia));
    return paraISO(n);
  }
  const n = lerData(fim); n.setDate(n.getDate() + diasEntre(inicio, fim));
  return paraISO(n);
}

// Juros de um prazo: capital × taxa × dias/365 (menos IRS se aplicável)
function jurosDoPrazo(conta, capital, inicio, fim) {
  if (!conta.taxa || capital <= 0) return 0;
  const bruto = capital * conta.taxa / 100 * diasEntre(inicio, fim) / 365;
  return arred(conta.irs === false ? bruto : bruto * (1 - IRS_JUROS));
}

// Corre ao abrir a app: regista juros dos depósitos que terminaram e renova-os
async function verificarDepositos() {
  const { contas, saldos } = await carregarFinancas();
  const hoje = hojeISO();
  let mudou = false;
  for (const c of contas) {
    if (c.tipo !== 'deposito' || !c.dataInicio || !c.dataFim || c.terminado) continue;
    const conta = { ...c };
    let capital = saldos[c.id], alterada = false, voltas = 0;
    while (conta.dataFim <= hoje && voltas++ < 60) {
      const destino = conta.contaJurosId || conta.id;
      const idJuros = `juros-${conta.id}-${conta.dataFim}`;
      let valor = jurosDoPrazo(conta, capital, conta.dataInicio, conta.dataFim);
      const existente = await DB.um('financas', idJuros);
      if (existente) valor = existente.valor;
      else if (valor > 0) {
        await DB.guardar('financas', {
          id: idJuros, tipo: 'juros', valor, contaId: destino, contaDestinoId: null, categoria: null,
          data: conta.dataFim, descricao: `Juros · ${conta.nome}`, criado: Date.now(), automatico: true,
        });
        if (destino === conta.id) capital += valor;
      }
      conta.aviso = { fim: conta.dataFim, juros: valor, taxa: conta.taxa, renovado: conta.renovar !== false };
      if (conta.renovar === false) { conta.terminado = true; alterada = true; break; }
      const novoFim = proximoFim(conta.dataInicio, conta.dataFim);
      conta.dataInicio = conta.dataFim;
      conta.dataFim = novoFim;
      alterada = true;
    }
    if (alterada) { await DB.guardar('contas', conta); mudou = true; }
  }
  return mudou;
}

// Avisos de depósitos que terminaram (Início e Finanças)
function avisosDepositos(contas, saldos) {
  const caixa = el('div');
  for (const c of contas) {
    if (!c.aviso) continue;
    const a = c.aviso;
    const texto = a.renovado
      ? `Terminou a ${dataBonita(a.fim)} e rendeu ${euro(a.juros)} (já registado). O banco renovou-o até ${dataBonita(c.dataFim)} — confirma se a taxa continua a ${String(a.taxa).replace('.', ',')}%.`
      : `Terminou a ${dataBonita(a.fim)} e rendeu ${euro(a.juros)} (já registado). O dinheiro está disponível.`;
    const fechar = async () => { const n = { ...c }; delete n.aviso; await DB.guardar('contas', n); redesenhar(); };
    caixa.append(el('div', { class: 'aviso' },
      el('div', { class: 'aviso-topo' }, el('span', {}, '🔔'), el('b', {}, `Depósito terminou: ${c.nome}`)),
      el('p', {}, texto),
      el('div', { class: 'aviso-botoes' },
        a.renovado ? el('button', { class: 'btn', onclick: () => abrirConta(c, saldos[c.id]) }, 'Atualizar taxa') : null,
        el('button', { class: 'btn claro', onclick: fechar }, a.renovado ? 'Taxa igual' : 'OK'))));
  }
  return caixa;
}

// ----- Contas -----
function desenharContas(zona, { contas, saldos }) {
  if (!contas.length) {
    zona.append(el('div', { class: 'vazio' },
      el('div', { class: 'grande-ic' }, '🏦'),
      'Começa por adicionar as tuas contas: banco, poupanças, depósitos, investimentos ou dinheiro.',
      el('br'), el('button', { class: 'btn', onclick: () => abrirConta() }, 'Adicionar conta')));
    return;
  }
  zona.append(avisosDepositos(contas, saldos));
  const total = contas.reduce((s, c) => s + saldos[c.id], 0);
  const jm = contas.reduce((s, c) => s + jurosMensais(c, saldos[c.id]), 0);

  zona.append(el('div', { class: 'destaque' },
    el('small', {}, 'Património total'),
    el('div', { class: 'grande' }, euro(total)),
    el('div', { class: 'linha-dupla' },
      el('div', {}, el('small', {}, 'Juros / mês (líq.)'), el('b', {}, '≈ ' + euro(jm))),
      el('div', {}, el('small', {}, 'Juros / ano (líq.)'), el('b', {}, '≈ ' + euro(jm * 12))),
    )));

  zona.append(el('div', { class: 'secao' }, el('h2', {}, 'As tuas contas'),
    el('button', { onclick: () => abrirConta() }, '+ Nova')));

  const lista = el('div', { class: 'lista' });
  const hoje = hojeISO();
  for (const c of contas) {
    const t = TIPOS_CONTA[c.tipo] || TIPOS_CONTA.outro;
    const s = saldos[c.id];
    const taxaTxt = c.taxa ? String(c.taxa).replace('.', ',') + '%' : '';
    let detalhe = c.taxa ? `${taxaTxt} · ≈ ${euro(jurosMensais(c, s))}/mês` : t.nome;
    let alerta = false;
    if (c.tipo === 'deposito' && c.dataFim && !c.terminado) {
      const falta = diasEntre(hoje, c.dataFim);
      const fim = jurosDoPrazo(c, s, c.dataInicio, c.dataFim);
      detalhe = falta <= 30
        ? `⏳ Termina ${falta === 0 ? 'hoje' : falta === 1 ? 'amanhã' : `em ${falta} dias`} · +${euro(fim)}`
        : `${taxaTxt} · até ${dataBonita(c.dataFim)} · +${euro(fim)}`;
      alerta = falta <= 30;
    } else if (c.terminado) detalhe = 'Depósito terminado';
    lista.append(el('div', { class: 'linha', onclick: () => abrirConta(c, s) },
      el('div', { class: 'icone' }, t.ic),
      el('div', { class: 'meio' }, el('b', {}, c.nome), el('span', { class: alerta ? 'alerta' : '' }, detalhe)),
      el('div', { class: 'valor' + (s < 0 ? ' neg' : '') }, euro(s))));
  }
  zona.append(lista);
}

async function abrirConta(conta = null, saldoAtual = 0) {
  const outras = (await DB.todos('contas')).filter((c) => c.id !== conta?.id);
  const nome = el('input', { placeholder: 'Ex.: Conta CGD, Poupança Revolut', value: conta?.nome || '' });
  const tipo = el('select', {}, ...Object.entries(TIPOS_CONTA).map(([k, t]) =>
    el('option', { value: k, selected: (conta?.tipo || 'corrente') === k }, `${t.ic}  ${t.nome}`)));
  const saldo = el('input', { inputmode: 'decimal', placeholder: '0,00', value: conta ? String(saldoAtual.toFixed(2)).replace('.', ',') : '' });
  const taxa = el('input', { inputmode: 'decimal', placeholder: '0', value: conta?.taxa ? String(conta.taxa).replace('.', ',') : '' });
  const irs = segmentos([['sim', 'Descontar IRS (28%)'], ['nao', 'Valor bruto']], conta?.irs === false ? 'nao' : 'sim');
  const previsao = el('div', { class: 'ajuda' });

  // Campos só do depósito a prazo
  const inicio = el('input', { type: 'date', value: conta?.dataInicio || hojeISO() });
  const fim = el('input', { type: 'date', value: conta?.dataFim || '' });
  const renovar = segmentos([['sim', 'Renova sozinho'], ['nao', 'Não renova']], conta?.renovar === false ? 'nao' : 'sim');
  const pagosEm = el('select', {},
    el('option', { value: '' }, 'Neste depósito'),
    ...outras.map((c) => el('option', { value: c.id, selected: conta?.contaJurosId === c.id }, `${(TIPOS_CONTA[c.tipo] || TIPOS_CONTA.outro).ic}  ${c.nome}`)));
  const zonaDeposito = el('div', {},
    el('div', { class: 'dois' }, campo('Início', inicio), campo('Fim', fim)),
    campo('Quando termina', renovar),
    campo('Juros pagos em', pagosEm));

  function atualizar() {
    const ehDeposito = tipo.value === 'deposito';
    zonaDeposito.style.display = ehDeposito ? '' : 'none';
    const s = lerNumero(saldo.value) || 0, tx = lerNumero(taxa.value) || 0;
    const base = { taxa: tx, irs: irs.valor === 'sim' };
    if (!tx) { previsao.textContent = ''; return; }
    if (ehDeposito && inicio.value && fim.value && fim.value > inicio.value) {
      const total = jurosDoPrazo(base, s, inicio.value, fim.value);
      const hoje = hojeISO();
      const ate = hoje < inicio.value ? inicio.value : hoje > fim.value ? fim.value : hoje;
      const ja = jurosDoPrazo(base, s, inicio.value, ate);
      previsao.textContent = `No fim (${dataBonita(fim.value)}) recebes ≈ ${euro(total)} de juros. Até hoje já acumulou ≈ ${euro(ja)}.`;
    } else {
      const j = jurosMensais(base, s);
      previsao.textContent = `Rende ≈ ${euro(j)} por mês, ${euro(j * 12)} por ano.`;
    }
  }
  saldo.oninput = taxa.oninput = inicio.onchange = fim.onchange = tipo.onchange = atualizar;
  irs.addEventListener('click', atualizar);
  atualizar();

  abrirFolha({
    titulo: conta ? 'Editar conta' : 'Nova conta',
    corpo: el('div', {},
      campo('Nome', nome),
      campo('Tipo', tipo),
      campo('Saldo atual (€)', saldo, 'O saldo que tens hoje nesta conta.'),
      campo('Taxa de juro anual (TANB, %)', taxa),
      campo(null, irs),
      zonaDeposito,
      previsao,
    ),
    guardar: async () => {
      if (!nome.value.trim()) return 'Dá um nome à conta.';
      const s = lerNumero(saldo.value || '0');
      if (isNaN(s)) return 'O saldo não é um número válido.';
      const tx = lerNumero(taxa.value || '0');
      if (isNaN(tx) || tx < 0) return 'A taxa não é válida.';
      const ehDeposito = tipo.value === 'deposito';
      if (ehDeposito && (!inicio.value || !fim.value)) return 'Indica a data de início e de fim do depósito.';
      if (ehDeposito && fim.value <= inicio.value) return 'A data de fim tem de ser depois do início.';
      const id = conta?.id || DB.novoId();
      // Guarda o saldo inicial de forma a que o saldo atual fique igual ao que escreveste
      const movs = await DB.todos('financas');
      const efeito = movs.reduce((acc, m) => acc + efeitoNaConta(m, id), 0);
      const nova = {
        id, nome: nome.value.trim(), tipo: tipo.value,
        saldoInicial: arred(s - efeito),
        taxa: tx, irs: irs.valor === 'sim',
        criada: conta?.criada || Date.now(),
      };
      if (ehDeposito) Object.assign(nova, {
        dataInicio: inicio.value, dataFim: fim.value,
        renovar: renovar.valor === 'sim', contaJurosId: pagosEm.value || null,
      });
      await DB.guardar('contas', nova); // ao guardar, o aviso fica resolvido
      if (ehDeposito && await verificarDepositos()) setTimeout(redesenhar, 50);
    },
    apagar: conta ? async () => {
      const movs = await DB.todos('financas');
      for (const m of movs) if (m.contaId === conta.id || m.contaDestinoId === conta.id) await DB.apagar('financas', m.id);
      await DB.apagar('contas', conta.id);
    } : null,
  });
  if (!conta) setTimeout(() => nome.focus(), 300);
}

// ----- Movimentos -----
function desenharMovimentos(zona, dados) {
  const { contas, movs } = dados;
  zona.append(seletorMes(() => { zona.innerHTML = ''; desenharMovimentos(zona, dados); }));

  const chave = chaveMes(finMes);
  const doMes = movs.filter((m) => m.data.startsWith(chave))
    .sort((a, b) => b.data.localeCompare(a.data) || b.criado - a.criado);

  if (!doMes.length) {
    zona.append(el('div', { class: 'vazio' }, el('div', { class: 'grande-ic' }, '🧾'),
      contas.length ? 'Sem movimentos neste mês. Toca em + para adicionar.' : 'Primeiro adiciona uma conta no separador Contas.'));
    return;
  }

  const nomeConta = Object.fromEntries(contas.map((c) => [c.id, c.nome]));
  const porDia = {};
  for (const m of doMes) (porDia[m.data] ||= []).push(m);

  for (const [dia, lista] of Object.entries(porDia)) {
    const d = new Date(dia + 'T12:00');
    const saldoDia = lista.reduce((s, m) => s + (m.tipo === 'despesa' ? -m.valor : m.tipo === 'transferencia' ? 0 : m.valor), 0);
    zona.append(el('div', { class: 'dia' },
      el('span', {}, dia === hojeISO() ? 'Hoje' : d.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })),
      el('span', {}, saldoDia ? euroSinal(saldoDia) : '')));
    const caixa = el('div', { class: 'lista' });
    for (const m of lista) caixa.append(linhaMovimento(m, nomeConta));
    zona.append(caixa);
  }
}

function linhaMovimento(m, nomeConta) {
  let titulo = m.descricao || m.categoria || '';
  let sub = nomeConta[m.contaId] || '—';
  let valor, classe = '';
  if (m.tipo === 'transferencia') {
    titulo = m.descricao || 'Transferência';
    sub = `${nomeConta[m.contaId] || '—'} → ${nomeConta[m.contaDestinoId] || '—'}`;
    valor = euro(m.valor);
  } else if (m.tipo === 'despesa') {
    valor = euroSinal(-m.valor); classe = 'neg';
    if (m.descricao) sub = `${m.categoria} · ${sub}`;
  } else {
    if (m.tipo === 'juros') titulo = m.descricao || 'Juros';
    valor = euroSinal(m.valor); classe = 'pos';
    if (m.descricao && m.categoria) sub = `${m.categoria} · ${sub}`;
  }
  return el('div', { class: 'linha', onclick: () => abrirMovimento(m) },
    el('div', { class: 'icone' }, iconeCategoria(m)),
    el('div', { class: 'meio' }, el('b', {}, titulo), el('span', {}, sub)),
    el('div', { class: 'valor ' + classe }, valor));
}

async function abrirMovimento(mov = null, tipoInicial = 'despesa') {
  const contas = await DB.todos('contas');
  if (!contas.length) { abrirConta(); return; }
  contas.sort((a, b) => a.criada - b.criada);

  let tipo = mov?.tipo || tipoInicial;
  let categoria = mov?.categoria || null;

  const valor = el('input', { class: 'valor-grande', inputmode: 'decimal', placeholder: '0,00 €',
    value: mov ? String(mov.valor.toFixed(2)).replace('.', ',') : '' });
  const opcoesContas = (sel) => contas.map((c) =>
    el('option', { value: c.id, selected: c.id === sel }, `${(TIPOS_CONTA[c.tipo] || TIPOS_CONTA.outro).ic}  ${c.nome}`));
  let ultima; try { ultima = localStorage.getItem('ultimaConta'); } catch {}
  const conta = el('select', {}, ...opcoesContas(mov?.contaId || ultima || contas[0].id));
  const destino = el('select', {}, ...opcoesContas(mov?.contaDestinoId || (contas[1] || contas[0]).id));
  const data = el('input', { type: 'date', value: mov?.data || hojeISO() });
  const descricao = el('input', { placeholder: 'Opcional', value: mov?.descricao || '' });

  const zonaVariavel = el('div');
  function desenharVariavel() {
    zonaVariavel.innerHTML = '';
    if (tipo === 'transferencia') {
      zonaVariavel.append(el('div', { class: 'dois' }, campo('De', conta), campo('Para', destino)));
      return;
    }
    zonaVariavel.append(campo(tipo === 'despesa' ? 'Pago com' : 'Recebido em', conta));
    if (tipo === 'juros') return;
    const cats = CATEGORIAS[tipo];
    if (!cats.some(([n]) => n === categoria)) categoria = null;
    const chips = el('div', { class: 'chips' });
    for (const [n, ic] of cats) {
      const b = el('button', { type: 'button', class: n === categoria ? 'ativo' : '' }, `${ic} ${n}`);
      b.onclick = () => { categoria = n; chips.querySelectorAll('button').forEach((x) => x.classList.toggle('ativo', x === b)); };
      chips.append(b);
    }
    zonaVariavel.append(campo('Categoria', chips));
  }

  const seg = segmentos(
    [['despesa', 'Despesa'], ['receita', 'Receita'], ['transferencia', 'Transf.'], ['juros', 'Juros']],
    tipo, (v) => { tipo = v; desenharVariavel(); });
  desenharVariavel();

  abrirFolha({
    titulo: mov ? 'Editar movimento' : 'Novo movimento',
    corpo: el('div', {}, seg, campo(null, valor), zonaVariavel,
      el('div', { class: 'dois' }, campo('Data', data), campo('Descrição', descricao))),
    guardar: async () => {
      const v = lerNumero(valor.value);
      if (!(v > 0)) return 'Indica um valor maior que zero.';
      if (tipo === 'transferencia' && conta.value === destino.value) return 'Escolhe contas diferentes.';
      if ((tipo === 'despesa' || tipo === 'receita') && !categoria) return 'Escolhe uma categoria.';
      if (!data.value) return 'Indica a data.';
      await DB.guardar('financas', {
        id: mov?.id || DB.novoId(),
        tipo, valor: Math.round(v * 100) / 100,
        contaId: conta.value,
        contaDestinoId: tipo === 'transferencia' ? destino.value : null,
        categoria: tipo === 'despesa' || tipo === 'receita' ? categoria : null,
        data: data.value,
        descricao: descricao.value.trim(),
        criado: mov?.criado || Date.now(),
      });
      try { localStorage.setItem('ultimaConta', conta.value); } catch {}
    },
    apagar: mov ? () => DB.apagar('financas', mov.id) : null,
  });
  if (!mov) setTimeout(() => valor.focus(), 300);
}

// ----- Resumo -----
function desenharResumo(zona, dados) {
  zona.append(seletorMes(() => { zona.innerHTML = ''; desenharResumo(zona, dados); }));
  const chave = chaveMes(finMes);
  const { receitas, despesas } = totaisMes(dados.movs, chave);
  const poupado = receitas - despesas;
  const taxa = receitas > 0 ? Math.round(poupado / receitas * 100) : null;

  zona.append(el('div', { class: 'tres' },
    el('div', { class: 'cartao' }, el('small', {}, 'Entradas'), el('b', { class: 'pos' }, euro(receitas))),
    el('div', { class: 'cartao' }, el('small', {}, 'Saídas'), el('b', { class: 'neg' }, euro(despesas))),
    el('div', { class: 'cartao' }, el('small', {}, taxa !== null ? `Poupado · ${taxa}%` : 'Poupado'),
      el('b', { class: poupado < 0 ? 'neg' : '' }, euro(poupado)))));

  const bloco = (tituloTxt, tipos, cor) => {
    const soma = {};
    for (const m of dados.movs) {
      if (!m.data.startsWith(chave) || !tipos.includes(m.tipo)) continue;
      const cat = m.tipo === 'juros' ? 'Juros' : m.categoria;
      soma[cat] = (soma[cat] || 0) + m.valor;
    }
    const linhas = Object.entries(soma).sort((a, b) => b[1] - a[1]);
    if (!linhas.length) return;
    const max = linhas[0][1];
    const total = linhas.reduce((s, [, v]) => s + v, 0);
    const cartao = el('div', { class: 'cartao' });
    for (const [cat, v] of linhas) {
      const ic = cat === 'Juros' ? '📈' : (CATEGORIAS[tipos[0]].find(([n]) => n === cat) || [, '📦'])[1];
      cartao.append(el('div', { class: 'barra-cat' },
        el('div', { class: 'topo-cat' },
          el('span', {}, `${ic} ${cat}`, el('span', { class: 'suave' }, `  ${Math.round(v / total * 100)}%`)),
          el('span', {}, euro(v))),
        el('div', { class: 'trilho' }, el('div', { class: 'enche', style: `width:${Math.max(3, v / max * 100)}%;background:${cor}` }))));
    }
    zona.append(el('div', { class: 'secao' }, el('h2', {}, tituloTxt)), cartao);
  };
  bloco('Para onde foi o dinheiro', ['despesa'], 'var(--negativo)');
  bloco('De onde veio', ['receita', 'juros'], 'var(--positivo)');

  if (!receitas && !despesas) {
    zona.append(el('div', { class: 'vazio' }, el('div', { class: 'grande-ic' }, '📊'), 'Sem movimentos neste mês.'));
  }
}

// =====================================================
//  Subscrições (pagamentos que se repetem)
// =====================================================
const FREQUENCIAS = {
  semanal:    { nome: 'Semanal',    curto: 'semana',    porMes: 52 / 12 },
  mensal:     { nome: 'Mensal',     curto: 'mês',       porMes: 1 },
  trimestral: { nome: 'Trimestral', curto: 'trimestre', porMes: 1 / 3 },
  anual:      { nome: 'Anual',      curto: 'ano',       porMes: 1 / 12 },
};

// Data da cobrança seguinte (mantém o dia do mês original, ex.: 31 → 28/29/30 quando o mês é mais curto)
function proximaCobranca(iso, freq, dia) {
  const d = lerData(iso);
  if (freq === 'semanal') { d.setDate(d.getDate() + 7); return paraISO(d); }
  const meses = freq === 'anual' ? 12 : freq === 'trimestral' ? 3 : 1;
  const n = new Date(d.getFullYear(), d.getMonth() + meses, 1);
  const ultimo = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
  n.setDate(Math.min(dia || d.getDate(), ultimo));
  return paraISO(n);
}

// Regista as cobranças que já chegaram (corre ao abrir a app; a função na nuvem faz o mesmo às 9h)
async function verificarSubscricoes() {
  const hoje = hojeISO();
  let mudou = false;
  for (const r of await DB.todos('recorrentes')) {
    if (r.ativa === false || !r.proximaData || r.proximaData > hoje) continue;
    const sub = { ...r };
    let voltas = 0;
    while (sub.proximaData <= hoje && voltas++ < 120) {
      const id = `sub-${sub.id}-${sub.proximaData}`;
      if (!(await DB.um('financas', id))) {
        await DB.guardar('financas', {
          id, tipo: 'despesa', valor: sub.valor, contaId: sub.contaId, contaDestinoId: null,
          categoria: sub.categoria || 'Subscrições', data: sub.proximaData,
          descricao: sub.nome, criado: Date.now(), automatico: true, subscricaoId: sub.id,
        });
      }
      sub.proximaData = proximaCobranca(sub.proximaData, sub.frequencia, sub.dia);
    }
    await DB.guardar('recorrentes', sub);
    mudou = true;
  }
  return mudou;
}

function custoMensal(r) { return r.ativa === false ? 0 : r.valor * (FREQUENCIAS[r.frequencia] || FREQUENCIAS.mensal).porMes; }

function desenharSubscricoes(zona, { contas, recorrentes }) {
  if (!recorrentes.length) {
    zona.append(el('div', { class: 'vazio' },
      el('div', { class: 'grande-ic' }, '🔁'),
      'Adiciona as tuas subscrições e pagamentos fixos (Netflix, ginásio, telemóvel, seguros…). No dia certo, o valor sai sozinho da conta que escolheres.',
      el('br'), el('button', { class: 'btn', onclick: () => contas.length ? abrirSubscricao() : abrirConta() }, 'Adicionar subscrição')));
    return;
  }
  const mensal = recorrentes.reduce((s, r) => s + custoMensal(r), 0);
  zona.append(el('div', { class: 'destaque' },
    el('small', {}, 'Subscrições por mês'),
    el('div', { class: 'grande' }, euro(mensal)),
    el('div', { class: 'linha-dupla' },
      el('div', {}, el('small', {}, 'Por ano'), el('b', {}, euro(mensal * 12))),
      el('div', {}, el('small', {}, 'Ativas'), el('b', {}, String(recorrentes.filter((r) => r.ativa !== false).length))),
    )));

  zona.append(el('div', { class: 'secao' }, el('h2', {}, 'Próximas cobranças'),
    el('button', { onclick: () => abrirSubscricao() }, '+ Nova')));

  const nomeConta = Object.fromEntries(contas.map((c) => [c.id, c.nome]));
  const ordem = [...recorrentes].sort((a, b) => (a.ativa === false) - (b.ativa === false) || a.proximaData.localeCompare(b.proximaData));
  const lista = el('div', { class: 'lista' });
  const hoje = hojeISO();
  for (const r of ordem) {
    const f = FREQUENCIAS[r.frequencia] || FREQUENCIAS.mensal;
    const falta = diasEntre(hoje, r.proximaData);
    const quando = r.ativa === false ? 'Em pausa'
      : falta === 0 ? 'Hoje' : falta === 1 ? 'Amanhã' : falta <= 7 ? `Daqui a ${falta} dias` : dataBonita(r.proximaData);
    const cat = (CATEGORIAS.despesa.find(([n]) => n === r.categoria) || [, '🔁'])[1];
    lista.append(el('div', { class: 'linha' + (r.ativa === false ? ' pausa' : ''), onclick: () => abrirSubscricao(r) },
      el('div', { class: 'icone' }, cat),
      el('div', { class: 'meio' }, el('b', {}, r.nome),
        el('span', { class: r.ativa !== false && falta <= 3 ? 'alerta' : '' },
          `${quando} · ${nomeConta[r.contaId] || '—'}${r.notificar ? ' · 🔔' : ''}`)),
      el('div', { class: 'valor' }, euro(r.valor), el('small', {}, '/' + f.curto))));
  }
  zona.append(lista);
}

async function abrirSubscricao(sub = null) {
  const contas = (await DB.todos('contas')).sort((a, b) => a.criada - b.criada);
  if (!contas.length) { abrirConta(); return; }
  let categoria = sub?.categoria || 'Subscrições';

  const nome = el('input', { placeholder: 'Ex.: Netflix, Ginásio, Telemóvel', value: sub?.nome || '' });
  const valor = el('input', { inputmode: 'decimal', placeholder: '0,00', value: sub ? String(sub.valor.toFixed(2)).replace('.', ',') : '' });
  const conta = el('select', {}, ...contas.map((c) =>
    el('option', { value: c.id, selected: c.id === (sub?.contaId || contas[0].id) }, `${(TIPOS_CONTA[c.tipo] || TIPOS_CONTA.outro).ic}  ${c.nome}`)));
  const freq = segmentos(Object.entries(FREQUENCIAS).map(([k, f]) => [k, f.nome]), sub?.frequencia || 'mensal');
  const data = el('input', { type: 'date', value: sub?.proximaData || hojeISO() });
  const notificar = segmentos([['sim', '🔔 Avisar'], ['nao', 'Sem aviso']], sub?.notificar === false ? 'nao' : 'sim');
  const estado = segmentos([['ativa', 'Ativa'], ['pausa', 'Em pausa']], sub?.ativa === false ? 'pausa' : 'ativa');
  const ajudaData = el('div', { class: 'ajuda' });
  const atualizarAjuda = () => {
    ajudaData.textContent = data.value && data.value <= hojeISO()
      ? 'Como a data é hoje (ou já passou), o valor é retirado logo ao guardar.'
      : 'O valor sai da conta automaticamente nesse dia.';
  };
  data.onchange = atualizarAjuda; atualizarAjuda();

  const chips = el('div', { class: 'chips' });
  for (const [n, ic] of CATEGORIAS.despesa) {
    const b = el('button', { type: 'button', class: n === categoria ? 'ativo' : '' }, `${ic} ${n}`);
    b.onclick = () => { categoria = n; chips.querySelectorAll('button').forEach((x) => x.classList.toggle('ativo', x === b)); };
    chips.append(b);
  }

  abrirFolha({
    titulo: sub ? 'Editar subscrição' : 'Nova subscrição',
    corpo: el('div', {},
      campo('Nome', nome),
      el('div', { class: 'dois' }, campo('Valor (€)', valor), campo('Próxima cobrança', data)),
      ajudaData,
      campo('Frequência', freq),
      campo('Sai da conta', conta),
      campo('Notificação no dia', notificar, 'Recebes uma notificação quando o valor for retirado (precisa das notificações ativas em Conta).'),
      sub ? campo('Estado', estado) : null,
      campo('Categoria', chips),
    ),
    guardar: async () => {
      if (!nome.value.trim()) return 'Dá um nome à subscrição.';
      const v = lerNumero(valor.value);
      if (!(v > 0)) return 'Indica um valor maior que zero.';
      if (!data.value) return 'Indica a data da próxima cobrança.';
      await DB.guardar('recorrentes', {
        id: sub?.id || DB.novoId(),
        nome: nome.value.trim(), valor: arred(v), contaId: conta.value,
        frequencia: freq.valor, proximaData: data.value, dia: lerData(data.value).getDate(),
        categoria, notificar: notificar.valor === 'sim', ativa: estado.valor !== 'pausa',
        criada: sub?.criada || Date.now(),
      });
      await verificarSubscricoes();
    },
    apagar: sub ? () => DB.apagar('recorrentes', sub.id) : null,
  });
  if (!sub) setTimeout(() => nome.focus(), 300);
}
