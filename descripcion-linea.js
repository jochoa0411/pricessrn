// ── Texto (descripción) de cada línea de la cotización, editable ───────────────────────────────────────────
// El texto se arma solo con las medidas y el acabado. El vendedor puede reemplazarlo (agregar una observación, cambiar una palabra…);
// las medidas, el precio y el cálculo siguen siendo los que se ingresaron. «Volver al texto automático» lo restablece.
(function () {
  function $(id) { return document.getElementById(id); }
  var cur = null;
  window.abrirDescripcion = function (uid) {
    var it = CARRITO.filter(function (x) { return x.uid === uid; })[0]; if (!it) return;
    cur = it;
    $('dlNombre').textContent = it.nombre;
    $('dlTexto').value = it.descripcionManual || descripcionAutomatica(it);
    $('dlAuto').style.display = it.descripcionManual ? 'block' : 'none';
    $('modalDescripcion').classList.remove('hidden');
    setTimeout(function () { $('dlTexto').focus(); }, 80);
  };
  window.cerrarDescripcion = function () { $('modalDescripcion').classList.add('hidden'); cur = null; };
  window.guardarDescripcion = function () {
    if (!cur) return;
    var t = $('dlTexto').value.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
    if (!t) { toast('Escribe el texto de la línea o vuelve al automático', 'err'); return; }
    // Si quedó igual al automático no se marca como personalizado
    cur.descripcionManual = (t === descripcionAutomatica(cur)) ? null : t.slice(0, 600);
    cerrarDescripcion(); saveCarrito(); renderCarrito();
    toast(cur && cur.descripcionManual ? 'Texto guardado' : 'Texto automático');
  };
  window.descripcionAuto = function () {
    if (!cur) return; cur.descripcionManual = null;
    cerrarDescripcion(); saveCarrito(); renderCarrito(); toast('Vuelve al texto automático');
  };
})();
