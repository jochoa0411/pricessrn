// ── Cotización REAL — conecta con el sistema LGM (ventas-cotizaciones) ──
// A diferencia de generarPDF() (local, muestra "Solicitado vs Cobrado" y el
// desperdicio de corte — solo para uso interno), esta función crea una
// cotización real en el ERP con líneas limpias (descripción/cantidad/precio/
// total, sin detalle de scrap) y la envía por correo usando la misma
// plantilla que el resto del sistema. El navegador nunca ve el PDF: la
// entrega es el correo.
//
// Requiere estar conectado a la red Tailscale de LGM (el servidor no tiene
// dominio público). La API key es pública (vive en este repo) — el servidor
// la limita con rate-limit estricto; si se filtra o se abusa, se rota desde
// el .env del servidor sin tocar este archivo.
var COT_API_BASE = 'https://100.86.2.32:3000';
var COT_API_KEY  = 'd866cc818c2333d59cc866fb254104632015258f7f7d36f8dd3b687f1c23072b';

function _emailValido(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim()); }

function _construirItemsCotizacionReal(){
  var hasSaco = CARRITO.some(function(i){ return i.tipo === 'saco'; });
  var telas = CARRITO.filter(function(i){ return i.tipo === 'tela'; });
  var telasSinTC = telas.filter(function(i){ return !i.tc; });
  var telasConTC = telas.filter(function(i){ return !!i.tc; });

  var moneda;
  if (hasSaco) {
    if (telasSinTC.length > 0) {
      return { error: 'Ingresa el Tipo de Cambio (TC) en estos ítems de tela para poder cotizar junto con los sacos (todo debe quedar en Quetzales): '
        + telasSinTC.map(function(i){ return i.nombre; }).join(', ') };
    }
    moneda = 'GTQ';
  } else if (telas.length > 0) {
    if (telasSinTC.length > 0 && telasConTC.length > 0) {
      return { error: 'Todos los ítems de tela deben usar la misma moneda: ingresa el Tipo de Cambio en todos, o en ninguno.' };
    }
    moneda = telasSinTC.length > 0 ? 'USD' : 'GTQ';
  } else {
    return { error: 'El presupuesto está vacío.' };
  }

  var items = CARRITO.map(function(item){
    if (item.tipo === 'tela') {
      // Medida SOLICITADA (la que el vendedor tecleó), no la redondeada a múltiplo de
      // 6ft que se usa internamente para calcular precio — eso es lo que no debe ver
      // el cliente; la medida pedida sí, porque es literalmente lo que va a recibir.
      var anchoLabel = item.ua === 'm' ? item.aSolM.toFixed(2) + 'm' : item.aSolFt.toFixed(1) + 'ft';
      var largoLabel = item.ul === 'm' ? item.lM.toFixed(2) + 'm' : item.lFt.toFixed(1) + 'ft';
      var medida = anchoLabel + ' x ' + largoLabel;
      var modoLabel = item.modo === 'master' ? 'Master' : 'Confeccionado';
      var precioSqft = moneda === 'GTQ' ? (item.p * item.tc) : item.p;

      if (item.modo === 'master') {
        // Rollo Master: material crudo, se vende por área continua.
        return {
          descripcion: item.nombre + ' — ' + medida + ' — ' + modoLabel,
          unidad: 'pie²',
          cantidad: item.ar,
          precio_unitario: precioSqft,
        };
      }
      // Confeccionado: pieza terminada (con ojetes/rebete) — se cotiza por unidad,
      // no por área; el precio unitario es el total de UNA pieza de esa medida.
      return {
        descripcion: item.nombre + ' — ' + medida + ' — ' + modoLabel,
        unidad: 'UNIDAD',
        cantidad: item.cant,
        precio_unitario: item.arCorte * precioSqft,
      };
    }
    return {
      descripcion: item.nombre + (item.medidas ? ' (' + item.medidas + ')' : ''),
      unidad: 'UNIDAD',
      cantidad: item.cantidad,
      precio_unitario: item.precioUnit,
    };
  });

  var total = items.reduce(function(s, it){ return s + it.cantidad * it.precio_unitario; }, 0);
  return { moneda: moneda, items: items, total: total };
}

// ── Modal de datos para la cotización real (correo, entrega, pago) — se abre
// solo al hacer click en "Generar cotización real", no queda fijo en pantalla ──
function abrirModalEnviarReal(){
  if (!CARRITO.length) { toast('El presupuesto está vacío', 'err'); return; }
  document.getElementById('modalEnviarReal').classList.remove('hidden');
}
function cerrarModalEnviarReal(){ document.getElementById('modalEnviarReal').classList.add('hidden'); }

// ── Confirmación persistente (no desaparece sola como el toast) ──
function cerrarModalCotReal(){ document.getElementById('modalCotReal').classList.add('hidden'); }

function _mostrarConfirmacionCotReal(estado, info){
  var titleEl = document.getElementById('mcrTitle');
  var bodyEl  = document.getElementById('mcrBody');

  if (estado === 'ok'){
    titleEl.textContent = '✅ Cotización enviada';
    bodyEl.innerHTML =
        '<p><strong>Folio:</strong> ' + info.no_cotizacion + '</p>'
      + '<p><strong>Enviada a:</strong> ' + info.vendedorCorreo + '</p>'
      + (info.clienteCorreo ? '<p><strong>Copia a:</strong> ' + info.clienteCorreo + '</p>' : '')
      + '<p style="margin-top:10px;padding:10px;background:#f0f9f5;border-radius:6px;color:#1a6b45;font-weight:700;">Revisa tu correo — debería llegar en segundos. Queda también en la pestaña Historial.</p>';
  } else if (estado === 'creada_sin_correo'){
    titleEl.textContent = '⚠️ Cotización creada, correo falló';
    bodyEl.innerHTML =
        '<p><strong>Folio:</strong> ' + info.no_cotizacion + ' (ya quedó guardada en el sistema)</p>'
      + '<p style="margin-top:8px;padding:10px;background:#fef9ec;border-radius:6px;color:#92400e;">' + (info.aviso || 'No se pudo enviar el correo automáticamente. Avisa a soporte con este folio para que te la reenvíen.') + '</p>';
  } else {
    titleEl.textContent = '❌ No se generó la cotización';
    bodyEl.innerHTML = '<p style="color:#d32f2f">' + (info.error || 'Error desconocido') + '</p>'
      + '<p style="margin-top:8px;font-size:12px;color:#888;">El presupuesto no se perdió — corrige e intenta de nuevo.</p>';
  }
  document.getElementById('modalCotReal').classList.remove('hidden');
}

// ── Registro permanente en Historial — para poder verificar después "¿se envió?" ──
function _registrarEnvioRealHistorial(data, armado, cliente, vendedorCorreo, clienteCorreo){
  var h = JSON.parse(localStorage.getItem('cotizaciones')||'[]');
  var entry = {
    ref: data.no_cotizacion,
    real: true,
    emailEnviado: data.email_enviado !== false,
    enviadoA: vendedorCorreo,
    clienteCorreo: clienteCorreo || '',
    cliente: cliente || 'Sin cliente',
    fecha: new Date().toLocaleString('es-GT'),
    items: JSON.parse(JSON.stringify(CARRITO)),
  };
  if (armado.moneda === 'GTQ') entry.totalQ = armado.total; else entry.totalUSD = armado.total;
  h.push(entry);
  localStorage.setItem('cotizaciones', JSON.stringify(h));
}

async function generarCotizacionReal(){
  if (!CARRITO.length) { toast('El presupuesto está vacío', 'err'); return; }

  var vendedorCorreo = (document.getElementById('merVendedorCorreo').value || '').trim();
  if (!_emailValido(vendedorCorreo)) {
    toast('Ingresa tu correo — ahí llega la cotización real', 'err');
    document.getElementById('merVendedorCorreo').focus();
    return;
  }
  var clienteCorreoEl = document.getElementById('merClienteCorreo');
  var clienteCorreo = (clienteCorreoEl.value || '').trim();
  if (clienteCorreo && !_emailValido(clienteCorreo)) {
    toast('El correo del cliente no es válido', 'err');
    clienteCorreoEl.focus();
    return;
  }

  var formaEntrega  = document.getElementById('merFormaEntrega').value.trim();
  var lugarEntrega  = document.getElementById('merLugarEntrega').value.trim();
  var tiempoEntrega = document.getElementById('merTiempoEntrega').value.trim();
  var formaPago     = document.getElementById('merFormaPago').value.trim();
  var entregaCampos = [
    ['merFormaEntrega', formaEntrega, 'la forma de entrega'],
    ['merLugarEntrega', lugarEntrega, 'el lugar de entrega'],
    ['merTiempoEntrega', tiempoEntrega, 'el tiempo de entrega'],
    ['merFormaPago', formaPago, 'la forma de pago'],
  ];
  for (var fi = 0; fi < entregaCampos.length; fi++) {
    if (!entregaCampos[fi][1]) {
      toast('Completa ' + entregaCampos[fi][2] + ' — lo necesita la cotización real', 'err');
      document.getElementById(entregaCampos[fi][0]).focus();
      return;
    }
  }

  var armado = _construirItemsCotizacionReal();
  if (armado.error) { toast(armado.error, 'err'); return; }

  var cliente = document.getElementById('cotCliente').value.trim();
  var btn = document.getElementById('btnCotReal');
  var textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Generando...';

  var conIva = !document.getElementById('cotDesglosarIVA').checked;
  var payload = {
    cliente: cliente,
    vendedor_nombre: '',
    vendedor_correo: vendedorCorreo,
    cliente_correo: clienteCorreo,
    moneda: armado.moneda,
    con_iva: conIva,
    items: armado.items,
    forma_entrega: formaEntrega,
    lugar_entrega: lugarEntrega,
    tiempo_entrega: tiempoEntrega,
    forma_pago: formaPago,
  };

  try {
    var r = await fetch(COT_API_BASE + '/api/ventas/cotizaciones-publicas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': COT_API_KEY },
      body: JSON.stringify(payload),
    });
    var data = await r.json().catch(function(){ return {}; });
    if (!r.ok || !data.ok) {
      cerrarModalEnviarReal();
      _mostrarConfirmacionCotReal('error', { error: data.error || 'No se pudo generar la cotización real' });
      return;
    }

    // La cotización YA quedó guardada en el sistema en este punto (con o sin correo) —
    // se registra en el historial local y se limpia el carrito para no volver a mandarla
    // por error con un segundo click (crearía un folio duplicado).
    _registrarEnvioRealHistorial(data, armado, cliente, vendedorCorreo, clienteCorreo);
    CARRITO = [];
    saveCarrito();
    renderCarrito();
    cerrarModalEnviarReal();

    if (data.email_enviado === false) {
      _mostrarConfirmacionCotReal('creada_sin_correo', { no_cotizacion: data.no_cotizacion, aviso: data.aviso });
    } else {
      _mostrarConfirmacionCotReal('ok', { no_cotizacion: data.no_cotizacion, vendedorCorreo: vendedorCorreo, clienteCorreo: clienteCorreo });
    }
  } catch (e) {
    cerrarModalEnviarReal();
    _mostrarConfirmacionCotReal('error', { error: 'Sin conexión al sistema — ¿Tailscale conectado? Si estás conectado, puede que el navegador no confíe en el certificado del servidor: abre https://100.86.2.32:3000 una vez y acepta la advertencia.' });
  } finally {
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
}

// ── Historial: distinguir cotizaciones reales (enviadas al sistema) de borradores locales ──
refrescarHistorial = function(){
  var h = JSON.parse(localStorage.getItem('cotizaciones')||'[]');
  var el = document.getElementById('historialList');
  if(!h.length){ el.innerHTML = '<p style="color:#bbb;padding:20px;text-align:center">No hay cotizaciones guardadas.</p>'; return; }
  var html = '';
  for(var i = h.length - 1; i >= 0; i--){
    var c = h[i];
    var nItems = c.items ? c.items.length : (c.items===0?0:'?');
    var totalLabel = (c.totalQ && c.totalQ > 0) ? 'Q'+Number(c.totalQ).toFixed(2) : (c.totalUSD ? '$'+Number(c.totalUSD).toFixed(2)+' USD' : 'Q'+(c.total||'0'));
    var badge = '';
    if (c.real) {
      badge = c.emailEnviado
        ? '<div style="margin-top:4px;font-size:11px;font-weight:700;color:#1a6b45;">✅ REAL · enviada a ' + c.enviadoA + '</div>'
        : '<div style="margin-top:4px;font-size:11px;font-weight:700;color:#d97706;">⚠️ REAL · creada pero correo falló</div>';
    }
    html += '<div class="item-card" style="flex-wrap:wrap;">'
      + '<div class="item-info"><strong>' + (c.ref||'') + ' - ' + c.cliente + '</strong>'
      + '<small>' + c.fecha + ' - ' + nItems + ' item(s)</small>'
      + badge
      + '</div>'
      + '<div style="text-align:right;margin-right:8px;"><strong style="color:#1a6b45;font-size:15px">' + totalLabel + '</strong></div>'
      + '<div class="actions">'
      + (c.items ? '<button class="btn btn-warning btn-sm" onclick="duplicarCot('+i+')">Duplicar</button>' : '')
      + '<button class="btn btn-danger btn-sm" onclick="eliminarCot('+i+')">X</button>'
      + '</div></div>';
  }
  el.innerHTML = html;
};
