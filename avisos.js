// ── Avisos en este teléfono (notificaciones push) ──
// 1) Menú Más › «Avisos en este teléfono»: activar / probar / desactivar. En iPhone solo funcionan con la app instalada en la pantalla de inicio.
// 2) «Latido» del presupuesto a medias: se manda al sistema un RESUMEN (cliente, nº de ítems, total) para poder recordar «dejaste una cotización sin
//    terminar»; se borra al enviarla o vaciarla. No sale el detalle de las líneas.
// 3) Al tocar un aviso se abre la app en la pantalla correcta (?ir=cotizar | historial).
(function () {
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  var enApp = !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
  var esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var soportado = ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);
  var estado = { clave: null, configurado: null, suscrito: false, cargado: false };

  function b64(k) {
    var p = '='.repeat((4 - k.length % 4) % 4), s = (k + p).replace(/-/g, '+').replace(/_/g, '/'), r = atob(s), o = new Uint8Array(r.length);
    for (var i = 0; i < r.length; i++) o[i] = r.charCodeAt(i);
    return o;
  }
  // ── Estado: no-soportado | instalar | no-configurado | bloqueado | apagado | activo ──
  function estadoActual() {
    if (!soportado) return esIOS && !enApp ? 'instalar' : 'no-soportado';
    if (estado.cargado && estado.configurado === false) return 'no-configurado';
    if (Notification.permission === 'denied') return 'bloqueado';
    return estado.suscrito && Notification.permission === 'granted' ? 'activo' : 'apagado';
  }
  function pintarMenu() {
    var sub = $('navAvisosSub'), dot = $('navAvisosDot'); if (!sub) return;
    var e = estadoActual();
    sub.textContent = { activo: 'Activados en este teléfono', apagado: 'Toca para activarlos', instalar: 'Primero instala la app', bloqueado: 'Bloqueados en el teléfono', 'no-soportado': 'No disponibles aquí', 'no-configurado': 'No disponibles todavía' }[e];
    if (dot) dot.hidden = e !== 'apagado';
  }

  async function cargarEstado() {
    if (!soportado || typeof _api !== 'function' || !_cargarSesion || !(_cargarSesion() || {}).token) { pintarMenu(); return; }
    try {
      var reg = await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();
      var r = await _api('/push/clave');
      if (r.ok) { estado.clave = r.data.publicKey; estado.configurado = !!r.data.configurado; }
      estado.cargado = true;
      estado.suscrito = !!sub;
      // Mantener al servidor al día con la suscripción de este teléfono (una vez por sesión)
      if (sub && Notification.permission === 'granted' && estado.configurado && !window._avisosSync) { window._avisosSync = true; _api('/push/suscribir', { method: 'POST', body: { subscription: sub.toJSON() } }).catch(function () {}); }
    } catch (e) { /* sin red: se queda con lo que sabe */ }
    pintarMenu();
  }

  async function activar() {
    var btn = $('avisosAccion'); if (btn) { btn.disabled = true; btn.textContent = 'Activando…'; }
    try {
      if (!estado.clave) { await cargarEstado(); }
      if (!estado.clave) throw new Error('Los avisos no están disponibles todavía en el servidor.');
      var perm = await Notification.requestPermission();           // debe llamarse desde un toque del usuario (iPhone)
      if (perm !== 'granted') { pintarMenu(); abrirAvisos(); return; }
      var reg = await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(estado.clave) });
      var r = await _api('/push/suscribir', { method: 'POST', body: { subscription: sub.toJSON() } });
      if (!r.ok) throw new Error(r.data.error || 'No se pudo activar');
      estado.suscrito = true; window._avisosSync = true;
      programarLatido(true);
      if (typeof toast === 'function') toast('Avisos activados');
    } catch (e) {
      if (typeof toast === 'function') toast(e.message || 'No se pudieron activar los avisos', 'err');
    }
    pintarMenu(); abrirAvisos();
  }
  async function desactivar() {
    try {
      var reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
      if (sub) { await _api('/push/baja', { method: 'POST', body: { endpoint: sub.endpoint } }).catch(function () {}); await sub.unsubscribe(); }
      await enviarLatido({ items: 0 }, true);
      estado.suscrito = false;
      if (typeof toast === 'function') toast('Avisos desactivados');
    } catch (e) { if (typeof toast === 'function') toast('No se pudieron desactivar', 'err'); }
    pintarMenu(); abrirAvisos();
  }
  async function probar() {
    var btn = $('avisosProbar'); if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }
    try {
      var r = await _api('/push/probar', { method: 'POST', body: {} });
      if (typeof toast === 'function') toast(r.ok && r.data.ok ? 'Listo: te llegará en unos segundos' : 'No se pudo enviar el aviso de prueba', r.ok && r.data.ok ? undefined : 'err');
    } catch (e) { if (typeof toast === 'function') toast('Sin conexión al sistema', 'err'); }
    if (btn) { btn.disabled = false; btn.textContent = 'Probar aviso'; }
  }

  // ── Hoja «Avisos en este teléfono» ──
  function cerrar() { var o = $('avisosOv'); if (o) o.remove(); }
  function abrirAvisos() {
    cerrar();
    var e = estadoActual();
    var cuerpo, acciones = '';
    var pasos = function (l) { return l.map(function (t, i) { return '<div class="av-paso"><span>' + (i + 1) + '</span><div>' + t + '</div></div>'; }).join(''); };
    if (e === 'activo') {
      cuerpo = '<p>Te avisamos aunque la app esté cerrada:</p><ul class="av-lista"><li>Si <b>dejas una cotización sin terminar</b> (a las 2 horas).</li><li>Si hay cotizaciones <b>por revisar</b>, <b>devueltas</b> o <b>autorizadas</b> sin enviar.</li><li>Cuando <b>autorizan o devuelven</b> una cotización tuya.</li></ul><p class="av-nota">Solo de lunes a viernes, de 8:00 a 18:00.</p>';
      acciones = '<button type="button" id="avisosProbar" class="av-btn av-sec">Probar aviso</button><button type="button" id="avisosAccion" class="av-btn av-gris">Desactivar avisos</button>';
    } else if (e === 'apagado') {
      cuerpo = '<p>Recibe un aviso en este teléfono cuando:</p><ul class="av-lista"><li>dejas una cotización <b>sin terminar</b>,</li><li>hay cotizaciones <b>por revisar</b> o <b>devueltas</b>,</li><li>autorizan o devuelven una cotización tuya.</li></ul><p class="av-nota">Solo de lunes a viernes, de 8:00 a 18:00. Puedes apagarlos cuando quieras.</p>';
      acciones = '<button type="button" id="avisosAccion" class="av-btn av-pri">Activar avisos</button>';
    } else if (e === 'instalar') {
      cuerpo = '<p>En el iPhone los avisos solo funcionan con la app <b>instalada en la pantalla de inicio</b>:</p>' + pasos(['Abre esta página en <b>Safari</b>.', 'Toca <b>Compartir</b> (el cuadro con una flecha hacia arriba) y luego <b>Agregar a inicio</b>.', 'Abre el Cotizador desde su <b>ícono nuevo</b>, entra a Más › Avisos y toca <b>Activar</b>.']);
    } else if (e === 'bloqueado') {
      cuerpo = '<p>Los avisos están <b>bloqueados</b> en este teléfono.</p>' + (esIOS ? pasos(['Abre <b>Ajustes</b> del iPhone.', 'Entra a <b>Notificaciones</b> y busca <b>Cotizador</b>.', 'Activa <b>Permitir notificaciones</b> y vuelve aquí.']) : pasos(['Toca el candado o el menú ⋮ del navegador › <b>Configuración del sitio</b>.', 'Cambia <b>Notificaciones</b> a <b>Permitir</b> y vuelve aquí.']));
    } else if (e === 'no-configurado') {
      cuerpo = '<p>Los avisos todavía no están disponibles en el servidor. Avisa a soporte.</p>';
    } else {
      cuerpo = '<p>Este navegador no permite avisos. Prueba con Safari (iPhone) o Chrome (Android), con la app instalada.</p>';
    }
    var ov = document.createElement('div'); ov.id = 'avisosOv'; ov.className = 'av-ov';
    ov.innerHTML = '<div class="av-hoja" role="dialog" aria-modal="true" aria-label="Avisos en este teléfono"><div class="av-tit">Avisos en este teléfono</div>' + cuerpo + '<div class="av-acc">' + acciones + '<button type="button" class="av-btn av-gris" id="avisosCerrar">Cerrar</button></div></div>';
    ov.addEventListener('click', function (ev) { if (ev.target === ov) cerrar(); });
    document.body.appendChild(ov);
    $('avisosCerrar').onclick = cerrar;
    if ($('avisosAccion')) $('avisosAccion').onclick = e === 'activo' ? desactivar : activar;
    if ($('avisosProbar')) $('avisosProbar').onclick = probar;
    if (typeof cerrarMenu === 'function') try { cerrarMenu(); } catch (x) {}
  }
  window.abrirAvisos = abrirAvisos;

  // ── Latido del presupuesto a medias ──
  var tLatido = null, ultimo = '';
  function resumenCarrito() {
    var c = (typeof CARRITO !== 'undefined' && CARRITO) || [];
    var q = 0, usd = 0, hayQ = false;
    c.forEach(function (i) { if (i.totalQ != null) { q += Number(i.totalQ) || 0; hayQ = true; } else if (i.tu != null) usd += Number(i.tu) || 0; });
    var cli = $('cotCliente') ? $('cotCliente').value.trim() : '';
    return { cliente: cli, items: c.length, total: hayQ ? q : usd, moneda: hayQ ? 'GTQ' : 'USD' };
  }
  async function enviarLatido(r, keepalive) {
    if (!soportado || !estado.suscrito) return;
    var s = (typeof _cargarSesion === 'function') ? _cargarSesion() : null; if (!s || !s.token) return;
    var firma = JSON.stringify(r); if (!keepalive && firma === ultimo) return; ultimo = firma;
    try {
      await fetch(COT_API_BASE + '/api/ventas/cotizaciones-publicas/push/borrador', { method: 'POST', keepalive: !!keepalive,
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': COT_API_KEY, Authorization: 'Bearer ' + s.token }, body: firma });
    } catch (e) { ultimo = ''; }
  }
  function programarLatido(ya) {
    if (!estado.suscrito) return;
    clearTimeout(tLatido);
    var r = resumenCarrito();
    if (!r.items || ya) { enviarLatido(r); return; }         // vaciado (o recién activado): se avisa de inmediato
    tLatido = setTimeout(function () { enviarLatido(resumenCarrito()); }, 40000);
  }
  function vaciarPendiente() { clearTimeout(tLatido); if (estado.suscrito) enviarLatido(resumenCarrito(), true); }

  // ── Abrir en la pantalla del aviso ──
  function irA(dest) {
    if (!dest || typeof abrirSeccion !== 'function') return;
    var items = document.querySelectorAll('#sidebar .nav-item');
    if (dest === 'historial') abrirSeccion('historial', items[1]);
    else if (dest === 'cotizar') abrirSeccion('cotizar', items[0]);
  }

  window.addEventListener('load', function () {
    // saveCarrito guarda el presupuesto en el teléfono: ahí mismo se programa el latido
    var sv = window.saveCarrito;
    if (typeof sv === 'function') window.saveCarrito = function () { var r = sv.apply(this, arguments); programarLatido(false); return r; };
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') vaciarPendiente(); else cargarEstado(); });
    window.addEventListener('pagehide', vaciarPendiente);
    if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', function (ev) { if (ev.data && ev.data.ir) irA(ev.data.ir); });
    var q = new URLSearchParams(location.search).get('ir');
    if (q) { setTimeout(function () { irA(q); try { history.replaceState(null, '', location.pathname); } catch (e) {} }, 900); }
    if (window.LGM && LGM.on) LGM.on('sesion:iniciada', function () { setTimeout(cargarEstado, 600); });
    pintarMenu(); setTimeout(cargarEstado, 1800);
  });
})();
