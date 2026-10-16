// ── Service worker + actualización automática ──
// 1) Registra el service worker (abrir sin señal y arrancar más rápido).
// 2) Actualiza la app sola (ver abajo). No hay botón de instalar: el acceso directo se agrega desde el navegador.
(function () {
  function $(id) { return document.getElementById(id); }
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }

  // ── Actualización automática ──
  // Al abrir la app, al volver a ella y cada minuto se compara la compilación publicada con la que corre. Si hay una más nueva
  // se actualiza SOLA en cuanto no haya nada a medias (sin ventanas abiertas, sin escribir y sin medidas ni producto en el
  // formulario). El presupuesto ya vive en el teléfono; el cliente y el NIT se restauran después de recargar. Si el usuario está
  // en medio de algo se muestra un aviso discreto y se actualiza apenas termine.
  var nuevaBuild = 0, aviso2 = null;
  function enProgreso() {
    var a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return true;
    if (document.querySelector('.modal:not(.hidden), .pk-ov, #pdfOverlay')) return true;
    var v = function (id) { var e = $(id); return !!(e && String(e.value || '').trim()); };
    return v('cotAncho') || v('cotLargo') || v('cotTelaSelect') || v('cotSacoSelect') || v('cotCantSaco');
  }
  function recargar() {
    try { sessionStorage.setItem('cotRestaurar', JSON.stringify({ c: ($('cotCliente') || {}).value || '', n: ($('cotNit') || {}).value || '' })); } catch (e) {}
    var go = function () { location.reload(); };
    if ('caches' in window) caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }).then(go, go); else go();
  }
  function aplicar() {
    if (!nuevaBuild) return;
    if (!enProgreso()) { recargar(); return; }
    if (aviso2) return;
    aviso2 = document.createElement('div');
    aviso2.setAttribute('role', 'status');
    aviso2.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(86px + env(safe-area-inset-bottom));z-index:99998;background:#1a6b45;color:#fff;border-radius:16px;padding:12px 16px;display:flex;gap:12px;align-items:center;box-shadow:0 6px 24px rgba(0,0,0,.3);font-size:16px;font-weight:600;';
    aviso2.innerHTML = '<span style="flex:1">Hay una versión nueva (compilación ' + nuevaBuild + '). Se actualizará sola al terminar.</span><button type="button" style="min-height:44px;padding:0 16px;border:0;border-radius:12px;background:#fff;color:#1a6b45;font-size:16px;font-weight:800">Ahora</button>';
    aviso2.querySelector('button').onclick = recargar;
    document.body.appendChild(aviso2);
  }
  function buscarNueva() {
    if (document.visibilityState === 'hidden' || !window.APP_VERSION) return;
    if (nuevaBuild) { aplicar(); return; }
    fetch('version.js?c=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) {
      var m = /build:\s*(\d+)/.exec(t || ''); if (!m || +m[1] <= (window.APP_VERSION.build || 0)) return;
      nuevaBuild = +m[1]; aplicar();
    }).catch(function () {});
  }
  // Restaura el cliente tras una actualización automática
  window.addEventListener('load', function () {
    try {
      var r = JSON.parse(sessionStorage.getItem('cotRestaurar') || 'null'); sessionStorage.removeItem('cotRestaurar');
      if (r && (r.c || r.n)) setTimeout(function () {
        if ($('cotCliente') && !$('cotCliente').value) $('cotCliente').value = r.c || '';
        if ($('cotNit') && !$('cotNit').value) $('cotNit').value = r.n || '';
        if ($('cotCliente')) $('cotCliente').dispatchEvent(new Event('change', { bubbles: true }));
        if (window.compactarCliente && r.c) compactarCliente();
      }, 400);
    } catch (e) {}
    setTimeout(buscarNueva, 2500);
    setInterval(buscarNueva, 60000);
  });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') buscarNueva(); });
})();
