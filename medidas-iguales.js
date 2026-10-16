// ── Aviso: medidas distintas con el MISMO precio ─────────────────────────────────────────────────────────
// La tela se cobra por múltiplos de 6 pies de ancho (el largo es el pedido). Dos medidas terminadas distintas pueden caer en el
// mismo ancho cobrado y por eso costar lo mismo, aunque una deje más desperdicio. El sistema solo AVISA y SUGIERE: el vendedor
// decide. La sugerencia cobra el área terminada más una parte del desperdicio (K_DESP_SUGERIDO); nunca se aplica sola.
var K_DESP_SUGERIDO = 0.5;      // 0 = solo lo que recibe el cliente · 1 = todo el ancho cobrado (precio actual)

(function () {
  function r2(v) { return Math.round(Number(v || 0) * 100) / 100; }
  function f(v, d) { return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function medidaTxt(it) {
    var a = it.ua === 'm' ? f(it.aSolM, 2) + ' m' : f(it.aSolFt, 1) + ' ft';
    var l = it.ul === 'm' ? f(it.lM, 2) + ' m' : f(it.lFt, 1) + ' ft';
    return a + ' × ' + l;
  }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // Grupos de ≥ 2 líneas de tela con la misma tela, modalidad, tarifa por pie², ancho cobrado y largo, pero ancho pedido distinto.
  // No se avisa de lo que el vendedor ya resolvió (precio manual o «dejar igual»).
  window.gruposMismoPrecio = function () {
    var mapa = {};
    CARRITO.forEach(function (it) {
      if (it.tipo !== 'tela' || it.precioManual || it.igualOk || !(it.aCobFt > 0) || !(it.lFt > 0) || !(it.p > 0)) return;
      var k = [it.telaId, it.modo, r2(it.p * 1000), r2(it.aCobFt), r2(it.lFt)].join('|');
      (mapa[k] = mapa[k] || []).push(it);
    });
    var grupos = [];
    Object.keys(mapa).forEach(function (k) {
      var arr = mapa[k];
      var distintas = arr.some(function (x) { return Math.abs(x.aSolFt - arr[0].aSolFt) > 0.05; });
      if (arr.length >= 2 && distintas) grupos.push(arr.slice().sort(function (a, b) { return b.aSolFt - a.aSolFt; }));
    });
    return grupos;
  };
  function enGrupo(it) {
    var gs = gruposMismoPrecio();
    for (var i = 0; i < gs.length; i++) if (gs[i].indexOf(it) >= 0) return gs[i];
    return null;
  }
  // Precio sugerido por corte (en la moneda de la línea): (terminado + K × desperdicio) × tarifa
  function sugerencia(it) {
    var terminado = it.aSolFt * it.lFt, arCorte = it.arCorte || it.aCobFt * it.lFt;
    var desp = Math.max(0, arCorte - terminado);
    var cortePrecio = (terminado + K_DESP_SUGERIDO * desp) * it.p, actual = arCorte * it.p;
    return { nuevo: cortePrecio, actual: actual, ahorroPct: actual > 0 ? (actual - cortePrecio) / actual * 100 : 0, desp: desp, despPct: arCorte > 0 ? desp / arCorte * 100 : 0 };
  }

  // HTML que se agrega a la línea del presupuesto (vacío si no aplica)
  window.avisoMedidasIguales = function (it) {
    var g = enGrupo(it); if (!g) return '';
    var mayor = g[0], s = sugerencia(it);
    var otras = g.filter(function (x) { return x !== it; });
    var ref = otras[0];
    if (it === mayor || s.ahorroPct < 0.5) {
      return '<div class="cx-igual"><div>' + (window._ic ? _ic('warn') : '') + ' <b>Mismo precio que otra medida:</b> «' + esc(medidaTxt(ref)) + '». Esta es la que más aprovecha el ancho cobrado.</div>'
        + '<div class="cx-igual-b"><button type="button" onclick="dejarIgual(' + it.uid + ')">Entendido</button></div></div>';
    }
    var mon = it.tc ? 'Q' : '$', mult = it.tc || 1;
    return '<div class="cx-igual"><div>' + (window._ic ? _ic('warn') : '') + ' <b>Mismo precio que «' + esc(medidaTxt(ref)) + '»</b> aunque esta medida es menor (desperdicio ' + f(s.despPct, 1) + ' %).'
      + '<br>Sugerencia: <b>' + mon + f(s.nuevo * mult, 2) + '</b> por corte en vez de ' + mon + f(s.actual * mult, 2) + ' (−' + f(s.ahorroPct, 1) + ' %). Tú decides.</div>'
      + '<div class="cx-igual-b"><button type="button" class="ok" onclick="aplicarSugerenciaIgual(' + it.uid + ')">Aplicar sugerencia</button>'
      + '<button type="button" onclick="dejarIgual(' + it.uid + ')">Dejar igual</button>'
      + '<button type="button" onclick="editarItemCarrito(' + it.uid + ')">Poner otro precio</button></div></div>';
  };
  window.dejarIgual = function (uid) {
    var it = CARRITO.filter(function (x) { return x.uid === uid; })[0]; if (!it) return;
    (enGrupo(it) || [it]).forEach(function (x) { x.igualOk = true; });     // se reconoce el aviso del grupo completo
    saveCarrito(); renderCarrito(); if (window._renderResumenEnvio && !document.getElementById('modalEnviarReal').classList.contains('hidden')) _renderResumenEnvio();
    toast('Se deja el mismo precio');
  };
  // Aplica la sugerencia como PRECIO MANUAL por pie² (conserva el recargo/descuento de la línea) y recalcula la línea.
  window.aplicarSugerenciaIgual = function (uid) {
    var it = CARRITO.filter(function (x) { return x.uid === uid; })[0]; if (!it) return;
    var s = sugerencia(it), arCorte = it.arCorte || it.aCobFt * it.lFt, r = (it.recargo || 0) / 100;
    var pNuevo = s.nuevo / arCorte;
    it.precioManual = Math.round(pNuevo / (1 + r) * 1e6) / 1e6;
    it.p = it.precioManual * (1 + r);
    it.tu = it.ar * it.p;
    it.totalQ = it.tc ? it.tu * it.tc : null;
    it.igualOk = true;
    saveCarrito(); renderCarrito();
    if (window._renderResumenEnvio && !document.getElementById('modalEnviarReal').classList.contains('hidden')) _renderResumenEnvio();
    toast('Precio ajustado: ' + (it.tc ? 'Q' : '$') + f(s.nuevo * (it.tc || 1), 2) + ' por corte');
  };
})();
