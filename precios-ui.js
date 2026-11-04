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
      var sinAcentos = function (t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); };
      var f = sinAcentos(filtro).trim(), html = '', ultimo = null, n = 0;
      var palabras = f ? f.split(/\s+/) : [];
      ops.forEach(function (o, i) {
        var pajar = sinAcentos(String(o.texto) + ' ' + String(o.sub || '') + ' ' + String(o.grupo || ''));
        if (palabras.some(function (w) { return pajar.indexOf(w) < 0; })) return;
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
  function opcionesListas(paraConsulta) {
    var ops = [{ valor: '', texto: 'General (A / B / C)', sub: 'Precios de lista para todos', grupo: 'General' }];
    (window.LISTAS_CLIENTE || []).forEach(function (l) {
      var n = Object.keys(l.precios || {}).length;
      ops.push({ valor: String(l.id), texto: 'Lista de ' + l.nombre, sub: n + (n === 1 ? ' saco con precio' : ' sacos con precio'), grupo: 'Por cliente' });
    });
    if (paraConsulta) (window.LISTAS_USD || []).forEach(function (c) { ops.push({ valor: 'usd:' + c.slug, texto: c.nombre, sub: 'Precios en US$ · ' + (c.incoterm || '') + ' · ' + c.filas.length + ' productos', grupo: 'Clientes en US$' }); });
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

  // ───────────────────────── Jumbos export (producto × país) ─────────────────────────
  window.JUMBOS = null; window.JUMBOS_REV = 0;
  try { var jj = JSON.parse(localStorage.getItem('JUMBOS') || 'null'); if (jj && jj.productos) { window.JUMBOS = jj; window.JUMBOS_REV = jj.rev || 0; } } catch (e) {}
  // Listas de clientes en US$ (KYM, UltraTech): solo llegan si el usuario tiene el acceso otorgado en el PFS
  window.LISTAS_USD = [];
  try { var lu = JSON.parse(localStorage.getItem('LISTAS_USD') || 'null'); if (Array.isArray(lu)) window.LISTAS_USD = lu; } catch (e) {}
  window.guardarListasUsd = function (arr) {
    window.LISTAS_USD = Array.isArray(arr) ? arr : [];
    try { localStorage.setItem('LISTAS_USD', JSON.stringify(window.LISTAS_USD)); } catch (e) {}
    var s = $('precios'); if (s && s.classList.contains('active')) renderPrecios();
  };
  window.guardarJumbos = function (j) {
    window.JUMBOS = j; window.JUMBOS_REV = j.rev || 0;
    try { localStorage.setItem('JUMBOS', JSON.stringify(j)); } catch (e) {}
    var s = $('precios'); if (s && s.classList.contains('active')) renderPrecios();
  };

  // ───────────────────────── Sección «Listas de precios» ─────────────────────────
  var ST = { lista: '', vista: 'sacos', q: '', pais: '', usdLista: '' };
  try { var g = JSON.parse(localStorage.getItem('PRECIOS_VISTA') || 'null'); if (g) { ST.lista = g.lista || ''; ST.vista = g.vista || 'sacos'; if (String(ST.lista).indexOf('usd:') === 0) ST.lista = ''; } } catch (e) {}
  function guardarVista() { try { localStorage.setItem('PRECIOS_VISTA', JSON.stringify({ lista: ST.lista, vista: ST.vista })); } catch (e) {} }
  function Q(v, d) { return v == null ? '—' : 'Q' + Number(v).toFixed(d == null ? 2 : d); }
  function listaActual() { return ST.lista ? (window.listaPorId ? listaPorId(ST.lista) : null) : null; }

  function metaSaco(s) {
    var n = String(s.nombre).toLowerCase(), m = [];
    if (s.gm && n.indexOf(s.gm + ' gm') < 0) m.push(s.gm + ' gm');
    if (s.color && n.indexOf(String(s.color).toLowerCase()) < 0) m.push(s.color);
    if (s.impresion === 'CON') m.push('con impresión'); else if (s.impresion === 'SIN') m.push('sin impresión');
    return m.join(' · ');
  }
  // Fila compacta: nombre a la izquierda y precios alineados en columnas; al tocarla se abre el detalle con «Cotizar»
  function fila(id, nombre, meta, precios, boton) {
    var n = precios.length;
    return '<div class="pr-r" id="prr' + id + '">'
      + '<button type="button" class="pr-rb c' + n + '" aria-expanded="false" onclick="prAbrir(' + id + ')">'
      + '<span class="pr-rn"><b>' + esc(nombre) + '</b>' + (meta ? '<small>' + esc(meta) + '</small>' : '') + '</span>'
      + precios.map(function (p) { return '<span class="pr-v">' + p.v + '</span>'; }).join('') + '</button>'
      + '<div class="pr-x" hidden><div class="pr-big c' + n + '">' + precios.map(function (p) { return '<div><small>' + esc(p.t) + '</small><b>' + p.v + '</b></div>'; }).join('') + '</div>'
      + boton + '</div></div>';
  }
  function cuerpoSacos(lista, q) {
    var cab = lista ? ['Base', '+10 %'] : ['A', 'B', 'C'];
    var html = '', total = 0;
    gruposSacos().forEach(function (arr, medida) {
      var filas = arr.filter(function (s) {
        if (lista) { var p = lista.precios && lista.precios[s.id]; if (!p || (p.base == null && p.mas10 == null)) return false; }
        return !q || (etiquetaSaco(s) + ' ' + s.medidas).toLowerCase().indexOf(q) >= 0;
      });
      if (!filas.length) return;
      html += '<div class="pr-grp">' + esc(medida) + '<small>' + filas.length + (filas.length === 1 ? ' saco' : ' sacos') + '</small></div><div class="pr-bloque">';
      filas.forEach(function (s) {
        total++;
        var vals = lista ? [lista.precios[s.id].base, lista.precios[s.id].mas10] : [s.pA, s.pB, s.pC];
        var precios = vals.map(function (v, k) { return { t: cab[k], v: Q(v) }; });
        html += fila(s.id, s.nombre, metaSaco(s), precios, '<button type="button" class="pr-cot" onclick="cotizarSacoDesde(' + s.id + ')">Cotizar este saco</button>');
      });
      html += '</div>';
    });
    if (!total) return '<div class="pr-vacio">' + (q ? 'No hay sacos que coincidan con “' + esc(q) + '”.' : 'Esta lista no tiene sacos con precio.') + '</div>';
    var enc = '<div class="pr-cols c' + cab.length + '"><span>' + total + (total === 1 ? ' saco' : ' sacos') + '</span>' + cab.map(function (c) { return '<span>' + esc(c) + '</span>'; }).join('') + '</div>';
    return enc + html;
  }
  function cuerpoTelas(q) {
    var arr = TELAS.filter(function (t) { return !q || (t.nombre + ' ' + (t.cat || '') + ' ' + (t.sombra || '')).toLowerCase().indexOf(q) >= 0; });
    if (!arr.length) return '<div class="pr-vacio">' + (q ? 'No hay telas que coincidan.' : 'No hay telas en la lista.') + '</div>';
    var html = '<div class="pr-cols c2"><span>' + arr.length + (arr.length === 1 ? ' tela' : ' telas') + '</span><span>Master</span><span>Confec.</span></div><div class="pr-bloque">';
    arr.forEach(function (t) {
      var meta = [t.cat, t.sombra, t.rollo ? 'rollo ' + t.rollo : ''].filter(Boolean).join(' · ');
      html += fila('t' + t.id, t.nombre, meta, [{ t: 'Rollo master', v: '$' + Number(t.pm).toFixed(3) }, { t: 'Confeccionado', v: '$' + Number(t.pc).toFixed(3) }],
        '<div class="pr-nota">Precios en dólares por pie²</div><button type="button" class="pr-cot" onclick="cotizarTelaDesde(' + t.id + ')">Cotizar esta tela</button>');
    });
    return html + '</div>';
  }
  window.prAbrir = function (id) {
    var fila = $('prr' + id); if (!fila) return;
    var abrir = fila.querySelector('.pr-x').hidden;
    document.querySelectorAll('#preciosCuerpo .pr-r').forEach(function (f) { f.classList.remove('abierta'); f.querySelector('.pr-x').hidden = true; f.querySelector('.pr-rb').setAttribute('aria-expanded', 'false'); });
    if (abrir) { fila.classList.add('abierta'); fila.querySelector('.pr-x').hidden = false; fila.querySelector('.pr-rb').setAttribute('aria-expanded', 'true'); }
  };
  function cuerpoJumbos(q) {
    var J = window.JUMBOS;
    if (!J || !J.productos || !J.productos.length) return '<div class="pr-vacio">Aún no se ha descargado la lista de Jumbos.<br>Toca el botón de actualizar (arriba a la derecha) con internet.</div>';
    var ps = J.paises, pais = ST.pais;
    var arr = J.productos.filter(function (p) { return !q || (p.nombre + ' ' + (p.detalle || '')).toLowerCase().indexOf(q) >= 0; });
    if (!arr.length) return '<div class="pr-vacio">No hay jumbos que coincidan con “' + esc(q) + '”.</div>';
    var nom = pais ? (ps.filter(function (c) { return c.k === pais; })[0] || {}).n : 'Precio';
    var html = '<div class="pr-cols c1"><span>' + arr.length + (arr.length === 1 ? ' producto' : ' productos') + '</span><span>' + esc(pais ? nom : 'Desde – hasta') + '</span></div><div class="pr-bloque">';
    arr.forEach(function (p) {
      var vals = ps.map(function (c) { return p.precios[c.k]; }).filter(function (v) { return v != null; });
      var resumen = pais ? (p.precios[pais] != null ? 'US$' + Number(p.precios[pais]).toFixed(2) : '—') : (vals.length ? (Math.min.apply(null, vals) === Math.max.apply(null, vals) ? 'US$' + Math.min.apply(null, vals).toFixed(2) : 'US$' + Math.min.apply(null, vals).toFixed(2) + ' – ' + Math.max.apply(null, vals).toFixed(2)) : '—');
      var grp = '', det = '';
      ps.forEach(function (c) {
        if (c.g !== grp) { grp = c.g; det += '<div class="pr-jg">' + esc(c.g) + '</div>'; }
        var v = p.precios[c.k];
        det += '<div class="pr-jp' + (pais === c.k ? ' sel' : '') + (v == null ? ' no' : '') + '"><span>' + esc(c.n) + '</span><b>' + (v == null ? 'No se cotiza' : 'US$' + Number(v).toFixed(2)) + '</b></div>';
      });
      html += '<div class="pr-r" id="prrj' + p.id + '"><button type="button" class="pr-rb c1" aria-expanded="false" onclick="prAbrir(\'j' + p.id + '\')"><span class="pr-rn"><b>' + esc(p.nombre) + '</b>' + (p.detalle ? '<small>' + esc(p.detalle) + '</small>' : '') + '</span><span class="pr-v">' + resumen + '</span></button>'
        + '<div class="pr-x" hidden>' + det + '</div></div>';
    });
    return html + '</div>' + (J.nota ? '<p class="pr-pie">' + esc(J.nota) + '</p>' : '');
  }
  // ── Listas de clientes en US$ (consulta) ──
  function esUsd() { return String(ST.lista).indexOf('usd:') === 0; }
  function usdActual() { var s = String(ST.lista).slice(4); return (window.LISTAS_USD || []).filter(function (c) { return c.slug === s; })[0] || null; }
  function hoyISO() { var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
  function fdUsd(iso) { return iso ? iso.split('-').reverse().join('/') : ''; }
  function vigTxt(l) { return l.hasta ? 'Vigente del ' + fdUsd(l.desde) + ' al ' + fdUsd(l.hasta) : 'Vigente desde el ' + fdUsd(l.desde); }
  // Lista que se muestra: la elegida; si no, la vigente hoy (preferir lista base sobre oferta); si no, la primera
  function usdListaSel(c) {
    var ls = c.listas || [], h = hoyISO();
    var elegida = ls.filter(function (l) { return String(l.id) === String(ST.usdLista); })[0]; if (elegida) return elegida;
    var vig = ls.filter(function (l) { return l.desde <= h && (!l.hasta || l.hasta >= h); });
    return vig.filter(function (l) { return l.tipo === 'lista'; })[0] || vig[0] || ls[0] || null;
  }
  window.elegirListaUsd = function () {
    var c = usdActual(); if (!c) return; var h = hoyISO();
    var ops = c.listas.map(function (l) {
      var vig = l.desde <= h && (!l.hasta || l.hasta >= h);
      return { valor: String(l.id), texto: l.nombre + (l.tipo === 'oferta' ? ' · oferta' : ''), sub: vigTxt(l) + (vig ? ' · vigente hoy' : l.desde > h ? ' · próxima' : ''), grupo: 'Listas' };
    });
    LGM.picker({ titulo: c.nombre, opciones: ops, valor: String((usdListaSel(c) || {}).id || ''), buscar: false, alElegir: function (v) { ST.usdLista = v; renderPrecios(); } });
  };
  function cuerpoUsd(c, q) {
    var l = usdListaSel(c);
    if (!l) return '<div class="pr-vacio">Esta lista aún no tiene precios.</div>';
    var arr = c.filas.filter(function (f) { return f.p[l.id] != null && (!q || (f.c + ' ' + f.d).toLowerCase().indexOf(q) >= 0); });
    var html = '<div class="card" style="margin-bottom:10px"><label style="margin-top:0">Lista</label>'
      + '<button type="button" class="pk-btn" aria-haspopup="dialog" onclick="elegirListaUsd()"><span class="pk-btn-v">' + esc(l.nombre) + '</span></button>'
      + '<p class="info-text" style="margin:8px 0 0"><b>' + esc(vigTxt(l)) + '</b></p></div>';
    if (!arr.length) return html + '<div class="pr-vacio">' + (q ? 'No hay productos que coincidan con “' + esc(q) + '”.' : 'Esta lista no tiene productos con precio.') + '</div>';
    html += '<div class="pr-cols c1"><span>' + arr.length + (arr.length === 1 ? ' producto' : ' productos') + '</span><span>' + esc((c.incoterm || '') + ' US$') + '</span></div><div class="pr-bloque">';
    arr.forEach(function (f, i) {
      var det = c.listas.filter(function (x) { return f.p[x.id] != null; }).map(function (x) {
        return '<div class="pr-jp' + (x.id === l.id ? ' sel' : '') + '"><span>' + esc(x.nombre) + '<small style="display:block;opacity:.7">' + esc(vigTxt(x)) + '</small></span><b>US$' + Number(f.p[x.id]).toFixed(2) + '</b></div>';
      }).join('');
      html += '<div class="pr-r" id="prru' + i + '"><button type="button" class="pr-rb c1" aria-expanded="false" onclick="prAbrir(\'u' + i + '\')"><span class="pr-rn"><b>' + esc(f.c) + '</b><small>' + esc(f.d) + '</small></span><span class="pr-v">US$' + Number(f.p[l.id]).toFixed(2) + '</span></button>'
        + '<div class="pr-x" hidden>' + det + '</div></div>';
    });
    return html + '</div>';
  }
  window.elegirPaisJumbos = function () {
    var J = window.JUMBOS; if (!J) return;
    var ops = [{ valor: '', texto: 'Todos los países', sub: 'Muestra el rango de precios', grupo: 'Ver' }]
      .concat(J.paises.map(function (c) { return { valor: c.k, texto: c.n, sub: c.g, grupo: c.g }; }));
    LGM.picker({ titulo: 'País', opciones: ops, valor: ST.pais, buscar: false, alElegir: function (v) { ST.pais = v; renderPrecios(); } });
  };
  window.renderPrecios = function () {
    var box = $('preciosCuerpo'); if (!box) return;
    var usd = esUsd() ? usdActual() : null;
    if (esUsd() && !usd) ST.lista = '';
    var lista = esUsd() ? null : listaActual();
    if (ST.lista && !lista && !usd) { ST.lista = ''; }
    var q = ST.q.toLowerCase().trim();
    $('prListaV').textContent = usd ? usd.nombre + ' (US$)' : textoLista(ST.lista ? Number(ST.lista) : null);
    $('prVistaBox').style.display = (lista || usd) ? 'none' : 'flex';
    if (usd) { $('prPaisBox').style.display = 'none'; $('prBuscar').placeholder = 'Buscar por código o descripción'; box.innerHTML = cuerpoUsd(usd, q); $('prPie').textContent = 'Precios en dólares (US$) por unidad · ' + (usd.incoterm || '') + ' · solo consulta'; return; }
    var enJumbos = ST.vista === 'jumbos' && !lista, enTelas = ST.vista === 'telas' && !lista;
    $('prSegSacos').classList.toggle('on', (ST.vista === 'sacos') || !!lista);
    $('prSegTelas').classList.toggle('on', enTelas);
    $('prSegJumbos').classList.toggle('on', enJumbos);
    $('prPaisBox').style.display = enJumbos ? '' : 'none';
    if (enJumbos) { var pj = window.JUMBOS && window.JUMBOS.paises.filter(function (c) { return c.k === ST.pais; })[0]; $('prPaisV').textContent = pj ? pj.n : 'Todos los países'; }
    $('prBuscar').placeholder = enJumbos ? 'Buscar jumbo' : enTelas ? 'Buscar tela' : 'Buscar saco (medida, color…)';
    box.innerHTML = enJumbos ? cuerpoJumbos(q) : enTelas ? cuerpoTelas(q) : cuerpoSacos(lista, q);
    var v = localStorage.getItem('PRECIOS_VERSION') || '';
    if (enJumbos) { $('prPie').textContent = window.JUMBOS ? 'Precios en dólares (US$) por unidad · lista de Jumbos export' : ''; return; }
    $('prPie').textContent = (v ? 'Precios vigentes · versión ' + v : 'Precios guardados en este teléfono') + (lista ? ' · lista de ' + lista.nombre : '');
  };
  window.elegirListaPrecios = function () {
    LGM.picker({ titulo: 'Lista de precios', opciones: opcionesListas(true), valor: ST.lista, buscar: (window.LISTAS_CLIENTE || []).length > 7,
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

  LGM.on('vista:cambio', function () { var s = $('precios'); if (s && s.classList.contains('active')) renderPrecios();  });
  LGM.on('precios:sync', function () { var s = $('precios'); if (s && s.classList.contains('active')) renderPrecios(); pkSyncLista(); });

  window.addEventListener('load', function () { montarBotonLista(); pkSyncLista(); });
})();
