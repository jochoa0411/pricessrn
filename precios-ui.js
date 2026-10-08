// ── Selector tipo iPhone + consulta de listas de precios ───────────────────────────────────────
// 1) LGM.picker(...)  — hoja inferior con esquinas redondeadas, fondo difuminado, marca de selección y búsqueda;
//    se ve igual en iPhone, Android y PC (reemplaza al desplegable nativo del navegador).
// 2) Sección «Listas de precios» — consultar precios (general y por cliente) sin armar una cotización.
(function () {
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var SVG = {
    check: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>',
    updown: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 9l4-4 4 4M8 15l4 4 4-4"/></svg>',
    search: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    tag: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.3"/></svg>'
  };

  // ───────────────────────── Selector (hoja inferior) ─────────────────────────
  // opts: { titulo, opciones:[{valor, texto, sub, grupo}], valor, buscar:true|false, alElegir(valor) }
  var abierto = null;
  LGM.picker = function (opts) {
    cerrar(true);
    var ops = opts.opciones || [];
    var conBusqueda = opts.buscar != null ? opts.buscar : ops.length > 7;
    var ov = document.createElement('div');
    ov.className = 'pk-ov'; ov.setAttribute('role', 'presentation');
    ov.innerHTML = '<div class="pk-sheet" role="dialog" aria-modal="true" aria-label="' + esc(opts.titulo || 'Elegir') + '">'
      + '<div class="pk-grab" aria-hidden="true"></div>'
      + '<div class="pk-head"><div class="pk-title">' + esc(opts.titulo || 'Elegir') + '</div></div>'
      + (conBusqueda ? '<div class="pk-search">' + SVG.search + '<input type="search" placeholder="Buscar" aria-label="Buscar" autocomplete="off"></div>' : '')
      + '<div class="pk-list" role="listbox"></div>'
      + '<button type="button" class="pk-cancel">Cancelar</button></div>';
    document.body.appendChild(ov);
    var sheet = ov.querySelector('.pk-sheet'), list = ov.querySelector('.pk-list');
    var sel = opts.valor, foco = -1;

    function pintar(filtro) {
      var f = String(filtro || '').toLowerCase().trim(), html = '', ultimo = null, n = 0;
      ops.forEach(function (o, i) {
        if (f && (String(o.texto) + ' ' + String(o.sub || '')).toLowerCase().indexOf(f) < 0) return;
        if (o.grupo && o.grupo !== ultimo) { html += '<div class="pk-grp">' + esc(o.grupo) + '</div>'; ultimo = o.grupo; }
        var on = String(o.valor) === String(sel);
        html += '<button type="button" class="pk-op' + (on ? ' on' : '') + '" role="option" aria-selected="' + on + '" data-i="' + i + '">'
          + '<span class="pk-tx"><b>' + esc(o.texto) + '</b>' + (o.sub ? '<small>' + esc(o.sub) + '</small>' : '') + '</span>'
          + '<span class="pk-ck">' + (on ? SVG.check : '') + '</span></button>';
        n++;
      });
      list.innerHTML = html || '<div class="pk-vacio">Sin resultados</div>';
      foco = -1;
    }
    pintar('');

    function elegir(i) { var o = ops[i]; if (!o) return; cerrar(); if (opts.alElegir) opts.alElegir(o.valor, o); }
    list.addEventListener('click', function (e) { var b = e.target.closest('.pk-op'); if (b) elegir(parseInt(b.dataset.i, 10)); });
    ov.addEventListener('click', function (e) { if (e.target === ov) cerrar(); });
    ov.querySelector('.pk-cancel').addEventListener('click', function () { cerrar(); });
    var inp = ov.querySelector('.pk-search input');
    if (inp) inp.addEventListener('input', function () { pintar(inp.value); });

    function teclas(e) {
      if (e.key === 'Escape') { e.preventDefault(); cerrar(); return; }
      var btns = [].slice.call(list.querySelectorAll('.pk-op'));
      if (!btns.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        foco = e.key === 'ArrowDown' ? Math.min(btns.length - 1, foco + 1) : Math.max(0, foco - 1);
        btns[foco].focus();
      }
    }
    document.addEventListener('keydown', teclas);

    // Deslizar hacia abajo para cerrar (en la barra superior)
    var y0 = null;
    var head = ov.querySelector('.pk-grab'), head2 = ov.querySelector('.pk-head');
    [head, head2].forEach(function (h) {
      h.addEventListener('touchstart', function (e) { y0 = e.touches[0].clientY; sheet.style.transition = 'none'; }, { passive: true });
      h.addEventListener('touchmove', function (e) { if (y0 == null) return; var d = Math.max(0, e.touches[0].clientY - y0); sheet.style.transform = 'translateY(' + d + 'px)'; }, { passive: true });
      h.addEventListener('touchend', function (e) {
        if (y0 == null) return; var d = (e.changedTouches[0].clientY - y0); y0 = null; sheet.style.transition = '';
        if (d > 90) cerrar(); else sheet.style.transform = '';
      });
    });

    var previo = document.activeElement;
    abierto = { ov: ov, teclas: teclas, previo: previo };
    requestAnimationFrame(function () {
      ov.classList.add('on');
      var s = list.querySelector('.pk-op.on') || list.querySelector('.pk-op');
      if (s && !conBusqueda) { s.scrollIntoView({ block: 'center' }); s.focus({ preventScroll: true }); }
      else if (inp && window.matchMedia('(hover:hover)').matches) inp.focus();
    });
  };
  function cerrar(sinAnimar) {
    if (!abierto) return;
    var a = abierto; abierto = null;
    document.removeEventListener('keydown', a.teclas);
    var quitar = function () { if (a.ov.parentNode) a.ov.parentNode.removeChild(a.ov); if (a.previo && a.previo.focus) { try { a.previo.focus({ preventScroll: true }); } catch (e) {} } };
    if (sinAnimar) { quitar(); return; }
    a.ov.classList.remove('on'); setTimeout(quitar, 220);
  }

  // ─────────── Botón del selector de la lista de precios (formulario de sacos) ───────────
  function textoLista(id) { var l = window.listaPorId && id ? listaPorId(id) : null; return l ? 'Lista de ' + l.nombre : 'General (A / B / C)'; }
  window.pkSyncLista = function () {
    var b = $('cotListaBtn'); if (!b) return;
    var id = window.listaSacoId ? listaSacoId() : null;
    b.querySelector('.pk-btn-v').textContent = textoLista(id);
  };
  function opcionesListas() {
    var ops = [{ valor: '', texto: 'General (A / B / C)', sub: 'Precios de lista para todos', grupo: 'General' }];
    (window.LISTAS_CLIENTE || []).forEach(function (l) {
      var n = Object.keys(l.precios || {}).length;
      ops.push({ valor: String(l.id), texto: 'Lista de ' + l.nombre, sub: n + (n === 1 ? ' saco con precio' : ' sacos con precio'), grupo: 'Por cliente' });
    });
    return ops;
  }
  window.elegirListaSaco = function () {
    var sel = $('cotListaSaco');
    LGM.picker({ titulo: 'Lista de precios', opciones: opcionesListas(), valor: sel.value, buscar: (window.LISTAS_CLIENTE || []).length > 7,
      alElegir: function (v) { sel.value = v; if (window.cambiarListaSaco) cambiarListaSaco(true); pkSyncLista(); } });
  };
  function montarBotonLista() {
    var sel = $('cotListaSaco'); if (!sel || $('cotListaBtn')) return;
    var b = document.createElement('button');
    b.type = 'button'; b.id = 'cotListaBtn'; b.className = 'pk-btn';
    b.setAttribute('aria-haspopup', 'dialog');
    b.innerHTML = '<span class="pk-btn-v"></span><span class="pk-btn-i">' + SVG.updown + '</span>';
    b.addEventListener('click', elegirListaSaco);
    sel.style.display = 'none';
    sel.parentNode.insertBefore(b, sel.nextSibling);
    pkSyncLista();
  }

  // ───────────────────────── Sección «Listas de precios» ─────────────────────────
  var ST = { lista: '', vista: 'sacos', q: '' };
  try { var g = JSON.parse(localStorage.getItem('PRECIOS_VISTA') || 'null'); if (g) { ST.lista = g.lista || ''; ST.vista = g.vista || 'sacos'; } } catch (e) {}
  function guardarVista() { try { localStorage.setItem('PRECIOS_VISTA', JSON.stringify({ lista: ST.lista, vista: ST.vista })); } catch (e) {} }
  function Q(v, d) { return v == null ? '—' : 'Q' + Number(v).toFixed(d == null ? 2 : d); }
  function listaActual() { return ST.lista ? (window.listaPorId ? listaPorId(ST.lista) : null) : null; }

  function cuerpoSacos(lista, q) {
    var html = '', n = 0;
    gruposSacos().forEach(function (arr, medida) {
      var filas = arr.filter(function (s) {
        if (lista) { var p = lista.precios && lista.precios[s.id]; if (!p || (p.base == null && p.mas10 == null)) return false; }
        return !q || (etiquetaSaco(s) + ' ' + s.medidas).toLowerCase().indexOf(q) >= 0;
      });
      if (!filas.length) return;
      html += '<div class="pr-grp">' + esc(medida) + '</div>';
      filas.forEach(function (s) {
        n++;
        var precios = lista
          ? [['Base', lista.precios[s.id].base], ['+10 %', lista.precios[s.id].mas10]]
          : [['A', s.pA], ['B', s.pB], ['C', s.pC]];
        html += '<div class="pr-row"><div class="pr-top"><div class="pr-n">' + etiquetaSaco(s) + '</div>'
          + '<button type="button" class="pr-go" onclick="cotizarSacoDesde(' + s.id + ')">Cotizar</button></div>'
          + '<div class="pr-pp cols' + precios.length + '">' + precios.map(function (p) { return '<div><small>' + p[0] + '</small><b>' + Q(p[1]) + '</b></div>'; }).join('') + '</div></div>';
      });
    });
    return n ? html : '<div class="pr-vacio">' + (q ? 'No hay sacos que coincidan con “' + esc(q) + '”.' : 'Esta lista no tiene sacos con precio.') + '</div>';
  }
  function cuerpoTelas(q) {
    var arr = TELAS.filter(function (t) { return !q || (t.nombre + ' ' + (t.cat || '') + ' ' + (t.sombra || '')).toLowerCase().indexOf(q) >= 0; });
    if (!arr.length) return '<div class="pr-vacio">' + (q ? 'No hay telas que coincidan.' : 'No hay telas en la lista.') + '</div>';
    return arr.map(function (t) {
      return '<div class="pr-row"><div class="pr-top"><div class="pr-n">' + esc(t.nombre) + '<small>' + esc([t.cat, t.sombra, t.rollo ? 'rollo ' + t.rollo : ''].filter(Boolean).join(' · ')) + '</small></div>'
        + '<button type="button" class="pr-go" onclick="cotizarTelaDesde(' + t.id + ')">Cotizar</button></div>'
        + '<div class="pr-pp cols2"><div><small>Rollo master</small><b>$' + Number(t.pm).toFixed(3)+ '</b></div><div><small>Confeccionado</small><b>$' + Number(t.pc).toFixed(3) + '</b></div></div>'
        + '<div class="pr-nota">Dólares por pie²</div></div>';
    }).join('');
  }
  window.renderPrecios = function () {
    var box = $('preciosCuerpo'); if (!box) return;
    var lista = listaActual();
    if (ST.lista && !lista) { ST.lista = ''; }
    var q = ST.q.toLowerCase().trim();
    $('prListaV').textContent = textoLista(ST.lista ? Number(ST.lista) : null);
    $('prVistaBox').style.display = lista ? 'none' : 'flex';
    $('prSegSacos').classList.toggle('on', ST.vista === 'sacos' || !!lista);
    $('prSegTelas').classList.toggle('on', ST.vista === 'telas' && !lista);
    var enTelas = ST.vista === 'telas' && !lista;
    $('prBuscar').placeholder = enTelas ? 'Buscar tela' : 'Buscar saco (medida, color…)';
    box.innerHTML = enTelas ? cuerpoTelas(q) : cuerpoSacos(lista, q);
    var v = localStorage.getItem('PRECIOS_VERSION') || '';
    $('prPie').textContent = (v ? 'Precios vigentes · versión ' + v : 'Precios guardados en este teléfono') + (lista ? ' · lista de ' + lista.nombre : '');
  };
  window.elegirListaPrecios = function () {
    LGM.picker({ titulo: 'Lista de precios', opciones: opcionesListas(), valor: ST.lista, buscar: (window.LISTAS_CLIENTE || []).length > 7,
      alElegir: function (v) { ST.lista = v; guardarVista(); renderPrecios(); } });
  };
  window.prVista = function (v) { ST.vista = v; guardarVista(); renderPrecios(); };
  window.prBuscar = function (v) { ST.q = v; renderPrecios(); };

  // Pasar un producto a la cotización (con su lista)
  function irACotizar(tabIdx) {
    irSeccion('cotizar');
    var btn = document.querySelectorAll('.tab-btn')[tabIdx]; if (btn) btn.click();
    var c = document.querySelector('.content'); if (c) c.scrollTo({ top: 0 });
  }
  window.cotizarSacoDesde = function (id) {
    irACotizar(1);
    if (window.setListaSaco) setListaSaco(ST.lista ? Number(ST.lista) : null, null);
    var s = $('cotSacoSelect'); s.value = String(id); actSacoPreview(); pkSyncLista();
    $('cotCantSaco').focus();
  };
  window.cotizarTelaDesde = function (id) {
    irACotizar(0);
    var s = $('cotTelaSelect'); s.value = String(id); actTelaPreview();
  };

  LGM.on('vista:cambio', function () { var s = $('precios'); if (s && s.classList.contains('active')) renderPrecios(); var b = $('bnPrecios'); if (b) b.classList.toggle('on', !!(s && s.classList.contains('active'))); });
  LGM.on('precios:sync', function () { var s = $('precios'); if (s && s.classList.contains('active')) renderPrecios(); pkSyncLista(); });

  window.addEventListener('load', function () { montarBotonLista(); pkSyncLista(); });
})();
