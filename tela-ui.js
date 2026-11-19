// ── Interfaz del formulario de telas ───────────────────────────────────────────
// Capa de presentación sobre la lógica existente (cotCalcTela / agregarTela en cotizador.html): los
// controles de esta pantalla escriben en los MISMOS campos de siempre (cotAncho, cotUAncho, cotCantTela,
// cotRecargo, radios cotModoTela…), así que el cálculo, el carrito y el envío no cambian.
(function () {
  var MT_ = 3.28;
  function $(id) { return document.getElementById(id); }
  function n(v) { return parseFloat(v) || 0; }
  function fmt(v, d) { return Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }

  // ── Modalidad: tarjetas Master / Confeccionado (reemplazan al selector de radio + tarjetas duplicadas) ──
  window.tlRenderModos = function (t, modo) {
    var box = $('tlModoCards'); if (!box) return;
    var items = [
      { v: 'master', titulo: 'Rollo Master', precio: t ? t.pm : null, desc: 'Sin ojetes ni ribete. Se corta directo del rollo.' },
      { v: 'conf', titulo: 'Confeccionado', precio: t ? t.pc : null, desc: 'Con ojetes y ribete. Listo para instalar.' },
    ];
    box.innerHTML = items.map(function (m) {
      return '<button type="button" class="tl-modo' + (modo === m.v ? ' on' : '') + '" onclick="tlModo(\'' + m.v + '\')" aria-pressed="' + (modo === m.v) + '">'
        + '<div class="tl-modo-top"><span>' + m.titulo + '</span><span class="tl-dot"><svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg></span></div>'
        + '<div class="tl-modo-p">' + (m.precio == null ? '—' : '$' + (Number(m.precio) * 10.7584).toFixed(3)) + ' <small>/ m²</small></div>'
        + '<div class="tl-modo-d">' + m.desc + '</div></button>';
    }).join('');
  };
  window.tlModo = function (v) {
    var r = document.querySelector('input[name="cotModoTela"][value="' + v + '"]');
    if (r) { r.checked = true; actTelaPreview(); pintarAcabado(); }
  };

  // Acabado de la pieza confeccionada: ojetes y ribete (OR), distancia entre OR y fuelle. Solo informa (no cambia el precio).
  // orCada se guarda SIEMPRE en pies (así lo leen los presupuestos guardados); orUnidad solo cambia cómo se muestra.
  var orSi = true, orCada = 2, fuelle = false, orUnidad = 'ft';
  var PIE_M = 0.3048;
  function pintarAcabado() {
    var box = $('tlAcabado'); if (!box) return;
    var conf = (document.querySelector('input[name="cotModoTela"]:checked') || {}).value === 'conf';
    box.style.display = conf ? 'block' : 'none';
    setOn('tlOrSi', orSi); setOn('tlOrNo', !orSi); setOn('tlFuSi', fuelle); setOn('tlFuNo', !fuelle);
    setOn('tlOrUnFt', orUnidad === 'ft'); setOn('tlOrUnM', orUnidad === 'm');
    $('tlOrBox').style.display = orSi ? 'flex' : 'none';
    var enM = orUnidad === 'm';
    document.querySelectorAll('.tl-or-q').forEach(function (b) {
      var v = parseFloat(b.dataset.v);
      b.textContent = enM ? fmt(v * PIE_M, 2) : String(v);
      b.classList.toggle('on', v === orCada);
    });
    document.querySelectorAll('.ac-unit').forEach(function (s) { s.textContent = enM ? 'm' : 'pies'; });
    var inp = $('tlOrCada');
    if (document.activeElement !== inp) {
      var esOtra = orCada > 0 && [1, 1.5, 2, 3].indexOf(orCada) < 0;
      inp.value = esOtra ? (enM ? fmt(orCada * PIE_M, 2) : String(orCada)) : '';
    }
    var res = $('tlAcabadoResumen');
    if (res) {
      var dist = enM ? fmt(orCada * PIE_M, 2) + ' m' : orCada + ' pies';
      res.textContent = (orSi ? 'Con ojetes y ribete, distancia entre OR ' + dist : 'Sin ojetes ni ribete') + (fuelle ? ', con fuelle.' : '.');
    }
  }
  window.tlOrUnidad = function (u) { orUnidad = u === 'm' ? 'm' : 'ft'; pintarAcabado(); };
  window.tlOrCadaIn = function (v) { var x = parseFloat(v) || 0; orCada = orUnidad === 'm' ? x / PIE_M : x; pintarAcabado(); };
  // ── Ancho especial: armar el ancho pedido con rollos de distinto ancho (sin el múltiplo de 6 ft) ──
  var rolloEsp = false, armadoSel = 0, armadoOpts = [];
  function anchoPedidoM() {
    var a = parseFloat($('cotAncho').value) || 0;
    return $('cotUAncho').value === 'm' ? a : a / 3.28;
  }
  // Combinaciones de hasta 6 rollos por ancho que cubren el pedido; primero las de menos uniones
  function armadosPara(W) {
    var a1 = $('tlRollo381').checked, a2 = $('tlRollo510').checked, out = [];
    for (var i = 0; i <= 6; i++) for (var j = 0; j <= 6; j++) {
      if (!a1 && i) continue;
      if (!a2 && j) continue;
      var n = i + j; if (n < 1) continue;
      var cobM = i * 3.81 + j * 5.10;
      if (cobM < W - 1e-9) continue;
      out.push({ i: i, j: j, cobM: cobM, uniones: n - 1, sobraM: cobM - W });
    }
    return out.sort(function (x, y) { return x.uniones - y.uniones || x.cobM - y.cobM; }).slice(0, 4);
  }
  function armadoEtiqueta(o) {
    var p = [];
    if (o.i) p.push(o.i + ' × 3.81 m');
    if (o.j) p.push(o.j + ' × 5.10 m');
    return p.join(' + ');
  }
  window.tlPintarArmado = function () {
    var box = $('tlArmadoBox'); if (!box) return;
    box.style.display = rolloEsp ? 'block' : 'none';
    setOn('tlRolStd', !rolloEsp); setOn('tlRolEsp', rolloEsp);
    if (!rolloEsp) return;
    var W = anchoPedidoM();
    armadoOpts = W > 0 ? armadosPara(W) : [];
    if (armadoSel >= armadoOpts.length) armadoSel = 0;
    $('tlArmadoOpts').innerHTML = armadoOpts.length
      ? armadoOpts.map(function (o, k) {
          return '<button type="button" class="tl-or-q' + (k === armadoSel ? ' on' : '') + '" onclick="tlArmadoPick(' + k + ')">'
            + armadoEtiqueta(o) + ' · ' + fmt(o.cobM, 2) + ' m' + (k === 0 ? ' · recomendado' : '') + '</button>';
        }).join('')
      : '<p class="ac-resumen">Captura el ancho del pedido y marca al menos un ancho de rollo.</p>';
    var r = $('tlArmadoResumen'), o = armadoOpts[armadoSel];
    if (r) r.textContent = o
      ? 'Se cobra ' + fmt(o.cobM, 2) + ' m de ancho · ' + o.uniones + (o.uniones === 1 ? ' unión' : ' uniones') + ' · sobra ' + fmt(o.sobraM, 2) + ' m por rollo.'
      : '';
  };
  window.tlArmadoPick = function (k) { armadoSel = k; tlPintarArmado(); cotCalcTela(); };
  window.tlRolloModo = function (esp) { rolloEsp = !!esp; armadoSel = 0; tlPintarArmado(); cotCalcTela(); };
  // Ancho que se cobra: el armado elegido en especial; si no, la regla estándar por tramos
  window.tlAnchoCobrado = function (aFt) {
    if (rolloEsp && armadoOpts[armadoSel]) return armadoOpts[armadoSel].cobM * 3.28;
    return anchoCobradoFt(aFt);
  };
  // Armado guardado en el ítem (para el detalle y para editarlo después)
  window.tlArmadoActual = function () {
    if (!rolloEsp || !armadoOpts[armadoSel]) return null;
    var o = armadoOpts[armadoSel];
    return { txt: armadoEtiqueta(o) + ' (' + o.uniones + (o.uniones === 1 ? ' unión' : ' uniones') + ')', cobM: o.cobM, uniones: o.uniones };
  };
  window.tlRestaurarArmado = function (a) {
    rolloEsp = !!a; armadoSel = 0; tlPintarArmado();
    if (a) {
      var k = armadoOpts.findIndex(function (o) { return Math.abs(o.cobM - a.cobM) < 1e-6; });
      armadoSel = k >= 0 ? k : 0; tlPintarArmado();
    }
  };
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

  // Descripción de la línea de cotización, redactada como una frase (sin guiones que delaten una línea armada)
  window.tlDescripcionLinea = function (item, medida) {
    var ac = [];
    if (item.modo === 'master') return item.nombre + ' en rollo, pieza de ' + medida;
    var base = item.nombre + ' confeccionada de ' + medida;
    if (item.orSi != null) {
      var c = item.orCada;
      ac.push(item.orSi ? 'con ojetes y ribete cada ' + fmt(c, c % 1 ? 1 : 0) + (c === 1 ? ' pie' : ' pies') : 'sin ojetes ni ribete');
      if (item.fuelle) ac.push('con fuelle');
    }
    return base + (ac.length ? ', ' + ac.join(' y ') : '');
  };
  window.tlDescripcionSaco = function (item) {
    var s = (typeof SACOS !== 'undefined') ? SACOS.filter(function (x) { return x.id == item.sacoId; })[0] : null;
    var nom = String(item.nombre || '').trim(), baja = nom.toLowerCase();
    var t = /^saco/i.test(nom) ? nom : 'Saco ' + nom;
    var med = String(item.medidas || (s && s.medidas) || '').trim();
    if (med && baja.indexOf(med.toLowerCase()) < 0) t += ' de ' + med;
    var extra = [];
    if (s && s.gm) extra.push(s.gm + ' gm');
    if (s && s.color && baja.indexOf(String(s.color).toLowerCase()) < 0) extra.push('color ' + String(s.color).toLowerCase());
    if (s && s.impresion === 'CON') extra.push('con impresión'); else if (s && s.impresion === 'SIN') extra.push('sin impresión');
    return t + (extra.length ? ', ' + extra.join(', ') : '');
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

  // ── Piezas ──
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
    var exp = $('tlAdjExp');
    if (exp) exp.textContent = adjTipo === 'none' ? 'Sin ajuste: el precio queda igual al de la lista.'
      : (!v ? 'Escribe el porcentaje.' : (adjTipo === 'rec' ? 'El precio sube ' + v + ' % sobre la lista.' : 'El precio baja ' + v + ' % bajo la lista.'));
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
    else if (tcManual) { c.className = 'opt-chip dark'; c.innerHTML = ic('edit') + ' Cambio Q' + v + ' por US$ · escrito por ti'; }
    else { c.className = 'opt-chip ok'; c.innerHTML = ic('check') + ' Cambio Q' + v + ' por US$ · oficial (Banguat)'; }
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
    var hint = $('tlMonHint');
    if (hint) hint.textContent = m === 'Q' ? 'El total se muestra en quetzales. Necesitas el tipo de cambio del día.' : 'El total se muestra en dólares (US$).';
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
    setOn('tlPreHib', ua !== ul); setOn('tlPreM', ua === 'm' && ul === 'm'); setOn('tlPreFt', ua === 'ft' && ul === 'ft');

    var aFt = ua === 'm' ? a * MT_ : a, aM = ua === 'm' ? a : a / MT_;
    var lFt = ul === 'm' ? l * MT_ : l, lM = ul === 'm' ? l : l / MT_;
    $('tlEqAncho').textContent = a > 0 ? '≈ ' + (ua === 'ft' ? fmt(aM, 2) + ' m' : fmt(aFt, 2) + ' ft') : '';
    $('tlEqLargo').textContent = l > 0 ? '≈ ' + (ul === 'ft' ? fmt(lM, 2) + ' m' : fmt(lFt, 2) + ' ft') : '';
    var norm = $('tlNorm');
    if (a > 0 && l > 0) {
      norm.style.display = 'block';
      norm.innerHTML = 'Pieza: <b>' + fmt(aM, 2) + ' m × ' + fmt(lM, 2) + ' m</b> · Área <b>' + fmt(aM * lM, 2) + ' m²</b> (' + fmt(aFt * lFt, 1) + ' pie²)';
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
      $('tlBarSum').textContent = modo + ' · ' + (ua === 'm' ? fmt(a, 2) : fmt(aFt, 1)) + ua + ' × ' + (ul === 'm' ? fmt(l, 2) : fmt(lFt, 1)) + ul + ' · ' + cant + (cant === 1 ? ' pieza' : ' piezas') + ($('cotDesglosarIVA').checked ? ' · sin IVA' : '');
      var usd = $('rUsd').textContent + ' USD';
      var q = $('rQBox').style.display !== 'none' ? $('rQ').textContent : '';
      // La moneda elegida va en grande; la otra, como referencia
      $('tlBarUsd').textContent = (moneda === 'Q' && q) ? q : usd;
      $('tlBarQ').textContent = (moneda === 'Q' && q) ? usd : q;
    }
  };

  // Antes de agregar: si lleva OR debe indicar cada cuántos pies
  LGM.on('item:antes', function (tipo) {
    if (tipo !== 'tela') return;
    var esConf = (document.querySelector('input[name="cotModoTela"]:checked') || {}).value === 'conf';
    if (esConf && orSi && !(orCada > 0)) { toast('Indica cada cuántos pies van los ojetes (o elige Sin OR)', 'err'); $('tlOrCada').focus(); return false; }
  });
  // El ítem confeccionado lleva su acabado (OR / fuelle)
  LGM.on('item:armado', function (item) {
    if (item.tipo === 'tela' && item.modo === 'conf') Object.assign(item, tlAcabadoDe());
  });
  // Tras agregar: el formulario de telas vuelve a su estado inicial
  LGM.on('item:agregado', function (ev) {
    if (ev.tipo !== 'tela') return;
    orSi = true; orCada = 2; fuelle = false;
    adjTipo = 'none'; $('tlAdjPct').value = '';
    $('cotUAncho').value = 'm'; $('cotULargo').value = 'm';     // las medidas siempre empiezan en metros
    var m = document.querySelector('input[name="cotModoTela"]:checked');
    tlRenderModos(null, m ? m.value : 'master');
    syncTelaUI();
  });
  // Barra fija / tarjetas: se actualizan al cambiar de pestaña, sección, sesión o precios
  LGM.on('vista:cambio', function () { syncTelaUI(); });
  LGM.on('sesion:cambio', function () { syncTelaUI(); });
  LGM.on('sesion:iniciada', function () { tlCargarTcOficial(); });

  window.addEventListener('load', function () {
    tlRenderModos(null, 'master'); pintarAcabado();
    tcOficial = leerTcLocal(); pintarTcHint(); pintarIvaChip();
    syncTelaUI();
  });
})();
