// Arranque da app
(async () => {
  let ultima = 'inicio';
  try { ultima = localStorage.getItem('ultimaVista') || 'inicio'; } catch {}

  // Veio de um link do email (confirmação de conta ou recuperar palavra-passe)?
  let link = null;
  try { link = await Nuvem.lerLinkDoEmail(); } catch {}

  atualizarBotaoConta();
  await irPara(VISTAS[ultima] ? ultima : 'inicio');

  if (link?.erro) { ecraLogin(); document.querySelector('.login .erro').textContent = 'O link do email expirou ou já foi usado. Entra ou pede outro.'; }
  else if (link?.tipo === 'recovery') folhaNovaPalavra();
  else if (!Nuvem.sessao && !Nuvem.semConta()) ecraLogin();

  // Depósitos a prazo: depois de sincronizar, regista juros dos que terminaram
  async function depositos() {
    try { if (Nuvem.sessao) await Nuvem.sincronizar(); } catch {}
    const a = await verificarDepositos();
    const b = await verificarSubscricoes();
    if ((a || b) && !document.querySelector('dialog[open]')) redesenhar();
  }
  depositos();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') depositos(); });

  if ('serviceWorker' in navigator) {
    const tinhaVersao = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').then((r) => r.update()).catch(() => {});
    // Quando chega uma versão nova da app, recarrega (só se não houver um formulário aberto)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!tinhaVersao) return;
      if (document.querySelector('dialog[open]')) folha.addEventListener('close', () => location.reload(), { once: true });
      else location.reload();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') navigator.serviceWorker.getRegistration().then((r) => r && r.update()).catch(() => {});
    });
  }
})();
