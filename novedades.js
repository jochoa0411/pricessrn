// ── Aviso de novedades (una sola vez por teléfono) ──
// Para anunciar algo nuevo: agregar un objeto a NOVEDADES con un id nuevo. Se muestra al entrar (ya con sesión) y no se repite.
(function () {
  var NOVEDADES = [
    { id: 'medios-pago-2026-11', titulo: 'Novedad: Medios de pago',
      texto: 'Ahora puedes compartir con tus clientes las cuentas bancarias de LGM (imagen o PDF) directo desde la app.',
      ruta: 'Menú (botón «Más») › Medios de pago', boton: 'Ver medios de pago', accion: function () { if (window.mediosPagoAbrir) window.mediosPagoAbrir(); } }
  ];
  function vista(id) { try { return localStorage.getItem('novedad_' + id) === '1'; } catch (e) { return false; } }
  function marcar(id) { try { localStorage.setItem('novedad_' + id, '1'); } catch (e) {} }
  function sesionLista() {
    var g = document.getElementById('loginGate');
    return !g || g.classList.contains('hidden') || g.offsetParent === null;
  }
  function mostrar(n) {
    var ov = document.createElement('div'); ov.id = 'novOv'; ov.className = 'av-ov';
    ov.innerHTML = '<div class="av-hoja" role="dialog" aria-modal="true" aria-label="' + n.titulo + '">'
      + '<div class="av-tit">' + n.titulo + '</div><p>' + n.texto + '</p>'
      + '<p class="av-nota"><b>Dónde:</b> ' + n.ruta + '</p>'
      + '<div class="av-acc"><button type="button" class="av-btn av-pri" id="novIr">' + n.boton + '</button>'
      + '<button type="button" class="av-btn av-gris" id="novCerrar">Entendido</button></div></div>';
    document.body.appendChild(ov);
    function cerrar() { marcar(n.id); ov.remove(); }
    document.getElementById('novCerrar').onclick = cerrar;
    document.getElementById('novIr').onclick = function () { cerrar(); try { n.accion(); } catch (e) {} };
  }
  function revisar() {
    var n = NOVEDADES.filter(function (x) { return !vista(x.id); })[0];
    if (!n) return true;
    if (!sesionLista() || document.querySelector('.av-ov')) return false;
    mostrar(n); return true;
  }
  window.addEventListener('load', function () {
    var t = setInterval(function () { if (revisar()) clearInterval(t); }, 1500);
    setTimeout(function () { clearInterval(t); }, 120000);
  });
})();
