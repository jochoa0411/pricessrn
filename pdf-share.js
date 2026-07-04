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
        + '<td class="idx">'+(idx+1)+'</td>'
        + '<td><strong>'+item.nombre+'</strong><br><small>'+(item.modo==='master'?'Rollo Master':'Confeccionado')+(item.tc?' · TC '+item.tc:'')+'</small></td>'
        + '<td><span class="lbl">Solicitado:</span> '+solLabel+' x '+lLabel+(item.cant>1?' x <strong>'+item.cant+' cortes</strong>':'')
        + (difiere?'<br><span class="cob">Cobrado: '+cobLabel+' x '+lLabel+'</span>':'')+'</td>'
        + '<td class="r">'+item.ar.toFixed(1)+' pie2</td>'
        + '<td class="r">$'+item.p.toFixed(3)+'</td>'
        + '<td class="r">$'+item.tu.toFixed(2)+'</td>'
        + '<td class="r hi">'+qStr+'</td>'
        + '</tr>';
    } else {
      filas += '<tr>'
        + '<td class="idx">'+(idx+1)+'</td>'
        + '<td><strong>'+item.nombre+'</strong><br><small>'+item.medidas+'</small></td>'
        + '<td>'+item.cantidad+' unidades<br><small>Tier '+(item.tier||'-')+'</small></td>'
        + '<td class="r">-</td>'
        + '<td class="r">Q'+item.precioUnit.toFixed(2)+'/u</td>'
        + '<td class="r">-</td>'
        + '<td class="r hi">Q'+item.totalQ.toFixed(2)+'</td>'
        + '</tr>';
    }
  });

  const cont = document.createElement('div');
  cont.innerHTML = '<div class="pdfx" style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:12px;padding:10px;width:730px;">'
    + '<div class="hdr"><div class="logo">LGM<small>La Gran Montana - Cotizacion comercial</small></div>'
    + '<div class="refx"><div class="no">'+ref+'</div><div class="meta">Fecha: '+fecha+'<br>Hora: '+hora+'</div></div></div>'
    + '<div class="cli"><div class="lbl2">CLIENTE</div><div class="val">'+cliente+'</div></div>'
    + '<div class="nota">Los anchos cobrados corresponden al multiplo de 6 pies superior al solicitado. El area de facturacion incluye el desperdicio de corte.</div>'
    + '<table><thead><tr><th>#</th><th>Descripcion</th><th>Dimensiones</th><th class="r">Area</th><th class="r">Precio</th><th class="r">USD</th><th class="r">Total Q</th></tr></thead>'
    + '<tbody>'+filas
    + (function(){
      var qi = document.getElementById('cotDesglosarIVA') && document.getElementById('cotDesglosarIVA').checked;
      var gf = qi ? gran/1.12 : gran;
      if(qi){
        return '<tr style="background:#fff8e1;"><td colspan="6" style="text-align:right;font-size:11px;color:#d97706;font-weight:700;">IVA REMOVIDO - PRECIO SIN IMPUESTO</td><td class="r" style="font-size:12px;">-</td></tr>'
          + '<tr class="tot"><td colspan="6" style="text-align:right">TOTAL SIN IVA'+(haySinTC?' *':'')+'</td><td class="r grand">'+(soloUSD ? '$'+(granUSD/1.12).toFixed(2)+' USD' : 'Q'+gf.toFixed(2))+'</td></tr>';
      } else {
        return '<tr style="background:#fff8e1;"><td colspan="6" style="text-align:right;font-size:11px;color:#666;">Subtotal sin IVA</td><td class="r" style="font-size:12px;font-weight:700;">'+(soloUSD ? '$'+(granUSD/1.12).toFixed(2) : 'Q'+(gran/1.12).toFixed(2))+'</td></tr>'
          + '<tr style="background:#fff8e1;"><td colspan="6" style="text-align:right;font-size:11px;color:#666;">IVA 12%</td><td class="r" style="font-size:12px;font-weight:700;">'+(soloUSD ? '$'+(granUSD-granUSD/1.12).toFixed(2) : 'Q'+(gran-gran/1.12).toFixed(2))+'</td></tr>'
          + '<tr class="tot"><td colspan="6" style="text-align:right">TOTAL CON IVA'+(haySinTC?' *':'')+'</td><td class="r grand">'+(soloUSD ? '$'+granUSD.toFixed(2)+' USD' : 'Q'+gran.toFixed(2))+'</td></tr>';
      }
    })()
    + (haySinTC?'<tr><td colspan="7" style="font-size:9px;color:#d97706">* Items de tela sin tipo de cambio no incluidos en el total Q.</td></tr>':'')
    + '</tbody></table>'
    + '<div style="margin-top:24px;font-size:9px;color:#bbb">LGM - La Gran Montana - Palin, Escuintla, Guatemala</div>'
    + '</div>';

  const st = document.createElement('style');
  st.textContent = '.pdfx .hdr{display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:14px;border-bottom:3px solid #1a6b45;margin-bottom:18px}.pdfx .logo{font-size:30px;font-weight:900;color:#1a6b45;line-height:1}.pdfx .logo small{display:block;font-size:11px;font-weight:400;color:#888;margin-top:3px}.pdfx .refx{text-align:right}.pdfx .refx .no{font-size:18px;font-weight:800;color:#1a6b45}.pdfx .refx .meta{font-size:10px;color:#888;margin-top:4px;line-height:1.7}.pdfx .cli{background:#f0f9f5;border-left:4px solid #1a6b45;padding:10px 14px;margin-bottom:14px}.pdfx .cli .lbl2{font-size:9px;color:#888;font-weight:700}.pdfx .cli .val{font-size:15px;font-weight:700;color:#1a6b45;margin-top:2px}.pdfx .nota{background:#fef9ec;border:1px solid #d97706;border-radius:5px;padding:7px 10px;margin-bottom:14px;font-size:10px;color:#92400e}.pdfx table{width:100%;border-collapse:collapse;margin-bottom:16px}.pdfx th{background:#1a6b45;color:#fff;padding:8px 9px;font-size:9.5px;text-transform:uppercase;text-align:left;font-weight:700}.pdfx th.r{text-align:right}.pdfx td{padding:8px 9px;border-bottom:1px solid #eee;vertical-align:top;line-height:1.5;font-size:11px}.pdfx .idx{color:#bbb;font-size:10px;width:24px}.pdfx .r{text-align:right}.pdfx .hi{font-weight:800;color:#1a6b45;font-size:12px}.pdfx .lbl{font-size:9.5px;font-weight:700;color:#555}.pdfx .cob{font-size:9.5px;font-weight:700;color:#d97706}.pdfx .tot td{background:#e8f5e9;font-weight:700;padding:11px 9px;font-size:12px}.pdfx .grand{font-size:17px;font-weight:900;color:#1a6b45}';
  cont.prepend(st);
  document.body.appendChild(cont);

  toast('Generando PDF...');

  try {
    const dataUri = await html2pdf().set({
      margin: 8,
      image: {type:'jpeg', quality:0.95},
      html2canvas: {scale:2, useCORS:true},
      jsPDF: {orientation:'p', unit:'mm', format:'a4'}
    }).from(cont).outputPdf('datauristring');

    // Web: descargar PDF
    if(typeof Capacitor === 'undefined' || !Capacitor.isNativePlatform()){
      const link = document.createElement('a');
      link.href = dataUri;
      link.download = ref + '.pdf';
      link.click();
      if(cont.parentNode) cont.parentNode.removeChild(cont);
      return;
    }

    const base64 = dataUri.split(',')[1];
    const { Filesystem, Share } = Capacitor.Plugins;
    const fileName = ref.replace(/[^a-zA-Z0-9_-]/g,'_') + '.pdf';

    await Filesystem.writeFile({ path: fileName, data: base64, directory: 'CACHE' });
    const uriResult = await Filesystem.getUri({ path: fileName, directory: 'CACHE' });

    await Share.share({ title: 'Cotizacion '+ref, files: [uriResult.uri] });
  } catch(e) {
    if(cont.parentNode) cont.parentNode.removeChild(cont);
    if(e && e.message && e.message.toLowerCase().includes('cancel')) return;
    toast('Error: '+(e.message||e), 'err');
  }
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
var GITHUB_TOKEN = ''; // <--- PEGA TU TOKEN AQUÍ OTRA VEZ, PERDÓN!

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
