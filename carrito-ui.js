// ── Presupuesto (carrito): gestión rápida de ítems ─────────────────────────────
// - Cantidad ajustable en la propia fila (− / +) sin abrir el formulario.
// - Editar NO saca el ítem del presupuesto: se carga en el formulario y se reemplaza en su lugar al guardar
//   (si se cancela, no se pierde nada).
// - Duplicar, quitar y vaciar con «Deshacer».
// - Total correcto con monedas mezcladas y aviso de precios anteriores por ítem.
// Solo toca la presentación y el arreglo CARRITO; el cálculo de cada ítem sigue en cotizador.html.
(function () {
  function $(id) { return document.getElementById(id); }
  function fmt(v, d) { return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function ic(n, size) { return typeof _ic === 'function' ? _ic(n, size) : ''; }
  function esc(v) { return typeof _esc === 'function' ? _esc(v) : String(v == null ? '' : v); }

  var editUid = null;     // uid del ítem que se está editando (sigue dentro del presupuesto)
  var undoTimer = null;

  // ── Aviso con «Deshacer» ──
  function toastUndo(msg, accion) {
    var el = $('toastUndo');
    if (!el) {
      el = document.createElement('div'); el.id = 'toastUndo'; el.className = 'toast-undo';
      el.innerHTML = '<span id="tuMsg"></span><button type="button" id="tuBtn">Deshacer</button>';
      document.body.appendChild(el);
    }
    $('tuMsg').textContent = msg;
    $('tuBtn').onclick = function () { clearTimeout(undoTimer); el.classList.remove('show'); accion(); };
    el.classList.add('show');
    clearTimeout(undoTimer);
    undoTimer = setTimeout(function () { el.classList.remove('show'); }, 7000);
  }

  function guardar() { saveCarrito(); renderCarrito(); }

  // ── Render ──
  function detalleTela(it) {
    var sol = it.ua === 'm' ? fmt(it.aSolM, 2) + ' m' : fmt(it.aSolFt, 1) + ' ft';
    var largo = it.ul === 'm' ? fmt(it.lM, 2) + ' m' : fmt(it.lFt, 1) + ' ft';
    var ac = window.tlAcabadoTxt ? tlAcabadoTxt(it) : '';
    return (it.modo === 'master' ? 'Master' : 'Confeccionado') + (ac ? ' · ' + ac : '') + ' · ' + sol + ' × ' + largo + (it.cant > 1 ? ' c/u' : '')
      + ' · $' + Number(it.p).toFixed(3) + '/pie²' + (it.tc ? ' · TC ' + it.tc : '');
  }
  function notaCobro(it) {
    if (Math.abs(it.aCobFt - it.aSolFt) <= 0.05) return '';
    var cob = it.ua === 'm' ? fmt(it.aCobM, 2) + ' m (' + fmt(it.aCobFt, 0) + ' ft)' : fmt(it.aCobFt, 0) + ' ft';
    return '<div class="cx-nota">' + ic('warn') + ' Se cobra ancho de ' + cob + ' (múltiplo de 6 ft)</div>';
  }
  function precioAnterior(it) {
    if (typeof _precioVigenteItem !== 'function') return false;
    var v = _precioVigenteItem(it), actual = it.tipo === 'tela' ? it.p : it.precioUnit;
    return v !== null && Math.abs(v - actual) > 1e-9;
  }

  function fila(it) {
    var tela = it.tipo === 'tela';
    var cantidad = tela ? (it.cant || 1) : it.cantidad;
    var total = it.totalQ != null ? 'Q' + fmt(it.totalQ, 2) : '$' + fmt(it.tu, 2) + ' USD';
    var detalle = tela ? detalleTela(it)
      : esc(it.medidas || '') + ' · ' + esc(etiquetaTierItem(it)) + ' · Q' + fmt(it.precioUnit, 2) + '/u';
    var uid = it.uid;
    return '<div class="cx-item' + (tela ? '' : ' saco') + (editUid === uid ? ' editando' : '') + '">'
      + '<div class="cx-top">'
      +   '<span class="cx-ico">' + ic(tela ? 'fabric' : 'bag') + '</span>'
      +   '<div class="cx-txt"><div class="cx-n">' + esc(it.nombre) + '</div><div class="cx-d">' + detalle + '</div>'
      +     (tela ? notaCobro(it) : '')
      +     (precioAnterior(it) ? '<button type="button" class="opt-chip alerta cx-viejo" onclick="cxActualizarPrecios()">' + ic('refresh') + ' Precio anterior · actualizar</button>' : '')
      +   '</div>'
      +   '<div class="cx-tot">' + total + '</div>'
      + '</div>'
      + '<div class="cx-bot">'
      +   '<div class="cx-step" role="group" aria-label="Cantidad">'
      +     '<button type="button" onclick="cxQty(' + uid + ',-1)" aria-label="Menos">−</button>'
      +     '<span><b>' + cantidad + '</b> ' + (tela ? (cantidad === 1 ? 'corte' : 'cortes') : 'u') + '</span>'
      +     '<button type="button" onclick="cxQty(' + uid + ',1)" aria-label="Más">+</button>'
      +   '</div>'
      +   '<div class="cx-acc">'
      +     '<button type="button" onclick="editarItemCarrito(' + uid + ')" aria-label="Editar ítem" title="Editar">' + ic('edit') + '</button>'
      +     '<button type="button" onclick="cxDuplicar(' + uid + ')" aria-label="Duplicar ítem" title="Duplicar">' + ic('copy') + '</button>'
      +     '<button type="button" class="danger" onclick="quitarItem(' + uid + ')" aria-label="Quitar ítem" title="Quitar">' + ic('trash') + '</button>'
      +   '</div>'
      + '</div></div>';
  }

  function badgeCarrito() {
    var b = $('navBadgeCarrito'); if (!b) return;
    b.style.display = CARRITO.length ? 'inline-flex' : 'none';
    b.textContent = CARRITO.length;
    var bn = $('bnBadgeCarrito'); if (bn) { bn.style.display = CARRITO.length ? 'block' : 'none'; bn.textContent = CARRITO.length; }
  }

  window.renderCarrito = function () {
    var list = $('cartList'), footer = $('cartFooter'), badge = $('cartBadge'), total = $('cartTotal');
    badge.textContent = CARRITO.length + (CARRITO.length === 1 ? ' ítem' : ' ítems');
    if (!CARRITO.length) {
      list.innerHTML = '<div class="cx-vacio">' + ic('clipboard') + '<div>Aún no hay ítems</div><small>Configura una tela o un saco arriba y toca «Agregar».</small></div>';
      footer.style.display = 'none';
      badgeCarrito();
      return;
    }
    list.innerHTML = CARRITO.map(fila).join('')
      + '<button type="button" class="cx-add" onclick="cxAgregarOtro()">' + ic('plus') + ' Agregar otro ítem</button>';

    // Total: Q de los ítems con TC (y sacos) + US$ de las telas sin TC
    var q = 0, usd = 0, sinTc = 0;
    CARRITO.forEach(function (i) { if (i.totalQ != null) q += i.totalQ; else { usd += i.tu || 0; sinTc++; } });
    var txt;
    if (sinTc && q > 0) txt = 'Q' + fmt(q, 2) + ' + $' + fmt(usd, 2) + ' USD';
    else if (sinTc) txt = '$' + fmt(usd, 2) + ' USD';
    else txt = 'Q' + fmt(q, 2);
    total.textContent = txt;
    var aviso = $('cartAviso');
    if (aviso) {
      aviso.style.display = (sinTc && q > 0) ? 'flex' : 'none';
      aviso.innerHTML = (sinTc && q > 0) ? ic('warn') + ' Mezcla de monedas: pasa las telas a Quetzales (tipo de cambio) para enviar una sola cotización.' : '';
    }
    footer.style.display = 'block';
    if (typeof syncTelaUI === 'function') syncTelaUI();
    badgeCarrito();
  };

  // ── Cantidad en la fila ──
  window.cxQty = function (uid, d) {
    var it = CARRITO.find(function (x) { return x.uid === uid; });
    if (!it) return;
    if (it.tipo === 'tela') {
      it.cant = Math.max(1, (it.cant || 1) + d);
      it.ar = it.arCorte * it.cant;
      it.tu = it.ar * it.p;
      it.totalQ = it.tc ? it.tu * it.tc : null;
    } else {
      it.cantidad = Math.max(1, (it.cantidad || 1) + d);
      it.totalQ = it.cantidad * it.precioUnit;
    }
    guardar();
  };

  window.cxDuplicar = function (uid) {
    var i = CARRITO.findIndex(function (x) { return x.uid === uid; });
    if (i < 0) return;
    var copia = JSON.parse(JSON.stringify(CARRITO[i]));
    copia.uid = Date.now() + Math.random(); copia.addedAt = Date.now();
    CARRITO.splice(i + 1, 0, copia);
    guardar();
    toast('Ítem duplicado');
  };

  window.cxActualizarPrecios = function () {
    if (typeof _actualizarPreciosCarrito !== 'function') return;
    var n = _actualizarPreciosCarrito();
    toast(n + (n === 1 ? ' ítem actualizado' : ' ítems actualizados') + ' a los precios vigentes');
  };

  window.cxAgregarOtro = function () {
    var tabs = document.querySelector('.tabs'); if (tabs) tabs.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var sel = $('cot-saco').classList.contains('active') ? $('cotSacoSelect') : $('cotTelaSelect');
    setTimeout(function () { if (sel) sel.focus(); }, 350);
  };

  // ── Quitar / vaciar con deshacer ──
  window.quitarItem = function (uid) {
    var i = CARRITO.findIndex(function (x) { return x.uid === uid; });
    if (i < 0) return;
    var it = CARRITO.splice(i, 1)[0];
    if (editUid === uid) cancelarEdicion(true);
    guardar();
    toastUndo('Ítem quitado', function () { CARRITO.splice(Math.min(i, CARRITO.length), 0, it); guardar(); });
  };
  window.limpiarCarrito = function () {
    if (!CARRITO.length) return;
    var copia = CARRITO.slice();
    CARRITO = [];
    cancelarEdicion(true);
    guardar();
    toastUndo('Presupuesto vaciado (' + copia.length + (copia.length === 1 ? ' ítem' : ' ítems') + ')', function () { CARRITO = copia; guardar(); });
  };

  // ── Edición en su lugar ──
  function bannerEl() {
    var b = $('editBanner');
    if (!b) {
      b = document.createElement('div'); b.id = 'editBanner'; b.className = 'edit-banner'; b.style.display = 'none';
      var tabs = document.querySelector('.tabs'); tabs.parentNode.insertBefore(b, tabs);
    }
    return b;
  }
  function etiquetasAgregar(editando) {
    document.querySelectorAll('[onclick="agregarTela()"],[onclick="agregarSaco()"]').forEach(function (btn) {
      if (btn.dataset.orig === undefined) btn.dataset.orig = btn.innerHTML;
      var enBarra = btn.closest('#tlBar');
      btn.innerHTML = editando ? ic('check') + (enBarra ? ' Guardar' : ' Guardar cambios') : btn.dataset.orig;
    });
  }
  function limpiarFormularios() {
    ['cotAncho', 'cotLargo', 'cotPrecioManual', 'cotCantSaco', 'cotPMSaco'].forEach(function (id) { var e = $(id); if (e) e.value = ''; });
    $('cotCantTela').value = 1; $('cotRecargo').value = 0; $('cotRecargoSaco').value = 0;
    $('cotTelaSelect').value = ''; $('cotSacoSelect').value = '';
    $('cotTelaPreview').style.display = 'none'; $('cotSacoPreview').style.display = 'none';
    $('cotResTela').classList.remove('show'); $('cotResSaco').classList.remove('show');
    if (typeof tlRenderModos === 'function') tlRenderModos(null, 'master');
    if (typeof syncTelaUI === 'function') syncTelaUI();
  }
  window.cancelarEdicion = function (silencioso) {
    if (editUid === null) return;
    editUid = null;
    bannerEl().style.display = 'none';
    etiquetasAgregar(false);
    limpiarFormularios();
    renderCarrito();
    if (!silencioso) toast('Edición cancelada: el ítem quedó como estaba');
  };

  window.editarItemCarrito = function (uid) {
    var item = CARRITO.find(function (x) { return x.uid === uid; });
    if (!item) return;
    editUid = uid;

    var tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(function (b) { b.classList.remove('active'); });
    document.querySelectorAll('.tab-content').forEach(function (t) { t.classList.remove('active'); });
    if (item.tipo === 'tela') {
      tabBtns[0].classList.add('active'); $('cot-tela').classList.add('active');
      $('cotTelaSelect').value = item.telaId;
      $('cotUAncho').value = item.ua; $('cotAncho').value = item.ua === 'm' ? item.aSolM : item.aSolFt;
      $('cotULargo').value = item.ul; $('cotLargo').value = item.ul === 'm' ? item.lM : item.lFt;
      $('cotCantTela').value = item.cant != null ? item.cant : 1;
      $('cotTC').value = item.tc != null ? item.tc : '';
      $('cotRecargo').value = item.recargo != null ? item.recargo : 0;
      $('cotPrecioManual').value = item.precioManual != null ? item.precioManual : '';
      var mr = document.querySelector('input[name="cotModoTela"][value="' + (item.modo || 'conf') + '"]');
      if (mr) mr.checked = true;
      if (window.tlSetAcabado) tlSetAcabado(item);
      actTelaPreview();
    } else {
      tabBtns[1].classList.add('active'); $('cot-saco').classList.add('active');
      setListaSaco(item.listaId, item.tier);
      $('cotSacoSelect').value = item.sacoId;
      $('cotCantSaco').value = item.cantidad;
      $('cotRecargoSaco').value = item.recargo != null ? item.recargo : 0;
      $('cotPMSaco').value = item.precioManual != null ? item.precioManual : '';
      var tr = document.querySelector('input[name="cotTierSaco"][value="' + (item.tier || 'A') + '"]');
      if (tr) tr.checked = true;
      actSacoPreview();
    }

    var b = bannerEl();
    b.innerHTML = '<span>' + ic('edit') + ' Editando <b>' + esc(item.nombre) + '</b></span><button type="button" onclick="cancelarEdicion()">Cancelar</button>';
    b.style.display = 'flex';
    etiquetasAgregar(true);
    renderCarrito();
    b.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Al «agregar» en modo edición, el ítem nuevo reemplaza al original en su misma posición
  LGM.on('item:agregado', function (ev) {
    if (editUid === null) return;
    var idx = CARRITO.findIndex(function (x) { return x.uid === editUid; });
    if (idx >= 0) {
      var nuevo = CARRITO.pop();         // el recién agregado
      idx = CARRITO.findIndex(function (x) { return x.uid === editUid; });
      nuevo.uid = editUid;
      CARRITO[idx] = nuevo;
      ev.actualizado = true;
    }
    editUid = null; bannerEl().style.display = 'none'; etiquetasAgregar(false);
  });

  window.addEventListener('load', function () { renderCarrito(); });
})();
