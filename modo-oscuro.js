// ── Modo oscuro: Automático (sigue al teléfono) / Claro / Oscuro ──
// La app tiene cientos de colores fijos, así que el oscuro se logra con una capa transparente que invierte lo que hay debajo
// (backdrop-filter) y la pasa a blanco y negro. Así cubre también las pantallas que se arman con JavaScript. La elección se guarda en este teléfono.
(function () {
  var KEY = 'lgm_tema', NOMBRES = { auto: 'Automático', claro: 'Claro', oscuro: 'Oscuro' };
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function leer() { try { var v = localStorage.getItem(KEY); return NOMBRES[v] ? v : 'auto'; } catch (e) { return 'auto'; } }
  function oscuroAhora(p) { return p === 'oscuro' || (p === 'auto' && !!(mq && mq.matches)); }
  var pref = leer();
  function aplicar() {
    var osc = oscuroAhora(pref), h = document.documentElement;
    h.classList.toggle('tema-oscuro', osc);
    var m = document.querySelector('meta[name="color-scheme"]'); if (m) m.setAttribute('content', osc ? 'dark' : 'light');
    var t = document.querySelector('meta[name="theme-color"]'); if (t) { if (!t.dataset.orig) t.dataset.orig = t.getAttribute('content') || ''; t.setAttribute('content', osc ? '#0d2e1c' : t.dataset.orig); }
  }
  function capa() {
    if (document.getElementById('temaCapa') || !document.body) return;
    var d = document.createElement('div'); d.id = 'temaCapa'; d.setAttribute('aria-hidden', 'true'); document.body.appendChild(d);
  }
  window.temaPref = function () { return pref; };
  window.temaSet = function (p) {
    if (!NOMBRES[p]) return;
    pref = p;
    try { localStorage.setItem(KEY, pref); } catch (e) {}
    aplicar();
  };
  if (mq) { var f = function () { if (pref === 'auto') aplicar(); }; if (mq.addEventListener) mq.addEventListener('change', f); else if (mq.addListener) mq.addListener(f); }
  aplicar();
  document.addEventListener('DOMContentLoaded', function () { capa(); aplicar(); });
})();
