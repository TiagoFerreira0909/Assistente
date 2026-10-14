// =====================================================
//  Cópia de segurança: exportar e repor os dados
// =====================================================
// O ficheiro é um JSON com todas as tabelas locais. Ao repor, nada é apagado:
// os registos que faltam são acrescentados e, quando o mesmo registo existe nos dois lados,
// fica a versão mais recente (pelo _t). Como os ids são os mesmos, juros e cobranças
// automáticas (ids determinísticos) nunca ficam duplicados.
const Copia = (() => {
  const FORMATO = 1;

  async function criar() {
    const dados = {};
    for (const t of DB.TABELAS) dados[t] = await DB.todos(t);
    return { app: 'assistente', formato: FORMATO, versaoApp: VERSAO_APP, criadaEm: new Date().toISOString(), dados };
  }

  function contar(copia) {
    return DB.TABELAS.reduce((n, t) => n + (copia.dados[t] || []).length, 0);
  }

  function ficheiro(copia) {
    const nome = `assistente-copia-${hojeISO()}.json`;
    return new File([JSON.stringify(copia)], nome, { type: 'application/json' });
  }

  // No iPhone abre a folha de partilha ("Guardar em Ficheiros", iCloud, email…);
  // noutros browsers descarrega o ficheiro.
  async function guardarFicheiro(f) {
    if (navigator.canShare && navigator.canShare({ files: [f] })) {
      try { await navigator.share({ files: [f], title: 'Cópia do Assistente' }); }
      catch (e) { if (e.name === 'AbortError') return false; throw e; }
    } else {
      const url = URL.createObjectURL(f);
      const a = el('a', { href: url, download: f.name });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
    try { localStorage.setItem('ultimaCopia', Date.now()); } catch {}
    return true;
  }

  // Lê e valida o ficheiro escolhido
  async function ler(f) {
    let copia;
    try { copia = JSON.parse(await f.text()); } catch { throw new Error('Este ficheiro não é uma cópia do Assistente.'); }
    if (!copia || copia.app !== 'assistente' || typeof copia.dados !== 'object') throw new Error('Este ficheiro não é uma cópia do Assistente.');
    if (copia.formato > FORMATO) throw new Error('Esta cópia foi feita por uma versão mais recente da app. Atualiza a app primeiro.');
    return copia;
  }

  // Compara com o que está no aparelho (sem gravar nada)
  async function analisar(copia) {
    const r = { novos: [], atualizados: [], iguais: 0 };
    for (const t of DB.TABELAS) {
      for (const obj of copia.dados[t] || []) {
        if (!obj || obj.id === undefined || obj.id === null) continue;
        const local = await DB.um(t, obj.id);
        if (!local) r.novos.push([t, obj]);
        else if ((obj._t || 0) > (local._t || 0)) r.atualizados.push([t, obj]);
        else r.iguais++;
      }
    }
    return r;
  }

  async function repor(analise) {
    for (const [t, obj] of [...analise.novos, ...analise.atualizados]) await DB.restaurar(t, obj);
    DB.avisarMudanca(); // envia para a nuvem (se houver conta)
  }

  return { criar, contar, ficheiro, guardarFicheiro, ler, analisar, repor };
})();

// Bloco "Cópia de segurança" (na folha da Conta)
function zonaCopia() {
  const caixa = el('div');
  const texto = el('div', { class: 'ajuda', style: 'margin:0 4px 10px' });
  const exportar = el('button', { class: 'btn claro largo' }, 'Exportar dados');
  const escolher = el('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
  const importar = el('button', { class: 'btn claro largo' }, 'Repor a partir de um ficheiro');
  const resultado = el('div', { class: 'ajuda', style: 'margin:0 4px 10px' });
  caixa.append(texto, exportar, importar, escolher, resultado);

  const ultima = +localStorage.getItem('ultimaCopia');
  texto.textContent = (Nuvem.sessao
    ? 'Os dados já ficam na nuvem, mas podes guardar também uma cópia num ficheiro (por ex. em Ficheiros → iCloud Drive).'
    : 'Sem conta, os dados só existem neste aparelho: se apagares a app, perdem-se. Guarda uma cópia num ficheiro (por ex. em Ficheiros → iCloud Drive).')
    + (ultima ? ` Última cópia: ${dataCurta(ultima)}.` : ' Ainda não fizeste nenhuma cópia.');

  // O ficheiro é preparado logo ao abrir: o iPhone só deixa abrir a partilha
  // imediatamente a seguir ao toque, sem esperas pelo meio.
  let pronto = null;
  Copia.criar().then((c) => { pronto = c; });

  exportar.onclick = async () => {
    const copia = pronto || await Copia.criar();
    try {
      const ok = await Copia.guardarFicheiro(Copia.ficheiro(copia));
      if (ok) resultado.textContent = `✅ Cópia com ${Copia.contar(copia)} registos.`;
    } catch (x) { resultado.textContent = 'Não foi possível guardar: ' + x.message; }
  };

  importar.onclick = () => { escolher.value = ''; escolher.click(); };
  escolher.onchange = async () => {
    const f = escolher.files[0];
    if (!f) return;
    resultado.textContent = 'A ler…';
    try {
      const copia = await Copia.ler(f);
      const a = await Copia.analisar(copia);
      const total = a.novos.length + a.atualizados.length;
      const quando = copia.criadaEm ? dataCurta(Date.parse(copia.criadaEm)) : 'data desconhecida';
      if (!total) { resultado.textContent = `Cópia de ${quando}: já tens tudo o que lá está. Nada a repor.`; return; }
      const msg = `Cópia de ${quando}.\n\n`
        + `${a.novos.length} registo(s) em falta vão ser acrescentados`
        + (a.atualizados.length ? ` e ${a.atualizados.length} vão ser substituídos pela versão mais recente da cópia` : '')
        + '.\n\nNada é apagado. Continuar?';
      if (!confirm(msg)) { resultado.textContent = ''; return; }
      await Copia.repor(a);
      resultado.textContent = `✅ Reposto: ${a.novos.length} acrescentado(s)`
        + (a.atualizados.length ? `, ${a.atualizados.length} atualizado(s)` : '') + '.';
      // Regista juros/cobranças que entretanto tenham ficado em atraso (ids determinísticos, sem duplicar)
      try { await verificarDepositos(); await verificarSubscricoes(); } catch {}
      folha.addEventListener('close', () => redesenhar(), { once: true });
    } catch (x) { resultado.textContent = x.message; }
  };
  return caixa;
}
