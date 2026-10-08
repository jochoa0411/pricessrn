// ── Listas de precios por cliente (sacos) ──────────────────────────────────────
// Cada cliente puede tener su propia lista con dos precios por saco: «Base» y «+10 %». Se administran en el
// PFS (Catálogo de Precios › Por cliente) y llegan con la lista general (GET /precios). Al cotizar un saco:
//   · si el cliente de la tarjeta Cliente coincide con una lista, se elige sola («Lista de Rudy Tambito»);
//   · el vendedor puede cambiar a otra lista o volver a la General (A / B / C) en cualquier momento.
// La lista general A/B/C no cambia. Un saco sin precio en la lista elegida no se puede cotizar con ella.
var LISTAS_CLIENTE = [];
var LISTAS_REV = 0;
var _listaManual = false;      // el vendedor eligió la lista a mano: ya no se cambia sola al cambiar el cliente

(function () {
  function $(id) { return document.getElementById(id); }
  function norm(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  window.cargarListasLocal = function () {
    try { var o = JSON.parse(localStorage.getItem('LISTAS_CLIENTE') || 'null'); LISTAS_CLIENTE = (o && o.listas) || []; LISTAS_REV = (o && o.rev) || 0; } catch (e) { LISTAS_CLIENTE = []; LISTAS_REV = 0; }
  };
  window.guardarListasCliente = function (rev, listas) {
    LISTAS_CLIENTE = listas || []; LISTAS_REV = rev || 0;
    try { localStorage.setItem('LISTAS_CLIENTE', JSON.stringify({ rev: LISTAS_REV, listas: LISTAS_CLIENTE })); } catch (e) {}
    renderListasSelect(); if (typeof loadSelects === 'function') loadSelects();
    if (typeof actSacoPreview === 'function') actSacoPreview();
  };

  window.listaPorId = function (id) { return LISTAS_CLIENTE.filter(function (l) { return l.id === Number(id); })[0] || null; };
  window.listaSacoId = function () { var v = $('cotListaSaco') ? $('cotListaSaco').value : ''; return v ? Number(v) : null; };
  window.tierLabel = function (t) { return t === 'BASE' ? 'Base' : t === 'MAS10' ? '+10 %' : t; };
  // «Lista de Rudy · Base»  /  «Tier A»
  window.etiquetaTierItem = function (it) { return it.listaNombre ? 'Lista ' + it.listaNombre + ' · ' + tierLabel(it.tier) : 'Tier ' + it.tier; };

  // Precio (o null si no existe) de un saco para un nivel: A/B/C de la general, BASE/MAS10 de una lista de cliente
  window.precioTierSaco = function (s, tier, listaId) {
    if (tier === 'BASE' || tier === 'MAS10') {
      var l = listaPorId(listaId); var pr = l && l.precios && l.precios[s.id];
      var v = pr ? (tier === 'BASE' ? pr.base : pr.mas10) : null;
      return v == null ? null : Number(v);
    }
    return s['p' + tier];
  };
  function tieneAlgunPrecio(l, s) { var p = l.precios && l.precios[s.id]; return !!(p && (p.base != null || p.mas10 != null)); }

  // Cliente de la tarjeta → lista: por código del catálogo y, si no, por las palabras del nombre de la lista
  window.listaParaCliente = function (nombre, cod) {
    if (!LISTAS_CLIENTE.length) return null;
    if (cod) { var c = LISTAS_CLIENTE.filter(function (l) { return l.cod_cliente && l.cod_cliente === cod; })[0]; if (c) return c; }
    var palabras = norm(nombre).split(/[^a-z0-9]+/).filter(Boolean);
    var mejor = null, mejorN = 0;
    LISTAS_CLIENTE.forEach(function (l) {
      var toks = norm(l.nombre).split(/[^a-z0-9]+/).filter(Boolean);
      if (toks.length && toks.every(function (t) { return palabras.indexOf(t) >= 0; }) && toks.length > mejorN) { mejor = l; mejorN = toks.length; }
    });
    return mejor;
  };

  // ── Selector de lista + niveles de precio ──
  window.renderTiers = function (listaId, seleccion) {
    var g = $('tierGroup'); if (!g) return;
    var opts = listaId ? [['BASE', 'Base'], ['MAS10', '+10 %']] : [['A', 'A'], ['B', 'B'], ['C', 'C']];
    g.innerHTML = opts.map(function (o, i) {
      var on = seleccion ? seleccion === o[0] : i === 0;
      return '<label class="tier-opt"><input type="radio" name="cotTierSaco" value="' + o[0] + '"' + (on ? ' checked' : '') + ' onchange="cotCalcSaco()"><span>' + o[1] + '</span></label>';
    }).join('');
    var lb = $('tierLabel'); if (lb) lb.textContent = listaId ? 'Precio de la lista' : 'Nivel de precio (A = más bajo · C = más alto)';
  };

  window.renderListasSelect = function () {
    var campo = $('cotListaCampo'), sel = $('cotListaSaco'); if (!sel) return;
    var actual = sel.value;
    campo.style.display = LISTAS_CLIENTE.length ? '' : 'none';
    sel.innerHTML = '<option value="">General (A / B / C)</option>' + LISTAS_CLIENTE.map(function (l) {
      return '<option value="' + l.id + '">Lista de ' + String(l.nombre).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</option>';
    }).join('');
    if (actual && listaPorId(actual)) sel.value = actual; else sel.value = '';
    renderTiers(listaSacoId(), null);
    if (window.pkSyncLista) pkSyncLista();
  };

  window.cambiarListaSaco = function (manual) {
    if (manual) _listaManual = true;
    var prev = (document.querySelector('input[name="cotTierSaco"]:checked') || {}).value;
    var id = listaSacoId();
    // Conserva el nivel equivalente: A↔Base, B↔+10 %
    var mapa = id ? { A: 'BASE', B: 'MAS10', C: 'MAS10' } : { BASE: 'A', MAS10: 'B' };
    renderTiers(id, mapa[prev] || null);
    if (typeof loadSelects === 'function') loadSelects();
    var ss = $('cotSacoSelect'); if (ss && ss.value && !ss.querySelector('option[value="' + ss.value + '"]')) ss.value = '';
    if (typeof actSacoPreview === 'function') actSacoPreview(); else cotCalcSaco();
    pintarChipLista();
    if (window.pkSyncLista) pkSyncLista();
  };
  window.setListaSaco = function (id, tier) {     // al editar un ítem del presupuesto
    var sel = $('cotListaSaco'); if (!sel) return;
    sel.value = id && listaPorId(id) ? String(id) : '';
    _listaManual = true;
    renderTiers(listaSacoId(), tier || null);
    if (typeof loadSelects === 'function') loadSelects();
    pintarChipLista();
    if (window.pkSyncLista) pkSyncLista();
  };

  window.pintarChipLista = function () {
    var chip = $('cotListaChip'); if (!chip) return;
    var l = listaPorId(listaSacoId());
    chip.style.display = l ? 'inline-flex' : 'none';
    if (l) chip.innerHTML = (typeof _ic === 'function' ? _ic('user') : '') + ' Cotizando con la lista de ' + String(l.nombre).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  };

  // Cambia sola la lista cuando cambia el cliente (salvo que el vendedor ya haya elegido una a mano)
  window.autoListaCliente = function () {
    if (!$('cotListaSaco') || !LISTAS_CLIENTE.length) return;
    var nombre = $('cotCliente').value.trim();
    var cod = (typeof _clienteSel !== 'undefined' && _clienteSel && _clienteSel.nombre === nombre) ? _clienteSel.codigo : '';
    var l = nombre ? listaParaCliente(nombre, cod) : null;
    var nuevo = l ? String(l.id) : '';
    if ($('cotListaSaco').value === nuevo) { pintarChipLista(); return; }
    $('cotListaSaco').value = nuevo;
    cambiarListaSaco(false);
    if (l && typeof toast === 'function') toast('Sacos con la lista de ' + l.nombre);
  };

  // Aviso cuando el saco elegido no tiene el precio pedido en la lista del cliente
  window.avisoSacoSinPrecio = function (s, tier) {
    var a = $('cotAvisoSaco'); if (!a) return;
    if (!s) { a.style.display = 'none'; return; }
    var l = listaPorId(listaSacoId());
    a.style.display = 'block';
    a.innerHTML = '<strong>Sin precio ' + tierLabel(tier) + '</strong> para este saco en la lista de ' + (l ? String(l.nombre).replace(/&/g, '&amp;') : 'este cliente') + '. Elige el otro precio, escribe un precio manual o cambia a la lista General.';
  };

  // Opciones de sacos: con una lista elegida, las que no tienen precio en ella se muestran atenuadas y sin poder elegirse
  // «  ·  Q1.65 / Q1.82» junto al nombre del saco cuando hay una lista de cliente elegida
  window.precioListaTxt = function (s) {
    var l = listaPorId(listaSacoId()); var p = l && l.precios && l.precios[s.id]; if (!p) return '';
    var f = function (v) { return v == null ? '—' : 'Q' + Number(v).toFixed(2); };
    return ' · ' + f(p.base) + ' / ' + f(p.mas10);
  };
  window.sacoDisponibleEnLista = function (s) {
    var l = listaPorId(listaSacoId());
    return !l || tieneAlgunPrecio(l, s);
  };

  window.addEventListener('load', function () {
    var c = $('cotCliente'); if (c) { c.addEventListener('change', autoListaCliente); c.addEventListener('blur', function(){ setTimeout(autoListaCliente, 150); }); } cargarListasLocal(); renderListasSelect(); pintarChipLista(); });
})();
