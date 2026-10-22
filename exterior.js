// ── Cotizar a un cliente del exterior ──
// Por defecto TODA cotización es local (Guatemala, con IVA). El chip «Cliente local» de la tarjeta Cliente se cambia a «Exterior» y pide:
// país, Incoterm y (opcional) dirección; el tipo de cambio sirve para convertir los sacos (que se listan en Q) a US$.
// Cliente del exterior = todo en dólares y SIN IVA, ID fiscal opcional, y el PDF sale con datos bancarios en USD y el Incoterm.
// La elección se recuerda mientras el presupuesto siga abierto y vuelve a «local» al enviar la cotización.
(function () {
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var KEY = 'cotExterior';
  var INCOTERMS = [['EXW', 'En fábrica'], ['FCA', 'Franco transportista'], ['FOB', 'Libre a bordo'], ['CFR', 'Costo y flete'], ['CIF', 'Costo, seguro y flete'], ['CPT', 'Transporte pagado'], ['CIP', 'Transporte y seguro pagados'], ['DAP', 'Entregado en lugar'], ['DDP', 'Entregado, derechos pagados'], ['FAS', 'Al costado del buque']];
  var paises = null;

  window.EXT = { on: false, pais: '', incoterm: '', direccion: '', tc: '' };
  try { var g = JSON.parse(localStorage.getItem(KEY) || 'null'); if (g && g.on) Object.assign(EXT, g); } catch (e) {}
  function guardar() { try { if (EXT.on) localStorage.setItem(KEY, JSON.stringify(EXT)); else localStorage.removeItem(KEY); } catch (e) {} }

  // Tipo de cambio para los sacos: el que el vendedor escribió o, si no, el oficial (Banguat) que ya trae la app
  window.extTc = function () {
    var v = parseFloat(EXT.tc);
    if (v > 0) return v;
    try { var o = JSON.parse(localStorage.getItem('TC_OFICIAL') || 'null'); if (o && parseFloat(o.valor) > 0) return parseFloat(o.valor); } catch (e) {}
    var f = parseFloat(($('cotTC') || {}).value); return f > 0 ? f : 0;
  };

  function pintarChip() {
    var c = $('extChip'); if (!c) return;
    c.className = 'opt-chip' + (EXT.on ? ' dark' : '');
    c.setAttribute('aria-pressed', EXT.on ? 'true' : 'false');
    var ic = typeof _ic === 'function' ? _ic('user') : '';
    c.innerHTML = ic + (EXT.on ? ' Exterior · ' + esc(EXT.pais || 'elige país') + (EXT.incoterm ? ' · ' + esc(EXT.incoterm) : '') : ' Cliente local');
    // Exportación: sin IVA y el chip de IVA ya no se puede cambiar
    var iva = $('ivaChip'), cb = $('cotDesglosarIVA');
    if (EXT.on) {
      if (cb && !cb.checked) { cb.checked = true; try { cotCalcTela(); if (typeof cotCalcSaco === 'function') cotCalcSaco(); } catch (e) {} }
      if (iva) { iva.disabled = true; iva.className = 'opt-chip dark'; iva.innerHTML = (typeof _ic === 'function' ? _ic('x') : '') + ' Exportación: sin IVA'; }
    } else if (iva) { iva.disabled = false; }
  }
  function aplicar() {
    guardar(); pintarChip();
    if (!EXT.on && $('cotDesglosarIVA') && window.tlToggleIva) { /* vuelve a «IVA incluido» */
      var cb = $('cotDesglosarIVA'); if (cb.checked) { cb.checked = false; try { cotCalcTela(); if (typeof cotCalcSaco === 'function') cotCalcSaco(); } catch (e) {} }
      var iv = $('ivaChip'); if (iv) { iv.className = 'opt-chip'; iv.setAttribute('aria-pressed', 'false'); iv.innerHTML = (typeof _ic === 'function' ? _ic('check') : '') + ' IVA incluido'; }
    }
    if (typeof _renderResumenEnvio === 'function' && $('merResumen')) try { _renderResumenEnvio(); } catch (e) {}
  }
  window.extPaises = cargarPaises_;
  window.extReiniciar = function () { EXT.on = false; EXT.pais = ''; EXT.incoterm = ''; EXT.direccion = ''; EXT.tc = ''; aplicar(); };

  function cargarPaises_() { return cargarPaises(); }
  async function cargarPaises() {
    if (paises) return paises;
    try { var r = await _api('/paises'); paises = (r.ok && Array.isArray(r.data)) ? r.data : []; } catch (e) { paises = []; }
    return paises;
  }

  // ── Hoja «Tipo de cliente» ──
  function cerrar() { var o = $('extOv'); if (o) o.remove(); }
  function otro() { return !!EXT.incoterm && INCOTERMS.every(function (x) { return x[0] !== EXT.incoterm; }); }
  window.extAbrir = function () {
    cerrar();
    var tc = extTc();
    var ov = document.createElement('div'); ov.id = 'extOv'; ov.className = 'av-ov';
    var hayTelas = typeof CARRITO !== 'undefined' && CARRITO.some(function (i) { return i.tipo === 'saco'; });
    ov.innerHTML = '<div class="av-hoja" role="dialog" aria-modal="true" aria-label="Tipo de cliente">'
      + '<div class="av-tit">Tipo de cliente</div>'
      + '<div class="ext-seg" role="radiogroup"><button type="button" id="extLocal" role="radio" aria-checked="' + !EXT.on + '" class="' + (!EXT.on ? 'on' : '') + '"><b>Local</b><small>Guatemala · con IVA · quetzales</small></button>'
      + '<button type="button" id="extExt" role="radio" aria-checked="' + EXT.on + '" class="' + (EXT.on ? 'on' : '') + '"><b>Del exterior</b><small>Dólares · sin IVA · datos bancarios en USD</small></button></div>'
      + '<div id="extCampos" ' + (EXT.on ? '' : 'hidden') + '>'
      + '<label class="ext-l">País *</label><button type="button" class="pk-btn" id="extPaisBtn"><span class="pk-btn-v">' + (EXT.pais ? esc(EXT.pais) : '<span class="pk-vacio-t">Toca para elegir el país…</span>') + '</span><span class="pk-btn-i">⌄</span></button>'
      + '<label class="ext-l">Incoterm *</label><div class="ext-inc" id="extInc">' + INCOTERMS.map(function (x) { return '<button type="button" class="sug-chip' + (EXT.incoterm === x[0] ? ' on' : '') + '" data-i="' + x[0] + '" title="' + esc(x[1]) + '">' + x[0] + '</button>'; }).join('')
      + '<button type="button" class="sug-chip' + (otro() ? ' on' : '') + '" data-i="OTRO">Otro…</button></div>'
      + '<input type="text" id="extIncOtro" maxlength="40" autocomplete="off" placeholder="Escribe el Incoterm (ej. FOB Puerto Quetzal)" value="' + (otro() ? esc(EXT.incoterm) : '') + '" ' + (otro() ? '' : 'hidden') + '>'
      + '<label class="ext-l" for="extDir">Dirección del cliente <small>(opcional)</small></label><input type="text" id="extDir" maxlength="300" autocomplete="off" value="' + esc(EXT.direccion) + '" placeholder="Calle, ciudad">'
      + '<label class="ext-l" for="extTc">Tipo de cambio para convertir sacos a US$ <small>(Q por US$1)</small></label><input type="number" id="extTc" inputmode="decimal" step="any" min="0" value="' + (EXT.tc || (tc ? tc : '')) + '" placeholder="Ej: 7.65">'
      + (hayTelas ? '<p class="av-nota">Los sacos se listan en quetzales: el precio en dólares sale de dividir entre este tipo de cambio.</p>' : '')
      + '</div>'
      + '<div class="av-acc"><button type="button" class="av-btn av-pri" id="extListo">Listo</button></div></div>';
    ov.addEventListener('click', function (e) { if (e.target === ov) cerrar(); });
    document.body.appendChild(ov);
    function mostrar() { $('extCampos').hidden = !EXT.on; $('extLocal').className = !EXT.on ? 'on' : ''; $('extExt').className = EXT.on ? 'on' : ''; $('extLocal').setAttribute('aria-checked', !EXT.on); $('extExt').setAttribute('aria-checked', EXT.on); }
    $('extLocal').onclick = function () { EXT.on = false; mostrar(); };
    $('extExt').onclick = function () { EXT.on = true; mostrar(); };
    $('extPaisBtn').onclick = async function () {
      var ps = await cargarPaises();
      if (!ps.length) { if (typeof toast === 'function') toast('No se pudo cargar la lista de países. Revisa tu conexión.', 'err'); return; }
      LGM.picker({ titulo: 'País del cliente', valor: EXT.pais, buscar: true,
        opciones: ps.map(function (p) { return { valor: p.nombre, texto: p.nombre, grupo: p.region }; }),
        alElegir: function (v) { EXT.pais = v; $('extPaisBtn').querySelector('.pk-btn-v').textContent = v; } });
    };
    $('extInc').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var v = b.getAttribute('data-i');
      [].forEach.call($('extInc').children, function (c) { c.classList.remove('on'); }); b.classList.add('on');
      if (v === 'OTRO') { $('extIncOtro').hidden = false; $('extIncOtro').focus(); EXT.incoterm = ($('extIncOtro').value || '').trim(); return; }
      $('extIncOtro').hidden = true; EXT.incoterm = v;
    };
    $('extListo').onclick = function () {
      if (EXT.on) {
        if (!$('extIncOtro').hidden) EXT.incoterm = ($('extIncOtro').value || '').trim().slice(0, 40);
        EXT.direccion = ($('extDir').value || '').trim(); EXT.tc = ($('extTc').value || '').trim();
        if (!EXT.pais) { if (typeof toast === 'function') toast('Elige el país del cliente', 'err'); return; }
        if (!EXT.incoterm) { if (typeof toast === 'function') toast('Elige el Incoterm', 'err'); return; }
      }
      cerrar(); aplicar();
      if (typeof toast === 'function') toast(EXT.on ? 'Cliente del exterior: ' + EXT.pais + ' · ' + EXT.incoterm + ' · dólares sin IVA' : 'Cliente local');
    };
    if (typeof cerrarMenu === 'function') try { cerrarMenu(); } catch (e) {}
  };

  // El chip de IVA no se cambia en una exportación
  window.addEventListener('load', function () {
    var t0 = window.tlToggleIva;
    if (typeof t0 === 'function') window.tlToggleIva = function () { if (EXT.on) { if (typeof toast === 'function') toast('Las exportaciones van sin IVA'); return; } return t0.apply(this, arguments); };
    pintarChip();
    if (window.LGM && LGM.on) LGM.on('carrito:render', function () { /* el tipo de cambio por defecto puede cambiar al sincronizar */ });
  });
})();
