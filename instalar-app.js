// ── Instalar el cotizador en el teléfono ──
// 1) Registra el service worker (permite instalar, abrir sin señal y arrancar más rápido).
// 2) Muestra «Instalar en el teléfono» en el menú Más mientras NO esté instalada:
//    · Android/Chrome: abre el aviso de instalación del sistema.
//    · iPhone/iPad: Safari no permite instalar desde un botón; se muestran los 3 pasos en pantalla.
(function () {
  function $(id) { return document.getElementById(id); }
  var enApp = !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
  var esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var esMovil = esIOS || /Android/i.test(navigator.userAgent);
  var aviso = null;

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }

  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); aviso = e; mostrar(); });
  window.addEventListener('appinstalled', function () { aviso = null; mostrar(); try { toast('Cotizador instalado en tu teléfono'); } catch (e) {} });

  function mostrar() {
    var it = $('navInstalar'); if (!it) return;
    it.hidden = enApp || !esMovil;           // ya instalada, o computadora: no hace falta
  }

  window.instalarApp = function () {
    if (aviso) {
      aviso.prompt();
      aviso.userChoice.then(function () { aviso = null; mostrar(); });
      return;
    }
    var pasos = esIOS
      ? ['Abre esta página en <b>Safari</b> (no dentro de otra app).', 'Toca el botón <b>Compartir</b> (el cuadro con una flecha hacia arriba).', 'Baja y toca <b>Agregar a inicio</b>, luego <b>Agregar</b>.']
      : ['Toca el menú <b>⋮</b> de Chrome (arriba a la derecha).', 'Toca <b>Instalar app</b> o <b>Agregar a pantalla principal</b>.', 'Confirma con <b>Instalar</b>.'];
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center;';
    ov.innerHTML = '<div role="dialog" aria-modal="true" aria-label="Instalar en el teléfono" style="width:100%;max-width:520px;background:#fff;border-radius:22px 22px 0 0;padding:20px 20px calc(20px + env(safe-area-inset-bottom));font-family:inherit;">'
      + '<div style="font-size:21px;font-weight:800;color:#1a6b45;margin-bottom:6px">Instalar en el teléfono</div>'
      + '<div style="font-size:16px;color:#555;margin-bottom:12px">Se abre como una app, a pantalla completa y con su propio ícono.</div>'
      + pasos.map(function (t, i) { return '<div style="display:flex;gap:12px;align-items:flex-start;margin:10px 0;font-size:18px;line-height:1.35"><span style="flex:none;width:32px;height:32px;border-radius:50%;background:#1a6b45;color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center">' + (i + 1) + '</span><span>' + t + '</span></div>'; }).join('')
      + '<button type="button" style="width:100%;min-height:56px;margin-top:10px;border:0;border-radius:14px;background:#1a6b45;color:#fff;font-size:18px;font-weight:700">Entendido</button></div>';
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.tagName === 'BUTTON') ov.remove(); });
    document.body.appendChild(ov);
  };

  window.addEventListener('load', mostrar);

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
