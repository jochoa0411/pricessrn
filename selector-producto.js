// ── Elegir saco / tela con la hoja de selección (en lugar del desplegable nativo) ──
// El <select> original sigue existiendo (oculto) y conserva el valor: todo lo demás del cotizador lo sigue leyendo igual.
// La hoja muestra el nombre grande, el detalle debajo (gramos · impresión · precios), grupos por medida/categoría y buscador
// que ignora acentos y acepta varias palabras («rojo 28x44»).
(function () {
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // «Blanco Liso 28x44 · 110 gm · sin impresión · Q2.55 / Q2.81» → nombre, detalle y precios con nombre
  function partir(texto, conPrecios) {
    var p = String(texto).split(' · '), nombre = p.shift(), precios = '';
    var m = p.length && /^Q[\d.,]+ \/ Q[\d.,]+$|^—? ?\/? ?Q[\d.,]+$|^(Q[\d.,]+|—) \/ (Q[\d.,]+|—)$/.exec(p[p.length - 1]);
    if (m && conPrecios) { var pr = p.pop().split(' / '); precios = 'Base ' + pr[0] + ' · +10 % ' + pr[1]; }
    return { nombre: nombre, sub: p.concat(precios ? [precios] : []).join(' · ') };
  }
  function opcionesDe(sel, tipo) {
    var ops = [];
    [].forEach.call(sel.querySelectorAll('option'), function (o) {
      if (!o.value) return;
      var grupo = o.parentNode && o.parentNode.tagName === 'OPTGROUP' ? o.parentNode.label : '';
      var d;
      if (tipo === 'saco') {
        d = partir(o.textContent, !!(window.listaSacoId && listaSacoId()));
        if (grupo && /^\d+\s*[x×]\s*\d+$/i.test(grupo)) grupo = grupo.replace(/\s*[x×]\s*/i, ' × ') + ' pulg';
      } else {
        var t = (typeof TELAS !== 'undefined') ? TELAS.filter(function (x) { return String(x.id) === o.value; })[0] : null;
        d = { nombre: o.textContent, sub: t ? [t.sombra, t.rollo ? 'rollo ' + t.rollo : ''].filter(Boolean).join(' · ') : '' };
        grupo = t && t.cat ? t.cat : '';
      }
      ops.push({ valor: o.value, texto: d.nombre, sub: d.sub, grupo: grupo });
    });
    return ops;
  }

  function montar(selId, btnId, titulo, tipo) {
    var sel = $(selId); if (!sel || $(btnId)) return;
    var b = document.createElement('button');
    b.type = 'button'; b.id = btnId; b.className = 'pk-btn pk-prod';
    b.setAttribute('aria-haspopup', 'dialog');
    b.innerHTML = '<span class="pk-btn-v"></span><span class="pk-btn-i"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 9l4-4 4 4M8 15l4 4 4-4"/></svg></span>';
    b.addEventListener('click', function () {
      var ops = opcionesDe(sel, tipo);
      LGM.picker({ titulo: titulo, opciones: ops, valor: sel.value, buscar: true,
        alElegir: function (v) { sel.value = v; sel.dispatchEvent(new Event('change', { bubbles: true })); sincronizar(); } });
    });
    sel.style.display = 'none';
    sel.parentNode.insertBefore(b, sel.nextSibling);
    sincronizar();
  }

  function sincronizar() {
    [['cotSacoSelect', 'cotSacoBtn', 'Toca para elegir el saco…', 'saco'], ['cotTelaSelect', 'cotTelaBtn', 'Toca para elegir la tela…', 'tela']].forEach(function (c) {
      var sel = $(c[0]), b = $(c[1]); if (!sel || !b) return;
      var o = sel.value ? sel.options[sel.selectedIndex] : null;
      var v = b.querySelector('.pk-btn-v');
      var html;
      if (!o || !o.value) html = '<span class="pk-vacio-t">' + esc(c[2]) + '</span>';
      else { var d = c[3] === 'saco' ? partir(o.textContent, false) : { nombre: o.textContent, sub: '' }; html = '<b>' + esc(d.nombre) + '</b>' + (d.sub ? '<small>' + esc(d.sub) + '</small>' : ''); }
      if (v.innerHTML !== html) v.innerHTML = html;
    });
  }

  window.addEventListener('load', function () {
    montar('cotSacoSelect', 'cotSacoBtn', 'Elegir saco', 'saco');
    montar('cotTelaSelect', 'cotTelaBtn', 'Elegir tela', 'tela');
    ['loadSelects', 'actSacoPreview', 'actTelaPreview', 'syncTelaUI'].forEach(function (n) {
      var f = window[n]; if (typeof f !== 'function') return;
      window[n] = function () { var r = f.apply(this, arguments); sincronizar(); return r; };
    });
    setInterval(sincronizar, 500);      // limpiar el formulario o editar un ítem cambian el valor sin avisar
  });
})();
