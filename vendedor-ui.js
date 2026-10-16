// ── Vendedor de la cotización ────────────────────────────────────────────────────────────────────────────
// Sale impreso en la cotización. Por defecto es el del propio usuario (el servidor lo enlaza por usuario o por nombre), pero se puede
// elegir otro vendedor de la empresa (p. ej. Guisela cotiza para José o Michael). Quien no tiene vendedor propio parte del último que usó.
(function () {
  function $(id) { return document.getElementById(id); }
  var LS = 'cotVendedores', LS_ULT = 'cotVendedorUltimo';
  var datos = { vendedores: [], por_defecto: null };
  var sel = { mer: null, med: null };

  function llave(base) { try { var s = JSON.parse(localStorage.getItem('cotSesion') || 'null'); return base + ':' + ((s && s.correo) || 'anon'); } catch (e) { return base; } }
  function leerLocal() { try { var o = JSON.parse(localStorage.getItem(llave(LS)) || 'null'); if (o && Array.isArray(o.vendedores)) datos = o; } catch (e) {} }
  window.sincronizarVendedores = async function () {
    try {
      var r = await _api('/vendedores');
      if (r.ok && Array.isArray(r.data.vendedores)) { datos = r.data; try { localStorage.setItem(llave(LS), JSON.stringify(datos)); } catch (e) {} pintar('mer'); pintar('med'); }
    } catch (e) { /* sin red: se usa lo guardado */ }
  };
  function ultimo() { try { var v = parseInt(localStorage.getItem(llave(LS_ULT)), 10); return v > 0 ? v : null; } catch (e) { return null; } }
  function nombre(id) { var v = datos.vendedores.filter(function (x) { return x.id === id; })[0]; return v ? v.nombre : ''; }

  function pintar(ctx) {
    var b = $(ctx + 'VendedorBtn'); if (!b) return;
    var n = sel[ctx] ? nombre(sel[ctx]) : '';
    var t = b.querySelector('.pk-btn-v');
    t.textContent = n || 'Elige el vendedor'; t.style.color = n ? '' : '#b45309';
  }
  // Al abrir el formulario: el elegido antes (edición) o el del usuario, o el último que usó si no tiene
  window.vendedorPreparar = function (ctx, actual) {
    leerLocal();
    sel[ctx] = actual || datos.por_defecto || ultimo() || null;
    if (sel[ctx] && !nombre(sel[ctx])) sel[ctx] = datos.por_defecto || null;
    pintar(ctx);
    sincronizarVendedores().then(function () {
      if (!sel[ctx] || !nombre(sel[ctx])) { sel[ctx] = actual || datos.por_defecto || ultimo() || null; pintar(ctx); }
    });
  };
  window.vendedorElegido = function (ctx) { return sel[ctx] || null; };
  window.elegirVendedor = function (ctx) {
    if (!datos.vendedores.length) { toast('Aún no hay vendedores descargados — revisa tu conexión', 'err'); sincronizarVendedores(); return; }
    LGM.picker({
      titulo: 'Vendedor de la cotización', valor: sel[ctx] ? String(sel[ctx]) : '', buscar: datos.vendedores.length > 7,
      opciones: datos.vendedores.map(function (v) { return { valor: String(v.id), texto: v.nombre, sub: v.id === datos.por_defecto ? 'Tú' : '' }; }),
      alElegir: function (v) {
        sel[ctx] = parseInt(v, 10);
        try { localStorage.setItem(llave(LS_ULT), String(sel[ctx])); } catch (e) {}
        pintar(ctx);
      },
    });
  };
  window.addEventListener('load', leerLocal);
  LGM.on('sesion:iniciada', function () { sincronizarVendedores(); });
})();
