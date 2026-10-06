// ── Interfaz del formulario de telas ───────────────────────────────────────────
// Capa de presentación sobre la lógica existente (cotCalcTela / agregarTela en cotizador.html): los
// controles de esta pantalla escriben en los MISMOS campos de siempre (cotAncho, cotUAncho, cotCantTela,
// cotRecargo, radios cotModoTela…), así que el cálculo, el carrito y el envío no cambian.
(function () {
  var MT_ = 3.28084;
  function $(id) { return document.getElementById(id); }
  function n(v) { return parseFloat(v) || 0; }
  function fmt(v, d) { return Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }

  // ── Modalidad: tarjetas Master / Confeccionado (reemplazan al selector de radio + tarjetas duplicadas) ──
  window.tlRenderModos = function (t, modo) {
    var box = $('tlModoCards'); if (!box) return;
    var items = [
      { v: 'master', titulo: 'Rollo Master', precio: t ? t.pm : null, desc: 'Sin ojetes ni rebete. Corte directo del rollo.' },
      { v: 'conf', titulo: 'Confeccionado', precio: t ? t.pc : null, desc: 'Con ojetes y rebete. Listo para instalar.' },
    ];
    box.innerHTML = items.map(function (m) {
      return '<button type="button" class="tl-modo' + (modo === m.v ? ' on' : '') + '" onclick="tlModo(\'' + m.v + '\')" aria-pressed="' + (modo === m.v) + '">'
        + '<div class="tl-modo-top"><span>' + m.titulo + '</span><span class="tl-dot"><svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg></span></div>'
        + '<div class="tl-modo-p">' + (m.precio == null ? '—' : '$' + Number(m.precio).toFixed(3)) + ' <small>/ pie²</small></div>'
        + '<div class="tl-modo-d">' + m.desc + '</div></button>';
    }).join('');
  };
  window.tlModo = function (v) {
    var r = document.querySelector('input[name="cotModoTela"][value="' + v + '"]');
    if (r) { r.checked = true; actTelaPreview(); pintarAcabado(); }
  };

  // ── Acabado de la pieza confeccionada: ojetes y rebete (OR) cada N pies + fuelle. Solo informa (no cambia el precio) ──
  var orSi = true, orCada = 2, fuelle = false;
  function pintarAcabado() {
    var box = $('tlAcabado'); if (!box) return;
    var conf = (document.querySelector('input[name="cotModoTela"]:checked') || {}).value === 'conf';
    box.style.display = conf ? 'block' : 'none';
    setOn('tlOrSi', orSi); setOn('tlOrNo', !orSi); setOn('tlFuSi', fuelle); setOn('tlFuNo', !fuelle);
    $('tlOrBox').style.display = orSi ? 'flex' : 'none';
    if (document.activeElement !== $('tlOrCada')) $('tlOrCada').value = orCada || '';
    document.querySelectorAll('.tl-or-q').forEach(function (b) { b.classList.toggle('on', parseFloat(b.dataset.v) === orCada); });
  }
  window.tlOR = function (v) { orSi = !!v; pintarAcabado(); };
  window.tlOrCada = function (v) { orCada = parseFloat(v) || 0; pintarAcabado(); };
  window.tlFuelle = function (v) { fuelle = !!v; pintarAcabado(); };
  window.tlAcabadoDe = function () { return { orSi: orSi ? 1 : 0, orCada: orSi ? orCada : 0, fuelle: fuelle ? 1 : 0 }; };
  window.tlSetAcabado = function (it) {   // al editar un ítem del presupuesto (los antiguos sin dato: Con OR cada 2 pies)
    orSi = it && it.orSi != null ? !!it.orSi : true; orCada = it && it.orCada > 0 ? it.orCada : 2; fuelle = !!(it && it.fuelle);
    pintarAcabado();
  };
  // «Con OR cada 2 pies · con fuelle» / «Sin OR»
  window.tlAcabadoTxt = function (it) {
    if (!it || it.modo === 'master' || it.orSi == null) return '';
    var t = it.orSi ? 'Con OR cada ' + fmt(it.orCada, it.orCada % 1 ? 1 : 0) + ' ' + (it.orCada === 1 ? 'pie' : 'pies') : 'Sin OR';
    return t + (it.fuelle ? ' · con fuelle' : '');
  };

  // ── Unidades: segmentado ft | m por dimensión (convierte el valor para conservar la medida física) ──
  window.tlSetUom = function (cual, u) {
    var sel = $(cual === 'ancho' ? 'cotUAncho' : 'cotULargo'), inp = $(cual === 'ancho' ? 'cotAncho' : 'cotLargo');
    if (sel.value === u) return;
    var v = n(inp.value);
    if (v > 0) {
      v = u === 'm' ? v / MT_ : v * MT_;
      inp.value = String(+v.toFixed(2));
    }
    sel.value = u;
    cotCalcTela();
  };
  window.tlPreset = function (a, l) { tlSetUom('ancho', a); tlSetUom('largo', l); };

  // ── Cortes ──
  window.tlQty = function (d) {
    var e = $('cotCantTela');
    e.value = Math.max(1, (parseInt(e.value, 10) || 1) + d);
    cotCalcTela();
  };

  // ── Ajuste comercial: Ninguno / Descuento / Recargo → escribe el % con signo en cotRecargo ──
  var adjTipo = 'none';
  function aplicarAdj() {
    var v = Math.abs(n($('tlAdjPct').value));
    $('cotRecargo').value = adjTipo === 'none' ? 0 : (adjTipo === 'desc' ? -v : v);
    cotCalcTela();
  }
  window.tlAdj = function (t) {
    adjTipo = t;
    if (t === 'none') $('tlAdjPct').value = '';
    aplicarAdj();
    if (t !== 'none') setTimeout(function () { $('tlAdjPct').focus(); }, 30);
  };
  window.tlAdjPct = function () { aplicarAdj(); };
  window.tlQuick = function (p) { $('tlAdjPct').value = p; aplicarAdj(); };

  // ── Tipo de cambio: el oficial del PFS (Banguat) se precarga; se puede escribir uno manual ──
  var TC_KEY = 'TC_OFICIAL';
  var tcOficial = null;      // { valor, fecha, stale }
  var tcManual = false;      // el vendedor escribió un valor distinto al oficial
  var tcVacio = false;       // lo dejó vacío a propósito (cotizar solo en USD)
  var tcUltimaCarga = 0;
  var moneda = 'USD';        // por defecto se cotiza en dólares; el selector activa Quetzales
  function leerTcLocal() { try { return JSON.parse(localStorage.getItem(TC_KEY)); } catch (e) { return null; } }
  function pintarTcChip() {
    var c = $('tcChip'); if (!c) return;
    var v = parseFloat($('cotTC').value);
    var ic = function (n) { return typeof _ic === 'function' ? _ic(n) : ''; };
    if (!(v > 0)) { c.className = 'opt-chip alerta'; c.innerHTML = ic('warn') + ' Definir tipo de cambio'; }
    else if (tcManual) { c.className = 'opt-chip dark'; c.innerHTML = ic('edit') + ' TC Q' + v + ' · manual'; }
    else { c.className = 'opt-chip ok'; c.innerHTML = ic('check') + ' TC Q' + v + ' · Banguat'; }
  }
  window.tlTcEditar = function () {
    var ed = $('tcEditor'), abrir = ed.style.display === 'none';
    ed.style.display = abrir ? 'block' : 'none';
    $('tcChip').setAttribute('aria-expanded', abrir);
    if (abrir) setTimeout(function () { $('cotTC').focus(); }, 30);
  };
  window.tlToggleIva = function () {
    var cb = $('cotDesglosarIVA'); cb.checked = !cb.checked;
    cotCalcTela(); if (typeof cotCalcSaco === 'function') cotCalcSaco();
    pintarIvaChip();
  };
  function pintarIvaChip() {
    var c = $('ivaChip'); if (!c) return;
    var sin = $('cotDesglosarIVA').checked;
    c.className = 'opt-chip' + (sin ? ' dark' : '');
    c.setAttribute('aria-pressed', sin);
    c.innerHTML = (typeof _ic === 'function' ? _ic(sin ? 'x' : 'check') : '') + (sin ? ' Sin IVA' : ' IVA incluido');
  }
  function pintarTcHint() {
    pintarTcChip();
    var h = $('tcHint'); if (!h) return;
    var v = parseFloat($('cotTC').value);
    var ic = function (n) { return typeof _ic === 'function' ? _ic(n) : ''; };
    h.className = 'tl-tc-hint';
    if (!tcOficial) { h.innerHTML = 'No hay tipo de cambio oficial disponible: escríbelo a mano.'; return; }
    var of = 'Q' + tcOficial.valor + (tcOficial.fecha ? ' · ' + tcOficial.fecha : '');
    if (tcVacio || !(v > 0)) h.innerHTML = 'Escribe un tipo de cambio o <a onclick="tlUsarOficial()">usa el oficial ' + of + '</a>.';
    else if (tcManual) h.innerHTML = ic('edit') + ' Manual · oficial ' + of + ' <a onclick="tlUsarOficial()">Usar oficial</a>';
    else { h.className += ' ok'; h.innerHTML = ic('check') + ' Oficial Banguat · ' + of + (tcOficial.stale ? ' (último disponible)' : ''); }
  }
  function aplicarTcOficial(forzar) {
    var inp = $('cotTC');
    if (moneda !== 'Q') { pintarTcHint(); return; }
    if (tcOficial && (forzar || (!tcManual && !tcVacio))) {
      if (forzar) { tcManual = false; tcVacio = false; }
      if (String(inp.value) !== String(tcOficial.valor)) { inp.value = String(tcOficial.valor); cotCalcTela(); }
    }
    pintarTcHint();
  }
  window.tlTcInput = function () {
    var v = parseFloat($('cotTC').value);
    tcVacio = !(v > 0);
    tcManual = !tcVacio && !!(tcOficial ? v !== tcOficial.valor : true);
    pintarTcHint();
  };
  window.tlUsarOficial = function () { aplicarTcOficial(true); };
  window.tlMoneda = function (m) {
    if (moneda === m) return;
    moneda = m;
    if (m === 'Q') { $('tcBox').style.display = 'block'; tcManual = false; tcVacio = false; aplicarTcOficial(true); if (!tcOficial && $('tcEditor').style.display === 'none') tlTcEditar(); }
    else { $('tcBox').style.display = 'none'; $('tcEditor').style.display = 'none'; $('cotTC').value = ''; }
    cotCalcTela();
  };
  window.tlCargarTcOficial = async function () {
    if (typeof _api !== 'function') return;
    try {
      var r = await _api('/tipo-cambio');
      if (r.ok && r.data.valor > 0) {
        tcOficial = { valor: r.data.valor, fecha: r.data.fecha || '', stale: !!r.data.stale };
        try { localStorage.setItem(TC_KEY, JSON.stringify(tcOficial)); } catch (e) {}
        tcUltimaCarga = Date.now();
      }
    } catch (e) { /* sin sesión o sin red: se usa el último guardado */ }
    aplicarTcOficial(false);
  };
  setInterval(function () { tlCargarTcOficial(); }, 30 * 60 * 1000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && Date.now() - tcUltimaCarga > 30 * 60 * 1000) tlCargarTcOficial(); });

  // ── Sincroniza toda la interfaz con los valores actuales de los campos ──
  function setOn(id, on) { var e = $(id); if (e) e.classList.toggle('on', !!on); }
  window.syncTelaUI = function () {
    if (!$('tlBar')) return;
    pintarAcabado();
    var ua = $('cotUAncho').value, ul = $('cotULargo').value;
    var a = n($('cotAncho').value), l = n($('cotLargo').value);
    setOn('tlAnchoFt', ua === 'ft'); setOn('tlAnchoM', ua === 'm');
    setOn('tlLargoFt', ul === 'ft'); setOn('tlLargoM', ul === 'm');
    setOn('tlPreHib', ua === 'ft' && ul === 'm'); setOn('tlPreM', ua === 'm' && ul === 'm'); setOn('tlPreFt', ua === 'ft' && ul === 'ft');

    var aFt = ua === 'm' ? a * MT_ : a, aM = ua === 'm' ? a : a / MT_;
    var lFt = ul === 'm' ? l * MT_ : l, lM = ul === 'm' ? l : l / MT_;
    $('tlEqAncho').textContent = a > 0 ? '≈ ' + (ua === 'ft' ? fmt(aM, 2) + ' m' : fmt(aFt, 2) + ' ft') : ' ';
    $('tlEqLargo').textContent = l > 0 ? '≈ ' + (ul === 'ft' ? fmt(lM, 2) + ' m' : fmt(lFt, 2) + ' ft') : ' ';
    var norm = $('tlNorm');
    if (a > 0 && l > 0) {
      norm.style.display = 'block';
      norm.innerHTML = 'Corte: <b>' + fmt(aM, 2) + ' m × ' + fmt(lM, 2) + ' m</b> · Área <b>' + fmt(aM * lM, 2) + ' m²</b> (' + fmt(aFt * lFt, 1) + ' pie²)';
    } else norm.style.display = 'none';

    // Moneda: un ítem con TC (p. ej. al editarlo desde el presupuesto) activa Quetzales
    if (moneda === 'USD' && n($('cotTC').value) > 0) { moneda = 'Q'; $('tcBox').style.display = 'block'; tcManual = !!(tcOficial && n($('cotTC').value) !== tcOficial.valor); pintarTcHint(); }
    setOn('tlMonUsd', moneda === 'USD'); setOn('tlMonQ', moneda === 'Q');

    // Ajuste: el signo de cotRecargo manda; si es 0 se conserva lo que eligió el usuario
    var r = n($('cotRecargo').value);
    if (r < 0) adjTipo = 'desc'; else if (r > 0) adjTipo = 'rec';
    setOn('tlAdjNone', adjTipo === 'none'); setOn('tlAdjDesc', adjTipo === 'desc'); setOn('tlAdjRec', adjTipo === 'rec');
    $('tlAdjBox').style.display = adjTipo === 'none' ? 'none' : 'flex';
    if (r !== 0 && document.activeElement !== $('tlAdjPct')) $('tlAdjPct').value = Math.abs(r);

    // Barra fija inferior: solo en Cotizar › Telas y con un cálculo válido
    var bar = $('tlBar');
    var enTelas = $('cotizar').classList.contains('active') && $('cot-tela').classList.contains('active');
    var listo = enTelas && $('cotResTela').classList.contains('show') && !$('appShell').classList.contains('hidden');
    bar.style.display = listo ? 'flex' : 'none';
    document.body.classList.toggle('tl-bar-on', listo);
    if (listo) {
      var modo = (document.querySelector('input[name="cotModoTela"]:checked') || {}).value === 'master' ? 'Master' : 'Confeccionado';
      var cant = Math.max(1, parseInt($('cotCantTela').value, 10) || 1);
      $('tlBarSum').textContent = modo + ' · ' + (ua === 'm' ? fmt(a, 2) : fmt(aFt, 1)) + ua + ' × ' + (ul === 'm' ? fmt(l, 2) : fmt(lFt, 1)) + ul + ' · ' + cant + (cant === 1 ? ' corte' : ' cortes') + ($('cotDesglosarIVA').checked ? ' · sin IVA' : '');
      var usd = $('rUsd').textContent + ' USD';
      var q = $('rQBox').style.display !== 'none' ? $('rQ').textContent : '';
      // La moneda elegida va en grande; la otra, como referencia
      $('tlBarUsd').textContent = (moneda === 'Q' && q) ? q : usd;
      $('tlBarQ').textContent = (moneda === 'Q' && q) ? usd : q;
    }
  };

  var _agregarTela = window.agregarTela;
  window.agregarTela = function () {
    var antes = (typeof CARRITO !== 'undefined') ? CARRITO.length : 0;
    var esConf = (document.querySelector('input[name="cotModoTela"]:checked') || {}).value === 'conf';
    if (esConf && orSi && !(orCada > 0)) { toast('Indica cada cuántos pies van los ojetes (o elige Sin OR)', 'err'); $('tlOrCada').focus(); return; }
    var ac = esConf ? tlAcabadoDe() : null;
    _agregarTela.apply(this, arguments);
    if (CARRITO.length > antes) {
      if (ac) Object.assign(CARRITO[CARRITO.length - 1], ac);
      if (typeof saveCarrito === 'function') saveCarrito();
      if (typeof renderCarrito === 'function') renderCarrito();
      orSi = true; orCada = 2; fuelle = false;
      // El formulario se limpia tras agregar (pdf-share.js): se reinician también las tarjetas y el ajuste
      adjTipo = 'none'; $('tlAdjPct').value = '';
      var m = document.querySelector('input[name="cotModoTela"]:checked');
      tlRenderModos(null, m ? m.value : 'master');
    }
    syncTelaUI();
  };

  // Barra fija: se actualiza al cambiar de pestaña / sección
  ['cambiarTab', 'abrirSeccion'].forEach(function (nombre) {
    var f = window[nombre];
    if (typeof f !== 'function') return;
    window[nombre] = function () { var r = f.apply(this, arguments); syncTelaUI(); return r; };
  });
  var _mApp = window._mostrarApp;
  if (typeof _mApp === 'function') window._mostrarApp = function () { var r = _mApp.apply(this, arguments); tlCargarTcOficial(); return r; };
  ['_mostrarApp', '_mostrarLogin'].forEach(function (nombre) {
    var f = window[nombre];
    if (typeof f !== 'function') return;
    window[nombre] = function () { var r = f.apply(this, arguments); syncTelaUI(); return r; };
  });

  window.addEventListener('load', function () {
    tlRenderModos(null, 'master'); pintarAcabado();
    tcOficial = leerTcLocal(); pintarTcHint(); pintarIvaChip();
    syncTelaUI();
  });
})();
