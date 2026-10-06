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
    if (r) { r.checked = true; actTelaPreview(); }
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

  // ── Sincroniza toda la interfaz con los valores actuales de los campos ──
  function setOn(id, on) { var e = $(id); if (e) e.classList.toggle('on', !!on); }
  window.syncTelaUI = function () {
    if (!$('tlBar')) return;
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
      $('tlBarSum').textContent = modo + ' · ' + (ua === 'm' ? fmt(a, 2) : fmt(aFt, 1)) + ua + ' × ' + (ul === 'm' ? fmt(l, 2) : fmt(lFt, 1)) + ul + ' · ' + cant + (cant === 1 ? ' corte' : ' cortes');
      $('tlBarUsd').textContent = $('rUsd').textContent + ' USD';
      $('tlBarQ').textContent = $('rQBox').style.display !== 'none' ? $('rQ').textContent : '';
    }
  };

  // El TC se recuerda: el último usado queda precargado en el siguiente ítem
  var _agregarTela = window.agregarTela;
  window.agregarTela = function () {
    var tc = $('cotTC').value;
    var antes = (typeof CARRITO !== 'undefined') ? CARRITO.length : 0;
    _agregarTela.apply(this, arguments);
    if (CARRITO.length > antes) {
      if (tc) { try { localStorage.setItem('TC_ULTIMO', tc); } catch (e) {} }
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
  ['_mostrarApp', '_mostrarLogin'].forEach(function (nombre) {
    var f = window[nombre];
    if (typeof f !== 'function') return;
    window[nombre] = function () { var r = f.apply(this, arguments); syncTelaUI(); return r; };
  });

  window.addEventListener('load', function () {
    try { var tc = localStorage.getItem('TC_ULTIMO'); if (tc && !$('cotTC').value) $('cotTC').value = tc; } catch (e) {}
    tlRenderModos(null, 'master');
    syncTelaUI();
  });
})();
