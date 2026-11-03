// ── Medios de pago LGM (cuentas bancarias) ──
// Hoja con la imagen y el PDF oficiales para mandarlos al cliente por WhatsApp, correo, etc. desde la hoja de compartir del teléfono.
// En computadora (sin hoja de compartir) se descargan. Si cambian las cuentas, se reemplazan medios-pago-lgm.png y .pdf.
(function () {
  function $(id) { return document.getElementById(id); }
  var ARCH = {
    img: { url: 'medios-pago-lgm.png', nombre: 'Medios de pago LGM.png', tipo: 'image/png' },
    pdf: { url: 'medios-pago-lgm.pdf', nombre: 'Medios de pago LGM.pdf', tipo: 'application/pdf' }
  };
  function cerrar() { var o = $('mpOv'); if (o) o.remove(); }
  async function compartir(cual, btn) {
    var a = ARCH[cual], txt = btn.textContent;
    btn.disabled = true; btn.textContent = 'Preparando…';
    try {
      var r = await fetch(a.url + '?v=' + Date.now()); if (!r.ok) throw new Error('http ' + r.status);
      var blob = await r.blob(), f = new File([blob], a.nombre, { type: a.tipo });
      if (navigator.canShare && navigator.canShare({ files: [f] })) {
        try { await navigator.share({ files: [f], title: 'Medios de pago LGM' }); } catch (e) { if (!e || e.name !== 'AbortError') throw e; }
      } else {
        var u = URL.createObjectURL(blob), l = document.createElement('a'); l.href = u; l.download = a.nombre; document.body.appendChild(l); l.click(); l.remove();
        setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
        if (typeof toast === 'function') toast('Se descargó ' + a.nombre);
      }
    } catch (e) {
      if (typeof toast === 'function') toast('No se pudo preparar el archivo. Revisa tu conexión e intenta de nuevo.', 'err');
    }
    btn.disabled = false; btn.textContent = txt;
  }
  window.mediosPagoAbrir = function () {
    cerrar();
    var ov = document.createElement('div'); ov.id = 'mpOv'; ov.className = 'av-ov';
    ov.innerHTML = '<div class="av-hoja" role="dialog" aria-modal="true" aria-label="Medios de pago">'
      + '<div class="av-tit">Medios de pago</div>'
      + '<p class="av-nota">Cuentas bancarias de La Gran Montaña para que el cliente haga su depósito.</p>'
      + '<img src="' + ARCH.img.url + '" alt="Cuentas bancarias de La Gran Montaña: Banco Industrial, Banrural y G&T Continental" style="width:100%;border-radius:12px;border:1px solid #e5e5ea;margin-top:6px">'
      + '<div class="av-acc"><button type="button" class="av-btn av-pri" id="mpImg">Compartir imagen</button>'
      + '<button type="button" class="av-btn av-sec" id="mpPdf">Compartir PDF</button>'
      + '<button type="button" class="av-btn av-gris" id="mpCerrar">Cerrar</button></div></div>';
    ov.addEventListener('click', function (e) { if (e.target === ov) cerrar(); });
    document.body.appendChild(ov);
    $('mpImg').onclick = function () { compartir('img', this); };
    $('mpPdf').onclick = function () { compartir('pdf', this); };
    $('mpCerrar').onclick = cerrar;
    if (typeof cerrarMenu === 'function') try { cerrarMenu(); } catch (e) {}
  };
})();
