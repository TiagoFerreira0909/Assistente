// =====================================================
//  Leitor de extratos grátis, no próprio telemóvel
// =====================================================
// - PDF: tira o texto com o pdf.js (incluído em lib/pdfjs). Se o PDF for digitalizado (sem texto), faz OCR às páginas.
// - Prints/fotos: OCR com o Tesseract.js (descarregado na primeira utilização, ~4 MB, fica em cache).
// - Depois, lerTextoExtrato() percebe as linhas: data, descrição, valor e (se houver) saldo.
//   O sinal (entrada/saída) vem de: sinal explícito (-/+), diferença de saldos entre linhas, ou palavras-chave.
// Nada sai do telemóvel e não tem custos.

const LEITOR = {
  pdfjs: 'lib/pdfjs/pdf.js',
  pdfjsWorker: 'lib/pdfjs/pdf.worker.js',
  tesseract: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
  alturaFatia: 3200,   // prints compridos são lidos às fatias
  sobreposicao: 120,
};

function carregarScript(src) {
  carregarScript.feitos ||= {};
  return carregarScript.feitos[src] ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve;
    s.onerror = () => { delete carregarScript.feitos[src]; reject(new Error('Não consegui carregar o leitor. Verifica a internet e tenta outra vez.')); };
    document.head.append(s);
  });
}

// ----- PDF -----
async function abrirPDF(f) {
  await carregarScript(LEITOR.pdfjs);
  const lib = window.pdfjsLib;
  lib.GlobalWorkerOptions.workerSrc = LEITOR.pdfjsWorker;
  return lib.getDocument({ data: new Uint8Array(await f.arrayBuffer()), isEvalSupported: false }).promise;
}

// Reconstrói as linhas do PDF a partir das posições do texto
async function textoDoPDF(pdf) {
  const linhas = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const pagina = await pdf.getPage(p);
    const { items } = await pagina.getTextContent();
    const pedacos = items.filter((i) => i.str && i.str.trim())
      .map((i) => ({ x: i.transform[4], y: i.transform[5], w: i.width, h: Math.abs(i.transform[3]) || 8, t: i.str }));
    pedacos.sort((a, b) => b.y - a.y || a.x - b.x);
    const grupos = [];
    for (const pe of pedacos) {
      const g = grupos.find((l) => Math.abs(l.y - pe.y) <= Math.max(2, pe.h * 0.35));
      if (g) g.itens.push(pe); else grupos.push({ y: pe.y, itens: [pe] });
    }
    grupos.sort((a, b) => b.y - a.y);
    for (const g of grupos) {
      g.itens.sort((a, b) => a.x - b.x);
      let s = '', fim = null;
      for (const it of g.itens) {
        if (fim !== null) s += it.x - fim > it.h * 0.9 ? '   ' : it.x - fim > it.h * 0.15 ? ' ' : '';
        s += it.t; fim = it.x + it.w;
      }
      linhas.push(s);
    }
  }
  return linhas.join('\n');
}

async function paginasPDFParaImagens(pdf) {
  const telas = [];
  for (let p = 1; p <= Math.min(pdf.numPages, 10); p++) {
    const pagina = await pdf.getPage(p);
    const vp = pagina.getViewport({ scale: 2 });
    const tela = document.createElement('canvas');
    tela.width = vp.width; tela.height = vp.height;
    const ctx = tela.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, tela.width, tela.height);
    await pagina.render({ canvasContext: ctx, viewport: vp }).promise;
    telas.push(tela);
  }
  return telas;
}

// ----- OCR (prints) -----
let trabalhadorOCR = null;
async function ocr(tela, aoProgresso) {
  await carregarScript(LEITOR.tesseract);
  if (!trabalhadorOCR) {
    aoProgresso('A preparar o leitor de imagens (só demora na primeira vez)…');
    trabalhadorOCR = await Tesseract.createWorker('por', 1, {
      logger: (m) => { if (m.status === 'recognizing text') aoProgresso(`A ler o texto… ${Math.round(m.progress * 100)}%`); },
    });
    await trabalhadorOCR.setParameters({ preserve_interword_spaces: '1' });
  }
  const { data } = await trabalhadorOCR.recognize(tela);
  return data.text || '';
}

// Prepara a imagem para o OCR: cinzento, contraste, inverte se for modo escuro, e parte em fatias
async function imagemParaTelas(f) {
  const img = await carregarImagem(f);
  const escala = img.naturalWidth < 900 ? 1.6 : img.naturalWidth > 1600 ? 1600 / img.naturalWidth : 1;
  const largura = Math.round(img.naturalWidth * escala), altura = Math.round(img.naturalHeight * escala);
  const telas = [];
  for (let y = 0; y < altura; y += LEITOR.alturaFatia - LEITOR.sobreposicao) {
    const h = Math.min(LEITOR.alturaFatia, altura - y);
    const tela = document.createElement('canvas');
    tela.width = largura; tela.height = h;
    const ctx = tela.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, y / escala, img.naturalWidth, h / escala, 0, 0, largura, h);
    const px = ctx.getImageData(0, 0, largura, h);
    const d = px.data;
    let soma = 0;
    for (let i = 0; i < d.length; i += 4) { const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; d[i] = d[i + 1] = d[i + 2] = v; soma += v; }
    if (soma / (d.length / 4) < 120) for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = 255 - d[i];
    ctx.putImageData(px, 0, 0);
    telas.push(tela);
    if (y + h >= altura) break;
  }
  return telas;
}

// Junta o texto das fatias sem repetir as linhas da zona sobreposta
function juntarFatias(textos) {
  let linhas = [];
  for (const t of textos) {
    const novas = t.split('\n');
    const norm = (s) => semAcentos(s).replace(/[^a-z0-9,]/g, '');
    let corte = 0;
    for (let k = Math.min(8, linhas.length, novas.length); k > 0; k--) {
      const fim = linhas.slice(-k).map(norm).join('|'), ini = novas.slice(0, k).map(norm).join('|');
      if (fim === ini && fim.replace(/\|/g, '')) { corte = k; break; }
    }
    linhas = linhas.concat(novas.slice(corte));
  }
  return linhas.join('\n');
}

async function textoDaImagem(f, aoProgresso) {
  const telas = await imagemParaTelas(f);
  const textos = [];
  for (const t of telas) textos.push(await ocr(t, aoProgresso));
  return juntarFatias(textos);
}

// ----- Perceber o texto -----
const MESES = { jan: 1, fev: 2, feb: 2, mar: 3, abr: 4, apr: 4, mai: 5, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, set: 9, sep: 9, out: 10, oct: 10, nov: 11, dez: 12, dec: 12 };
const RE_MES = '(jan|fev|feb|mar|abr|apr|mai|may|jun|jul|ago|aug|set|sep|out|oct|nov|dez|dec)[a-zçã]*\\.?';
// valor com 2 casas decimais (vírgula ou ponto), com sinal e € opcionais
const RE_VALOR = /(^|[\s(€:])([-+−–]\s?)?(€\s?)?(\d{1,3}(?:[.,\s '’]\d{3})+|\d+)([.,])(\d{2})(?!\d)(\s?(?:€(?!\s?[-+−–]?\d)|eur\b))?(-(?!\d))?/gi;
const RE_RECEITA = /transf(er[eê]ncia)?\.?\s*(receb|de\b|cred)|\btrf\.?\s*(de|cr)|\bcr[eé]dito\b|dep[oó]sito|sal[aá]rio|ordenado|vencimento|remunera|reembolso|devolu[cç]|estorno|refund|juros|interest|cashback|recebid|received|\bfrom\b|top.?up|carregamento|mb way.*de\b|payment from|transfer from/i;
const RE_IGNORAR = /^(saldo|total|data\b|date\b|descri|movimentos|página|page\b|iban|bic|nif|extrato|statement|balance|money (in|out)|valor|montante|débito|crédito)/i;

function anoProvavel(texto) {
  const conta = {};
  for (const m of texto.matchAll(/\b(20\d{2})\b/g)) conta[m[1]] = (conta[m[1]] || 0) + 1;
  const melhor = Object.entries(conta).sort((a, b) => b[1] - a[1])[0];
  return melhor ? +melhor[0] : new Date().getFullYear();
}

// Tira uma data do início da linha → { data, resto } (ou null)
function tirarData(linha, ano) {
  const hoje = hojeISO();
  const ajustarAno = (iso, explicito) => {
    if (!iso || explicito) return iso;
    // sem ano: se ficar no futuro (mais de 3 dias), é do ano anterior
    if (diasEntre(hoje, iso) > 3) { const d = lerData(iso); d.setFullYear(d.getFullYear() - 1); return paraISO(d); }
    return iso;
  };
  let s = linha.trim(), m;
  const rel = s.match(/^(hoje|today|agora|just now|ontem|yesterday)\b[,\s]*/i);
  if (rel) { const d = new Date(); if (/ontem|yesterday/i.test(rel[1])) d.setDate(d.getDate() - 1); return { data: paraISO(d), resto: s.slice(rel[0].length) }; }
  // "Há 3 horas", "Há 25 minutos", "Há 2 dias", "3 hours ago" (Carteira da Apple, apps de bancos)
  const ha = s.match(/^(?:h[áa]\s+(\d+|um|uma)\s+(minuto|hora|dia|semana)s?|(\d+|an?)\s+(minute|hour|day|week)s?\s+ago)\b[,\s]*/i);
  if (ha) {
    const n = /^\d+$/.test(ha[1] || ha[3]) ? +(ha[1] || ha[3]) : 1;
    const u = (ha[2] || ha[4]).toLowerCase();
    const ms = { minuto: 6e4, minute: 6e4, hora: 36e5, hour: 36e5, dia: 864e5, day: 864e5, semana: 6048e5, week: 6048e5 }[u];
    return { data: paraISO(new Date(Date.now() - n * ms)), resto: s.slice(ha[0].length) };
  }
  // Dia da semana: seguido de data ("segunda-feira, 13 de outubro") ou sozinho ("Terça-feira" = a última terça)
  const DIAS = { domingo: 0, segunda: 1, terca: 2, terga: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6, sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const ds = s.match(/^(segunda|terça|terca|terga|quarta|quinta|sexta|sábado|sabado|domingo)(-feira)?\b\.?,?\s*|^(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b\.?,?\s*/i);
  let diaSemana = null;
  if (ds) { diaSemana = DIAS[semAcentos(ds[1] || ds[3]).slice(0, ds[1] ? 7 : 3).replace(/-.*/, '')]; s = s.slice(ds[0].length); }
  const semanaSozinha = () => {
    if (diaSemana === null || diaSemana === undefined) return null;
    const d = new Date(); let volta = (d.getDay() - diaSemana + 7) % 7; if (volta === 0) volta = 7;
    d.setDate(d.getDate() - volta);
    return { data: paraISO(d), resto: s };
  };
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/))) return { data: validarISO(+m[1], +m[2], +m[3]), resto: s.slice(m[0].length) };
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?!\d)/))) {
    const a = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return { data: validarISO(a, +m[2], +m[1]), resto: s.slice(m[0].length) };
  }
  if ((m = s.match(new RegExp('^(\\d{1,2})\\s+(de\\s+)?' + RE_MES + '(,?\\s+(de\\s+)?(\\d{4}))?', 'i')))) {
    const mes = MESES[m[3].toLowerCase().slice(0, 3)];
    return { data: ajustarAno(validarISO(m[5] ? +m[5] : ano, mes, +m[1]), !!m[5]), resto: s.slice(m[0].length) };
  }
  if ((m = s.match(new RegExp('^' + RE_MES + '\\s+(\\d{1,2}),?(\\s+(\\d{4}))?', 'i')))) {
    const mes = MESES[m[1].toLowerCase().slice(0, 3)];
    return { data: ajustarAno(validarISO(m[4] ? +m[4] : ano, mes, +m[2]), !!m[4]), resto: s.slice(m[0].length) };
  }
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})(?![-/.]?\d)/))) {
    return { data: ajustarAno(validarISO(ano, +m[2], +m[1]), false), resto: s.slice(m[0].length) };
  }
  return semanaSozinha();
}

function valoresDaLinha(s) {
  // OCR às vezes come a vírgula de valores abaixo de 1 €: "040€" → "0,40€"
  s = s.replace(/(^|\s)0(\d{2})(\s?€)/g, (_, a, c, e) => `${a}0,${c}${e}`);
  const res = [];
  for (const m of s.matchAll(RE_VALOR)) {
    const inteiro = m[4].replace(/[.,\s '’]/g, '');
    let v = parseFloat(inteiro + '.' + m[6]);
    const sinal = m[2] ? (/[+]/.test(m[2]) ? 1 : -1) : m[8] ? -1 : 0;
    if (sinal < 0) v = -v;
    res.push({ v, sinal, ini: m.index + m[1].length, fim: m.index + m[0].length });
  }
  return res;
}

function limparDescricao(s) {
  return s.replace(/^(\d{1,2}[-/.]\d{1,2}([-/.]\d{2,4})?\s+)+/, '')   // 2.ª data (data-valor)
    .replace(/\b\d{1,2}:\d{2}\b/g, '').replace(/[|•·]+/g, ' ')
    .replace(/\s+/g, ' ').replace(/^[-–:,.\s]+|[-–:,.\s€]+$/g, '').trim().slice(0, 120);
}

function lerTextoExtrato(texto) {
  const ano = anoProvavel(texto);
  const itens = [];
  const marcas = [];   // linhas só com data: { pos: nº de itens antes dela, data }
  let dataGrupo = null, descPendente = '';
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/\s+/g, ' ').trim();
    if (!linha) continue;
    const d = tirarData(linha, ano);
    // tira a 2.ª data (data-valor) logo a seguir, para não ser confundida com um valor (ex.: 05.10)
    const resto = (d ? d.resto : linha).replace(/^\s*(\d{1,2}[-/.]\d{1,2}([-/.]\d{2,4})?\s+)+/, '');
    const vals = valoresDaLinha(resto);
    const ehSaldo = /saldo|balance/i.test(resto) && !/transf/i.test(resto);
    if (ehSaldo && vals.length) { itens.push({ soSaldo: true, saldo: vals[vals.length - 1].v }); descPendente = ''; continue; }
    if (d && d.data && !vals.length) {
      // linha só com data: cabeçalho de grupo (apps) ou data por baixo do movimento (Carteira da Apple)
      dataGrupo = d.data;
      marcas.push({ pos: itens.length, data: d.data });
      descPendente = limparDescricao(d.resto);
      continue;
    }
    if (!vals.length) {
      if (!RE_IGNORAR.test(linha) && !/^\d{1,2}:\d{2}/.test(linha) && /[a-zà-ú]{2}/i.test(linha)) descPendente = limparDescricao(linha);
      continue;
    }
    if (RE_IGNORAR.test(resto) && !d) continue;
    let desc = limparDescricao(resto.slice(0, vals[0].ini));
    if (desc.length < 2) desc = descPendente || desc;
    if (!desc || RE_IGNORAR.test(desc)) { if (!desc) continue; }
    const item = { dataPropria: d?.data || null, dataAntes: dataGrupo, descricao: desc, valor: Math.abs(vals.length >= 2 ? vals[vals.length - 2].v : vals[0].v),
      sinal: vals.length >= 2 ? vals[vals.length - 2].sinal : vals[0].sinal,
      saldo: vals.length >= 2 ? vals[vals.length - 1].v : null };
    if (item.valor >= 0.005) itens.push(item);
    descPendente = '';
  }

  // Datas: própria da linha; senão, se o 1.º movimento aparece antes de qualquer data, as datas vêm
  // por baixo de cada movimento (Carteira da Apple); caso contrário são cabeçalhos por cima (Revolut, etc.)
  const primeiroSemData = itens.find((it) => !it.soSaldo && !it.dataPropria);
  const datasDepois = !!primeiroSemData && !primeiroSemData.dataAntes && marcas.length > 0;
  itens.forEach((it, i) => {
    if (it.soSaldo) return;
    if (it.dataPropria) { it.data = it.dataPropria; return; }
    if (datasDepois) { const mk = marcas.find((x) => x.pos >= i + 1); it.data = mk ? mk.data : it.dataAntes; }
    else it.data = it.dataAntes;
  });
  for (let i = itens.length - 1; i >= 0; i--) if (!itens[i].soSaldo && !itens[i].data) itens.splice(i, 1);

  // Sinal pelos saldos: testa ordem cronológica (saldo sobe/desce com o movimento) e ordem inversa
  const comSaldo = itens.map((it, i) => ({ it, i })).filter(({ it }) => it.saldo !== null && it.saldo !== undefined);
  const bate = (a, b, v) => Math.abs(Math.abs(a - b) - v) < 0.011;
  let asc = 0, desc = 0;
  for (let k = 1; k < comSaldo.length; k++) {
    const atual = comSaldo[k].it, ant = comSaldo[k - 1].it;
    if (!atual.soSaldo && bate(atual.saldo, ant.saldo, atual.valor)) asc++;
    if (!ant.soSaldo && bate(ant.saldo, atual.saldo, ant.valor)) desc++;
  }
  const crescente = asc >= desc;
  for (let k = 0; k < comSaldo.length; k++) {
    const { it } = comSaldo[k];
    if (it.soSaldo || it.sinal) continue;
    const vizinho = crescente ? comSaldo[k - 1]?.it : comSaldo[k + 1]?.it;
    if (vizinho && bate(it.saldo, vizinho.saldo, it.valor)) it.sinal = it.saldo > vizinho.saldo ? 1 : -1;
  }

  const movimentos = itens.filter((it) => !it.soSaldo).map((it) => {
    const tipo = it.sinal > 0 || (!it.sinal && RE_RECEITA.test(it.descricao)) ? 'receita' : 'despesa';
    return { data: it.data, descricao: it.descricao, valor: arred(it.valor), tipo, categoria: sugerirCategoria(tipo, it.descricao) };
  });
  const saldos = comSaldo.map(({ it }) => it.saldo);
  const saldoFinal = saldos.length ? (crescente ? saldos[saldos.length - 1] : saldos[0]) : null;
  return { movimentos, saldoFinal };
}
