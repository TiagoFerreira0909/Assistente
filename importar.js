// =====================================================
//  Importar extratos: ficheiro do banco (CSV/PDF) ou prints → movimentos
// =====================================================
// Tudo é lido aqui no aparelho, sem custos: CSV diretamente, PDF com o pdf.js e prints com OCR
// (ver leitor-extratos.js). Nada é gravado sem rever a lista primeiro.
// Os ids dos movimentos importados são determinísticos (imp-<conta>-<data>-<cêntimos>-<descrição>-<n>):
// importar o mesmo extrato duas vezes (ou em dois aparelhos) nunca duplica.

// ----- Categorias sugeridas pela descrição (usado no CSV e como reserva) -----
const PALAVRAS_CATEGORIA = [
  ['Supermercado', /continente|pingo doce|lidl|auchan|mercadona|minipre|intermarch|aldi|el corte|froiz|supermerc|spar\b|coviran/],
  ['Restaurantes', /restaur|mcdonald|burger|kfc|telepizza|pizza|glovo|uber ?eats|bolt food|pastelaria|padaria|cafe\b|caf[eé]|snack|tasca|sushi|starbucks|h3\b/],
  ['Transportes', /galp|\bbp\b|repsol|cepsa|prio\b|via ?verde|uber|bolt|\bcp\b|comboios|metro|carris|stcp|navegante|portagem|parque|estacion|emel|ryanair|tap air/],
  ['Subscrições', /netflix|spotify|disney|hbo|max\.com|prime video|apple\.com|icloud|google (one|storage)|youtube|chatgpt|openai|anthropic|claude\.ai|ginasio|gin[aá]sio|fitness/],
  ['Contas', /\bedp\b|endesa|goldenergy|iberdrola|epal|[aá]guas|\bmeo\b|\bnos\b|vodafone|\bdigi\b|nowo|galp energia|seguro|fidelidade|allianz|tranquilidade|condom[ií]nio|renda/],
  ['Saúde', /farm[aá]cia|hospital|cl[ií]nica|cuf\b|lusiadas|dentista|wells|[oó]ptica|medic/],
  ['Compras', /amazon|zara|fnac|worten|ikea|primark|decathlon|aliexpress|shein|mango|pull ?& ?bear|bershka|leroy|radio popular|media ?markt|el corte/],
  ['Lazer', /cinema|nos cinemas|ticketline|bilheteira|steam|playstation|xbox|nintendo|concerto|museu/],
  ['Educação', /escola|universidade|faculdade|propina|livraria|bertrand|curso|udemy/],
  ['Viagens', /hotel|booking|airbnb|hostel|easyjet|vueling|expedia/],
];
const PALAVRAS_RECEITA = [
  ['Salário', /sal[aá]rio|ordenado|vencimento|remunera/],
  ['Reembolsos', /reembolso|devolu[cç][aã]o|estorno|refund/],
  ['Vendas', /vinted|olx|venda/],
];
function sugerirCategoria(tipo, descricao) {
  const d = (descricao || '').toLowerCase();
  for (const [cat, re] of (tipo === 'receita' ? PALAVRAS_RECEITA : PALAVRAS_CATEGORIA)) if (re.test(d)) return cat;
  return 'Outros';
}

// ----- Leitura de ficheiros -----
// Os bancos portugueses exportam muitas vezes em Windows-1252 (acentos estragados se lidos como UTF-8)
async function lerTexto(f) {
  const bytes = await f.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, ''); }
  catch { return new TextDecoder('windows-1252').decode(bytes); }
}

function carregarImagem(f) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Não consegui abrir a imagem ${f.name}.`)); };
    img.src = url;
  });
}

// ----- CSV -----
// "1.234,56", "-12.50", "1,234.56", "12,50 €" → número (o último separador é o decimal)
function numeroExtrato(txt) {
  let s = String(txt || '').trim().replace(/\s|€|EUR/gi, '');
  if (!s) return NaN;
  let negativo = false;
  if (/^\(.*\)$/.test(s)) { negativo = true; s = s.slice(1, -1); }
  if (s.endsWith('-')) { negativo = true; s = s.slice(0, -1); }
  const v = s.lastIndexOf(','), p = s.lastIndexOf('.');
  if (v > -1 && p > -1) s = v > p ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (v > -1) s = s.replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  if (!/^[-+]?\d*\.?\d+$/.test(s)) return NaN;
  const n = parseFloat(s);
  return negativo ? -n : n;
}

// "05-10-2026", "05/10/2026", "2026-10-05 10:22", "05.10.26" → "2026-10-05"
function dataExtrato(txt) {
  const s = String(txt || '').trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return validarISO(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) return validarISO(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  return null;
}
function validarISO(a, m, d) {
  const x = new Date(a, m - 1, d);
  return x.getFullYear() === a && x.getMonth() === m - 1 && x.getDate() === d ? paraISO(x) : null;
}

function partirLinhaCSV(linha, sep) {
  const celulas = [];
  let atual = '', aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (aspas) {
      if (c === '"' && linha[i + 1] === '"') { atual += '"'; i++; }
      else if (c === '"') aspas = false;
      else atual += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { celulas.push(atual.trim()); atual = ''; }
    else atual += c;
  }
  celulas.push(atual.trim());
  return celulas;
}

const semAcentos = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// Devolve a lista de movimentos, ou null se não perceber o ficheiro (aí vai para a nuvem)
function lerCSV(texto) {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim());
  if (linhas.length < 2) return null;
  for (let i = 0; i < Math.min(40, linhas.length - 1); i++) {
    const sep = [';', '\t', ','].sort((a, b) => linhas[i].split(b).length - linhas[i].split(a).length)[0];
    const cab = partirLinhaCSV(linhas[i], sep).map(semAcentos);
    const achar = (re, exceto) => cab.findIndex((c) => re.test(c) && !(exceto && exceto.test(c)));
    const cData = achar(/^(data|date)|(^| )(data|date)( |$)|completed date|started date/, /valor|value/);
    const cDataReserva = cData < 0 ? achar(/data|date/) : cData;
    const cDesc = achar(/descri|historico|designa|movimento|description|detalhe|referencia|beneficiario|comerciante|merchant|narrativa/, /data|tipo de/);
    const cValor = achar(/^(montante|valor|importancia|amount|quantia)|montante|amount/, /saldo|balance|data|date|fee|comiss/);
    const cDeb = achar(/debito|debit|saida/);
    const cCred = achar(/credito|credit|entrada/);
    const cEstado = achar(/^(estado|state|status)$/);
    if (cDataReserva < 0 || cDesc < 0 || (cValor < 0 && cDeb < 0 && cCred < 0)) continue;

    const movs = [];
    for (const linha of linhas.slice(i + 1)) {
      const c = partirLinhaCSV(linha, sep);
      const data = dataExtrato(c[cDataReserva]);
      if (!data) continue;
      if (cEstado >= 0 && /revert|declin|fail|recus|cancel/i.test(c[cEstado] || '')) continue;
      let v;
      if (cValor >= 0 && c[cValor]) v = numeroExtrato(c[cValor]);
      else {
        const deb = cDeb >= 0 ? numeroExtrato(c[cDeb]) : NaN;
        const cred = cCred >= 0 ? numeroExtrato(c[cCred]) : NaN;
        v = !isNaN(deb) && deb !== 0 ? -Math.abs(deb) : !isNaN(cred) ? Math.abs(cred) : NaN;
      }
      if (isNaN(v) || Math.abs(v) < 0.005) continue;
      const tipo = v > 0 ? 'receita' : 'despesa';
      const descricao = (c[cDesc] || '').replace(/\s+/g, ' ').trim();
      movs.push({ data, descricao, valor: arred(Math.abs(v)), tipo, categoria: sugerirCategoria(tipo, descricao) });
    }
    if (movs.length) return movs;
  }
  return null;
}

// ----- PDF, prints e CSV "estranhos": lidos aqui no telemóvel, sem custos (ver leitor-extratos.js) -----
async function lerFicheirosExtrato(ficheiros, aoProgresso) {
  const movimentos = [];
  let saldoFinal = null;
  const avisos = [];
  for (const f of ficheiros) {
    const nome = f.name.toLowerCase();
    let r = null;
    if (f.type.startsWith('image/') || /\.(jpe?g|png|heic|heif|webp)$/.test(nome)) {
      aoProgresso(`A ler ${f.name}…`);
      r = lerTextoExtrato(await textoDaImagem(f, aoProgresso));
    } else if (f.type === 'application/pdf' || nome.endsWith('.pdf')) {
      aoProgresso(`A abrir ${f.name}…`);
      const pdf = await abrirPDF(f);
      let texto = await textoDoPDF(pdf);
      if (texto.replace(/\s/g, '').length < 40) {
        // PDF digitalizado (só imagem): lê as páginas com OCR
        const telas = await paginasPDFParaImagens(pdf);
        const textos = [];
        for (let i = 0; i < telas.length; i++) { aoProgresso(`A ler a página ${i + 1} de ${telas.length}…`); textos.push(await ocr(telas[i], aoProgresso)); }
        texto = textos.join('\n');
      }
      r = lerTextoExtrato(texto);
    } else if (/\.xlsx$/.test(nome)) {
      throw new Error(`O ficheiro ${f.name} é Excel (.xlsx). Exporta do banco em CSV ou PDF.`);
    } else {
      const texto = await lerTexto(f);
      const local = lerCSV(texto);
      r = local ? { movimentos: local, saldoFinal: null } : lerTextoExtrato(texto);
    }
    if (!r.movimentos.length) avisos.push(`não encontrei movimentos em ${f.name}`);
    movimentos.push(...r.movimentos);
    if (r.saldoFinal !== null && r.saldoFinal !== undefined) saldoFinal = r.saldoFinal;
  }
  // Garante formato e categorias válidas
  const limpos = movimentos.filter((m) => m && dataExtrato(m.data) === m.data && Math.abs(+m.valor) >= 0.005)
    .map((m) => {
      const tipo = m.tipo === 'receita' ? 'receita' : 'despesa';
      const cats = CATEGORIAS[tipo].map(([n]) => n);
      const descricao = String(m.descricao || '').trim().slice(0, 120);
      return { data: m.data, descricao, valor: arred(Math.abs(+m.valor)), tipo,
        categoria: cats.includes(m.categoria) ? m.categoria : sugerirCategoria(tipo, descricao) };
    });
  const observacoes = avisos.length && limpos.length ? `Atenção: ${avisos.join('; ')}.` : (avisos.length ? 'experimenta um print mais nítido ou o ficheiro CSV/PDF do banco' : '');
  return { movimentos: limpos, saldoFinal, observacoes };
}

// ----- Ids e duplicados -----
function resumoTexto(s) {
  let h = 0;
  for (const c of semAcentos(s).replace(/[^a-z0-9]/g, '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h.toString(36);
}
function idsImportacao(contaId, lista) {
  const vistos = {};
  return lista.map((m) => {
    const base = `imp-${contaId}-${m.data}-${Math.round(m.valor * 100)}-${resumoTexto(m.descricao)}`;
    vistos[base] = (vistos[base] || 0) + 1;
    return `${base}-${vistos[base]}`;
  });
}

// Marca o que já está registado: mesmo id (importado antes) ou mesmo valor na mesma conta
// com data até 3 dias de diferença (ex.: compra com cartão registada à mão ou subscrição automática)
function marcarDuplicados(conta, itens, movs) {
  const usados = new Set();
  const existentes = movs.filter((m) => efeitoNaConta(m, conta.id) !== 0);
  const ids = new Set(movs.map((m) => m.id));
  for (const it of itens) {
    if (ids.has(it.id)) { it.duplicado = 'Já importado'; usados.add(it.id); continue; }
    const sinal = it.tipo === 'receita' ? it.valor : -it.valor;
    const igual = existentes.find((m) => !usados.has(m.id) && Math.abs(efeitoNaConta(m, conta.id) - sinal) < 0.005
      && Math.abs(diasEntre(m.data, it.data)) <= 3);
    if (igual) { usados.add(igual.id); it.duplicado = `Parece já registado (${igual.descricao || igual.categoria || 'movimento'}, ${dataBonita(igual.data)})`; }
  }
  for (const it of itens) it.escolhido = !it.duplicado;
}

// ----- Folha 1: escolher conta e ficheiros -----
async function abrirImportar() {
  const contas = (await DB.todos('contas')).sort((a, b) => a.criada - b.criada);
  if (!contas.length) { abrirConta(); return; }
  let ultima; try { ultima = localStorage.getItem('ultimaConta'); } catch {}
  const conta = el('select', {}, ...contas.map((c) =>
    el('option', { value: c.id, selected: c.id === (ultima || contas[0].id) }, `${(TIPOS_CONTA[c.tipo] || TIPOS_CONTA.outro).ic}  ${c.nome}`)));

  let ficheiros = [];
  const lista = el('div', { class: 'lista importar-ficheiros' });
  const estado = el('div', { class: 'ajuda importar-estado' });
  const entradaFicheiro = el('input', { type: 'file', multiple: true, style: 'display:none',
    accept: '.csv,.txt,.tsv,.xls,.pdf,text/csv,text/plain,application/pdf,application/vnd.ms-excel' });
  const entradaImagens = el('input', { type: 'file', multiple: true, accept: 'image/*', style: 'display:none' });
  const juntar = (inp) => { ficheiros.push(...inp.files); inp.value = ''; desenharLista(); };
  entradaFicheiro.onchange = () => juntar(entradaFicheiro);
  entradaImagens.onchange = () => juntar(entradaImagens);

  function desenharLista() {
    lista.innerHTML = '';
    lista.style.display = ficheiros.length ? '' : 'none';
    ficheiros.forEach((f, i) => {
      const imagem = f.type.startsWith('image/');
      lista.append(el('div', { class: 'linha' },
        el('div', { class: 'icone' }, imagem ? '🖼️' : /pdf$/i.test(f.name) ? '📕' : '📄'),
        el('div', { class: 'meio' }, el('b', {}, f.name), el('span', {}, `${Math.max(1, Math.round(f.size / 1024))} KB`)),
        el('button', { type: 'button', class: 'tirar', 'aria-label': 'Tirar', onclick: () => { ficheiros.splice(i, 1); desenharLista(); } }, '✕')));
    });
  }
  desenharLista();

  abrirFolha({
    titulo: 'Importar extrato',
    textoGuardar: 'Ler movimentos',
    corpo: el('div', {},
      campo('Conta', conta, 'Os movimentos ficam registados nesta conta.'),
      el('div', { class: 'dois importar-botoes' },
        el('button', { type: 'button', class: 'btn claro', onclick: () => entradaFicheiro.click() }, '📄 Ficheiro do banco'),
        el('button', { type: 'button', class: 'btn claro', onclick: () => entradaImagens.click() }, '🖼️ Prints')),
      entradaFicheiro, entradaImagens, lista, estado,
      el('div', { class: 'ajuda' },
        'Tudo é lido aqui no telemóvel, sem custos. O melhor é o CSV ou o PDF do banco; os prints também funcionam (na primeira vez descarrega o leitor de imagens). Confirma sempre os valores na lista. ',
        'Antes de gravar vês a lista, corriges o que for preciso e escolhes o que fica. Os movimentos que já tens registados aparecem desmarcados.')),
    guardar: async () => {
      if (!ficheiros.length) return 'Escolhe um ficheiro do banco ou os prints.';
      const c = contas.find((x) => x.id === conta.value);
      try {
        const r = await lerFicheirosExtrato(ficheiros, (t) => { estado.textContent = t; });
        estado.textContent = '';
        if (!r.movimentos.length) return 'Não encontrei movimentos ' + (r.observacoes ? `(${r.observacoes})` : 'nestes ficheiros.');
        try { localStorage.setItem('ultimaConta', c.id); } catch {}
        await abrirRevisaoImportacao(c, r);
        return false; // a folha continua aberta, agora com a revisão
      } catch (e) {
        estado.textContent = '';
        return e.message || 'Não foi possível ler os ficheiros.';
      }
    },
  });
  folha.querySelector('.folha-topo .guardar').textContent = 'Ler';
}

// ----- Folha 2: rever antes de gravar -----
async function abrirRevisaoImportacao(conta, { movimentos, saldoFinal, observacoes }) {
  const movs = await DB.todos('financas');
  const ids = idsImportacao(conta.id, movimentos);
  const itens = movimentos.map((m, i) => ({ ...m, id: ids[i] }))
    .sort((a, b) => b.data.localeCompare(a.data));
  marcarDuplicados(conta, itens, movs);

  // A conta foi criada com o saldo desse dia: os movimentos anteriores já lá estão incluídos
  const criadaISO = paraISO(new Date(conta.criada || Date.now()));
  const haAntigos = itens.some((it) => it.data < criadaISO);
  const saldoOpcao = segmentos([['manter', 'Não mexer no saldo'], ['somar', 'Somar ao saldo']], 'manter', () => atualizarResumo());
  const zonaSaldo = haAntigos ? el('div', {},
    campo(`Movimentos antes de ${dataBonita(criadaISO)}`, saldoOpcao,
      `Criaste esta conta a ${dataBonita(criadaISO)} com o saldo desse dia, por isso os movimentos anteriores já estão incluídos nele. Escolhe "Somar ao saldo" só se o saldo que puseste não os incluía.`)) : null;

  const resumo = el('div', { class: 'cartao importar-resumo' });
  const lista = el('div', { class: 'lista' });
  const todos = el('button', { type: 'button' });
  const saldoAtual = saldoConta(conta, movs);

  function efeitoNoSaldo() {
    return itens.filter((it) => it.escolhido && !(saldoOpcao.valor === 'manter' && it.data < criadaISO))
      .reduce((s, it) => s + (it.tipo === 'receita' ? it.valor : -it.valor), 0);
  }
  function atualizarResumo() {
    const n = itens.filter((it) => it.escolhido).length;
    const dup = itens.filter((it) => it.duplicado).length;
    resumo.innerHTML = '';
    resumo.append(...[
      el('b', {}, `${itens.length} movimento${itens.length === 1 ? '' : 's'} encontrado${itens.length === 1 ? '' : 's'}`),
      dup ? el('p', {}, `${dup} já ${dup === 1 ? 'estava registado e está desmarcado' : 'estavam registados e estão desmarcados'}.`) : null,
      el('p', {}, `Saldo de ${conta.nome} depois de importar: ${euro(saldoAtual + efeitoNoSaldo())}`
        + (saldoFinal !== null ? ` · no extrato: ${euro(saldoFinal)}` : '')),
      observacoes ? el('p', { class: 'nota-importar' }, '💬 ' + observacoes) : null].filter(Boolean));
    todos.textContent = n === itens.length ? 'Desmarcar todos' : 'Marcar todos';
    const texto = n ? `Registar ${n} movimento${n === 1 ? '' : 's'}` : 'Registar';
    folha.querySelectorAll('.folha-rodape .btn, .folha-topo .guardar').forEach((b) => { b.textContent = b.classList.contains('guardar') ? 'Registar' : texto; });
  }
  todos.onclick = () => {
    const marcar = itens.some((it) => !it.escolhido);
    itens.forEach((it) => { it.escolhido = marcar; });
    desenharLista();
  };

  let aberto = null; // item a ser editado
  function desenharLista() {
    lista.innerHTML = '';
    for (const it of itens) {
      const visto = el('button', { type: 'button', class: 'visto' + (it.escolhido ? ' feito' : ''), 'aria-label': it.escolhido ? 'Não registar' : 'Registar' });
      visto.onclick = (e) => { e.stopPropagation(); it.escolhido = !it.escolhido; desenharLista(); };
      const ic = (CATEGORIAS[it.tipo].find(([n]) => n === it.categoria) || [, '📦'])[1];
      lista.append(el('div', { class: 'linha importar-item' + (it.escolhido ? '' : ' desmarcado'), onclick: () => { aberto = aberto === it ? null : it; desenharLista(); } },
        visto,
        el('div', { class: 'meio' },
          el('b', {}, it.descricao || it.categoria),
          el('span', {}, `${dataBonita(it.data)} · ${ic} ${it.categoria}`),
          it.duplicado ? el('span', { class: 'alerta' }, '⚠️ ' + it.duplicado) : null),
        el('div', { class: 'valor ' + (it.tipo === 'receita' ? 'pos' : 'neg') }, euroSinal(it.tipo === 'receita' ? it.valor : -it.valor))));
      if (aberto === it) lista.append(editorItem(it));
    }
    atualizarResumo();
  }

  function editorItem(it) {
    const descricao = el('input', { value: it.descricao });
    const valor = el('input', { inputmode: 'decimal', value: String(it.valor.toFixed(2)).replace('.', ',') });
    const data = el('input', { type: 'date', value: it.data });
    const categoria = el('select', {});
    const encherCategorias = () => {
      categoria.innerHTML = '';
      for (const [n, ic] of CATEGORIAS[it.tipo]) categoria.append(el('option', { value: n, selected: n === it.categoria }, `${ic} ${n}`));
      if (!CATEGORIAS[it.tipo].some(([n]) => n === it.categoria)) { it.categoria = sugerirCategoria(it.tipo, it.descricao); categoria.value = it.categoria; }
    };
    const tipo = segmentos([['despesa', 'Despesa'], ['receita', 'Receita']], it.tipo, (v) => { it.tipo = v; encherCategorias(); });
    encherCategorias();
    descricao.oninput = () => { it.descricao = descricao.value.trim(); };
    categoria.onchange = () => { it.categoria = categoria.value; };
    data.onchange = () => { if (data.value) it.data = data.value; };
    valor.oninput = () => { const v = lerNumero(valor.value); if (v > 0) it.valor = arred(v); };
    return el('div', { class: 'importar-editor', onclick: (e) => e.stopPropagation() },
      campo('Descrição', descricao),
      el('div', { class: 'dois' }, campo('Valor (€)', valor), campo('Data', data)),
      campo(null, tipo),
      campo('Categoria', categoria),
      el('button', { type: 'button', class: 'btn claro largo', onclick: () => { aberto = null; desenharLista(); } }, 'Feito'));
  }

  abrirFolha({
    titulo: 'Rever movimentos',
    textoGuardar: 'Registar',
    corpo: el('div', {},
      resumo,
      zonaSaldo,
      el('div', { class: 'secao' }, el('h2', {}, 'Movimentos'), todos),
      el('div', { class: 'ajuda' }, 'Toca num movimento para corrigir a descrição, o valor, a data ou a categoria.'),
      lista),
    guardar: async () => {
      const escolhidos = itens.filter((it) => it.escolhido);
      if (!escolhidos.length) return 'Não há nenhum movimento marcado.';
      const agora = Date.now();
      // Ids determinísticos: corrigir a data ou o valor não muda o id, por isso reimportar não duplica
      for (const it of escolhidos) {
        await DB.guardar('financas', {
          id: it.id, tipo: it.tipo, valor: it.valor, contaId: conta.id, contaDestinoId: null,
          categoria: it.categoria, data: it.data, descricao: it.descricao, criado: agora, importado: true,
        });
      }
      // Movimentos anteriores à criação da conta já estavam no saldo: acerta o saldo inicial
      if (saldoOpcao.valor === 'manter') {
        const antes = escolhidos.filter((it) => it.data < criadaISO)
          .reduce((s, it) => s + (it.tipo === 'receita' ? it.valor : -it.valor), 0);
        if (Math.abs(antes) >= 0.005) {
          const atual = await DB.um('contas', conta.id);
          await DB.guardar('contas', { ...atual, saldoInicial: arred((atual.saldoInicial || 0) - antes) });
        }
      }
      const maisRecente = escolhidos.reduce((a, it) => (it.data > a ? it.data : a), '');
      finMes = new Date(lerData(maisRecente).getFullYear(), lerData(maisRecente).getMonth(), 1);
      finSep = 'movimentos'; try { localStorage.setItem('finSep', 'movimentos'); } catch {}
      vistaAtual = 'financas';
    },
  });
  desenharLista();
}
