// ── Enviar cotización paso a paso: 1 Contacto → 2 Entrega y pago → 3 Revisar y enviar ────────────────────
// Misma mecánica que paso-a-paso.js (telas) pero sobre #merPasos. No cambia los campos ni la validación:
// al enviar se muestran todos los pasos un instante para que la validación de siempre enfoque el campo que
// falta, y se abre el paso donde quedó el cursor. El modal abre en el primer paso incompleto.
(function () {
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function v(id) { var e = $(id); return e ? String(e.value || '').trim() : ''; }
  var TIT = { 1: 'Contacto', 2: 'Entrega y pago', 3: 'Revisar y enviar' };
  var cur = 1, grupos = [];

  function vendedorOk() { return !window.vendedorElegido || !!vendedorElegido('mer'); }
  function ok1() { return !!v('merContacto') && !!(v('merClienteCorreo') || v('merTelefono')) && vendedorOk(); }
  function ok2() { return !!(v('merFormaEntrega') && v('merLugarEntrega') && v('merTiempoEntrega') && v('merFormaPago')); }
  function primeroIncompleto() { return !ok1() ? 1 : (!ok2() ? 2 : 3); }
  function alcanza() { return ok1() ? (ok2() ? 3 : 2) : 1; }
  function resumen(i) {
    if (i === 1) return [v('merContacto'), v('merClienteCorreo') || v('merTelefono')].filter(Boolean).join(' · ');
    if (i === 2) { var r = $('merCondRes'); return r ? r.textContent.trim() : ''; }
    return '';
  }

  function montar() {
    var raiz = $('merPasos'); if (!raiz || raiz.getAttribute('data-listo')) return;
    raiz.setAttribute('data-listo', '1');
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
    var f = grupos[i - 1].querySelector('.pp-falta'), falta = '', campo = null;
    if (i === 1) {
      if (!v('merContacto')) { falta = 'Escribe con quién se cotiza (atención).'; campo = $('merContacto'); }
      else if (!v('merClienteCorreo') && !v('merTelefono')) { falta = 'Escribe un correo o un teléfono del contacto.'; campo = $('merClienteCorreo'); }
      else if (!vendedorOk()) { falta = 'Elige el vendedor de esta cotización.'; campo = $('merVendedorBtn'); }
    } else if (i === 2) {
      if (typeof mostrarCondiciones === 'function') mostrarCondiciones(true);
      var c = [['merFormaEntrega', 'la forma de entrega'], ['merLugarEntrega', 'el lugar de entrega'], ['merTiempoEntrega', 'el tiempo de entrega'], ['merFormaPago', 'la forma de pago']];
      for (var k = 0; k < c.length; k++) if (!v(c[k][0])) { falta = 'Completa ' + c[k][1] + ' para continuar.'; campo = $(c[k][0]); break; }
    }
    if (falta) { f.textContent = falta; f.classList.add('on'); if (campo) campo.focus(); return; }
    f.classList.remove('on'); ir(i + 1);
  }

  function ir(i, sinScroll) {
    if (i > alcanza()) return;
    cur = i; pintar();
    if (!sinScroll) setTimeout(function () { var h = grupos[i - 1] && grupos[i - 1].querySelector('.pp-head'); if (h) h.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30);
  }

  function pintar(todos) {
    if (!grupos.length) return;
    var max = alcanza(); if (cur > max) cur = max;
    grupos.forEach(function (g, k) {
      var i = k + 1, hecho = i < cur || (i < 3 && i < max), activo = i === cur, pend = i > max;
      g.classList.toggle('pend', pend);
      g.querySelector('.pp-body').hidden = todos ? false : !activo;
      var h = g.querySelector('.pp-head'); h.setAttribute('aria-expanded', activo ? 'true' : 'false'); h.disabled = pend;
      var r = !activo && hecho && i < 3 ? resumen(i) : '';
      h.innerHTML = '<span class="pp-n" aria-hidden="true">' + (hecho && !activo ? '✓' : i) + '</span>'
        + '<span class="pp-t"><b>' + TIT[i] + '</b>' + (r ? '<span>' + esc(r) + '</span>' : '') + '</span>'
        + (r ? '<span class="pp-cambiar">Cambiar</span>' : '');
      h.setAttribute('aria-label', 'Paso ' + i + ': ' + TIT[i] + (r ? '. ' + r + '. Toca para cambiar' : ''));
    });
  }

  window.addEventListener('load', function () {
    montar();
    var abrir = window.abrirModalEnviarReal;
    if (abrir) window.abrirModalEnviarReal = function () {
      var r = abrir.apply(this, arguments);
      if (!$('modalEnviarReal').classList.contains('hidden')) {
        grupos.forEach(function (g) { g.querySelector('.pp-falta') && g.querySelector('.pp-falta').classList.remove('on'); });
        cur = primeroIncompleto(); pintar();
        var c = $('modalEnviarReal').querySelector('.modal-box'); if (c) c.scrollTop = 0;
      }
      return r;
    };
    var gen = window.generarCotizacionReal;
    if (gen) window.generarCotizacionReal = function () {
      pintar(true);                                  // todo visible: la validación de siempre puede enfocar cualquier campo
      var enfocado = document.activeElement;
      var p = gen.apply(this, arguments);
      var af = document.activeElement, paso = 0;
      if (af && af !== enfocado) grupos.forEach(function (g, k) { if (g.contains(af)) paso = k + 1; });
      if (paso) { cur = paso; }
      pintar();
      // El aviso de error (cotizador.html › _errorEnModal) se mudó al primer paso mientras estaban todos visibles: se lleva al paso que quedó abierto
      var er = document.querySelector('#merPasos .err-inline'), act = grupos[cur - 1] && grupos[cur - 1].querySelector('.pp-body');
      if (er && act && er.offsetParent === null && !act.contains(er)) { act.insertBefore(er, act.firstChild); try { er.scrollIntoView({ block: 'nearest' }); } catch (e) {} }
      if (paso && af.scrollIntoView) setTimeout(function () { af.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 30);
      return p;
    };
    var sug = window.renderSugTerminos;
    if (sug) window.renderSugTerminos = function () { var r = sug.apply(this, arguments); pintar(); return r; };
  });
})();
