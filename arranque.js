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
  else Nuvem.sincronizar();

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
})();
