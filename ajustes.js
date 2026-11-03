// ── Ajustes: todas las preferencias en un solo lugar (el menú solo muestra «Ajustes») ──
// Apariencia (automático/claro/oscuro), avisos en el teléfono y «volver arriba al agregar».
(function () {
  function $(id) { return document.getElementById(id); }
  function cerrar() { var o = $('ajOv'); if (o) o.remove(); }
  function textoAvisos() { var s = $('navAvisosSub'); return s ? s.textContent : ''; }
  function pintar() {
    var ov = $('ajOv'); if (!ov) return;
    var p = window.temaPref ? temaPref() : 'auto';
    [].forEach.call(ov.querySelectorAll('[data-tema]'), function (b) { var on = b.getAttribute('data-tema') === p; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
    var sw = $('ajSubir'); if (sw) sw.setAttribute('aria-checked', window.subirActivo && subirActivo() ? 'true' : 'false');
    var av = $('ajAvisosSub'); if (av) av.textContent = textoAvisos();
  }
  window.ajustesAbrir = function () {
    cerrar();
    var ov = document.createElement('div'); ov.id = 'ajOv'; ov.className = 'av-ov';
    ov.innerHTML = '<div class="av-hoja" role="dialog" aria-modal="true" aria-label="Ajustes">'
      + '<div class="av-tit">Ajustes</div>'
      + '<label class="ext-l">Apariencia</label>'
      + '<div class="ext-inc" role="radiogroup">'
      + '<button type="button" class="sug-chip" role="radio" data-tema="auto">Automático</button>'
      + '<button type="button" class="sug-chip" role="radio" data-tema="claro">Claro</button>'
      + '<button type="button" class="sug-chip" role="radio" data-tema="oscuro">Oscuro</button></div>'
      + '<p class="av-nota">Automático sigue el modo claro u oscuro del teléfono.</p>'
      + '<label class="ext-l">Avisos</label>'
      + '<button type="button" class="av-btn av-sec" id="ajAvisos" style="width:100%;text-align:left;padding:10px 16px"><span id="ajAvisosT">Avisos en este teléfono</span><br><small id="ajAvisosSub" style="font-weight:500"></small></button>'
      + '<label class="ext-l">Al cotizar</label>'
      + '<div class="nv-opt" style="padding:0"><div class="nv-opt-t"><b id="ajSubirT">Volver arriba al agregar</b></div>'
      + '<button type="button" id="ajSubir" class="sw" role="switch" aria-labelledby="ajSubirT" aria-checked="true"><i></i></button></div>'
      + '<div class="av-acc"><button type="button" class="av-btn av-gris" id="ajCerrar">Cerrar</button></div></div>';
    ov.addEventListener('click', function (e) { if (e.target === ov) cerrar(); });
    document.body.appendChild(ov);
    [].forEach.call(ov.querySelectorAll('[data-tema]'), function (b) { b.onclick = function () { temaSet(b.getAttribute('data-tema')); pintar(); }; });
    $('ajSubir').onclick = function () { subirFijar(!(window.subirActivo && subirActivo())); pintar(); };
    $('ajAvisos').onclick = function () { cerrar(); if (window.abrirAvisos) abrirAvisos(); };
    $('ajCerrar').onclick = cerrar;
    pintar();
    if (typeof cerrarMenu === 'function') try { cerrarMenu(); } catch (e) {}
  };
  // Punto de aviso en «Ajustes» cuando los avisos del teléfono están sin activar
  function punto() { var d = $('navAvisosDot'), a = $('navAjustesDot'); if (d && a) a.hidden = d.hidden; }
  window.addEventListener('load', function () {
    var d = $('navAvisosDot'); if (d && window.MutationObserver) new MutationObserver(punto).observe(d, { attributes: true, attributeFilter: ['hidden'] });
    punto();
  });
})();
