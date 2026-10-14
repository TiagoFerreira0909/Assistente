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

  conteudo.append(segmentos(
    [['contas', 'Contas'], ['movimentos', 'Movimentos'], ['resumo', 'Resumo']],
    finSep,
    (v) => { finSep = v; try { localStorage.setItem('finSep', v); } catch {} desenhar(); },
  ));
  const zona = el('div');
  conteudo.append(zona);

  botaoAdicionar(() => dados.contas.length ? abrirMovimento() : abrirConta());

  function desenhar() {
    zona.innerHTML = '';
    if (finSep === 'contas') desenharContas(zona, dados);
    else if (finSep === 'movimentos') desenharMovimentos(zona, dados);
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

// ----- Contas -----
function desenharContas(zona, { contas, saldos }) {
  if (!contas.length) {
    zona.append(el('div', { class: 'vazio' },
      el('div', { class: 'grande-ic' }, '🏦'),
      'Começa por adicionar as tuas contas: banco, poupanças, depósitos, investimentos ou dinheiro.',
      el('br'), el('button', { class: 'btn', onclick: () => abrirConta() }, 'Adicionar conta')));
    return;
  }
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
  for (const c of contas) {
    const t = TIPOS_CONTA[c.tipo] || TIPOS_CONTA.outro;
    const s = saldos[c.id];
    const j = jurosMensais(c, s);
    const detalhe = c.taxa
      ? `${String(c.taxa).replace('.', ',')}% · ≈ ${euro(j)}/mês`
      : t.nome;
    lista.append(el('div', { class: 'linha', onclick: () => abrirConta(c, s) },
      el('div', { class: 'icone' }, t.ic),
      el('div', { class: 'meio' }, el('b', {}, c.nome), el('span', {}, detalhe)),
      el('div', { class: 'valor' + (s < 0 ? ' neg' : '') }, euro(s))));
  }
  zona.append(lista);
}

function abrirConta(conta = null, saldoAtual = 0) {
  const nome = el('input', { placeholder: 'Ex.: Conta CGD, Poupança Revolut', value: conta?.nome || '' });
  const tipo = el('select', {}, ...Object.entries(TIPOS_CONTA).map(([k, t]) =>
    el('option', { value: k, selected: (conta?.tipo || 'corrente') === k }, `${t.ic}  ${t.nome}`)));
  const saldo = el('input', { inputmode: 'decimal', placeholder: '0,00', value: conta ? String(saldoAtual.toFixed(2)).replace('.', ',') : '' });
  const taxa = el('input', { inputmode: 'decimal', placeholder: '0', value: conta?.taxa ? String(conta.taxa).replace('.', ',') : '' });
  const irs = segmentos([['sim', 'Descontar IRS (28%)'], ['nao', 'Valor bruto']], conta?.irs === false ? 'nao' : 'sim');
  const previsao = el('div', { class: 'ajuda' });

  function atualizarPrevisao() {
    const s = lerNumero(saldo.value) || 0, tx = lerNumero(taxa.value) || 0;
    const j = jurosMensais({ taxa: tx, irs: irs.valor === 'sim' }, s);
    previsao.textContent = tx ? `Rende ≈ ${euro(j)} por mês, ${euro(j * 12)} por ano.` : '';
  }
  saldo.oninput = taxa.oninput = atualizarPrevisao;
  irs.addEventListener('click', atualizarPrevisao);
  atualizarPrevisao();

  abrirFolha({
    titulo: conta ? 'Editar conta' : 'Nova conta',
    corpo: el('div', {},
      campo('Nome', nome),
      campo('Tipo', tipo),
      campo('Saldo atual (€)', saldo, 'O saldo que tens hoje nesta conta.'),
      campo('Taxa de juro / rendimento anual (%)', taxa),
      campo(null, irs),
      previsao,
    ),
    guardar: async () => {
      if (!nome.value.trim()) return 'Dá um nome à conta.';
      const s = lerNumero(saldo.value || '0');
      if (isNaN(s)) return 'O saldo não é um número válido.';
      const tx = lerNumero(taxa.value || '0');
      if (isNaN(tx) || tx < 0) return 'A taxa não é válida.';
      const id = conta?.id || DB.novoId();
      // Guarda o saldo inicial de forma a que o saldo atual fique igual ao que escreveste
      const movs = await DB.todos('financas');
      const efeito = movs.reduce((acc, m) => acc + efeitoNaConta(m, id), 0);
      await DB.guardar('contas', {
        id, nome: nome.value.trim(), tipo: tipo.value,
        saldoInicial: Math.round((s - efeito) * 100) / 100,
        taxa: tx, irs: irs.valor === 'sim',
        criada: conta?.criada || Date.now(),
      });
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
