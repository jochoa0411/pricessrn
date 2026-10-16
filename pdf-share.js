// ── Vista previa › «Imprimir / Guardar PDF» ──
// En el iPhone (sobre todo con la app instalada) window.print() no hace nada: se genera un PDF de verdad y se manda a la hoja de
// compartir del teléfono (ahí están Imprimir, Guardar en Archivos, WhatsApp, Correo…). En computadora se sigue usando el diálogo de imprimir.
var _pdfListo = null;
function _esMovilTactil(){
  var ua = navigator.userAgent || '';
  return ((navigator.maxTouchPoints || 0) > 0 && /iPhone|iPad|iPod|Android/i.test(ua)) || (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1);
}
async function _compartirPdfListo(ref){
  var f = _pdfListo && _pdfListo.file; if(!f) return false;
  if(navigator.canShare && navigator.canShare({ files: [f] })){
    try { await navigator.share({ files: [f], title: 'Cotización ' + ref }); return true; }
    catch(e){ if(e && e.name === 'AbortError') return true; throw e; }
  }
  var url = URL.createObjectURL(_pdfListo.blob);              // sin hoja de compartir: se abre el PDF en el visor
  var w = window.open(url, '_blank'); if(!w) location.href = url;
  setTimeout(function(){ URL.revokeObjectURL(url); }, 120000);
  return true;
}
async function imprimirPdfLocal(pdfHtml, ref, btn){
  if(!_esMovilTactil()){ window.print(); return; }
  var textoOrig = btn.textContent;
  btn.disabled = true; btn.textContent = 'Generando PDF…';
  // Se genera desde la propia vista previa (un contenedor fuera de pantalla o fijo sale en blanco en html2canvas). Mientras se captura se
  // cambia su contenido por la tabla de escritorio a 800 px (sin las tarjetas del celular) y después se restaura tal cual.
  var cont = document.querySelector('#pdfOverlay > div:last-child');
  var overlay = document.getElementById('pdfOverlay'), st = overlay ? overlay.scrollTop : 0;
  var htmlPantalla = cont.innerHTML, estiloPantalla = cont.getAttribute('style') || '';
  var restaurar = function(){ cont.innerHTML = htmlPantalla; cont.setAttribute('style', estiloPantalla); if(overlay) overlay.scrollTop = st; };
  try {
    if(overlay) overlay.scrollTop = 0;
    cont.innerHTML = pdfHtml;
    var opt = { margin: 8, filename: ref + '.pdf', image: { type: 'jpeg', quality: 0.92 },
      html2canvas: { scale: 1.6, useCORS: true, scrollX: 0, scrollY: 0, width: 800, windowWidth: 820,
        onclone: function(doc){ var el = doc.querySelector('#pdfOverlay > div:last-child'); if(el){ el.style.width = '800px'; el.style.maxWidth = 'none'; el.style.margin = '0'; el.style.boxShadow = 'none'; } } },
      jsPDF: { orientation: 'p', unit: 'mm', format: 'a4' } };
    var blob = await html2pdf().set(opt).from(cont).outputPdf('blob');
    restaurar();
    var nombre = ref.replace(/[^a-zA-Z0-9_-]/g, '_') + '.pdf';
    _pdfListo = { blob: blob, file: new File([blob], nombre, { type: 'application/pdf' }), nombre: nombre };
    btn.disabled = false; btn.textContent = textoOrig;
    try { await _compartirPdfListo(ref); }
    catch(e){
      // iOS exige un toque del usuario para compartir: si ya pasó mucho tiempo, se pide un toque más
      btn.textContent = 'PDF listo · toca para compartir';
      btn.onclick = async function(){ try { await _compartirPdfListo(ref); } catch(err){ toast('No se pudo abrir el PDF', 'err'); } };
    }
  } catch(e){
    restaurar();
    btn.disabled = false; btn.textContent = textoOrig;
    toast('No se pudo generar el PDF', 'err'); console.error(e);
  }
}

// En pantallas angostas la tabla de 7 columnas no cabe: cada renglón se muestra como tarjeta (etiqueta a la izquierda, valor a la derecha).
// El PDF se arma a 800 px de ancho, por eso conserva la tabla normal.
function _etiquetarFilasPv(trHtml){
  var t = document.createElement('tbody'); t.innerHTML = trHtml;
  var L = ['', '', 'Dimensiones y cálculo', 'Precio / pie²', 'Precio unitario', 'USD', 'Total Q'];
  [].forEach.call(t.querySelectorAll('tr'), function(tr){
    if(tr.children.length !== 7) return;
    [].forEach.call(tr.children, function(td, i){
      if(i === 0) td.className = 'pv-i';
      else if(i === 1) td.className = 'pv-d';
      else { td.setAttribute('data-l', L[i]); if(i === 2) td.className = 'pv-c'; td.innerHTML = '<span class="pv-v">' + td.innerHTML + '</span>'; }
    });
  });
  return t.innerHTML;
}
var _PV_CSS = '<style>'
  + '.pv-wrap{padding:36px}'
  + '@media (max-width:700px){'
  + '.pv-wrap{padding:14px 12px}'
  + '.pv-wrap .pv-t,.pv-wrap .pv-t tbody,.pv-wrap .pv-t tr,.pv-wrap .pv-t td{display:block;width:100%}'
  + '.pv-wrap .pv-t thead{display:none}'
  + '.pv-wrap .pv-t tr{padding:10px 0;border-bottom:1px solid #e3e3e3}'
  + '.pv-wrap .pv-t td{border:none!important;padding:4px 0!important;text-align:right!important;display:flex;justify-content:space-between;align-items:baseline;gap:14px;font-size:14px!important}'
  + '.pv-wrap .pv-t td::before{content:attr(data-l);font-weight:700;color:#555;font-size:12px;text-align:left;flex:none}'
  + '.pv-wrap .pv-t td.pv-i{display:none}'
  + '.pv-wrap .pv-t td.pv-d{display:block;text-align:left!important;font-size:16px!important}'
  + '.pv-wrap .pv-t td .pv-v{text-align:right}'
  + '.pv-wrap .pv-t td.pv-c{display:block;text-align:left!important;line-height:1.6!important}\n'
  + '.pv-wrap .pv-t td.pv-c .pv-v{display:block;text-align:left}'
  + '.pv-wrap .pv-t td.pv-c::before{display:block;margin-bottom:2px}'
  + '.pv-wrap .pv-t tr.pv-tot td{display:block;text-align:right!important}'
  + '}</style>';

async function generarPDF(){
  if(!CARRITO.length){ toast('El presupuesto est\u00e1 vac\u00edo','err'); return; }

  const cliente = document.getElementById('cotCliente').value.trim() || 'Sin nombre';
  const ref     = document.getElementById('cotRef').value.trim() || ('COT-'+Date.now().toString().slice(-6));
  const fecha   = new Date().toLocaleDateString('es-GT');
  const hora    = new Date().toLocaleTimeString('es-GT',{hour:'2-digit',minute:'2-digit'});

  const gran    = CARRITO.reduce((s,i)=> s + (i.totalQ ?? 0), 0);
  var granUSD = CARRITO.reduce(function(s,i){return s+(i.tipo==='tela'?i.tu:0);},0);
  const haySinTC = CARRITO.some(i => i.tipo==='tela' && i.tc === null);
  var soloUSD = haySinTC && gran===0 && granUSD>0;

  let filas = '';
  CARRITO.forEach((item, idx) => {
    if(item.tipo === 'tela'){
      // Medidas y cálculo en metros y en pies (el ancho cobrado es el múltiplo de 6 ft superior al solicitado)
      var n1 = function(v,d){ return Number(v||0).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}); };
      var M2 = 10.7639, FT = 3.28084;
      var aSolFt = item.aSolFt || 0, aSolM = item.aSolM || aSolFt/FT, lFt = item.lFt || (item.lM||0)*FT, lM = item.lM || lFt/FT;
      var aCobFt = item.aCobFt || aSolFt, aCobM = item.aCobM || aCobFt/FT;
      var cant = Math.max(1, item.cant || 1);
      var arCorte = item.arCorte || ((item.ar || 0) / cant);
      var arTot = item.ar || arCorte * cant;
      var difiere = Math.abs(aCobFt - aSolFt) > 0.01;
      var par = function(a_m,l_m,a_ft,l_ft){ return n1(a_m,2)+' m × '+n1(l_m,2)+' m <span style="color:#888;">('+n1(a_ft,1)+' ft × '+n1(l_ft,1)+' ft)</span>'; };
      var calcTxt = n1(aCobFt,1)+' ft × '+n1(lFt,1)+' ft = <b>'+n1(arCorte,1)+' pie²</b> <span style="color:#888;">('+n1(arCorte/M2,2)+' m²)</span>'
        + (cant>1 ? '<br>× '+cant+' piezas = <b>'+n1(arTot,1)+' pie²</b> <span style="color:#888;">('+n1(arTot/M2,2)+' m²)</span>' : '');
      var unitUsd = arCorte * (item.p || 0);
      var unitTxt = '<b>$'+n1(unitUsd,2)+'</b>'+(item.tc ? '<br><span style="color:#555;">Q'+n1(unitUsd*item.tc,2)+'</span>' : '')+'<br><span style="font-size:9px;color:#888;">por pieza</span>';
      filas += '<tr>'
        + '<td style="padding:9px 8px;border-bottom:1px solid #eee;color:#bbb;font-size:10px;">'+(idx+1)+'</td>'
        + '<td style="padding:9px 8px;border-bottom:1px solid #eee;"><strong style="color:#1a6b45;">'+(cant>1?cant+'× ':'')+item.nombre+'</strong><br><small style="color:#888;">'+(item.modo==='master'?'Rollo Master':'Confeccionado'+(window.tlAcabadoTxt&&tlAcabadoTxt(item)?' · '+tlAcabadoTxt(item):''))+(item.recargo?' · '+(item.recargo>0?'Recargo ':'Descuento ')+Math.abs(item.recargo)+'%':'')+'</small></td>'
        + '<td style="padding:9px 8px;border-bottom:1px solid #eee;font-size:11px;line-height:1.55;"><span style="font-weight:700;color:#555;">Solicitado:</span> '+par(aSolM,lM,aSolFt,lFt)
          +(difiere?'<br><span style="font-weight:700;color:#d97706;">Cobrado: '+par(aCobM,lM,aCobFt,lFt)+'</span>':'')
          +'<br><span style="font-weight:700;color:#555;">Cálculo:</span> '+calcTxt+'</td>'
        + '<td style="padding:9px 8px;border-bottom:1px solid #eee;text-align:right;">$'+(item.p||0).toFixed(3)+'<br><span style="font-size:9px;color:#888;">por pie²</span></td>'
        + '<td style="padding:9px 8px;border-bottom:1px solid #eee;text-align:right;">'+unitTxt+'</td>'
        + '<td style="padding:9px 8px;border-bottom:1px solid #eee;text-align:right;">$'+n1(item.tu||0,2)+'</td>'
        + '<td style="padding:9px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:700;">'+(item.totalQ!==null?'Q'+n1(item.totalQ,2):'—')+'</td>'
        + '</tr>';
    } else {
      filas += '<tr>'
        + '<td style="padding:9px 8px;border-bottom:1px solid #eee;color:#bbb;font-size:10px;">'+(idx+1)+'</td>'
        + '<td style="padding:9px 8px;border-bottom:1px solid #eee;"><strong style="color:#1a6b45;">'+item.nombre+'</strong><br><small style="color:#888;">Saco \u00b7 '+etiquetaTierItem(item)+(item.recargo?' \u00b7 '+(item.recargo>0?'Recargo ':'Descuento ')+Math.abs(item.recargo)+'%':'')+'</small></td>'
        + '<td style="padding:9px 8px;border-bottom:1px solid #eee;font-size:11px;">'+(item.medidas||'')+' \u00b7 '+item.cantidad+' unidades</td>'
        + '<td style="padding:9px 8px;border-bottom:1px solid #eee;text-align:right;">\u2014</td>'
        + '<td style="padding:9px 8px;border-bottom:1px solid #eee;text-align:right;"><b>Q'+(item.precioUnit||0).toFixed(2)+'</b><br><span style="font-size:9px;color:#888;">por unidad</span></td>'
        + '<td style="padding:9px 8px;border-bottom:1px solid #eee;text-align:right;">\u2014</td>'
        + '<td style="padding:9px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:700;">Q'+(item.totalQ||0).toFixed(2)+'</td>'
        + '</tr>';
    }
  });

  var qi = document.getElementById('cotDesglosarIVA') && document.getElementById('cotDesglosarIVA').checked;
  var gf = qi ? gran/1.12 : gran;
  var labelIva = qi ? 'SIN IVA' : 'CON IVA';
  var totalHtml = '<tr class="pv-tot" style="background:#e8f5e9;font-weight:700;"><td colspan="6" style="padding:16px 8px;text-align:right;font-size:14px;">TOTAL '+labelIva+(haySinTC?' *':'')+'</td>'
    + '<td style="padding:16px 8px;text-align:right;font-size:20px;color:#1a6b45;font-weight:900;">'+(soloUSD ? '$'+granUSD.toFixed(2)+' USD' : 'Q'+gf.toFixed(2))+'</td></tr>'
     + (haySinTC?'<tr class="pv-tot"><td colspan="7" style="font-size:10px;color:#d97706;padding-top:10px;">* Items de tela sin tipo de cambio no incluidos en el total Q.</td></tr>':'');

  var filasDesk = filas, totalDesk = totalHtml;
  var armarHtml = function(movil){
  var filas_ = movil ? _etiquetarFilasPv(filasDesk) : filasDesk;
  return (movil ? _PV_CSS : '') + '<div class="' + (movil ? 'pv-wrap' : '') + '" style="' + (movil ? '' : 'padding:36px;') + 'background:white;font-family:Arial,sans-serif;color:#1a1a1a;">'
    + '<div style="display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:14px;border-bottom:4px solid #1a6b45;margin-bottom:22px;">'
    + '<div style="font-size:32px;font-weight:900;color:#1a6b45;">LGM<small style="display:block;font-size:12px;font-weight:400;color:#888;margin-top:4px;">La Gran Monta\u00f1a \u00b7 Cotizaci\u00f3n comercial</small></div>'
    + '<div style="text-align:right;"><div style="font-size:20px;font-weight:800;color:#1a6b45;">'+ref+'</div><div style="font-size:11px;color:#888;margin-top:5px;">Fecha: '+fecha+'<br>Hora: '+hora+'</div></div></div>'
    + '<div style="background:#f0f9f5;border-left:5px solid #1a6b45;padding:14px;margin-bottom:20px;"><div style="font-size:10px;color:#888;font-weight:700;text-transform:uppercase;">CLIENTE</div><div style="font-size:17px;font-weight:700;color:#1a6b45;margin-top:3px;">'+cliente+'</div></div>'
    + '<div style="background:#fef9ec;border:1px solid #d97706;border-radius:7px;padding:10px;margin-bottom:14px;font-size:11px;color:#92400e;">Los anchos cobrados corresponden al m\u00faltiplo de 6 pies superior al solicitado. El \u00e1rea de facturaci\u00f3n incluye el desperdicio de corte.</div>'
    + '<div style="font-size:11px;color:#1a6b45;font-weight:700;margin-bottom:14px;">Cotizaci\u00f3n v\u00e1lida por 15 d\u00edas a partir de la fecha de emisi\u00f3n.</div>'
    + '<table class="pv-t" style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:12px;"><thead><tr>'
    + '<th style="background:#1a6b45;color:#fff;padding:10px 8px;text-align:left;font-size:10px;">#</th>'
    + '<th style="background:#1a6b45;color:#fff;padding:10px 8px;text-align:left;font-size:10px;">DESCRIPCION</th>'
    + '<th style="background:#1a6b45;color:#fff;padding:10px 8px;text-align:left;font-size:10px;">DIMENSIONES Y C\u00c1LCULO (m / ft)</th>'
    + '<th style="background:#1a6b45;color:#fff;padding:10px 8px;text-align:right;font-size:10px;">PRECIO / PIE\u00b2</th>'
    + '<th style="background:#1a6b45;color:#fff;padding:10px 8px;text-align:right;font-size:10px;">PRECIO UNITARIO</th>'
    + '<th style="background:#1a6b45;color:#fff;padding:10px 8px;text-align:right;font-size:10px;">USD</th>'
    + '<th style="background:#1a6b45;color:#fff;padding:10px 8px;text-align:right;font-size:10px;">TOTAL Q</th>'
    + '</tr></thead><tbody>'+filas_+totalHtml+'</tbody></table>'
    + '<div style="margin-top:40px;font-size:11px;color:#bbb;border-top:1px solid #eee;padding-top:16px;">LGM \u00b7 La Gran Monta\u00f1a \u00b7 Pal\u00edn, Escuintla, Guatemala</div>'
    + '</div>';
  };
  var pdfHtml = armarHtml(true), pdfHtmlDesk = armarHtml(false);   // pantalla (tarjetas en celular) y PDF (tabla a 800 px)

  // ===== WEB: overlay + print nativo =====
  if(typeof Capacitor === 'undefined' || !Capacitor.isNativePlatform || !Capacitor.isNativePlatform()){
    var overlay = document.createElement('div');
    overlay.id = 'pdfOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#e8e8e8;overflow-y:auto;';
    var tb = document.createElement('div');
    tb.style.cssText = 'display:flex;gap:10px;padding:12px 16px;position:sticky;top:0;background:#1a6b45;z-index:1;';
    var bC = document.createElement('button');
    bC.textContent = '\u2190 Volver';
    bC.style.cssText = 'padding:10px 20px;background:rgba(255,255,255,0.2);color:white;border:none;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;';
    bC.onclick = function(){ overlay.remove(); };
    var bP = document.createElement('button');
    bP.textContent = 'Imprimir / Guardar PDF';
    bP.style.cssText = 'padding:10px 20px;background:white;color:#1a6b45;border:none;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;';
    bP.onclick = function(){ imprimirPdfLocal(pdfHtmlDesk, ref, bP); };
    tb.appendChild(bC); tb.appendChild(bP);
    overlay.appendChild(tb);
    var pbody = document.createElement('div');
    pbody.style.cssText = 'max-width:1000px;margin:16px auto;background:white;box-shadow:0 2px 12px rgba(0,0,0,0.15);';
    pbody.innerHTML = pdfHtml;
    overlay.appendChild(pbody);
    document.body.appendChild(overlay);
    return;
  }

  // ===== APP NATIVA: html2pdf + share sheet =====
  var cont = document.createElement('div');
  cont.style.cssText = 'position:absolute;left:-9999px;top:0;width:800px;background:white;';
  cont.innerHTML = pdfHtmlDesk;
  document.body.appendChild(cont);

  toast('Generando PDF...');
  setTimeout(async function(){
    try {
      var opt = {
        margin: 8,
        filename: ref + '.pdf',
        image: {type:'jpeg', quality:0.95},
        html2canvas: {scale:2, useCORS:true, width:800, windowWidth:800},
        jsPDF: {orientation:'p', unit:'mm', format:'a4'}
      };
      var dataUri = await html2pdf().set(opt).from(cont).outputPdf('datauristring');
      if(cont.parentNode) cont.parentNode.removeChild(cont);

      var base64 = dataUri.split(',')[1];
      var FS = Capacitor.Plugins.Filesystem;
      var SH = Capacitor.Plugins.Share;
      var fileName = ref.replace(/[^a-zA-Z0-9_-]/g,'_') + '.pdf';

      await FS.writeFile({ path: fileName, data: base64, directory: 'CACHE' });
      var uriResult = await FS.getUri({ path: fileName, directory: 'CACHE' });
      await SH.share({ title: 'Cotizaci\u00f3n '+ref, files: [uriResult.uri] });
    } catch(e) {
      if(cont.parentNode) cont.parentNode.removeChild(cont);
      if(e && e.name === 'AbortError') return;
      toast('Error al generar PDF', 'err');
      console.error(e);
    }
  }, 400);
}

// ── Limpiar inputs después de agregar al presupuesto ──
LGM.on('item:agregado', function(ev){
  if(ev.tipo === 'tela'){
    document.getElementById('cotAncho').value = '';
    document.getElementById('cotLargo').value = '';
    document.getElementById('cotCantTela').value = 1;
    document.getElementById('cotRecargo').value = 0;
    document.getElementById('cotPrecioManual').value = '';
    document.getElementById('cotTelaSelect').value = '';
    document.getElementById('cotTelaPreview').style.display = 'none';
    document.getElementById('cotModoDesc').textContent = '';
    document.getElementById('cotResTela').classList.remove('show');
  } else {
    document.getElementById('cotCantSaco').value = '';
    document.getElementById('cotRecargoSaco').value = 0;
    document.getElementById('cotPMSaco').value = '';
    document.getElementById('cotSacoSelect').value = '';
    document.getElementById('cotSacoPreview').style.display = 'none';
    document.getElementById('cotResSaco').classList.remove('show');
  }
});

// ── Botón ± para recargo/descuento ──
window.addEventListener('load', function(){
  // El de telas ya no lo necesita: el ajuste comercial se elige con Ninguno / Descuento / Recargo (tela-ui.js)
  [['cotRecargoSaco','cotCalcSaco']].forEach(function(par){
    const input = document.getElementById(par[0]);
    if(!input) return;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:6px;align-items:stretch;';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '±';
    btn.style.cssText = 'width:46px;flex-shrink:0;border:1.5px solid #ddd;border-radius:6px;background:#f5f5f5;font-size:20px;font-weight:700;color:#1a6b45;cursor:pointer;';
    btn.onclick = function(){
      const v = parseFloat(input.value) || 0;
      input.value = -v;
      window[par[1]]();
    };
    wrap.appendChild(btn);
  });
});

// -- Notificaciones Locales --
async function showLocalNotification(title, body) {
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
    const LocalNotifications = window.Capacitor.Plugins.LocalNotifications;
    await LocalNotifications.schedule({
      notifications: [
        {
          title: title,
          body: body,
          id: 1,
          schedule: { at: new Date(Date.now() + 100) },
          sound: 'default'
        }
      ]
    });
  }
}

if(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications){
  window.Capacitor.Plugins.LocalNotifications.requestPermissions();
}

// -- Sync de precios: la lista se edita en el ERP (PFS > Ventas > Catalogo > Catalogo de Precios)
// y se descarga del relay con la sesion del vendedor (GET /precios). Sin sesion no sincroniza.
var _ultimaSyncPrecios = 0;
var SYNC_PRECIOS_MS = 5 * 60 * 1000;

async function syncPrecios(manual){
  try { await _syncPreciosCore(manual); } finally { LGM.emit('precios:sync'); }
}
async function _syncPreciosCore(manual){
  try {
    if(!manual && Date.now() - _ultimaSyncPrecios < SYNC_PRECIOS_MS) return;
    var sesion = typeof _cargarSesion === 'function' ? _cargarSesion() : null;
    if(!sesion || !sesion.token){ if(manual) toast('Inicia sesion para actualizar los precios','err'); return; }
    // Se manda la versión local: si no cambió, el servidor responde {unchanged:true} sin reenviar la lista
    var resp = await _api('/precios?v=' + (parseInt(localStorage.getItem('PRECIOS_VERSION')||'0') || 0) + '&l=' + (window.LISTAS_REV || 0) + '&j=' + (window.JUMBOS_REV || 0));
    if(!resp.ok) throw new Error(resp.data && resp.data.error || ('HTTP '+resp.status));
    _ultimaSyncPrecios = Date.now();
    var data = resp.data;
    if(data.unchanged){ if(manual) toast('Ya tenes la ultima version (v'+data.version+')'); return; }
    // Listas por cliente: se guardan aunque la lista general no haya cambiado
    if(data.listas_cliente && window.guardarListasCliente && data.listas_rev !== window.LISTAS_REV){ guardarListasCliente(data.listas_rev, data.listas_cliente); if(manual) toast('Listas por cliente actualizadas'); }

    // Jumbos export: se guardan aunque la lista general no haya cambiado
    if(data.jumbos && window.guardarJumbos && data.jumbos_rev !== window.JUMBOS_REV){ guardarJumbos(data.jumbos); if(manual) toast('Lista de Jumbos actualizada'); }
    var vLocal = parseInt(localStorage.getItem('PRECIOS_VERSION')||'0');
    if(!data.telas) return;
    if(data.version > vLocal){
      var cambios = [];
      data.telas.forEach(function(nt){
        var vieja = TELAS.find(function(t){ return t.id === nt.id; });
        if(!vieja){ cambios.push('+ Tela nueva: '+nt.nombre); return; }
        if(vieja.pm !== nt.pm) cambios.push(vieja.nombre+' Master: $'+vieja.pm.toFixed(3)+' > $'+nt.pm.toFixed(3));
        if(vieja.pc !== nt.pc) cambios.push(vieja.nombre+' Conf: $'+vieja.pc.toFixed(3)+' > $'+nt.pc.toFixed(3));
      });
      data.sacos.forEach(function(ns){
        var viejo = SACOS.find(function(s){ return s.id === ns.id; });
        if(!viejo){ cambios.push('+ Saco nuevo: '+ns.nombre); return; }
        ['pA','pB','pC'].forEach(function(k){
          if(viejo[k] !== ns[k]) cambios.push(viejo.nombre+' precio '+k.slice(1)+': Q'+viejo[k].toFixed(2)+' > Q'+ns[k].toFixed(2));
        });
      });
      TELAS = data.telas; SACOS = data.sacos;
      saveTelas(); saveSacos(); loadSelects();
      localStorage.setItem('PRECIOS_VERSION', data.version);

      showLocalNotification('Nueva Actualizacion de Precios', 'Los precios se han actualizado a la v' + data.version);

      if(cambios.length > 0 && typeof _mostrarCambiosPrecios === 'function'){ _mostrarCambiosPrecios(data.version, cambios); }
      else { toast('Catalogo actualizado a v'+data.version); }
    } else if(manual){
      toast('Ya tenes la ultima version (v'+vLocal+')');
    }
  } catch(e){
    if(manual && !(e && e.handled)) toast('Sin conexion - usando precios locales','err');
  }
}

window.addEventListener('load', function(){
  syncPrecios(false);
  var header = document.querySelector('header');
  var btn = document.createElement('button');
  btn.className = 'toggle-menu';
  btn.setAttribute('aria-label','Actualizar precios');
  btn.innerHTML = (typeof _ic === 'function') ? _ic('refresh') : '';
  btn.onclick = function(){ syncPrecios(true); };
  header.replaceChild(btn, header.lastElementChild);
});

setInterval(function(){ syncPrecios(false); }, 60 * 1000);

if(window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App){
  Capacitor.Plugins.App.addListener('appStateChange', function(state){
    if(state.isActive) syncPrecios(false);
  });
}

(function(){
  var badge = document.createElement('div');
  badge.id = 'preciosVersion';
  badge.style.cssText = 'background:rgba(255,255,255,0.2);color:white;font-size:14px;font-weight:700;padding:6px 12px;border-radius:99px;';
  badge.textContent = 'v' + (localStorage.getItem('PRECIOS_VERSION') || '...');
  var header = document.querySelector('header');
  if(header){ var h1 = header.querySelector('h1'); if(h1) h1.insertAdjacentElement('afterend', badge); }
  LGM.on('precios:sync', function(){ var el = document.getElementById('preciosVersion'); if(el) el.textContent = 'v' + (localStorage.getItem('PRECIOS_VERSION') || '?'); });
})();

// ===== PASO 2: Historial completo + numeracion correlativa =====

function siguienteRef(){
  var n = parseInt(localStorage.getItem('COT_COUNTER')||'0') + 1;
  return 'COT-' + String(n).padStart(4,'0');
}
function consumirRef(){
  var n = parseInt(localStorage.getItem('COT_COUNTER')||'0') + 1;
  localStorage.setItem('COT_COUNTER', n);
  return 'COT-' + String(n).padStart(4,'0');
}

// Prellenar referencia al cargar
window.addEventListener('load', function(){
  var refInput = document.getElementById('cotRef');
  if(refInput && !refInput.value) refInput.placeholder = siguienteRef() + ' (auto)';
});

// Override: guardar con items completos
guardarHistorial = function(){
  if(!CARRITO.length){ toast('El presupuesto esta vacio','err'); return; }
  var h = JSON.parse(localStorage.getItem('cotizaciones')||'[]');
  var cliente = document.getElementById('cotCliente').value.trim()||'Sin cliente';
  var refInput = document.getElementById('cotRef');
  var ref = refInput.value.trim() || consumirRef();
  var gran = CARRITO.reduce(function(s,i){return s+(i.totalQ??0);},0);
  var granUSD = CARRITO.reduce(function(s,i){return s+(i.tipo==='tela'?i.tu:0);},0);
  h.push({
    ref: ref,
    cliente: cliente,
    fecha: new Date().toLocaleString('es-GT'),
    items: JSON.parse(JSON.stringify(CARRITO)),
    totalQ: gran,
    totalUSD: granUSD
  });
  localStorage.setItem('cotizaciones', JSON.stringify(h));
  refInput.value = '';
  refInput.placeholder = siguienteRef() + ' (auto)';
  toast('Guardada como ' + ref);
};

// Override: historial con Duplicar y Eliminar
refrescarHistorial = function(){
  var h = JSON.parse(localStorage.getItem('cotizaciones')||'[]');
  var el = document.getElementById('historialList');
  if(!h.length){ el.innerHTML = '<p style="color:#bbb;padding:20px;text-align:center">No hay cotizaciones guardadas.</p>'; return; }
  var html = '';
  for(var i = h.length - 1; i >= 0; i--){
    var c = h[i];
    var nItems = c.items ? c.items.length : (c.items===0?0:'?');
    var totalLabel = (c.totalQ && c.totalQ > 0) ? 'Q'+Number(c.totalQ).toFixed(2) : (c.totalUSD ? '$'+Number(c.totalUSD).toFixed(2)+' USD' : 'Q'+(c.total||'0'));
    html += '<div class="item-card" style="flex-wrap:wrap;">'
      + '<div class="item-info"><strong>' + (c.ref||'') + ' - ' + c.cliente + '</strong>'
      + '<small>' + c.fecha + ' - ' + nItems + ' item(s)</small></div>'
      + '<div style="text-align:right;margin-right:8px;"><strong style="color:#1a6b45;font-size:15px">' + totalLabel + '</strong></div>'
      + '<div class="actions">'
      + (c.items ? '<button class="btn btn-warning btn-sm" onclick="duplicarCot('+i+')">Duplicar</button>' : '')
      + '<button class="btn btn-danger btn-sm" onclick="eliminarCot('+i+')">X</button>'
      + '</div></div>';
  }
  el.innerHTML = html;
};

function duplicarCot(i){
  var h = JSON.parse(localStorage.getItem('cotizaciones')||'[]');
  var c = h[i];
  if(!c || !c.items){ toast('Cotizacion antigua sin items','err'); return; }
  CARRITO = JSON.parse(JSON.stringify(c.items));
  CARRITO.forEach(function(it){ it.uid = Date.now() + Math.random(); });
  saveCarrito();
  renderCarrito();
  document.getElementById('cotCliente').value = c.cliente==='Sin cliente'?'':c.cliente;
  document.getElementById('cotRef').value = '';
  document.querySelectorAll('.seccion').forEach(function(s){s.classList.remove('active');});
  document.getElementById('cotizar').classList.add('active');
  document.querySelectorAll('.nav-item').forEach(function(n){n.classList.remove('active');});
  document.querySelector('.nav-item').classList.add('active');
  document.querySelector('.content').scrollTo({top:9999,behavior:'smooth'});
  toast('Cotizacion de ' + c.cliente + ' cargada al presupuesto');
}

function eliminarCot(i){
  if(!confirm('Eliminar esta cotizacion?')) return;
  var h = JSON.parse(localStorage.getItem('cotizaciones')||'[]');
  h.splice(i,1);
  localStorage.setItem('cotizaciones', JSON.stringify(h));
  refrescarHistorial();
}
