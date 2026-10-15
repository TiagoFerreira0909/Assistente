// =====================================================
//  Nuvem (Supabase): login e sincronização dos dados
// =====================================================
const NUVEM = {
  url: 'https://putvpneoexwblbbqemer.supabase.co',
  // Chave pública: pode estar no código, a segurança está nas regras da base de dados
  chave: 'sb_publishable_rtIQLaakc9LH2c2PRuQTcA_AgpMYizi',
  app: 'https://tiagoferreira0909.github.io/Assistente/',
};

const Nuvem = (() => {
  const ls = {
    ler(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    gravar(k, v) { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  let sessao = ls.ler('sessao');
  let estado = 'parado'; // parado | a sincronizar | erro | offline
  let ultimoErro = '';
  const ouvintes = [];
  const avisar = () => ouvintes.forEach((f) => f(estado));

  async function pedido(caminho, { metodo = 'GET', corpo, token, extra = {} } = {}) {
    const cab = { apikey: NUVEM.chave, 'Content-Type': 'application/json', ...extra };
    if (token) cab.Authorization = 'Bearer ' + token;
    const r = await fetch(NUVEM.url + caminho, { method: metodo, headers: cab, body: corpo ? JSON.stringify(corpo) : undefined });
    const texto = await r.text();
    let dados = null; try { dados = texto ? JSON.parse(texto) : null; } catch { dados = texto; }
    if (!r.ok) {
      const msg = (dados && (dados.msg || dados.message || dados.error_description || dados.error)) || `Erro ${r.status}`;
      const e = new Error(traduzir(msg)); e.status = r.status; throw e;
    }
    return dados;
  }

  function traduzir(msg) {
    const m = String(msg);
    if (/Invalid login credentials/i.test(m)) return 'Email ou palavra-passe errados.';
    if (/Email not confirmed/i.test(m)) return 'Ainda não confirmaste o email. Vê a tua caixa de correio.';
    if (/User already registered/i.test(m)) return 'Já existe uma conta com este email. Usa "Entrar".';
    if (/Password should be at least/i.test(m)) return 'A palavra-passe tem de ter pelo menos 6 caracteres.';
    if (/rate limit|too many/i.test(m)) return 'Demasiadas tentativas. Espera um pouco e tenta outra vez.';
    if (/valid email|invalid format/i.test(m)) return 'O email não é válido.';
    return m;
  }

  function guardarSessao(d) {
    sessao = {
      access_token: d.access_token,
      refresh_token: d.refresh_token,
      expira: Date.now() + (d.expires_in || 3600) * 1000,
      email: d.user?.email || sessao?.email,
      userId: d.user?.id || sessao?.userId,
    };
    ls.gravar('sessao', sessao);
  }

  // Renova a sessão uma só vez mesmo que vários pedidos precisem dela ao mesmo tempo
  // (duas renovações em paralelo com o mesmo refresh_token podiam invalidar a sessão)
  let renovacao = null;
  async function token() {
    if (!sessao) return null;
    if (Date.now() < sessao.expira - 60000) return sessao.access_token;
    if (!renovacao) {
      renovacao = (async () => {
        try {
          const d = await pedido('/auth/v1/token?grant_type=refresh_token', { metodo: 'POST', corpo: { refresh_token: sessao.refresh_token } });
          guardarSessao(d);
          return sessao.access_token;
        } catch (e) {
          if (e.status === 400 || e.status === 401) sessaoExpirou();
          throw e;
        }
      })().finally(() => { renovacao = null; });
    }
    return renovacao;
  }

  // A sessão deixou de ser válida: pede para entrar outra vez, mas NÃO apaga os dados do aparelho
  // (podem ter alterações ainda por enviar; ao voltar a entrar com a mesma conta são enviadas)
  function sessaoExpirou() {
    if (sessao?.userId) ls.gravar('ultimoUtilizador', sessao.userId);
    sessao = null;
    ls.gravar('sessao', null); ls.gravar('ultimaSync', null);
    estado = 'parado'; avisar();
    if (typeof ecraLogin === 'function' && !document.querySelector('.login')) {
      ecraLogin();
      const e = document.querySelector('.login .erro');
      if (e) e.textContent = 'A sessão terminou. Entra outra vez para continuar a sincronizar (os teus dados continuam no aparelho).';
    }
  }

  // ----- Conta -----
  async function entrar(email, palavra) {
    const d = await pedido('/auth/v1/token?grant_type=password', { metodo: 'POST', corpo: { email, password: palavra } });
    await comecarSessao(d);
  }
  async function registar(email, palavra) {
    const d = await pedido('/auth/v1/signup?redirect_to=' + encodeURIComponent(NUVEM.app), { metodo: 'POST', corpo: { email, password: palavra } });
    if (d && d.access_token) { await comecarSessao(d); return 'entrou'; }
    return 'confirmar';
  }
  async function recuperar(email) {
    await pedido('/auth/v1/recover?redirect_to=' + encodeURIComponent(NUVEM.app), { metodo: 'POST', corpo: { email } });
  }
  async function mudarPalavra(palavra) {
    await pedido('/auth/v1/user', { metodo: 'PUT', corpo: { password: palavra }, token: await token() });
  }
  async function comecarSessao(d) {
    const antes = sessao?.userId || ls.ler('ultimoUtilizador');
    guardarSessao(d);
    ls.gravar('ultimoUtilizador', null);
    if (antes && antes !== sessao.userId) { await DB.limparTudo(); ls.gravar('ultimaSync', null); }
    // Primeira vez neste aparelho: envia o que já existe localmente
    if (!ls.ler('ultimaSync')) await DB.marcarTudoPendente();
    ls.gravar('semConta', null);
    sincronizar();
  }
  async function sair(silencioso) {
    if (!silencioso) {
      try { await sincronizar(); } catch {}
      try { await pedido('/auth/v1/logout', { metodo: 'POST', token: sessao?.access_token }); } catch {}
    }
    sessao = null;
    ls.gravar('sessao', null); ls.gravar('ultimaSync', null);
    await DB.limparTudo();
    estado = 'parado'; avisar();
  }

  // Quando a pessoa abre o link do email (confirmação ou recuperar palavra-passe)
  async function lerLinkDoEmail() {
    const h = new URLSearchParams(location.hash.slice(1));
    if (h.get('error_description')) {
      history.replaceState(null, '', location.pathname);
      return { erro: h.get('error_description').replace(/\+/g, ' ') };
    }
    if (!h.get('access_token')) return null;
    const d = { access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_in: +h.get('expires_in') || 3600 };
    history.replaceState(null, '', location.pathname);
    try { d.user = await pedido('/auth/v1/user', { token: d.access_token }); } catch {}
    await comecarSessao(d);
    return { tipo: h.get('type') };
  }

  // ----- Sincronização -----
  let aCorrer = null, deNovo = false;
  function sincronizar() {
    if (!sessao) return Promise.resolve();
    if (aCorrer) { deNovo = true; return aCorrer; }
    aCorrer = correr().finally(() => {
      aCorrer = null;
      if (deNovo) { deNovo = false; sincronizar(); }
    });
    return aCorrer;
  }

  async function correr() {
    if (!navigator.onLine) { estado = 'offline'; avisar(); return; }
    estado = 'a sincronizar'; avisar();
    let mudou = false;
    try {
      const t = await token();
      if (!t) { estado = 'parado'; avisar(); return; }

      // 1) Receber o que mudou na nuvem
      let desde = ls.ler('ultimaSync');
      const pend = Object.fromEntries((await DB.pendentes()).map((p) => [p.chave, p]));
      for (;;) {
        let q = '/rest/v1/registos?select=tabela,id,dados,atualizado,apagado,servidor_em&order=servidor_em.asc&limit=500';
        if (desde) q += '&servidor_em=gt.' + encodeURIComponent(desde);
        const linhas = await pedido(q, { token: t });
        for (const r of linhas) {
          desde = r.servidor_em;
          if (!DB.TABELAS.includes(r.tabela)) continue;
          const chave = `${r.tabela}:${r.id}`;
          const p = pend[chave];
          if (p && p.atualizado > r.atualizado) continue; // a versão local é mais recente
          if (p) { await DB.tirarPendente(chave); delete pend[chave]; }
          const local = await DB.um(r.tabela, r.id);
          if (r.apagado) { if (local) { await DB.apagarLocal(r.tabela, r.id); mudou = true; } }
          else if (!local || (local._t || 0) < r.atualizado || JSON.stringify(local) !== JSON.stringify({ ...r.dados, _t: r.atualizado })) {
            await DB.gravarLocal(r.tabela, { ...r.dados, _t: r.atualizado }); mudou = true;
          }
        }
        ls.gravar('ultimaSync', desde);
        if (linhas.length < 500) break;
      }

      // 2) Enviar o que mudou aqui
      const enviar = Object.values(pend);
      for (let i = 0; i < enviar.length; i += 200) {
        const lote = enviar.slice(i, i + 200);
        const linhas = [];
        for (const p of lote) {
          const obj = p.apagado ? null : await DB.um(p.tabela, p.id);
          linhas.push({ tabela: p.tabela, id: p.id, dados: obj, atualizado: p.atualizado, apagado: p.apagado || !obj });
        }
        await pedido('/rest/v1/registos?on_conflict=user_id,tabela,id', {
          metodo: 'POST', corpo: linhas, token: t,
          extra: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        });
        // Só tira dos pendentes se não houve outra alteração entretanto
        const atuais = Object.fromEntries((await DB.pendentes()).map((p) => [p.chave, p]));
        for (const p of lote) if (atuais[p.chave]?.atualizado === p.atualizado) await DB.tirarPendente(p.chave);
      }
      estado = 'parado'; ultimoErro = '';
      try { localStorage.setItem('sincronizadoEm', Date.now()); } catch {}
    } catch (e) {
      estado = navigator.onLine ? 'erro' : 'offline'; ultimoErro = e.message;
    }
    avisar();
    if (mudou && typeof redesenhar === 'function' && !document.querySelector('dialog[open]')) redesenhar();
  }

  // Sincroniza depois de cada alteração (com um pequeno atraso para juntar várias)
  let espera;
  DB.aoMudar(() => { clearTimeout(espera); espera = setTimeout(sincronizar, 1200); });
  window.addEventListener('online', () => sincronizar());
  window.addEventListener('offline', () => { estado = 'offline'; avisar(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sincronizar(); });
  setInterval(() => { if (document.visibilityState === 'visible') sincronizar(); }, 60000);

  // ----- Notificações (Web Push) -----
  const FUNCAO = NUVEM.url + '/functions/v1/avisos';
  function paraBytes(b64) {
    const p = '='.repeat((4 - b64.length % 4) % 4);
    const raw = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }
  const notif = {
    suportado: () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
    instalada: () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches,
    async estado() {
      if (!notif.suportado()) return 'nao-suportado';
      if (Notification.permission === 'denied') return 'bloqueado';
      const reg = await navigator.serviceWorker.ready;
      return (await reg.pushManager.getSubscription()) ? 'ativo' : 'inativo';
    },
    async ativar() {
      if (!sessao) throw new Error('Entra na tua conta primeiro.');
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') throw new Error('Não deste autorização às notificações.');
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const { publica } = await (await fetch(FUNCAO + '?chave=1')).json();
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: paraBytes(publica) });
      }
      await pedido('/rest/v1/subscricoes?on_conflict=endpoint', {
        metodo: 'POST', token: await token(),
        corpo: { endpoint: sub.endpoint, dados: sub.toJSON() },
        extra: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      });
      return notif.testar();
    },
    async testar() {
      const r = await fetch(FUNCAO + '?teste=1', { headers: { Authorization: 'Bearer ' + await token() } });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Falhou o teste');
      return d.enviadas;
    },
    async desativar() {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;
      try { await pedido('/rest/v1/subscricoes?endpoint=eq.' + encodeURIComponent(sub.endpoint), { metodo: 'DELETE', token: await token() }); } catch {}
      await sub.unsubscribe();
    },
  };

  return {
    notif,
    entrar, registar, recuperar, mudarPalavra, sair, sincronizar, lerLinkDoEmail, token,
    get sessao() { return sessao; },
    get estado() { return estado; },
    get erro() { return ultimoErro; },
    aoMudarEstado: (f) => ouvintes.push(f),
    semConta: () => ls.ler('semConta'),
    usarSemConta: () => ls.gravar('semConta', true),
  };
})();

// =====================================================
//  Ecrãs de conta
// =====================================================

function ecraLogin() {
  const caixa = el('div', { class: 'login' });
  let modo = 'entrar';
  const email = el('input', { type: 'email', autocomplete: 'email', placeholder: 'Email', inputmode: 'email', autocapitalize: 'off' });
  const palavra = el('input', { type: 'password', autocomplete: 'current-password', placeholder: 'Palavra-passe' });
  const erro = el('div', { class: 'erro' });
  const info = el('div', { class: 'info' });
  const botao = el('button', { class: 'btn largo', type: 'submit' }, 'Entrar');
  const esqueci = el('button', { type: 'button', class: 'link' }, 'Esqueci-me da palavra-passe');
  const seg = segmentos([['entrar', 'Entrar'], ['criar', 'Criar conta']], 'entrar', (v) => {
    modo = v; erro.textContent = ''; info.textContent = '';
    botao.textContent = v === 'entrar' ? 'Entrar' : 'Criar conta';
    palavra.autocomplete = v === 'entrar' ? 'current-password' : 'new-password';
    esqueci.style.display = v === 'entrar' ? '' : 'none';
  });

  const form = el('form', {}, seg, campo(null, email), campo(null, palavra), erro, info, botao, esqueci);
  form.onsubmit = async (e) => {
    e.preventDefault();
    erro.textContent = ''; info.textContent = '';
    const em = email.value.trim(), pw = palavra.value;
    if (!em || !pw) { erro.textContent = 'Preenche o email e a palavra-passe.'; return; }
    botao.disabled = true; botao.textContent = 'Aguarda…';
    try {
      if (modo === 'entrar') { await Nuvem.entrar(em, pw); fecharLogin(); }
      else {
        const r = await Nuvem.registar(em, pw);
        if (r === 'entrou') fecharLogin();
        else info.textContent = 'Conta criada! Enviámos-te um email: abre o link para confirmar e depois entra aqui.';
      }
    } catch (x) { erro.textContent = navigator.onLine ? x.message : 'Sem internet. Liga-te e tenta outra vez.'; }
    botao.disabled = false; botao.textContent = modo === 'entrar' ? 'Entrar' : 'Criar conta';
  };
  esqueci.onclick = async () => {
    const em = email.value.trim();
    if (!em) { erro.textContent = 'Escreve o teu email primeiro.'; return; }
    try { await Nuvem.recuperar(em); info.textContent = 'Enviámos-te um email com um link para mudares a palavra-passe.'; erro.textContent = ''; }
    catch (x) { erro.textContent = x.message; }
  };

  caixa.append(
    el('img', { src: 'icons/icon-180.png', alt: '', class: 'login-icone' }),
    el('h1', {}, 'Assistente'),
    el('p', { class: 'suave' }, 'Entra para guardares os teus dados na nuvem e os teres em qualquer aparelho.'),
    form,
    el('button', { type: 'button', class: 'link suave', onclick: () => { Nuvem.usarSemConta(); fecharLogin(); } }, 'Continuar sem conta'),
  );
  document.body.append(caixa);
  document.body.classList.add('com-login');
}
function fecharLogin() {
  document.querySelector('.login')?.remove();
  document.body.classList.remove('com-login');
  atualizarBotaoConta();
  redesenhar();
}

function abrirMinhaConta() {
  const s = Nuvem.sessao;
  if (!s) {
    abrirFolha({
      titulo: 'Conta',
      corpo: el('div', {},
        el('div', { class: 'ajuda', style: 'margin:0 4px 10px' }, 'Estás a usar a app sem conta. Com conta, os dados ficam guardados na nuvem e em qualquer aparelho.'),
        el('button', { class: 'btn largo', onclick: () => { folha.close(); ecraLogin(); } }, 'Entrar ou criar conta'),
        el('div', { class: 'secao' }, el('h2', {}, 'Cópia de segurança')),
        zonaCopia(),
        el('div', { class: 'ajuda', style: 'text-align:center;margin-top:8px' }, `Versão ${VERSAO_APP}`),
      ),
    });
    return;
  }
  const estado = el('div', { class: 'ajuda' });
  const mostrarEstado = () => {
    const quando = +localStorage.getItem('sincronizadoEm');
    estado.textContent = Nuvem.estado === 'a sincronizar' ? 'A sincronizar…'
      : Nuvem.estado === 'offline' ? 'Sem internet — as alterações são enviadas quando voltares a ter rede.'
      : Nuvem.estado === 'erro' ? 'Erro ao sincronizar: ' + Nuvem.erro
      : quando ? 'Sincronizado ' + dataCurta(quando) : 'Sincronizado';
  };
  mostrarEstado();
  Nuvem.aoMudarEstado(mostrarEstado);

  const novaPw = el('input', { type: 'password', autocomplete: 'new-password', placeholder: 'Nova palavra-passe' });
  abrirFolha({
    titulo: 'Conta',
    corpo: el('div', {},
      el('div', { class: 'lista' }, el('div', { class: 'linha' },
        el('div', { class: 'icone' }, '👤'),
        el('div', { class: 'meio' }, el('b', {}, s.email || 'A tua conta'), estado))),
      el('button', { class: 'btn claro largo', onclick: () => Nuvem.sincronizar() }, 'Sincronizar agora'),
      el('div', { class: 'secao' }, el('h2', {}, 'Notificações')),
      zonaNotificacoes(),
      el('div', { class: 'secao' }, el('h2', {}, 'Cópia de segurança')),
      zonaCopia(),
      el('div', { class: 'secao' }, el('h2', {}, 'Mudar palavra-passe')),
      campo(null, novaPw),
      el('button', { class: 'btn claro largo', onclick: async (e) => {
        try {
          if (novaPw.value.length < 6) throw new Error('Mínimo 6 caracteres.');
          await Nuvem.mudarPalavra(novaPw.value); novaPw.value = ''; e.target.textContent = 'Palavra-passe mudada ✓';
        } catch (x) { e.target.textContent = x.message; }
      } }, 'Guardar nova palavra-passe'),
      el('button', { class: 'btn perigo', onclick: async () => {
        if (!confirm('Terminar sessão? Os dados ficam guardados na nuvem e saem deste aparelho.')) return;
        folha.close(); await Nuvem.sair(); ecraLogin(); redesenhar();
      } }, 'Terminar sessão'),
      el('div', { class: 'ajuda', style: 'text-align:center;margin-top:8px' }, `Versão ${VERSAO_APP}`),
    ),
  });
}

function folhaNovaPalavra() {
  const pw = el('input', { type: 'password', autocomplete: 'new-password', placeholder: 'Nova palavra-passe' });
  abrirFolha({
    titulo: 'Nova palavra-passe',
    corpo: el('div', {}, campo(null, pw, 'Mínimo 6 caracteres.')),
    guardar: async () => {
      if (pw.value.length < 6) return 'A palavra-passe tem de ter pelo menos 6 caracteres.';
      try { await Nuvem.mudarPalavra(pw.value); } catch (x) { return x.message; }
    },
  });
}

// Botão da conta no topo (mostra também o estado da sincronização)
const botaoConta = el('button', { class: 'conta-btn', 'aria-label': 'Conta', onclick: () => abrirMinhaConta() });
document.querySelector('.topo').append(botaoConta);
function atualizarBotaoConta() {
  const s = Nuvem.sessao;
  botaoConta.textContent = s ? (s.email || '?').charAt(0).toUpperCase() : '👤';
  botaoConta.dataset.estado = s ? Nuvem.estado : 'sem-conta';
}
Nuvem.aoMudarEstado(atualizarBotaoConta);

// Bloco de notificações (na folha da Conta)
function zonaNotificacoes() {
  const caixa = el('div');
  const texto = el('div', { class: 'ajuda', style: 'margin:0 4px 10px' });
  const botao = el('button', { class: 'btn claro largo' });
  const extra = el('button', { class: 'link', style: 'width:100%' });
  caixa.append(texto, botao, extra);

  async function desenhar() {
    extra.style.display = 'none'; botao.style.display = '';
    const iOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (iOS && !Nuvem.notif.instalada()) {
      texto.textContent = 'No iPhone, as notificações só funcionam quando abres a app a partir do ícone no ecrã principal.';
      botao.style.display = 'none'; return;
    }
    const e = await Nuvem.notif.estado();
    if (e === 'nao-suportado') { texto.textContent = 'Este aparelho/browser não suporta notificações.'; botao.style.display = 'none'; return; }
    if (e === 'bloqueado') { texto.textContent = 'As notificações estão bloqueadas. Ativa-as nas Definições do iPhone → Notificações → Assistente.'; botao.style.display = 'none'; return; }
    if (e === 'ativo') {
      texto.textContent = '✅ Ativas neste aparelho. Recebes os lembretes com aviso, as cobranças das subscrições e os avisos dos depósitos a prazo.';
      botao.textContent = 'Enviar notificação de teste';
      botao.onclick = async () => {
        botao.textContent = 'A enviar…';
        try { const n = await Nuvem.notif.testar(); botao.textContent = n ? 'Enviada ✓' : 'Não foi enviada — tenta desligar e ligar'; }
        catch (x) { botao.textContent = x.message; }
      };
      extra.style.display = ''; extra.textContent = 'Desligar notificações neste aparelho';
      extra.onclick = async () => { await Nuvem.notif.desativar(); desenhar(); };
      return;
    }
    texto.textContent = 'Recebe no telemóvel os lembretes à hora marcada e os avisos de depósitos e subscrições, mesmo com a app fechada.';
    botao.textContent = 'Ativar notificações';
    botao.onclick = async () => {
      botao.textContent = 'A ativar…';
      try { await Nuvem.notif.ativar(); agendarLembretesLocais(); await desenhar(); }
      catch (x) { botao.textContent = 'Ativar notificações'; texto.textContent = x.message; }
    };
  }
  desenhar();
  return caixa;
}
