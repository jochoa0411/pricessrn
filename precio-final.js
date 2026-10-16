// ── Precio FINAL de una línea, editable a mano ──────────────────────────────────────────────────────────────
// El vendedor escribe cuánto cuesta la línea completa (no el precio por pie² ni el unitario) y el sistema recalcula todo lo demás:
// precio por pie² (telas) o unitario (sacos), precio por pieza y total. Se guarda como precio manual y se puede volver al de lista.
(function () {
  function $(id) { return document.getElementById(id); }
  function f(v, d) { return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  var cur = null;                       // { it, esTela, mon, simbolo }

  function precioLista(it) {            // precio de lista por pie² (tela) o unitario (saco), con el recargo/descuento de la línea
    var r = 1 + (it.recargo || 0) / 100;
    if (it.tipo === 'tela') {
      var t = TELAS.filter(function (x) { return x.id === it.telaId; })[0];
      return t ? (it.modo === 'master' ? t.pm : t.pc) * r : null;
    }
    var s = SACOS.filter(function (x) { return x.id === it.sacoId; })[0];
    var v = s ? precioTierSaco(s, it.tier || 'A', it.listaId) : null;
    return v == null ? null : v * r;
  }
  function totalActual(it) { return it.tipo === 'tela' ? (it.tc ? it.totalQ : it.tu) : it.totalQ; }

  window.abrirPrecioFinal = function (uid) {
    var it = CARRITO.filter(function (x) { return x.uid === uid; })[0]; if (!it) return;
    var esTela = it.tipo === 'tela', enQ = !esTela || !!it.tc;
    cur = { it: it, esTela: esTela, simbolo: enQ ? 'Q' : '$', mon: enQ ? 'Q' : 'US$' };
    $('pfTitulo').textContent = it.nombre;
    $('pfDetalle').textContent = esTela
      ? ((it.cant || 1) + ((it.cant || 1) === 1 ? ' pieza' : ' piezas') + ' · ancho cobrado ' + f(it.aCobFt, 1) + ' ft × ' + f(it.lFt, 1) + ' ft')
      : (it.cantidad + ' unidades · ' + (it.medidas || ''));
    $('pfLbl').textContent = 'Precio final de la línea (' + cur.mon + ')';
    $('pfInput').value = totalActual(it) != null ? Number(totalActual(it)).toFixed(2) : '';
    $('pfLista').style.display = it.precioManual ? 'block' : 'none';
    $('modalPrecioFinal').classList.remove('hidden');
    pfVista();
    setTimeout(function () { $('pfInput').focus(); $('pfInput').select(); }, 80);
  };
  window.cerrarPrecioFinal = function () { $('modalPrecioFinal').classList.add('hidden'); cur = null; };

  function leer() { var v = parseFloat(String($('pfInput').value).replace(',', '.')); return v > 0 ? v : null; }
  // Vista previa: qué quedaría con ese precio final
  window.pfVista = function () {
    if (!cur) return; var it = cur.it, v = leer(), box = $('pfCalc');
    if (!v) { box.innerHTML = 'Escribe el precio final para ver cómo queda.'; $('pfOk').disabled = true; return; }
    $('pfOk').disabled = false;
    var lista = precioLista(it), l = [];
    if (cur.esTela) {
      var totalUsd = it.tc ? v / it.tc : v, pPie = totalUsd / it.ar, piezas = it.cant || 1;
      l.push('Por pieza: <b>' + cur.simbolo + f(v / piezas, 2) + '</b>');
      l.push('Por pie²: <b>$' + f(pPie, 3) + '</b>' + (lista ? ' <span>(lista $' + f(lista, 3) + ' · ' + (pPie >= lista ? '+' : '') + f((pPie / lista - 1) * 100, 1) + ' %)</span>' : ''));
      l.push('Por m²: <b>$' + f(pPie * 10.7639, 2) + '</b>');
    } else {
      var u = v / it.cantidad;
      l.push('Por unidad: <b>Q' + f(u, 2) + '</b>' + (lista ? ' <span>(lista Q' + f(lista, 2) + ' · ' + (u >= lista ? '+' : '') + f((u / lista - 1) * 100, 1) + ' %)</span>' : ''));
    }
    box.innerHTML = l.join('<br>');
  };
  window.aplicarPrecioFinal = function () {
    if (!cur) return; var it = cur.it, v = leer(); if (!v) return;
    var r = 1 + (it.recargo || 0) / 100;
    if (cur.esTela) {
      var totalUsd = it.tc ? v / it.tc : v;
      it.precioManual = Math.round(totalUsd / it.ar / r * 1e8) / 1e8;
      it.p = it.precioManual * r; it.tu = it.ar * it.p; it.totalQ = it.tc ? it.tu * it.tc : null;
    } else {
      it.precioManual = Math.round(v / it.cantidad / r * 1e8) / 1e8;
      it.precioUnit = it.precioManual * r; it.totalQ = it.cantidad * it.precioUnit;
    }
    it.igualOk = true; it.precioFinalManual = 1;
    cerrarPrecioFinal(); saveCarrito(); renderCarrito();
    toast('Precio final: ' + cur_s(it));
  };
  function cur_s(it) { var v = totalActual(it); return (it.tipo === 'tela' && !it.tc ? '$' : 'Q') + f(v, 2); }
  window.volverPrecioLista = function () {
    if (!cur) return; var it = cur.it, l = precioLista(it);
    if (l == null) { toast('No se encontró el precio de lista de este producto', 'err'); return; }
    it.precioManual = null; it.precioFinalManual = 0;
    if (cur.esTela) { it.p = l; it.tu = it.ar * it.p; it.totalQ = it.tc ? it.tu * it.tc : null; }
    else { it.precioUnit = l; it.totalQ = it.cantidad * it.precioUnit; }
    cerrarPrecioFinal(); saveCarrito(); renderCarrito(); toast('Vuelve al precio de lista');
  };
})();
