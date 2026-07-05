async function generarPDF(){
  if(!CARRITO.length){ toast('El presupuesto está vacío','err'); return; }

  const cliente = document.getElementById('cotCliente').value.trim() || 'Sin nombre';
  const ref     = document.getElementById('cotRef').value.trim() || ('COT-'+Date.now().toString().slice(-6));
  const fecha   = new Date().toLocaleDateString('es-GT',{day:'2-digit',month:'2-digit',year:'numeric'});
  const hora    = new Date().toLocaleTimeString('es-GT',{hour:'2-digit',minute:'2-digit'});
  const gran    = CARRITO.reduce((s,i)=> s + (i.totalQ ?? 0), 0);
  var granUSD   = CARRITO.reduce(function(s,i){return s+(i.tipo==='tela'?i.tu:0);},0);
  const haySinTC = CARRITO.some(i => i.tipo==='tela' && i.tc === null);
  var soloUSD   = haySinTC && gran===0 && granUSD>0;
  
  let filas = '';
  CARRITO.forEach((item,idx)=>{
    if(item.tipo==='tela'){
      const solLabel = item.ua==='m' ? item.aSolM.toFixed(2)+' m' : item.aSolFt.toFixed(1)+' ft';
      const cobLabel = item.ua==='m' ? (item.aCobM.toFixed(2)+' m ('+item.aCobFt.toFixed(0)+' ft)') : (item.aCobFt.toFixed(0)+' ft');
      const lLabel   = item.ul==='m' ? (item.lM.toFixed(2)+' m') : (item.lFt.toFixed(1)+' ft');
      const difiere  = Math.abs(item.aCobFt - item.aSolFt) > 0.05;
      const qStr     = item.totalQ !== null ? 'Q'+item.totalQ.toFixed(2) : '—';
      filas += '<tr>'
        + '<td style="padding:10px; border-bottom:1px solid #eee;">'+(idx+1)+'</td>'
        + '<td style="padding:10px; border-bottom:1px solid #eee;"><strong>'+item.nombre+'</strong><br><small>'+(item.modo==='master'?'Rollo Master':'Confeccionado')+(item.tc?' · TC '+item.tc:'')+'</small></td>'
        + '<td style="padding:10px; border-bottom:1px solid #eee;"><span style="color:#666; font-size:11px;">Solicitado:</span> '+solLabel+' x '+lLabel+(item.cant>1?' x <strong>'+item.cant+' cortes</strong>':'')
        + (difiere?'<br><span style="color:#d97706; font-size:11px;">Cobrado: '+cobLabel+' x '+lLabel+'</span>':'')+'</td>'
        + '<td style="padding:10px; border-bottom:1px solid #eee; text-align:right;">'+item.ar.toFixed(1)+' pie2</td>'
        + '<td style="padding:10px; border-bottom:1px solid #eee; text-align:right;">$'+item.p.toFixed(3)+'</td>'
        + '<td style="padding:10px; border-bottom:1px solid #eee; text-align:right;">$'+item.tu.toFixed(2)+'</td>'
        + '<td style="padding:10px; border-bottom:1px solid #eee; text-align:right; font-weight:bold; color:#1a6b45; font-size:13px;">'+qStr+'</td>'
        + '</tr>';
    } else {
      filas += '<tr>'
        + '<td style="padding:10px; border-bottom:1px solid #eee;">'+(idx+1)+'</td>'
        + '<td style="padding:10px; border-bottom:1px solid #eee;"><strong>'+item.nombre+'</strong><br><small>'+item.medidas+'</small></td>'
        + '<td style="padding:10px; border-bottom:1px solid #eee;">'+item.cantidad+' unidades<br><small>Tier '+(item.tier||'-')+'</small></td>'
        + '<td style="padding:10px; border-bottom:1px solid #eee; text-align:right;">-</td>'
        + '<td style="padding:10px; border-bottom:1px solid #eee; text-align:right;">Q'+item.precioUnit.toFixed(2)+'/u</td>'
        + '<td style="padding:10px; border-bottom:1px solid #eee; text-align:right;">-</td>'
        + '<td style="padding:10px; border-bottom:1px solid #eee; text-align:right; font-weight:bold; color:#1a6b45; font-size:13px;">Q'+item.totalQ.toFixed(2)+'</td>'
        + '</tr>';
    }
  });

  const cont = document.createElement('div');
  // Usamos visibilidad en lugar de posicion extrema para que el motor de renderizado lo vea
  cont.style.cssText = 'position:fixed; top:0; left:0; width:800px; background:white; z-index:-1; opacity:0; pointer-events:none;';

  cont.innerHTML = '<div style="padding:40px; background:white; font-family:Arial, sans-serif; color:#1a1a1a;">'
    + '<div style="display:flex; justify-content:space-between; align-items:flex-end; padding-bottom:15px; border-bottom:4px solid #1a6b45; margin-bottom:25px;">'
    + '<div style="font-size:35px; font-weight:900; color:#1a6b45;">LGM<small style="display:block; font-size:13px; font-weight:400; color:#888; margin-top:5px;">La Gran Montana - Cotizacion comercial</small></div>'
    + '<div style="text-align:right;"><div style="font-size:22px; font-weight:800; color:#1a6b45;">'+ref+'</div><div style="font-size:12px; color:#888; margin-top:6px;">Fecha: '+fecha+'<br>Hora: '+hora+'</div></div></div>'
    + '<div style="background:#f0f9f5; border-left:6px solid #1a6b45; padding:18px; margin-bottom:25px;"><div style="font-size:11px; color:#888; font-weight:700; text-transform:uppercase;">CLIENTE</div><div style="font-size:19px; font-weight:700; color:#1a6b45; margin-top:4px;">'+cliente+'</div></div>'
    + '<div style="background:#fef9ec; border:1px solid #d97706; border-radius:8px; padding:12px; margin-bottom:25px; font-size:12px; color:#92400e;">Los anchos cobrados corresponden al multiplo de 6 pies superior al solicitado. El area de facturacion incluye el desperdicio de corte.</div>'
    + '<table style="width:100%; border-collapse:collapse; margin-bottom:25px; font-size:13px;"><thead><tr>'
    + '<th style="background:#1a6b45; color:#fff; padding:12px 10px; text-align:left; font-size:11px;">#</th>'
    + '<th style="background:#1a6b45; color:#fff; padding:12px 10px; text-align:left; font-size:11px;">DESCRIPCION</th>'
    + '<th style="background:#1a6b45; color:#fff; padding:12px 10px; text-align:left; font-size:11px;">DIMENSIONES</th>'
    + '<th style="background:#1a6b45; color:#fff; padding:12px 10px; text-align:right; font-size:11px;">AREA</th>'
    + '<th style="background:#1a6b45; color:#fff; padding:12px 10px; text-align:right; font-size:11px;">PRECIO</th>'
    + '<th style="background:#1a6b45; color:#fff; padding:12px 10px; text-align:right; font-size:11px;">USD</th>'
    + '<th style="background:#1a6b45; color:#fff; padding:12px 10px; text-align:right; font-size:11px;">TOTAL Q</th>'
    + '</tr></thead>'
    + '<tbody>'+filas
    + (function(){
      var qi = document.getElementById('cotDesglosarIVA') && document.getElementById('cotDesglosarIVA').checked;
      var gf = qi ? gran/1.12 : gran;
      var labelIva = qi ? 'SIN IVA' : 'CON IVA';
      return '<tr style="background:#e8f5e9; font-weight:700;"><td colspan="6" style="padding:18px 10px; text-align:right; font-size:15px;">TOTAL '+labelIva+(haySinTC?' *':'')+'</td>'
           + '<td style="padding:18px 10px; text-align:right; font-size:22px; color:#1a6b45; font-weight:900;">'+(soloUSD ? '$'+granUSD.toFixed(2)+' USD' : 'Q'+gran.toFixed(2))+'</td></tr>';
    })()
    + (haySinTC?'<tr><td colspan="7" style="font-size:11px; color:#d97706; padding-top:12px;">* Items de tela sin tipo de cambio no incluidos en el total Q.</td></tr>':'')
    + '</tbody></table>'
    + '<div style="margin-top:50px; font-size:12px; color:#bbb; border-top:1px solid #eee; padding-top:20px;">LGM - La Gran Montana - Palin, Escuintla, Guatemala</div>'
    + '</div>';

  document.body.appendChild(cont);
  toast('Preparando documento...');

  // Damos un tiempo al navegador para que renderice el HTML oculto
  setTimeout(async () => {
    try {
      const opt = {
        margin: 10,
        filename: ref + '.pdf',
        image: {type:'jpeg', quality:0.98},
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          width: 800,
          scrollY: 0,
          windowWidth: 800
        },
        jsPDF: {orientation:'p', unit:'mm', format:'a4'}
      };

      if(typeof Capacitor === 'undefined' || !Capacitor.isNativePlatform()){
        const pdfBlob = await html2pdf().set(opt).from(cont).output('blob');
        if(cont.parentNode) cont.parentNode.removeChild(cont);

        const file = new File([pdfBlob], ref + ".pdf", { type: 'application/pdf' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Cotización ' + ref });
        } else {
          const url = URL.createObjectURL(pdfBlob);
          const a = document.createElement('a'); a.href = url; a.download = ref + '.pdf'; a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      } else {
        const dataUri = await html2pdf().set(opt).from(cont).outputPdf('datauristring');
        if(cont.parentNode) cont.parentNode.removeChild(cont);

        const base64 = dataUri.split(',')[1];
        const { Filesystem, Share } = Capacitor.Plugins;
        const fileName = ref.replace(/[^a-zA-Z0-9_-]/g,'_') + '.pdf';

        await Filesystem.writeFile({ path: fileName, data: base64, directory: 'CACHE' });
        const uriResult = await Filesystem.getUri({ path: fileName, directory: 'CACHE' });
        await Share.share({ title: 'Cotización '+ref, files: [uriResult.uri] });
      }
    } catch(e) {
      if(cont.parentNode) cont.parentNode.removeChild(cont);
      toast('Error al generar PDF', 'err');
      console.error(e);
    }
  }, 500); // 500ms de espera para el renderizado
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
var GITHUB_TOKEN = 'REMOVED'; // <--- PEGA TU TOKEN AQUÍ

async function syncPrecios(manual){
  try {
    var headers = {'Accept':'application/vnd.github.v3+json'};
    if(GITHUB_TOKEN) {
      headers['Authorization'] = 'token ' + GITHUB_TOKEN;
    }

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
