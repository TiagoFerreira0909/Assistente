// Arranque da app
(() => {
  let ultima = 'inicio';
  try { ultima = localStorage.getItem('ultimaVista') || 'inicio'; } catch {}
  irPara(VISTAS[ultima] ? ultima : 'inicio');
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
})();
