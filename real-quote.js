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
      var precio = moneda === 'GTQ' ? (item.p * item.tc) : item.p;
      return {
        descripcion: (item.cant > 1 ? item.cant + '× ' : '') + item.nombre + ' (' + (item.modo === 'master' ? 'Rollo Master' : 'Confeccionado') + ')',
        unidad: 'pie²',
        cantidad: item.ar,
        precio_unitario: precio,
      };
    }
    return {
      descripcion: item.nombre + (item.medidas ? ' (' + item.medidas + ')' : ''),
      unidad: 'unidad',
      cantidad: item.cantidad,
      precio_unitario: item.precioUnit,
    };
  });

  return { moneda: moneda, items: items };
}

async function generarCotizacionReal(){
  if (!CARRITO.length) { toast('El presupuesto está vacío', 'err'); return; }

  var vendedorCorreo = (document.getElementById('cotVendedorCorreo').value || '').trim();
  if (!_emailValido(vendedorCorreo)) {
    toast('Ingresa tu correo — ahí llega la cotización real', 'err');
    document.getElementById('cotVendedorCorreo').focus();
    return;
  }
  var clienteCorreoEl = document.getElementById('cotClienteCorreo');
  var clienteCorreo = (clienteCorreoEl.value || '').trim();
  if (clienteCorreo && !_emailValido(clienteCorreo)) {
    toast('El correo del cliente no es válido', 'err');
    clienteCorreoEl.focus();
    return;
  }

  var armado = _construirItemsCotizacionReal();
  if (armado.error) { toast(armado.error, 'err'); return; }

  var btn = document.getElementById('btnCotReal');
  var textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Generando...';

  var conIva = !document.getElementById('cotDesglosarIVA').checked;
  var payload = {
    cliente: document.getElementById('cotCliente').value.trim(),
    vendedor_nombre: '',
    vendedor_correo: vendedorCorreo,
    cliente_correo: clienteCorreo,
    moneda: armado.moneda,
    con_iva: conIva,
    items: armado.items,
  };

  try {
    var r = await fetch(COT_API_BASE + '/api/ventas/cotizaciones-publicas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': COT_API_KEY },
      body: JSON.stringify(payload),
    });
    var data = await r.json().catch(function(){ return {}; });
    if (!r.ok || !data.ok) {
      toast(data.error || 'No se pudo generar la cotización real', 'err');
      return;
    }
    if (data.email_enviado === false) {
      toast('Cotización ' + data.no_cotizacion + ' generada, pero el correo falló — avisa a soporte', 'err');
    } else {
      toast('✅ ' + data.no_cotizacion + ' enviada a ' + vendedorCorreo);
    }
  } catch (e) {
    toast('Sin conexión al sistema — ¿Tailscale conectado?', 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
}
