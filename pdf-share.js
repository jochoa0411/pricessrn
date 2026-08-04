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
      var dimsSol = (item.lFt||item.lM||0).toFixed ? (item.ul==='ft'? item.lFt.toFixed(1)+' ft' : item.lM.toFixed(1)+' m') : '';
      var anchoSol = item.ua==='ft' ? (item.aSolFt||0).toFixed(1)+' ft' : (item.aSolM||0).toFixed(1)+' m';
      var largoSol = item.ul==='ft' ? (item.lFt||0).toFixed(1)+' ft' : (item.lM||0).toFixed(1)+' m';
      var dimsTxt = anchoSol + ' x ' + largoSol + (item.cant>1?' (x'+item.cant+' cortes)':'');
      var anchoCob = item.ua==='ft' ? (item.aCobFt||0).toFixed(1)+' ft' : (item.aCobM||0).toFixed(1)+' m';
      var dimsCob = (item.aCobFt && Math.abs(item.aCobFt - item.aSolFt) > 0.01) ? anchoCob+' x '+largoSol : null;
      filas += '<tr>'
        + '<td style="padding:9px 8px;border-bottom:1px solid #eee;color:#bbb;font-size:10px;">'+(idx+1)+'</td>'
        + '<td style="padding:9px 8px;border-bottom:1px solid #eee;"><strong style="color:#1a6b45;">'+(item.cant>1?item.cant+'\u00d7 ':'')+item.nombre+'</strong><br><small style="color:#888;">'+(item.modo==='master'?'Rollo Master':'Confeccionado')+(item.recargo?' \u00b7 Rec/Desc '+item.recargo+'%':'')+'</small></td>'
        + '<td style="padding:9px 8px;border-bottom:1px solid #eee;font-size:11px;"><span style="font-weight:700;color:#555;">Solicitado:</span> '+dimsTxt+(dimsCob?'<br><span style="font-weight:700;color:#d97706;">Cobrado: '+dimsCob+'</span>':'')+'</td>'
        + '<td style="padding:9px 8px;border-bottom:1px solid #eee;text-align:right;">'+(item.ar||0).toFixed(1)+' pie\u00b2</td>'
        + '<td style="padding:9px 8px;border-bottom:1px solid #eee;text-align:right;">$'+(item.p||0).toFixed(3)+'</td>'
        + '<td style="padding:9px 8px;border-bottom:1px solid #eee;text-align:right;">$'+(item.tu||0).toFixed(2)+'</td>'
        + '<td style="padding:9px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:700;">'+(item.totalQ!==null?'Q'+item.totalQ.toFixed(2):'\u2014')+'</td>'
        + '</tr>';
    } else {
      filas += '<tr>'
        + '<td style="padding:9px 8px;border-bottom:1px solid #eee;color:#bbb;font-size:10px;">'+(idx+1)+'</td>'
        + '<td style="padding:9px 8px;border-bottom:1px solid #eee;"><strong style="color:#1a6b45;">'+item.nombre+'</strong><br><small style="color:#888;">Saco \u00b7 Tier '+item.tier+(item.recargo?' \u00b7 Rec/Desc '+item.recargo+'%':'')+'</small></td>'
        + '<td style="padding:9px 8px;border-bottom:1px solid #eee;font-size:11px;">'+(item.medidas||'')+' \u00b7 '+item.cantidad+' unidades</td>'
        + '<td style="padding:9px 8px;border-bottom:1px solid #eee;text-align:right;">\u2014</td>'
        + '<td style="padding:9px 8px;border-bottom:1px solid #eee;text-align:right;">Q'+(item.precioUnit||0).toFixed(2)+'</td>'
        + '<td style="padding:9px 8px;border-bottom:1px solid #eee;text-align:right;">\u2014</td>'
        + '<td style="padding:9px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:700;">Q'+(item.totalQ||0).toFixed(2)+'</td>'
        + '</tr>';
    }
  });

  var qi = document.getElementById('cotDesglosarIVA') && document.getElementById('cotDesglosarIVA').checked;
  var gf = qi ? gran/1.12 : gran;
  var labelIva = qi ? 'SIN IVA' : 'CON IVA';
  var totalHtml = '<tr style="background:#e8f5e9;font-weight:700;"><td colspan="6" style="padding:16px 8px;text-align:right;font-size:14px;">TOTAL '+labelIva+(haySinTC?' *':'')+'</td>'
    + '<td style="padding:16px 8px;text-align:right;font-size:20px;color:#1a6b45;font-weight:900;">'+(soloUSD ? '$'+granUSD.toFixed(2)+' USD' : 'Q'+gf.toFixed(2))+'</td></tr>'
    + (haySinTC?'<tr><td colspan="7" style="font-size:10px;color:#d97706;padding-top:10px;">* Items de tela sin tipo de cambio no incluidos en el total Q.</td></tr>':'');

  var pdfHtml = '<div style="padding:36px;background:white;font-family:Arial,sans-serif;color:#1a1a1a;">'
    + '<div style="display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:14px;border-bottom:4px solid #1a6b45;margin-bottom:22px;">'
    + '<div style="font-size:32px;font-weight:900;color:#1a6b45;">LGM<small style="display:block;font-size:12px;font-weight:400;color:#888;margin-top:4px;">La Gran Monta\u00f1a \u00b7 Cotizaci\u00f3n comercial</small></div>'
    + '<div style="text-align:right;"><div style="font-size:20px;font-weight:800;color:#1a6b45;">'+ref+'</div><div style="font-size:11px;color:#888;margin-top:5px;">Fecha: '+fecha+'<br>Hora: '+hora+'</div></div></div>'
    + '<div style="background:#f0f9f5;border-left:5px solid #1a6b45;padding:14px;margin-bottom:20px;"><div style="font-size:10px;color:#888;font-weight:700;text-transform:uppercase;">CLIENTE</div><div style="font-size:17px;font-weight:700;color:#1a6b45;margin-top:3px;">'+cliente+'</div></div>'
    + '<div style="background:#fef9ec;border:1px solid #d97706;border-radius:7px;padding:10px;margin-bottom:14px;font-size:11px;color:#92400e;">Los anchos cobrados corresponden al m\u00faltiplo de 6 pies superior al solicitado. El \u00e1rea de facturaci\u00f3n incluye el desperdicio de corte.</div>'
    + '<div style="font-size:11px;color:#1a6b45;font-weight:700;margin-bottom:14px;">Cotizaci\u00f3n v\u00e1lida por 15 d\u00edas a partir de la fecha de emisi\u00f3n.</div>'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:12px;"><thead><tr>'
    + '<th style="background:#1a6b45;color:#fff;padding:10px 8px;text-align:left;font-size:10px;">#</th>'
    + '<th style="background:#1a6b45;color:#fff;padding:10px 8px;text-align:left;font-size:10px;">DESCRIPCION</th>'
    + '<th style="background:#1a6b45;color:#fff;padding:10px 8px;text-align:left;font-size:10px;">DIMENSIONES</th>'
    + '<th style="background:#1a6b45;color:#fff;padding:10px 8px;text-align:right;font-size:10px;">AREA</th>'
    + '<th style="background:#1a6b45;color:#fff;padding:10px 8px;text-align:right;font-size:10px;">PRECIO</th>'
    + '<th style="background:#1a6b45;color:#fff;padding:10px 8px;text-align:right;font-size:10px;">USD</th>'
    + '<th style="background:#1a6b45;color:#fff;padding:10px 8px;text-align:right;font-size:10px;">TOTAL Q</th>'
    + '</tr></thead><tbody>'+filas+totalHtml+'</tbody></table>'
    + '<div style="margin-top:40px;font-size:11px;color:#bbb;border-top:1px solid #eee;padding-top:16px;">LGM \u00b7 La Gran Monta\u00f1a \u00b7 Pal\u00edn, Escuintla, Guatemala</div>'
    + '</div>';

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
    bP.onclick = function(){ window.print(); };
    tb.appendChild(bC); tb.appendChild(bP);
    overlay.appendChild(tb);
    var pbody = document.createElement('div');
    pbody.style.cssText = 'max-width:820px;margin:16px auto;background:white;box-shadow:0 2px 12px rgba(0,0,0,0.15);';
    pbody.innerHTML = pdfHtml;
    overlay.appendChild(pbody);
    document.body.appendChild(overlay);
    return;
  }

  // ===== APP NATIVA: html2pdf + share sheet =====
  var cont = document.createElement('div');
  cont.style.cssText = 'position:absolute;left:-9999px;top:0;width:800px;background:white;';
  cont.innerHTML = pdfHtml;
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
const _agregarTelaOrig = agregarTela;
agregarTela = function(){
  const antes = CARRITO.length;
  _agregarTelaOrig();
  if(CARRITO.length > antes){
    document.getElementById('cotAncho').value = '';
    document.getElementById('cotLargo').value = '';
    document.getElementById('cotCantTela').value = 1;
    document.getElementById('cotRecargo').value = 0;
    document.getElementById('cotPrecioManual').value = '';
    document.getElementById('cotTelaSelect').value = '';
    document.getElementById('cotTelaPreview').style.display = 'none';
    document.getElementById('cotModoDesc').textContent = '';
    document.getElementById('cotResTela').classList.remove('show');
  }
};

const _agregarSacoOrig = agregarSaco;
agregarSaco = function(){
  const antes = CARRITO.length;
  _agregarSacoOrig();
  if(CARRITO.length > antes){
    document.getElementById('cotCantSaco').value = '';
    document.getElementById('cotRecargoSaco').value = 0;
    document.getElementById('cotPMSaco').value = '';
    document.getElementById('cotSacoSelect').value = '';
    document.getElementById('cotSacoPreview').style.display = 'none';
    document.getElementById('cotResSaco').classList.remove('show');
  }
};

// ── Botón ± para recargo/descuento ──
window.addEventListener('load', function(){
  [['cotRecargo','cotCalcTela'],['cotRecargoSaco','cotCalcSaco']].forEach(function(par){
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

// -- Sync de precios (GitHub API con Token) --
var GITHUB_API_URL = 'https://api.github.com/repos/jochoa0411/pricessrn/contents/precios.json';

async function syncPrecios(manual){
  try {
    var headers = {'Accept':'application/vnd.github.v3+json'};
    var r = await fetch(GITHUB_API_URL + '?t=' + Date.now(), { headers: headers });
    if(!r.ok) throw new Error('HTTP '+r.status);
    var jsonResponse = await r.json();
    var content = decodeURIComponent(escape(atob(jsonResponse.content.replace(/\s/g, ''))));
    var data = JSON.parse(content);

    var vLocal = parseInt(localStorage.getItem('PRECIOS_VERSION')||'0');
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
          if(viejo[k] !== ns[k]) cambios.push(viejo.nombre+' Tier '+k.slice(1)+': Q'+viejo[k].toFixed(2)+' > Q'+ns[k].toFixed(2));
        });
      });
      TELAS = data.telas; SACOS = data.sacos;
      saveTelas(); saveSacos(); loadSelects();
      localStorage.setItem('PRECIOS_VERSION', data.version);

      showLocalNotification('Nueva Actualizacion de Precios', 'Los precios se han actualizado a la v' + data.version);

      if(cambios.length > 0){ alert('Precios actualizados (v'+data.version+'):\n\n' + cambios.join('\n')); }
      else { toast('Catalogo actualizado a v'+data.version); }
    } else if(manual){
      toast('Ya tenes la ultima version (v'+vLocal+')');
    }
  } catch(e){
    if(manual) toast('Sin conexion - usando precios locales','err');
  }
}

window.addEventListener('load', function(){
  syncPrecios(false);
  var header = document.querySelector('header');
  var btn = document.createElement('button');
  btn.className = 'toggle-menu';
  btn.textContent = '\u{1F504}';
  btn.onclick = function(){ syncPrecios(true); };
  header.replaceChild(btn, header.lastElementChild);
});

setInterval(function(){ syncPrecios(false); }, 5000);

if(window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App){
  Capacitor.Plugins.App.addListener('appStateChange', function(state){
    if(state.isActive) syncPrecios(false);
  });
}

(function(){
  var badge = document.createElement('div');
  badge.id = 'preciosVersion';
  badge.style.cssText = 'background:rgba(255,255,255,0.2);color:white;font-size:11px;font-weight:700;padding:4px 10px;border-radius:99px;';
  badge.textContent = 'v' + (localStorage.getItem('PRECIOS_VERSION') || '...');
  var header = document.querySelector('header');
  if(header){ var h1 = header.querySelector('h1'); if(h1) h1.insertAdjacentElement('afterend', badge); }
  var _origSync = syncPrecios;
  syncPrecios = async function(manual){ await _origSync(manual); var el = document.getElementById('preciosVersion'); if(el) el.textContent = 'v' + (localStorage.getItem('PRECIOS_VERSION') || '?'); };
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
