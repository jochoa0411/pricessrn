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
})();
