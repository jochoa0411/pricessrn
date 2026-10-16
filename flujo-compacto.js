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
  function pintarResumen() {
    var c = card(), r = $('cliResumen'); if (!c || !r) return;
    var nombre = $('cotCliente').value.trim(), nit = $('cotNit').value.trim();
    var est = $('cliEstado'), estTxt = est && est.style.display !== 'none' ? est.textContent.trim() : '';
    r.querySelector('.cli-res-n').textContent = nombre;
    r.querySelector('.cli-res-d').textContent = [nit ? 'NIT ' + nit : 'Sin NIT', estTxt].filter(Boolean).join(' · ');
  }
  window.compactarCliente = function () {
    var c = card(); if (!c || !$('cotCliente').value.trim()) return;
    pintarResumen(); c.classList.add('compacto');
  };
  window.expandirCliente = function (enfocar) {
    var c = card(); if (!c) return;
    c.classList.remove('compacto');
    if (enfocar) { var i = $('cotCliente'); if (i) { c.scrollIntoView({ block: 'start', behavior: 'smooth' }); setTimeout(function () { i.focus(); }, 120); } }
  };
  function montarResumen() {
    var c = card(); if (!c || $('cliResumen')) return;
    var r = document.createElement('div');
    r.id = 'cliResumen'; r.className = 'cli-resumen';
    r.innerHTML = '<span class="ic" data-ic="user"></span><div class="cli-res-t"><b class="cli-res-n"></b><small class="cli-res-d"></small></div>'
      + '<button type="button" class="cli-res-b" onclick="expandirCliente(true)">Cambiar</button>';
    c.insertBefore(r, c.firstChild);
    if (typeof _hidratarIconos === 'function') _hidratarIconos();
  }
  // «Avanzar» = tocar algo del formulario de la cotización (material, saco, pestañas…) estando el cliente ya escrito
  document.addEventListener('focusin', function (e) {
    var t = e.target, c = card(); if (!c || !t || c.contains(t)) return;
    if (t.closest && (t.closest('#cot-tela') || t.closest('#cot-saco') || t.closest('.tabs'))) compactarCliente();
  });
  LGM.on('vista:cambio', function () { var s = $('cotizar'); if (s && s.classList.contains('active')) compactarCliente(); });
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

  // ── 3) Tras agregar, volver al inicio para el siguiente ítem ──
  LGM.on('item:agregado', function (ev) {
    if (ev.actualizado) return;
    setTimeout(function () { var c = document.querySelector('.content'); if (c) c.scrollTo({ top: 0, behavior: 'smooth' }); }, 60);
  });

  window.addEventListener('load', function () {
    montarResumen(); montarBarra();
    var w = document.querySelector('#cotizar .cart-wrap'), root = document.querySelector('.content');
    if (w && root && window.IntersectionObserver) {
      new IntersectionObserver(function (es) { cartVisible = es[0].isIntersecting; actualizarBarra(); }, { root: root, threshold: 0.25 }).observe(w);
    }
    actualizarBarra();
  });
})();
