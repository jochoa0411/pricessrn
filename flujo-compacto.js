// ── Menos desplazamiento al cotizar ──────────────────────────────────────────────────────────────────────
// 1) Cuando el cliente ya está y el vendedor pasa a armar la cotización, la tarjeta de cliente se encoge a una línea
//    («Cliente · NIT · Cambiar»). Se vuelve a abrir con un toque, o sola si hace falta escribir al cliente.
// 2) Una barra fija «Presupuesto · N ítems · total · Ver y enviar» lleva al presupuesto con un toque (ya no hay que bajar
//    buscándolo). Se oculta cuando el presupuesto ya está a la vista o cuando la barra de totales de la tela ocupa su lugar.
// 3) Al agregar un ítem se vuelve al inicio del formulario para agregar el siguiente.
(function () {
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  var card = function () { return document.querySelector('#cotizar .cli-card'); };

  // ── 1) Cliente compacto ──
  // El nombre del cliente pasa al ENCABEZADO («Cotizando a · NOMBRE ✎») y la tarjeta se reduce a la fila del IVA: todo el espacio
  // de la pantalla queda para la cotización. Tocar el encabezado la vuelve a abrir.
  var TITULO = 'Cotizador LGM';
  function titulo() { return document.querySelector('#appShell header h1'); }
  function pintarTitulo(compacto) {
    var h1 = titulo(); if (!h1) return;
    if (compacto) {
      var nombre = $('cotCliente').value.trim();
      h1.innerHTML = '<span class="hc-s">Cotizando a</span><b class="hc-n">' + esc(nombre) + ' <i aria-hidden="true">✎</i></b>';
      h1.classList.add('hc-cli'); h1.setAttribute('role', 'button'); h1.setAttribute('tabindex', '0');
      h1.setAttribute('aria-label', 'Cotizando a ' + nombre + '. Toca para cambiar el cliente');
    } else {
      h1.textContent = TITULO; h1.classList.remove('hc-cli'); h1.removeAttribute('role'); h1.removeAttribute('tabindex'); h1.removeAttribute('aria-label');
    }
  }
  // Mantiene en su sitio lo que el usuario está mirando cuando la tarjeta cambia de alto (iOS no tiene «scroll anchoring»)
  function conservarPosicion(fn, ancla) {
    var cont = document.querySelector('.content');
    var a = ancla || (document.activeElement && document.activeElement !== document.body ? document.activeElement : document.querySelector('#cotizar .tabs'));
    var antes = a && a.getBoundingClientRect ? a.getBoundingClientRect().top : null;
    fn();
    if (antes != null && cont) { var desp = a.getBoundingClientRect().top - antes; if (Math.abs(desp) > 1) cont.scrollTop += desp; }
  }
  window.compactarCliente = function () {
    var c = card(); if (!c || !$('cotCliente').value.trim() || c.classList.contains('compacto')) { if (c && c.classList.contains('compacto')) pintarTitulo(true); return; }
    conservarPosicion(function () { c.classList.add('compacto'); });
    pintarTitulo(true);
  };
  window.expandirCliente = function (enfocar) {
    var c = card(); if (!c) return;
    pintarTitulo(false);
    c.classList.remove('compacto');
    if (enfocar) {
      var i = $('cotCliente'), cont = document.querySelector('.content');
      if (cont) cont.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(function () { if (i) i.focus({ preventScroll: true }); }, 150);
    }
  };
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('#appShell header h1.hc-cli')) expandirCliente(true); });
  document.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('hc-cli')) { e.preventDefault(); expandirCliente(true); } });
  // «Avanzar» = tocar algo del formulario de la cotización (material, saco, pestañas…) estando el cliente ya escrito
  document.addEventListener('focusin', function (e) {
    var t = e.target, c = card(); if (!c || !t || c.contains(t)) return;
    if (t.closest && (t.closest('#cot-tela') || t.closest('#cot-saco') || t.closest('.tabs'))) compactarCliente();
  });
  // En otras secciones el encabezado vuelve a decir «Cotizador LGM»; al regresar a Cotizar se vuelve a mostrar el cliente
  LGM.on('vista:cambio', function () {
    var s = $('cotizar'), c = card(); if (!s || !c) return;
    if (s.classList.contains('active')) { if (c.classList.contains('compacto')) pintarTitulo(true); else compactarCliente(); }
    else pintarTitulo(false);
  });
  LGM.on('item:agregado', function () { compactarCliente(); });

  // ── 2) Barra del presupuesto ──
  function montarBarra() {
    if ($('cartBar')) return;
    var b = document.createElement('div');
    b.id = 'cartBar'; b.className = 'cart-bar'; b.style.display = 'none';
    b.innerHTML = '<div class="cart-bar-i"><span class="cart-bar-n"></span><b class="cart-bar-t"></b></div>'
      + '<button type="button" class="cart-bar-b" onclick="irAlPresupuesto()">Ver y enviar</button>';
    $('appShell').appendChild(b);
  }
  window.irAlPresupuesto = function () {
    var w = document.querySelector('#cotizar .cart-wrap'); if (w) w.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  var cartVisible = false;
  function actualizarBarra() {
    var b = $('cartBar'); if (!b) return;
    var enCotizar = $('cotizar') && $('cotizar').classList.contains('active');
    var hay = typeof CARRITO !== 'undefined' && CARRITO.length > 0;
    var ocupada = document.body.classList.contains('tl-bar-on');      // la barra de totales de la tela ya está abajo
    var ver = enCotizar && hay && !ocupada && !cartVisible;
    b.style.display = ver ? 'flex' : 'none';
    document.body.classList.toggle('cartbar-on', ver);
    if (hay) {
      var n = CARRITO.length;
      b.querySelector('.cart-bar-n').textContent = 'Presupuesto · ' + n + (n === 1 ? ' ítem' : ' ítems');
      var tot = $('cartTotal'); b.querySelector('.cart-bar-t').textContent = tot ? tot.textContent : '';
    }
  }
  LGM.on('carrito:render', actualizarBarra);
  LGM.on('vista:cambio', actualizarBarra);
  new MutationObserver(actualizarBarra).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // ── 3) Desplazamiento automático controlado por el usuario ──
  // «Subir al inicio después de agregar un ítem» (menú Más): activado por defecto; apagado, la pantalla se queda donde está.
  function subirActivo() { try { return localStorage.getItem('cotSubirAlAgregar') !== '0'; } catch (e) { return true; } }
  window.alternarOpcionSubir = function () {
    var b = $('optSubir'), on = b.getAttribute('aria-checked') !== 'true';
    b.setAttribute('aria-checked', on ? 'true' : 'false');
    try { localStorage.setItem('cotSubirAlAgregar', on ? '1' : '0'); } catch (e) {}
  };
  function montarOpcionScroll() {
    var foot = document.querySelector('#sidebar .nv-foot'); if (!foot || $('optSubir')) return;
    var l = document.createElement('div'); l.className = 'nv-opt';
    l.innerHTML = '<div class="nv-opt-t"><b id="optSubirT">Volver arriba al agregar</b><small>Después de agregar un producto, la pantalla sube al inicio para agregar el siguiente.</small></div>'
      + '<button type="button" id="optSubir" class="sw" role="switch" aria-labelledby="optSubirT" aria-checked="' + (subirActivo() ? 'true' : 'false') + '" onclick="alternarOpcionSubir()"><i></i></button>';
    foot.insertBefore(l, foot.firstChild);
  }
  LGM.on('item:agregado', function (ev) {
    if (ev.actualizado || !subirActivo()) return;
    setTimeout(function () { var c = document.querySelector('.content'); if (c) c.scrollTo({ top: 0, behavior: 'smooth' }); }, 60);
  });

  window.addEventListener('load', function () {
    montarBarra(); montarOpcionScroll();
    var tb = $('tlBar'), shell = $('appShell');
    if (tb && shell && tb.parentNode !== shell) shell.appendChild(tb);   // la barra de totales de la tela también va dentro de la columna
    var w = document.querySelector('#cotizar .cart-wrap'), root = document.querySelector('.content');
    if (w && root && window.IntersectionObserver) {
      new IntersectionObserver(function (es) { cartVisible = es[0].isIntersecting; actualizarBarra(); }, { root: root, threshold: 0.25 }).observe(w);
    }
    actualizarBarra();
  });
})();
