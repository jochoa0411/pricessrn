// ── Cotizar telas paso a paso ────────────────────────────────────────────────────────────────────────────
// El formulario de tela se muestra de a un paso: 1 ¿Qué tela? → 2 ¿Qué medidas? → 3 Precio y agregar.
// Los pasos ya hechos se pliegan a una línea con su resumen y «Cambiar». No toca los campos ni el cálculo:
// sólo decide qué grupo (.pp) se ve. Si algo falta, «Siguiente» lo dice y lleva al campo.
(function () {
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function num(id) { var e = $(id); return e ? (parseFloat(e.value) || 0) : 0; }
  var TIT = { 1: '¿Qué tela?', 2: '¿Qué medidas?', 3: 'Precio y agregar' };
  var cur = 1, grupos = [];

  function fm(v) { return String(+Number(v).toFixed(2)); }
  function ok1() { return !!$('cotTelaSelect').value; }
  function ok2() { return num('cotAncho') > 0 && num('cotLargo') > 0 && num('cotCantTela') >= 1; }
  function alcanza() { return ok1() ? (ok2() ? 3 : 2) : 1; }
  function resumen(i) {
    if (i === 1) {
      var sel = $('cotTelaSelect'), t = ok1() ? sel.options[sel.selectedIndex].text : '';
      var m = document.querySelector('input[name="cotModoTela"]:checked');
      var partes = [t]; if (m) partes.push(m.value === 'master' ? 'Rollo Master' : 'Confeccionado');
      if (m && m.value === 'conf' && $('tlAcabado') && $('tlAcabado').style.display !== 'none') {
        partes.push($('tlOrSi').classList.contains('on') ? 'con ojetes y ribete' : 'sin ojetes');
        if ($('tlFuSi').classList.contains('on')) partes.push('con fuelle');
      }
      return partes.join(' · ');
    }
    if (i === 2) {
      var ua = $('cotUAncho').value === 'm' ? 'm' : 'pies', ul = $('cotULargo').value === 'm' ? 'm' : 'pies', c = Math.max(1, parseInt($('cotCantTela').value, 10) || 1);
      return fm(num('cotAncho')) + ' ' + ua + ' × ' + fm(num('cotLargo')) + ' ' + ul + ' · ' + c + (c === 1 ? ' pieza' : ' piezas');
    }
    return '';
  }

  function montar() {
    var raiz = $('tlPasos'); if (!raiz) return;
    grupos = [].slice.call(raiz.querySelectorAll('.pp'));
    grupos.forEach(function (g, k) {
      var i = k + 1;
      var h = document.createElement('button');
      h.type = 'button'; h.className = 'pp-head'; h.setAttribute('data-ph', i);
      h.addEventListener('click', function () { ir(i); });
      g.insertBefore(h, g.firstChild);
      var cuerpo = document.createElement('div'); cuerpo.className = 'pp-body';
      while (h.nextSibling) cuerpo.appendChild(h.nextSibling);
      g.appendChild(cuerpo);
      if (i < 3) {
        var f = document.createElement('div'); f.className = 'pp-falta'; f.setAttribute('role', 'alert');
        var b = document.createElement('button'); b.type = 'button'; b.className = 'pp-sig'; b.textContent = 'Siguiente ›';
        b.addEventListener('click', function () { siguiente(i); });
        cuerpo.appendChild(f); cuerpo.appendChild(b);
      }
    });
    pintar();
  }

  function siguiente(i) {
    var g = grupos[i - 1], f = g.querySelector('.pp-falta');
    var falta = '', campo = null;
    if (i === 1 && !ok1()) { falta = 'Elige una tela para continuar.'; campo = $('cotTelaSelect'); }
    if (i === 2) {
      if (!(num('cotAncho') > 0)) { falta = 'Escribe el ancho para continuar.'; campo = $('cotAncho'); }
      else if (!(num('cotLargo') > 0)) { falta = 'Escribe el largo para continuar.'; campo = $('cotLargo'); }
    }
    if (falta) { f.textContent = falta; f.classList.add('on'); if (campo) campo.focus(); return; }
    f.classList.remove('on'); ir(i + 1);
  }

  function ir(i, sinScroll) {
    if (i > alcanza()) return;
    cur = i; pintar();
    if (!sinScroll) setTimeout(function () {
      var h = grupos[i - 1] && grupos[i - 1].querySelector('.pp-head'), c = document.querySelector('.content');
      if (!h || !c) return;
      var d = h.getBoundingClientRect().top - c.getBoundingClientRect().top - 8;
      if (Math.abs(d) > 4) c.scrollTo({ top: c.scrollTop + d, behavior: 'smooth' });
    }, 30);
  }

  function pintar() {
    if (!grupos.length) return;
    var max = alcanza();
    if (cur > max) cur = max;
    grupos.forEach(function (g, k) {
      var i = k + 1, hecho = i < cur || (i < 3 && i < max), activo = i === cur, pend = i > max;
      g.classList.toggle('pend', pend);
      var cuerpo = g.querySelector('.pp-body'); cuerpo.hidden = !activo;
      var h = g.querySelector('.pp-head'); h.setAttribute('aria-expanded', activo ? 'true' : 'false'); h.disabled = pend;
      var r = !activo && hecho && i < 3 ? resumen(i) : '';
      h.innerHTML = '<span class="pp-n" aria-hidden="true">' + (hecho && !activo ? '✓' : i) + '</span>'
        + '<span class="pp-t"><b>' + TIT[i] + '</b>' + (r ? '<span>' + esc(r) + '</span>' : '') + '</span>'
        + (r ? '<span class="pp-cambiar">Cambiar</span>' : '');
      h.setAttribute('aria-label', 'Paso ' + i + ': ' + TIT[i] + (r ? '. ' + r + '. Toca para cambiar' : ''));
    });
  }

  window.ppIr = function (i) { ir(i, true); };
  window.ppReiniciar = function () { cur = 1; pintar(); };

  window.addEventListener('load', function () {
    montar();
    // Cada vez que cambia algo de la tela: refrescar resúmenes; si el formulario quedó vacío, volver al paso 1
    var orig = window.syncTelaUI;
    if (orig) window.syncTelaUI = function () { var r = orig.apply(this, arguments); if (!ok1()) cur = 1; pintar(); return r; };
    // Editar un ítem del presupuesto: todo ya está lleno → directo al último paso
    var ed = window.editarItemCarrito;
    if (ed) window.editarItemCarrito = function () { var r = ed.apply(this, arguments); setTimeout(function () { if (ok1() && ok2()) ir(3); }, 60); return r; };
    LGM.on('item:agregado', function (ev) { if (ev.tipo === 'tela') setTimeout(function () { cur = 1; pintar(); }, 0); });
  });
})();
