// ── Cotización REAL — conecta con el sistema LGM (ventas-cotizaciones) ──
// A diferencia de generarPDF() (local, muestra "Solicitado vs Cobrado" y el
// desperdicio de corte — solo para uso interno), esta función crea una
// cotización real en el ERP con líneas limpias (descripción/cantidad/precio/
// total, sin detalle de scrap) y la envía por correo usando la misma
// plantilla que el resto del sistema. El navegador nunca ve el PDF: la
// entrega es el correo.
//
// El dispositivo NO necesita Tailscale: COT_API_BASE es un relay público angosto
// (Tailscale Funnel, certificado real) que solo expone las rutas que este
// cotizador necesita (crear cotización real + buscador de NIT) — el resto
// del ERP (login, datos de otras empresas) sigue privado en el servidor real.
// La API key es pública (vive en este repo) — el servidor la limita con
// rate-limit estricto; si se filtra o se abusa, se rota desde el .env del
// servidor sin tocar este archivo.
var COT_API_BASE = 'https://mac-mini-de-jose.tail2b51ca.ts.net';
var COT_API_KEY  = 'd866cc818c2333d59cc866fb254104632015258f7f7d36f8dd3b687f1c23072b';

function _emailValido(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim()); }

// ── Sesión del vendedor (login real del ERP) ───────────────────────────────
// Reemplaza el campo "Tu correo" de texto libre: la identidad de quien cotiza
// ahora viene de sus credenciales reales del sistema, verificadas por el
// servidor (POST /login emite un token acotado — solo sirve para estas rutas,
// ver middleware/cotizadorMovilAuth.js en el backend). La sesión se cierra
// sola tras 20 min sin actividad; el token además expira solo a las 8h como
// respaldo del lado servidor.
var COT_SESSION_KEY = 'cotSesion';
var IDLE_MS = 20 * 60 * 1000;
var _idleTimer = null;

// Iconos del ojo (mostrar / ocultar contraseña) — SVG en vez de emoji.
var _EYE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
var _EYE_OFF_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.7 5.1A11 11 0 0 1 12 5c6.5 0 10 7 10 7a13.4 13.4 0 0 1-1.7 2.4M6.6 6.6A13.4 13.4 0 0 0 2 12s3.5 7 10 7a11 11 0 0 0 5.4-1.4"/><path d="M3 3l18 18M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';

function _cargarSesion(){
  try {
    var raw = localStorage.getItem(COT_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function _guardarSesion(sesion){ localStorage.setItem(COT_SESSION_KEY, JSON.stringify(sesion)); }

function _mostrarLogin(){
  document.getElementById('loginGate').classList.remove('hidden');
  document.getElementById('appShell').classList.add('hidden');
  var passEl = document.getElementById('loginPassword');
  var toggleBtn = document.getElementById('btnTogglePass');
  if (passEl) passEl.type = 'password';
  if (toggleBtn) { toggleBtn.innerHTML = _EYE_SVG; toggleBtn.setAttribute('aria-label', 'Mostrar contraseña'); }
  _mostrarLoginForm();
}

// ── Recuperar contraseña con código (dentro de la misma tarjeta de login) ──
var _recoverIdentifier = '';

function _mostrarLoginForm(){
  document.getElementById('loginStepCreds').classList.remove('hidden');
  document.getElementById('loginStepRecover1').classList.add('hidden');
  document.getElementById('loginStepRecover2').classList.add('hidden');
}
function _mostrarRecuperarPaso1(){
  document.getElementById('loginStepCreds').classList.add('hidden');
  document.getElementById('loginStepRecover1').classList.remove('hidden');
  document.getElementById('loginStepRecover2').classList.add('hidden');
}
function _mostrarRecuperarPaso2(){
  document.getElementById('loginStepCreds').classList.add('hidden');
  document.getElementById('loginStepRecover1').classList.add('hidden');
  document.getElementById('loginStepRecover2').classList.remove('hidden');
}

async function solicitarCodigoRecuperacion(){
  var userEl = document.getElementById('recoverUsername');
  var input = (userEl.value || '').trim();
  if (!input) { toast('Ingresa tu usuario o correo', 'err'); return; }
  _recoverIdentifier = input;

  var btns = [document.getElementById('btnRecoverStep1'), document.getElementById('btnReenviarCodigo')].filter(Boolean);
  btns.forEach(function(b){ b.disabled = true; });

  try {
    var r = await fetch(COT_API_BASE + '/api/ventas/cotizaciones-publicas/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': COT_API_KEY },
      body: JSON.stringify({ username: input }),
    });
    await r.json().catch(function(){ return {}; });
    toast('Si tu cuenta puede usar el cotizador, revisa tu correo — te llegará un código.');
    _mostrarRecuperarPaso2();
  } catch (e) {
    toast('Sin conexión al sistema — revisa tu conexión a internet', 'err');
  } finally {
    btns.forEach(function(b){ b.disabled = false; });
  }
}

async function restablecerConCodigo(){
  var code = (document.getElementById('recoverCode').value || '').trim();
  var pass = (document.getElementById('recoverPassword').value || '').trim();
  var pass2 = (document.getElementById('recoverPassword2').value || '').trim();
  if (!code) { toast('Ingresa el código de recuperación', 'err'); return; }
  if (!pass || pass.length < 8) { toast('La contraseña debe tener al menos 8 caracteres', 'err'); return; }
  if (pass !== pass2) { toast('Las contraseñas no coinciden', 'err'); return; }

  var btn = document.getElementById('btnRecoverStep2');
  var textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Restableciendo...';

  try {
    var r = await fetch(COT_API_BASE + '/api/ventas/cotizaciones-publicas/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': COT_API_KEY },
      body: JSON.stringify({ username: _recoverIdentifier, code: code, password: pass }),
    });
    var data = await r.json().catch(function(){ return {}; });
    if (!r.ok) {
      toast(data.error || 'No se pudo restablecer la contraseña', 'err');
      return;
    }
    toast('Contraseña actualizada — ya puedes ingresar');
    document.getElementById('recoverCode').value = '';
    document.getElementById('recoverPassword').value = '';
    document.getElementById('recoverPassword2').value = '';
    document.getElementById('recoverUsername').value = '';
    _mostrarLoginForm();
  } catch (e) {
    toast('Sin conexión al sistema — revisa tu conexión a internet', 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
}

function _toggleLoginPass(){
  var passEl = document.getElementById('loginPassword');
  var toggleBtn = document.getElementById('btnTogglePass');
  if (passEl.type === 'password') { passEl.type = 'text'; toggleBtn.innerHTML = _EYE_OFF_SVG; toggleBtn.setAttribute('aria-label', 'Ocultar contraseña'); }
  else { passEl.type = 'password'; toggleBtn.innerHTML = _EYE_SVG; toggleBtn.setAttribute('aria-label', 'Mostrar contraseña'); }
}
function _mostrarApp(sesion){
  document.getElementById('loginGate').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  var navNombre = document.getElementById('navSesionNombre');
  if (navNombre) navNombre.textContent = sesion.nombre || '';
  _reiniciarVigilanciaInactividad();
  _renderRecientes();
  _cliCargarLocal();
  sincronizarClientes(false);
  if (typeof syncPrecios === 'function') syncPrecios(false);
}

function _cerrarSesion(mensaje){
  localStorage.removeItem(COT_SESSION_KEY);
  if (_idleTimer) { clearTimeout(_idleTimer); _idleTimer = null; }
  _mostrarLogin();
  if (mensaje) toast(mensaje, 'err');
}
function cerrarSesionManual(){ _cerrarSesion(); }

function _reiniciarVigilanciaInactividad(){
  if (_idleTimer) clearTimeout(_idleTimer);
  _idleTimer = setTimeout(function(){
    _cerrarSesion('Tu sesión expiró por inactividad — inicia sesión de nuevo.');
  }, IDLE_MS);
}
['click', 'keydown', 'touchstart'].forEach(function(ev){
  document.addEventListener(ev, function(){
    if (_idleTimer) _reiniciarVigilanciaInactividad();
  }, { passive: true });
});

async function iniciarSesionCotizador(){
  var userEl = document.getElementById('loginUsername');
  var passEl = document.getElementById('loginPassword');
  var username = (userEl.value || '').trim();
  var password = (passEl.value || '').trim();
  if (!username || !password) { toast('Ingresa usuario y contraseña', 'err'); return; }

  var btn = document.getElementById('btnLogin');
  var textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Ingresando...';

  try {
    var r = await fetch(COT_API_BASE + '/api/ventas/cotizaciones-publicas/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': COT_API_KEY },
      body: JSON.stringify({ username: username, password: password }),
    });
    var data = await r.json().catch(function(){ return {}; });
    if (!r.ok) {
      toast(data.error || 'No se pudo iniciar sesión', 'err');
      return;
    }
    var sesion = { token: data.token, nombre: data.nombre, correo: data.correo };
    _guardarSesion(sesion);
    passEl.value = '';
    _mostrarApp(sesion);
  } catch (e) {
    toast('Sin conexión al sistema — revisa tu conexión a internet', 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
}

// ── Iconos SVG (trazo, sin emojis) ─────────────────────────────────────────
var _IC = {
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  print: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  sold: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  more: '<circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  warn: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h4"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  fabric: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  bulb: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2Z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
};
function _ic(name, size){
  var st = size ? ' style="width:' + size + 'px;height:' + size + 'px"' : '';
  return '<span class="ic' + (name === 'more' ? ' f' : '') + '"' + st + '><svg viewBox="0 0 24 24"' + (size ? ' width="' + size + '" height="' + size + '"' : '') + '>' + (_IC[name] || '') + '</svg></span>';
}
function _hidratarIconos(){
  document.querySelectorAll('[data-ic]').forEach(function(el){
    if (el.dataset.done) return;
    el.outerHTML = _ic(el.dataset.ic);
  });
}
document.addEventListener('DOMContentLoaded', _hidratarIconos);

// ── Utilidades ─────────────────────────────────────────────────────────────
function _esc(v){
  return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function _fmtMoneda(n, moneda){
  var v = Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return moneda === 'USD' ? '$' + v + ' USD' : 'Q' + v;
}

// Llamada autenticada al relay. Cierra la sesión sola si el servidor responde 401.
async function _api(path, opts){
  var sesion = _cargarSesion();
  if (!sesion || !sesion.token) { _mostrarLogin(); var e0 = new Error('sin sesión'); e0.handled = true; throw e0; }
  opts = opts || {};
  var headers = { 'X-Api-Key': COT_API_KEY, 'Authorization': 'Bearer ' + sesion.token };
  if (opts.body) headers['Content-Type'] = 'application/json';
  var r = await fetch(COT_API_BASE + '/api/ventas/cotizaciones-publicas' + path, {
    method: opts.method || 'GET', headers: headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  var data = await r.json().catch(function(){ return {}; });
  if (r.status === 401) {
    _cerrarSesion('Tu sesión expiró — inicia sesión de nuevo. Lo que tenías en pantalla no se perdió.');
    var e1 = new Error('401'); e1.handled = true; throw e1;
  }
  return { ok: r.ok, status: r.status, data: data };
}

// ── Memoria local: últimos clientes y últimos datos de entrega/pago usados ──
// Se guarda por vendedor (correo de la sesión) para que en un celular compartido
// no se mezclen. Es solo comodidad: si el navegador la borra, nada se rompe.
function _lsKey(base){ var s = _cargarSesion(); return base + ':' + ((s && s.correo) || 'anon'); }
function _lsGet(base, def){
  try { var v = JSON.parse(localStorage.getItem(_lsKey(base))); return v == null ? def : v; } catch (e) { return def; }
}
function _lsSet(base, val){ try { localStorage.setItem(_lsKey(base), JSON.stringify(val)); } catch (e) {} }

var _CAMPOS_TERMINOS = { forma_entrega: 'merFormaEntrega', lugar_entrega: 'merLugarEntrega', tiempo_entrega: 'merTiempoEntrega', forma_pago: 'merFormaPago' };

function _recordarCliente(c){
  if (!c || !c.nombre) return;
  var list = _lsGet('cotClientesRecientes', []).filter(function(x){ return x.nombre.toLowerCase() !== c.nombre.toLowerCase(); });
  list.unshift({ nombre: c.nombre, nit: c.nit || '', correo: c.correo || '', codigo: c.codigo || null, ts: Date.now() });
  _lsSet('cotClientesRecientes', list.slice(0, 12));
}
function _recordarTerminos(t){
  var cur = _lsGet('cotTerminos', {});
  Object.keys(_CAMPOS_TERMINOS).forEach(function(k){
    var v = String((t && t[k]) || '').trim();
    if (!v) return;
    var arr = (cur[k] || []).filter(function(x){ return x.toLowerCase() !== v.toLowerCase(); });
    arr.unshift(v);
    cur[k] = arr.slice(0, 8);
  });
  _lsSet('cotTerminos', cur);
}

// ── Cliente: recientes + búsqueda en los clientes de la empresa del vendedor ──
var _clienteSel = null;   // { codigo, nombre, nit, correo } del cliente elegido de la lista
var _sugItems = [];

function _renderRecientes(){
  var box = document.getElementById('cliRecientes');
  if (!box) return;
  var rec = _lsGet('cotClientesRecientes', []).slice(0, 5);
  box.innerHTML = rec.length
    ? rec.map(function(c, i){ return '<button type="button" class="chip" onclick="elegirReciente(' + i + ')">' + _ic('clock', 13) + ' ' + _esc(c.nombre) + '</button>'; }).join('')
    : '';
}
function elegirReciente(i){
  var c = _lsGet('cotClientesRecientes', [])[i];
  if (c) _aplicarCliente(c);
}
function _aplicarCliente(c){
  _clienteSel = { codigo: c.codigo || null, nombre: c.nombre, nit: c.nit || '', correo: c.correo || c.email || '' };
  document.getElementById('cotCliente').value = c.nombre;
  document.getElementById('cotNit').value = c.nit || 'CF';
  document.getElementById('cliSug').classList.add('hidden');
  toast('Cliente: ' + c.nombre);
}

// ── Catálogo de clientes en caché local ──────────────────────────────────────
// Se descarga completo UNA vez (y se refresca como máximo cada 12 h, o a mano) y la
// búsqueda corre en el teléfono: cero consultas por tecla. El servidor responde
// {unchanged:true} si el hash no cambió, así que refrescar casi no cuesta datos.
var CLI_TTL_MS = 12 * 3600 * 1000;
var _cliCache = null;      // { ts, hash, lista: [[codigo, nombre, nit, email], ...] }
var _cliIdx = [];          // textos normalizados, paralelos a _cliCache.lista
var _cliSyncing = false;

function _norm(t){ return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function _cliIndexar(){
  _cliIdx = _cliCache ? _cliCache.lista.map(function(c){ return _norm(c[1] + ' ' + c[2] + ' ' + c[0]); }) : [];
}
function _cliCargarLocal(){
  _cliCache = _lsGet('cotClientesCache', null);
  if (_cliCache && !Array.isArray(_cliCache.lista)) _cliCache = null;
  _cliIndexar();
}
async function sincronizarClientes(forzar){
  if (_cliSyncing) return;
  if (!_cliCache) _cliCargarLocal();
  if (!forzar && _cliCache && Date.now() - _cliCache.ts < CLI_TTL_MS) return;
  _cliSyncing = true;
  try {
    var r = await _api('/clientes/todos' + (_cliCache && _cliCache.hash ? '?hash=' + _cliCache.hash : ''));
    if (!r.ok) { if (forzar) toast(r.data.error || 'No se pudo actualizar los clientes', 'err'); return; }
    if (r.data.unchanged && _cliCache) { _cliCache.ts = Date.now(); }
    else { _cliCache = { ts: Date.now(), hash: r.data.hash, lista: r.data.clientes || [] }; _cliIndexar(); }
    _lsSet('cotClientesCache', _cliCache);
    if (forzar) toast('Clientes actualizados (' + _cliCache.lista.length + ')');
  } catch (e) {
    if (forzar && !e.handled) toast('Sin conexión — se usa la lista guardada en el teléfono', 'err');
  } finally {
    _cliSyncing = false;
    var el = document.getElementById('cotCliente');
    if (el && document.activeElement === el) buscarClientes();
  }
}
function forzarSyncClientes(ev){
  if (ev) ev.stopPropagation();
  sincronizarClientes(true);
}

function _buscarLocal(q){
  var toks = _norm(q).split(/\s+/).filter(Boolean);
  if (!toks.length || !_cliCache) return [];
  var ini = [], resto = [];
  for (var i = 0; i < _cliIdx.length && ini.length + resto.length < 120; i++) {
    var h = _cliIdx[i];
    if (toks.every(function(t){ return h.indexOf(t) >= 0; })) (h.indexOf(toks[0]) === 0 ? ini : resto).push(_cliCache.lista[i]);
  }
  return ini.concat(resto).slice(0, 40);
}
function _haceCuantoCorto(ts){
  var m = Math.floor((Date.now() - ts) / 60000);
  if (m < 2) return 'ahora'; if (m < 60) return m + ' min'; var h = Math.floor(m / 60);
  return h < 24 ? h + ' h' : Math.floor(h / 24) + ' d';
}

function _pintarSug(rec, srv){
  var box = document.getElementById('cliSug');
  var vistos = {};
  _sugItems = [];
  rec.forEach(function(c){ vistos[c.nombre.toLowerCase()] = 1; _sugItems.push({ c: c, rec: true }); });
  (srv || []).forEach(function(c){
    if (vistos[String(c[1]).toLowerCase()]) return;
    _sugItems.push({ c: { codigo: c[0] || null, nombre: c[1], nit: c[2] || '', correo: c[3] || '' }, rec: false });
  });
  var html = _sugItems.map(function(it, i){
    var c = it.c;
    return '<div class="sug-item" onclick="elegirSug(' + i + ')"><span class="sug-tag' + (it.rec ? ' rec' : '') + '">' + (it.rec ? 'Reciente' : 'Cliente') + '</span>'
      + '<strong>' + _esc(c.nombre) + '</strong><small>' + (c.nit ? 'NIT ' + _esc(c.nit) : 'Sin NIT') + (c.correo ? ' · ' + _esc(c.correo) : '') + '</small></div>';
  }).join('');
  if (_sugItems.length >= 80 && !document.getElementById('cotCliente').value.trim()) html += '<div class="sug-vacio">Mostrando los primeros 80 — escribe para filtrar el resto.</div>';
  if (!_sugItems.length) html += '<div class="sug-vacio">' + (_cliCache ? 'Sin coincidencias — se usará el nombre que escribas.' : (_cliSyncing ? 'Descargando catálogo de clientes…' : 'Catálogo aún no descargado. Toca Actualizar con internet.')) + '</div>';
  html += '<div class="cli-pie"><span>' + (_cliCache ? _cliCache.lista.length + ' clientes guardados · act. hace ' + _haceCuantoCorto(_cliCache.ts) : 'Sin catálogo local') + '</span>'
    + '<button type="button" onclick="forzarSyncClientes(event)">' + _ic('refresh', 14) + ' ' + (_cliSyncing ? 'Actualizando…' : 'Actualizar') + '</button></div>';
  box.innerHTML = html;
  box.classList.remove('hidden');
}
function elegirSug(i){ if (_sugItems[i]) _aplicarCliente(_sugItems[i].c); }

function buscarClientes(){
  var el = document.getElementById('cotCliente');
  var q = el.value.trim();
  if (_clienteSel && q !== _clienteSel.nombre) _clienteSel = null;
  if (!_cliCache) _cliCargarLocal();
  var nq = _norm(q);
  var rec = _lsGet('cotClientesRecientes', []).filter(function(x){
    return !nq || _norm(x.nombre + ' ' + x.nit).indexOf(nq) >= 0;
  }).slice(0, 4);
  // Sin texto: se despliega el catálogo completo (A-Z) para explorarlo; con texto, se filtra.
  var lista = q ? _buscarLocal(q) : (_cliCache ? _cliCache.lista.slice(0, 80) : []);
  _pintarSug(rec, lista);
}
function alternarListaClientes(ev){
  // Botón "Buscar": siempre muestra la lista (filtrada por lo escrito); tocar fuera la cierra.
  if (ev) ev.stopPropagation();
  buscarClientes();
}
document.addEventListener('click', function(ev){
  if (!ev.target.closest || ev.target.closest('#cotCliente') || ev.target.closest('#cliSug') || ev.target.closest('#btnBuscarCliente')) return;
  var box = document.getElementById('cliSug');
  if (box) box.classList.add('hidden');
});

function _esCF(v){ return /^c\s*[\/.\-]?\s*f\.?$/i.test(String(v || '').trim()); }
function _nitONormal(v){ v = String(v || '').trim(); return !v || _esCF(v) ? 'CF' : v; }

// ── Buscador de NIT (SAT/Digifact) — igual al del sistema web ──
async function consultarNit(){
  var nitEl = document.getElementById('cotNit');
  var nit = (nitEl.value || '').trim();
  // Sin NIT (o ya "CF"): consumidor final. No se consulta a la SAT y se conserva el nombre tecleado.
  if (!nit || _esCF(nit)) {
    nitEl.value = 'CF';
    toast(document.getElementById('cotCliente').value.trim() ? 'Consumidor final (CF) — se conserva el nombre' : 'Consumidor final (CF) — escribe el nombre del cliente');
    if (!document.getElementById('cotCliente').value.trim()) document.getElementById('cotCliente').focus();
    return;
  }

  var btn = document.getElementById('btnConsultarNit');
  var textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Buscando...';

  try {
    var r = await fetch(COT_API_BASE + '/api/util/nit/' + encodeURIComponent(nit), {
      headers: { 'X-Api-Key': COT_API_KEY },
    });
    var data = await r.json().catch(function(){ return {}; });
    if (!r.ok) {
      toast(r.status === 404 ? 'NIT no encontrado en el registro de la SAT' : (data.error || 'No se pudo consultar el NIT'), 'err');
      return;
    }
    document.getElementById('cotCliente').value = data.nombre || '';
    _clienteSel = null;
    toast('NIT encontrado: ' + data.nombre);
  } catch (e) {
    toast('Sin conexión al sistema — revisa tu conexión a internet', 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
}

function _construirItemsCotizacionReal(){
  var hasSaco = CARRITO.some(function(i){ return i.tipo === 'saco'; });
  var telas = CARRITO.filter(function(i){ return i.tipo === 'tela'; });
  var telasSinTC = telas.filter(function(i){ return !i.tc; });
  var telasConTC = telas.filter(function(i){ return !!i.tc; });

  var moneda;
  if (hasSaco) {
    if (telasSinTC.length > 0) {
      return { error: 'Ingresa el Tipo de Cambio (TC) en estos ítems de tela para poder cotizar junto con los sacos (todo debe quedar en Quetzales): '
        + telasSinTC.map(function(i){ return i.nombre; }).join(', ') };
    }
    moneda = 'GTQ';
  } else if (telas.length > 0) {
    if (telasSinTC.length > 0 && telasConTC.length > 0) {
      return { error: 'Todos los ítems de tela deben usar la misma moneda: ingresa el Tipo de Cambio en todos, o en ninguno.' };
    }
    moneda = telasSinTC.length > 0 ? 'USD' : 'GTQ';
  } else {
    return { error: 'El presupuesto está vacío.' };
  }

  var items = CARRITO.map(function(item){
    if (item.tipo === 'tela') {
      // Medida SOLICITADA (la que el vendedor tecleó), no la redondeada a múltiplo de
      // 6ft que se usa internamente para calcular precio — eso es lo que no debe ver
      // el cliente; la medida pedida sí, porque es literalmente lo que va a recibir.
      var anchoLabel = item.ua === 'm' ? item.aSolM.toFixed(2) + 'm' : item.aSolFt.toFixed(1) + 'ft';
      var largoLabel = item.ul === 'm' ? item.lM.toFixed(2) + 'm' : item.lFt.toFixed(1) + 'ft';
      var medida = anchoLabel + ' x ' + largoLabel;
      var modoLabel = item.modo === 'master' ? 'Master' : 'Confeccionado';
      var precioSqft = moneda === 'GTQ' ? (item.p * item.tc) : item.p;

      if (item.modo === 'master') {
        // Rollo Master: material crudo, se vende por área continua.
        return {
          descripcion: item.nombre + ' — ' + medida + ' — ' + modoLabel,
          unidad: 'pie²',
          cantidad: item.ar,
          precio_unitario: precioSqft,
        };
      }
      // Confeccionado: pieza terminada (con ojetes/rebete) — se cotiza por unidad,
      // no por área; el precio unitario es el total de UNA pieza de esa medida.
      return {
        descripcion: item.nombre + ' — ' + medida + ' — ' + modoLabel,
        unidad: 'UNIDAD',
        cantidad: item.cant,
        precio_unitario: item.arCorte * precioSqft,
      };
    }
    return {
      descripcion: item.nombre + (item.medidas ? ' (' + item.medidas + ')' : ''),
      unidad: 'UNIDAD',
      cantidad: item.cantidad,
      precio_unitario: item.precioUnit,
    };
  });

  var total = items.reduce(function(s, it){ return s + it.cantidad * it.precio_unitario; }, 0);
  return { moneda: moneda, items: items, total: total };
}

// ── Modal de datos para la cotización real (correo, entrega, pago) — se abre
// solo al hacer click en "Generar cotización real", no queda fijo en pantalla ──
var _ignorarPendiente = false, _ignorarViejos = false;
var _HORAS_VIEJO = 12;

// Cálculos que el vendedor tecleó pero NO agregó al presupuesto. Es el caso que causó
// que se enviara otra cotización: lo que se manda es el presupuesto, no la calculadora.
function _calculosPendientes(){
  var out = [];
  var rt = document.getElementById('cotResTela');
  var selT = document.getElementById('cotTelaSelect');
  if (selT && selT.value && rt && rt.classList.contains('show') && _firmaTela() !== _ultimaFirmaTela) {
    var cortes = Number(_vv('cotCantTela')) > 1 ? ' (' + _vv('cotCantTela') + ' cortes)' : '';
    out.push({ tipo: 'tela', desc: selT.options[selT.selectedIndex].text + ' — ' + _vv('cotAncho') + ' ' + _vv('cotUAncho') + ' × ' + _vv('cotLargo') + ' ' + _vv('cotULargo') + cortes });
  }
  var rs = document.getElementById('cotResSaco');
  var selS = document.getElementById('cotSacoSelect');
  if (selS && selS.value && rs && rs.classList.contains('show') && _firmaSaco() !== _ultimaFirmaSaco) {
    out.push({ tipo: 'saco', desc: selS.options[selS.selectedIndex].text + ' × ' + _vv('cotCantSaco') });
  }
  return out;
}

function _edadItemMs(item){
  var t = item.addedAt || Math.floor(item.uid || 0);
  return t ? Date.now() - t : 0;
}
function _haceCuanto(ms){
  var h = Math.floor(ms / 3600000);
  if (h < 1) return 'hace ' + Math.max(1, Math.floor(ms / 60000)) + ' min';
  if (h < 24) return 'hace ' + h + ' h';
  var d = Math.floor(h / 24);
  return 'hace ' + d + (d === 1 ? ' día' : ' días');
}

// Estado de las guardias previas al envío (compartido por el resumen y el botón).
function _estadoEnvio(){
  var armado = _construirItemsCotizacionReal();
  var pend = _ignorarPendiente ? [] : _calculosPendientes();
  var viejos = _ignorarViejos ? [] : CARRITO.filter(function(i){ return _edadItemMs(i) > _HORAS_VIEJO * 3600000; });
  return { armado: armado, pend: pend, viejos: viejos, bloqueo: !!(armado.error || pend.length || viejos.length) };
}

function _renderResumenEnvio(){
  var box = document.getElementById('merResumen');
  var btn = document.getElementById('btnCotReal');
  if (!box) return;
  var est = _estadoEnvio();
  var cliente = document.getElementById('cotCliente').value.trim();
  var nit = document.getElementById('cotNit').value.trim();
  var html = '<h4>Revisa antes de enviar</h4>'
    + '<div style="font-size:13px;margin-bottom:6px"><strong>Cliente:</strong> ' + _esc(cliente) + (nit ? ' · NIT ' + _esc(nit) : '') + '</div>';

  est.pend.forEach(function(p){
    html += '<div class="res-warn"><strong>' + _ic('warn') + ' Tienes un cálculo SIN agregar al presupuesto:</strong><br>' + _esc(p.desc)
      + '<br>Lo que se enviará es solo lo que aparece en esta lista.'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="btn btn-success btn-sm" onclick="_resolverPendiente(\'' + p.tipo + '\')">' + _ic('plus') + ' Agregarlo al presupuesto</button>'
      + '<button type="button" class="btn btn-ghost btn-sm" onclick="_ignorarPendiente=true;_renderResumenEnvio()">Enviar sin ese cálculo</button></div></div>';
  });
  if (est.viejos.length) {
    html += '<div class="res-warn"><strong>' + _ic('warn') + ' ' + est.viejos.length + (est.viejos.length === 1 ? ' ítem lleva' : ' ítems llevan') + ' más de ' + _HORAS_VIEJO + ' h en el presupuesto.</strong><br>'
      + 'Pueden ser de una cotización anterior. Confírmalo antes de enviar.'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="btn btn-ghost btn-sm" onclick="_ignorarViejos=true;_renderResumenEnvio()">Sí, son de esta cotización</button>'
      + '<button type="button" class="btn btn-danger btn-sm" onclick="_quitarViejos()">Quitar los viejos</button></div></div>';
  }
  if (est.armado.error) {
    html += '<div class="res-warn err"><strong>No se puede enviar todavía:</strong><br>' + _esc(est.armado.error) + '</div>';
  } else {
    est.armado.items.forEach(function(it, idx){
      var ci = CARRITO[idx];
      var edad = ci ? _edadItemMs(ci) : 0;
      var viejo = edad > _HORAS_VIEJO * 3600000;
      html += '<div class="res-row"><div class="rd">' + _esc(it.descripcion)
        + '<small>' + Number(it.cantidad).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + _esc(it.unidad) + ' × ' + _fmtMoneda(it.precio_unitario, est.armado.moneda)
        + (viejo ? ' · <span class="stale">agregado ' + _haceCuanto(edad) + '</span>' : '') + '</small></div>'
        + '<div class="rt">' + _fmtMoneda(it.cantidad * it.precio_unitario, est.armado.moneda) + '</div>'
        + (ci ? '<button type="button" class="btn btn-danger btn-sm" style="align-self:center" onclick="_quitarDesdeResumen(' + ci.uid + ')" aria-label="Quitar">' + _ic('x') + '</button>' : '') + '</div>';
    });
    html += '<div class="res-total"><span>TOTAL ' + (!document.getElementById('cotDesglosarIVA').checked ? '(IVA incluido)' : '(sin IVA)') + '</span><span>' + _fmtMoneda(est.armado.total, est.armado.moneda) + '</span></div>';
  }
  box.innerHTML = html;
  if (btn) {
    btn.disabled = est.bloqueo;
    btn.textContent = est.bloqueo ? 'Resuelve los avisos de arriba' : 'Enviar ' + _fmtMoneda(est.armado.total, est.armado.moneda) + ' a ' + (cliente.length > 24 ? cliente.slice(0, 22) + '…' : cliente);
  }
}
function _resolverPendiente(tipo){
  if (tipo === 'tela') agregarTela(); else agregarSaco();
  _renderResumenEnvio();
}
function _quitarViejos(){
  CARRITO = CARRITO.filter(function(i){ return _edadItemMs(i) <= _HORAS_VIEJO * 3600000; });
  saveCarrito(); renderCarrito();
  if (!CARRITO.length) { cerrarModalEnviarReal(); toast('El presupuesto quedó vacío', 'err'); return; }
  _renderResumenEnvio();
}
function _quitarDesdeResumen(uid){
  quitarItem(uid);
  if (!CARRITO.length) { cerrarModalEnviarReal(); toast('El presupuesto quedó vacío', 'err'); return; }
  _renderResumenEnvio();
}

// Precarga lo último usado: datos de entrega/pago (con sugerencias) y el correo del cliente elegido.
function _prellenarModalEnvio(){
  var cur = _lsGet('cotTerminos', {});
  Object.keys(_CAMPOS_TERMINOS).forEach(function(k){
    var id = _CAMPOS_TERMINOS[k];
    var dl = document.getElementById('dl_' + id);
    if (dl) dl.innerHTML = (cur[k] || []).map(function(v){ return '<option value="' + _esc(v) + '">'; }).join('');
    var el = document.getElementById(id);
    if (el && !el.value.trim() && cur[k] && cur[k][0]) el.value = cur[k][0];
  });
  var cliente = document.getElementById('cotCliente').value.trim();
  var correoEl = document.getElementById('merClienteCorreo');
  if (correoEl.dataset.cliente !== cliente) {
    var conocido = (_clienteSel && _clienteSel.nombre === cliente) ? _clienteSel
      : _lsGet('cotClientesRecientes', []).filter(function(x){ return x.nombre.toLowerCase() === cliente.toLowerCase(); })[0];
    correoEl.value = (conocido && conocido.correo) || '';
    correoEl.dataset.cliente = cliente;
  }
}

function abrirModalEnviarReal(){
  if (!CARRITO.length) { toast('El presupuesto está vacío', 'err'); return; }
  var sesion = _cargarSesion();
  if (!sesion || !sesion.token) {
    toast('Inicia sesión para generar la cotización real', 'err');
    _mostrarLogin();
    return;
  }
  var clienteEl = document.getElementById('cotCliente');
  if (!clienteEl.value.trim()) {
    toast('Ingresa el nombre del cliente — no podemos cotizarle a nadie', 'err');
    clienteEl.focus();
    return;
  }
  var display = document.getElementById('merVendedorCorreoDisplay');
  if (display) display.textContent = sesion.correo || '(sin correo configurado)';
  _ignorarPendiente = false; _ignorarViejos = false;
  _prellenarModalEnvio();
  _renderResumenEnvio();
  document.getElementById('modalEnviarReal').classList.remove('hidden');
}
function cerrarModalEnviarReal(){ document.getElementById('modalEnviarReal').classList.add('hidden'); }

// ── Confirmación persistente (no desaparece sola como el toast) ──
function cerrarModalCotReal(){ document.getElementById('modalCotReal').classList.add('hidden'); }

function _mostrarConfirmacionCotReal(estado, info){
  var titleEl = document.getElementById('mcrTitle');
  var bodyEl  = document.getElementById('mcrBody');

  if (estado === 'ok'){
    titleEl.textContent = info.titulo || 'Cotización enviada';
    bodyEl.innerHTML =
        '<p><strong>Folio:</strong> ' + info.no_cotizacion + '</p>'
      + '<p><strong>Enviada a:</strong> ' + info.vendedorCorreo + '</p>'
      + (info.clienteCorreo ? '<p><strong>Copia a:</strong> ' + info.clienteCorreo + '</p>' : '')
      + '<p style="margin-top:10px;padding:10px;background:#f0f9f5;border-radius:6px;color:#1a6b45;font-weight:700;">Revisa tu correo — debería llegar en segundos. Queda en Historial › Mis cotizaciones, donde puedes editarla o reenviarla.</p>';
  } else if (estado === 'creada_sin_correo'){
    titleEl.textContent = 'Cotización guardada, correo falló';
    bodyEl.innerHTML =
        '<p><strong>Folio:</strong> ' + info.no_cotizacion + ' (ya quedó guardada en el sistema)</p>'
      + '<p style="margin-top:8px;padding:10px;background:#fef9ec;border-radius:6px;color:#92400e;">' + (info.aviso || 'No se pudo enviar el correo automáticamente. Avisa a soporte con este folio para que te la reenvíen.') + '</p>';
  } else {
    titleEl.textContent = 'No se generó la cotización';
    bodyEl.innerHTML = '<p style="color:#d32f2f">' + (info.error || 'Error desconocido') + '</p>'
      + '<p style="margin-top:8px;font-size:12px;color:#888;">El presupuesto no se perdió — corrige e intenta de nuevo.</p>';
  }
  document.getElementById('modalCotReal').classList.remove('hidden');
}

async function generarCotizacionReal(){
  if (!CARRITO.length) { toast('El presupuesto está vacío', 'err'); return; }

  var sesion = _cargarSesion();
  if (!sesion || !sesion.token) {
    cerrarModalEnviarReal();
    toast('Inicia sesión para generar la cotización real', 'err');
    _mostrarLogin();
    return;
  }
  var vendedorCorreo = sesion.correo || '';

  var clienteCorreoEl = document.getElementById('merClienteCorreo');
  var clienteCorreo = (clienteCorreoEl.value || '').trim();
  if (clienteCorreo && !_emailValido(clienteCorreo)) {
    toast('El correo del cliente no es válido', 'err');
    clienteCorreoEl.focus();
    return;
  }

  var formaEntrega  = document.getElementById('merFormaEntrega').value.trim();
  var lugarEntrega  = document.getElementById('merLugarEntrega').value.trim();
  var tiempoEntrega = document.getElementById('merTiempoEntrega').value.trim();
  var formaPago     = document.getElementById('merFormaPago').value.trim();
  var comentarios   = document.getElementById('merComentarios').value.trim();
  var entregaCampos = [
    ['merFormaEntrega', formaEntrega, 'la forma de entrega'],
    ['merLugarEntrega', lugarEntrega, 'el lugar de entrega'],
    ['merTiempoEntrega', tiempoEntrega, 'el tiempo de entrega'],
    ['merFormaPago', formaPago, 'la forma de pago'],
  ];
  for (var fi = 0; fi < entregaCampos.length; fi++) {
    if (!entregaCampos[fi][1]) {
      toast('Completa ' + entregaCampos[fi][2] + ' — lo necesita la cotización real', 'err');
      document.getElementById(entregaCampos[fi][0]).focus();
      return;
    }
  }

  var cliente = document.getElementById('cotCliente').value.trim();
  if (!cliente) {
    toast('Ingresa el nombre del cliente — no podemos cotizarle a nadie', 'err');
    document.getElementById('cotCliente').focus();
    return;
  }

  var est = _estadoEnvio();
  if (est.bloqueo) { _renderResumenEnvio(); toast('Revisa los avisos del resumen antes de enviar', 'err'); return; }
  var armado = est.armado;

  var clienteNit = _nitONormal(document.getElementById('cotNit').value);
  document.getElementById('cotNit').value = clienteNit;
  var btn = document.getElementById('btnCotReal');
  var textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Generando...';

  var conIva = !document.getElementById('cotDesglosarIVA').checked;
  var payload = {
    cliente: cliente,
    cliente_nit: clienteNit,
    cod_cliente: (_clienteSel && _clienteSel.nombre === cliente && _clienteSel.codigo) || undefined,
    cliente_correo: clienteCorreo,
    moneda: armado.moneda,
    con_iva: conIva,
    items: armado.items,
    forma_entrega: formaEntrega,
    lugar_entrega: lugarEntrega,
    tiempo_entrega: tiempoEntrega,
    forma_pago: formaPago,
    comentarios_adicionales: comentarios,
  };

  try {
    var r = await fetch(COT_API_BASE + '/api/ventas/cotizaciones-publicas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': COT_API_KEY,
        'Authorization': 'Bearer ' + sesion.token,
      },
      body: JSON.stringify(payload),
    });
    var data = await r.json().catch(function(){ return {}; });
    if (r.status === 401) {
      cerrarModalEnviarReal();
      _cerrarSesion('Tu sesión expiró — inicia sesión de nuevo. El presupuesto no se perdió.');
      return;
    }
    if (!r.ok || !data.ok) {
      cerrarModalEnviarReal();
      _mostrarConfirmacionCotReal('error', { error: data.error || 'No se pudo generar la cotización real' });
      return;
    }

    // La cotización YA quedó guardada en el sistema en este punto (con o sin correo) —
    // se limpia el carrito para no volver a mandarla
    // por error con un segundo click (crearía un folio duplicado).
    _recordarCliente({ nombre: cliente, nit: clienteNit, correo: clienteCorreo, codigo: payload.cod_cliente });
    _recordarTerminos({ forma_entrega: formaEntrega, lugar_entrega: lugarEntrega, tiempo_entrega: tiempoEntrega, forma_pago: formaPago });
    _renderRecientes();
    _misCot = null;
    CARRITO = [];
    saveCarrito();
    renderCarrito();
    cerrarModalEnviarReal();

    if (data.email_enviado === false) {
      _mostrarConfirmacionCotReal('creada_sin_correo', { no_cotizacion: data.no_cotizacion, aviso: data.aviso });
    } else {
      _mostrarConfirmacionCotReal('ok', { no_cotizacion: data.no_cotizacion, vendedorCorreo: vendedorCorreo, clienteCorreo: clienteCorreo });
    }
  } catch (e) {
    cerrarModalEnviarReal();
    _mostrarConfirmacionCotReal('error', { error: 'Sin conexión al sistema — revisa tu conexión a internet e intenta de nuevo.' });
  } finally {
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
}

// ── Historial: mis cotizaciones en el sistema (consultar, editar, reenviar) + borradores locales ──
var _misCot = null;
var _ESTATUS_PILL = { BORRADOR: ['Borrador', 'borr'], ENVIADA: ['Enviada', 'ok'], APROBADA: ['Aprobada', 'ok'], CONVERTIDA: ['Convertida a pedido', 'conv'] };

function _fechaCorta(v){
  try { return new Date(v).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return ''; }
}

async function cargarMisCotizaciones(force){
  var el = document.getElementById('misCotList');
  if (!force && _misCot) { renderMisCotizaciones(); return; }
  el.innerHTML = '<p class="muted">Cargando…</p>';
  try {
    var r = await _api('/mis');
    if (!r.ok) { el.innerHTML = '<p class="muted">' + _esc(r.data.error || 'No se pudieron cargar tus cotizaciones') + '</p>'; return; }
    _misCot = r.data;
    renderMisCotizaciones();
  } catch (e) {
    if (!e.handled) el.innerHTML = '<p class="muted">Sin conexión al sistema — revisa tu internet y toca Actualizar.</p>';
  }
}

function renderMisCotizaciones(){
  var el = document.getElementById('misCotList');
  if (!_misCot) return;
  var f = (document.getElementById('misCotFiltro').value || '').trim().toLowerCase();
  var lista = _misCot.filter(function(c){ return !f || (c.no_cotizacion + ' ' + c.cliente + ' ' + (c.cliente_nit || '')).toLowerCase().indexOf(f) >= 0; });
  if (!lista.length) { el.innerHTML = '<p class="muted">' + (_misCot.length ? 'Sin resultados.' : 'Aún no has generado cotizaciones.') + '</p>'; return; }
  el.innerHTML = lista.map(function(c){
    var pill = _ESTATUS_PILL[String(c.estatus || '').toUpperCase()] || [c.estatus, ''];
    var editada = new Date(c.updated_at) - new Date(c.created_at) > 60000;
    return '<div class="item-card" style="flex-wrap:wrap">'
      + '<div class="item-info"><strong>' + _esc(c.no_cotizacion) + ' — ' + _esc(c.cliente) + '</strong>'
      + '<small>' + _fechaCorta(c.created_at) + ' · ' + c.total_items + ' ítem(s)' + (editada ? ' · editada ' + _fechaCorta(c.updated_at) : '') + '</small>'
      + '<div style="margin-top:4px"><span class="pill ' + pill[1] + '">' + _esc(pill[0]) + '</span>' + (c.vendida ? ' <span class="pill ok">Vendida</span>' : '') + '</div></div>'
      + '<div style="text-align:right"><strong style="color:#1a6b45;font-size:15px">' + _fmtMoneda(c.total, c.moneda) + '</strong></div>'
      + '<div style="width:100%;display:flex;gap:6px;justify-content:flex-end">'
      + '<button class="btn btn-warning btn-sm" onclick="abrirEditar(' + c.id + ')">' + _ic(c.editable ? 'edit' : 'eye') + ' ' + (c.editable ? 'Editar' : 'Ver') + '</button>'
      + '<button class="kebab-m" onclick="abrirAcciones(' + c.id + ')" aria-label="Más acciones">' + _ic('more') + '</button></div></div>';
  }).join('');
}

// ── Menú ⋮ (mismas acciones que el kebab de Cotizaciones en el ERP) ──
function _cotLocal(id){ return (_misCot || []).filter(function(x){ return x.id === id; })[0]; }
function abrirAcciones(id){
  var c = _cotLocal(id);
  if (!c) return;
  var it = function(ic, txt, fn, cls){ return '<button class="act-item' + (cls ? ' ' + cls : '') + '" onclick="cerrarAcciones();' + fn + '">' + _ic(ic) + '<span>' + txt + '</span></button>'; };
  var h = it(c.editable ? 'edit' : 'eye', c.editable ? 'Editar' : 'Ver', 'abrirEditar(' + id + ')')
    + it('print', 'Imprimir', "accionPdf(" + id + ",'imprimir')")
    + it('download', 'Descargar PDF', "accionPdf(" + id + ",'descargar')")
    + it('mail', 'Enviar por correo', 'abrirReenviar(' + id + ')');
  if (c.puede_clonar) h += it('copy', 'Clonar', 'clonarCot(' + id + ')');
  if (c.puede_editar_estado || c.puede_eliminar) h += '<div class="act-sep"></div>';
  if (c.puede_editar_estado) h += it('sold', c.vendida ? 'Desmarcar vendida' : 'Marcar como vendida', 'marcarVendida(' + id + ')');
  if (c.puede_eliminar) h += it('trash', 'Eliminar', 'eliminarCotizacion(' + id + ')', 'danger');
  document.getElementById('accTitle').textContent = c.no_cotizacion + ' — ' + c.cliente;
  document.getElementById('accList').innerHTML = h;
  document.getElementById('modalAcciones').classList.remove('hidden');
}
function cerrarAcciones(){ document.getElementById('modalAcciones').classList.add('hidden'); }

async function accionPdf(id, modo){
  // En iOS una pestaña abierta después de un await la bloquea el navegador: se abre antes.
  var w = modo === 'imprimir' ? window.open('', '_blank') : null;
  toast('Generando PDF…');
  try {
    var sesion = _cargarSesion();
    if (!sesion || !sesion.token) { if (w) w.close(); _mostrarLogin(); return; }
    var r = await fetch(COT_API_BASE + '/api/ventas/cotizaciones-publicas/mis/' + id + '/pdf', {
      headers: { 'X-Api-Key': COT_API_KEY, 'Authorization': 'Bearer ' + sesion.token },
    });
    if (r.status === 401) { if (w) w.close(); _cerrarSesion('Tu sesión expiró — inicia sesión de nuevo.'); return; }
    if (!r.ok) { if (w) w.close(); var d = await r.json().catch(function(){ return {}; }); toast(d.error || 'No se pudo generar el PDF', 'err'); return; }
    var blob = await r.blob();
    var url = URL.createObjectURL(blob);
    if (modo === 'imprimir') { if (w) w.location.href = url; else window.open(url, '_blank'); }
    else {
      var a = document.createElement('a');
      a.href = url; a.download = r.headers.get('X-Filename') || ('cotizacion-' + id + '.pdf');
      document.body.appendChild(a); a.click(); a.remove();
    }
    setTimeout(function(){ URL.revokeObjectURL(url); }, 120000);
  } catch (e) {
    if (w) w.close();
    toast('Sin conexión al sistema — revisa tu internet', 'err');
  }
}

async function clonarCot(id){
  var c = _cotLocal(id);
  if (!c || !confirm('¿Clonar ' + c.no_cotizacion + '? Se crea un nuevo borrador con otro folio para que lo edites.')) return;
  try {
    var r = await _api('/mis/' + id + '/clonar', { method: 'POST' });
    if (!r.ok) { toast(r.data.error || 'No se pudo clonar', 'err'); return; }
    toast('Clonada como ' + r.data.no_cotizacion);
    await cargarMisCotizaciones(true);
    abrirEditar(r.data.id);
  } catch (e) { if (!e.handled) toast('Sin conexión al sistema — revisa tu internet', 'err'); }
}
async function marcarVendida(id){
  var c = _cotLocal(id);
  if (!c) return;
  try {
    var r = await _api('/mis/' + id + '/vendida', { method: 'POST', body: { vendida: !c.vendida } });
    if (!r.ok) { toast(r.data.error || 'No se pudo actualizar', 'err'); return; }
    c.vendida = r.data.vendida;
    renderMisCotizaciones();
    toast(c.vendida ? 'Marcada como vendida' : 'Marca de vendida quitada');
  } catch (e) { if (!e.handled) toast('Sin conexión al sistema — revisa tu internet', 'err'); }
}
async function eliminarCotizacion(id){
  var c = _cotLocal(id);
  if (!c || !confirm('¿Eliminar ' + c.no_cotizacion + ' de ' + c.cliente + '? No se puede deshacer.')) return;
  try {
    var r = await _api('/mis/' + id + '/eliminar', { method: 'POST' });
    if (!r.ok) { toast(r.data.error || 'No se pudo eliminar', 'err'); return; }
    _misCot = _misCot.filter(function(x){ return x.id !== id; });
    renderMisCotizaciones();
    toast('Cotización eliminada');
  } catch (e) { if (!e.handled) toast('Sin conexión al sistema — revisa tu internet', 'err'); }
}

// ── Editor de una cotización existente ──
var _edit = null;

async function abrirEditar(id){
  toast('Cargando cotización…');
  try {
    var r = await _api('/mis/' + id);
    if (!r.ok) { toast(r.data.error || 'No se pudo abrir la cotización', 'err'); return; }
    var q = r.data;
    _edit = { id: q.id, no: q.no_cotizacion, estatus: q.estatus, editable: q.editable, moneda: q.moneda, base: q.updated_at, codCliente: q.cod_cliente || null, items: q.items };
    var ro = !q.editable;
    document.getElementById('medTitle').textContent = (ro ? 'Ver ' : 'Editar ') + q.no_cotizacion;
    var est = String(q.estatus || '').toUpperCase();
    document.getElementById('medAviso').innerHTML = ro
      ? '<div class="res-warn"><strong>Solo lectura.</strong> Esta cotización está ' + _esc(est.toLowerCase()) + (q.fel_numero ? ' y facturada' : '') + ', así que ya no puede cambiar de monto. Puedes verla, descargarla y reenviarla.</div>'
      : '<div class="res-warn" style="border-color:#1a6b45"><strong style="color:#1a6b45">Editando el folio ' + _esc(q.no_cotizacion) + '.</strong> Al guardar se actualiza esta misma cotización (no se crea otra).'
        + ((est === 'APROBADA' || est === 'PENDIENTE') ? '<br><strong>Estaba ' + _esc(est.toLowerCase()) + ':</strong> volverá a borrador y requerirá autorización de nuevo.' : '') + '</div>';
    document.getElementById('medCliente').value = q.cliente || '';
    document.getElementById('medNit').value = q.cliente_nit || '';
    document.getElementById('medClienteCorreo').value = q.cliente_correo || '';
    document.getElementById('medConIva').checked = q.con_iva !== false;
    document.getElementById('medFormaEntrega').value = q.forma_entrega || '';
    document.getElementById('medLugarEntrega').value = q.lugar_entrega || '';
    document.getElementById('medTiempoEntrega').value = q.tiempo_entrega || '';
    document.getElementById('medFormaPago').value = q.forma_pago || '';
    document.getElementById('medComentarios').value = q.comentarios_adicionales || '';
    ['medCliente', 'medNit', 'medClienteCorreo', 'medConIva', 'medFormaEntrega', 'medLugarEntrega', 'medTiempoEntrega', 'medFormaPago', 'medComentarios']
      .forEach(function(i){ document.getElementById(i).disabled = ro; });
    document.getElementById('medAddLinea').classList.toggle('hidden', ro);
    document.getElementById('btnMedGuardarEnviar').classList.toggle('hidden', ro);
    document.getElementById('btnMedGuardar').classList.toggle('hidden', ro);
    document.getElementById('btnMedReenviar').classList.toggle('hidden', !ro);
    medRender();
    document.getElementById('modalEditar').classList.remove('hidden');
  } catch (e) {
    if (!e.handled) toast('Sin conexión al sistema — revisa tu internet', 'err');
  }
}
function cerrarModalEditar(){ document.getElementById('modalEditar').classList.add('hidden'); _edit = null; }

function medRender(){
  var ro = !_edit.editable, dis = ro ? 'disabled' : '';
  document.getElementById('medItems').innerHTML = _edit.items.map(function(it, i){
    return '<div class="med-line"><textarea rows="2" placeholder="Descripción" ' + dis + ' oninput="medSet(' + i + ',\'descripcion\',this.value)">' + _esc(it.descripcion) + '</textarea>'
      + '<div class="med-grid"><div><label>Cantidad (' + _esc(it.unidad || 'UNIDAD') + ')</label><input type="number" inputmode="decimal" step="any" min="0" value="' + it.cantidad + '" ' + dis + ' oninput="medSet(' + i + ',\'cantidad\',this.value)"></div>'
      + '<div><label>Precio unitario</label><input type="number" inputmode="decimal" step="any" min="0" value="' + it.precio_unitario + '" ' + dis + ' oninput="medSet(' + i + ',\'precio_unitario\',this.value)"></div></div>'
      + '<div class="med-foot"><span class="med-lt" id="medLT' + i + '">' + _fmtMoneda(it.cantidad * it.precio_unitario, _edit.moneda) + '</span>'
      + (ro ? '' : '<button type="button" class="btn btn-danger btn-sm" onclick="medQuitar(' + i + ')">' + _ic('x') + ' Quitar línea</button>') + '</div></div>';
  }).join('');
  medRecalcular();
}
function medSet(i, k, v){
  _edit.items[i][k] = k === 'descripcion' ? v : (parseFloat(v) || 0);
  var lt = document.getElementById('medLT' + i);
  if (lt) lt.textContent = _fmtMoneda(_edit.items[i].cantidad * _edit.items[i].precio_unitario, _edit.moneda);
  medRecalcular();
}
function medQuitar(i){
  if (_edit.items.length <= 1) { toast('La cotización necesita al menos un ítem', 'err'); return; }
  _edit.items.splice(i, 1);
  medRender();
}
function medAgregarLinea(){
  _edit.items.push({ descripcion: '', unidad: 'UNIDAD', cantidad: 1, precio_unitario: 0 });
  medRender();
}
function medRecalcular(){
  if (!_edit) return;
  var t = _edit.items.reduce(function(a, it){ return a + (it.cantidad || 0) * (it.precio_unitario || 0); }, 0);
  document.getElementById('medTotal').textContent = _fmtMoneda(t, _edit.moneda) + (document.getElementById('medConIva').checked ? ' (IVA incluido)' : ' (sin IVA)');
}

async function guardarEdicion(reenviar){
  if (!_edit || !_edit.editable) return;
  var cliente = document.getElementById('medCliente').value.trim();
  var correo = document.getElementById('medClienteCorreo').value.trim();
  if (!cliente) { toast('Ingresa el nombre del cliente', 'err'); return; }
  if (correo && !_emailValido(correo)) { toast('El correo del cliente no es válido', 'err'); return; }
  var items = _edit.items.filter(function(it){ return String(it.descripcion).trim() && it.cantidad > 0; });
  if (!items.length) { toast('Agrega al menos un ítem con descripción y cantidad', 'err'); return; }
  if (items.length !== _edit.items.length && !confirm('Hay líneas vacías o con cantidad 0; se descartarán al guardar. ¿Continuar?')) return;
  var btns = [document.getElementById('btnMedGuardarEnviar'), document.getElementById('btnMedGuardar')];
  var textos = btns.map(function(b){ return b.textContent; });
  btns.forEach(function(b){ b.disabled = true; b.textContent = 'Guardando…'; });
  try {
    var r = await _api('/mis/' + _edit.id + '/editar', { method: 'POST', body: {
      cliente: cliente, cliente_nit: _nitONormal(document.getElementById('medNit').value), cod_cliente: _edit.codCliente || undefined,
      cliente_correo: correo, moneda: _edit.moneda, con_iva: document.getElementById('medConIva').checked,
      items: items,
      forma_entrega: document.getElementById('medFormaEntrega').value.trim(),
      lugar_entrega: document.getElementById('medLugarEntrega').value.trim(),
      tiempo_entrega: document.getElementById('medTiempoEntrega').value.trim(),
      forma_pago: document.getElementById('medFormaPago').value.trim(),
      comentarios_adicionales: document.getElementById('medComentarios').value.trim(),
      base_updated_at: _edit.base, reenviar: reenviar,
    } });
    if (!r.ok) { toast(r.data.error || 'No se pudo guardar', 'err'); return; }
    _recordarCliente({ nombre: cliente, nit: _nitONormal(document.getElementById('medNit').value), correo: correo, codigo: _edit.codCliente });
    _renderRecientes();
    cerrarModalEditar();
    _misCot = null;
    cargarMisCotizaciones(true);
    var sesion = _cargarSesion() || {};
    if (!reenviar) toast('Cambios guardados en ' + r.data.no_cotizacion);
    else if (r.data.email_enviado === false) _mostrarConfirmacionCotReal('creada_sin_correo', { no_cotizacion: r.data.no_cotizacion, aviso: r.data.aviso });
    else _mostrarConfirmacionCotReal('ok', { titulo: 'Cotización actualizada y reenviada', no_cotizacion: r.data.no_cotizacion, vendedorCorreo: sesion.correo, clienteCorreo: correo });
  } catch (e) {
    if (!e.handled) toast('Sin conexión al sistema — revisa tu internet e intenta de nuevo', 'err');
  } finally {
    btns.forEach(function(b, i){ b.disabled = false; b.textContent = textos[i]; });
  }
}

// ── Reenviar tal como está ──
var _reenv = null;
function abrirReenviar(id, correoCliente){
  var q = (_misCot || []).filter(function(x){ return x.id === id; })[0];
  var sesion = _cargarSesion() || {};
  _reenv = { id: id, no: q ? q.no_cotizacion : (_edit && _edit.no) || '' };
  document.getElementById('mreTitle').textContent = 'Reenviar ' + _reenv.no;
  document.getElementById('mreVendedor').textContent = sesion.correo || '(sin correo configurado)';
  document.getElementById('mreClienteCorreo').value = correoCliente != null ? correoCliente : ((q && q.cliente_correo) || '');
  document.getElementById('modalReenviar').classList.remove('hidden');
}
function cerrarModalReenviar(){ document.getElementById('modalReenviar').classList.add('hidden'); _reenv = null; }
function reenviarDesdeEditor(){
  var id = _edit.id, c = document.getElementById('medClienteCorreo').value.trim();
  cerrarModalEditar();
  abrirReenviar(id, c);
}
async function confirmarReenvio(){
  if (!_reenv) return;
  var correo = document.getElementById('mreClienteCorreo').value.trim();
  if (correo && !_emailValido(correo)) { toast('El correo del cliente no es válido', 'err'); return; }
  var btn = document.getElementById('btnMreEnviar');
  var texto = btn.textContent;
  btn.disabled = true; btn.textContent = 'Enviando…';
  try {
    var r = await _api('/mis/' + _reenv.id + '/reenviar', { method: 'POST', body: { cliente_correo: correo } });
    if (!r.ok) { toast(r.data.error || 'No se pudo reenviar', 'err'); return; }
    var no = _reenv.no;
    cerrarModalReenviar();
    _mostrarConfirmacionCotReal('ok', { titulo: 'Cotización reenviada', no_cotizacion: no, vendedorCorreo: r.data.enviada_a, clienteCorreo: r.data.copia_a });
  } catch (e) {
    if (!e.handled) toast('Sin conexión al sistema — revisa tu internet e intenta de nuevo', 'err');
  } finally {
    btn.disabled = false; btn.textContent = texto;
  }
}

// ── Borradores locales (botón Guardar del presupuesto + envíos anteriores a esta versión) ──
function eliminarCot(i){
  var h = JSON.parse(localStorage.getItem('cotizaciones') || '[]');
  h.splice(i, 1);
  localStorage.setItem('cotizaciones', JSON.stringify(h));
  refrescarHistorial();
}
function duplicarCot(i){
  var h = JSON.parse(localStorage.getItem('cotizaciones') || '[]');
  var c = h[i];
  if (!c || !Array.isArray(c.items)) return;
  var ahora = Date.now();
  c.items.forEach(function(it){ CARRITO.push(Object.assign({}, it, { uid: ahora + Math.random(), addedAt: ahora })); });
  saveCarrito(); renderCarrito();
  document.getElementById('cotCliente').value = c.cliente && c.cliente !== 'Sin cliente' ? c.cliente : '';
  _clienteSel = null;
  abrirSeccion('cotizar', document.querySelector('#sidebar .nav-item'));
  toast('Ítems copiados al presupuesto');
}

refrescarHistorial = function(){
  cargarMisCotizaciones(false);
  var h = JSON.parse(localStorage.getItem('cotizaciones') || '[]');
  var el = document.getElementById('historialList');
  if (!h.length) { el.innerHTML = '<p class="muted">No hay borradores locales.</p>'; return; }
  var html = '';
  for (var i = h.length - 1; i >= 0; i--) {
    var c = h[i];
    var nItems = Array.isArray(c.items) ? c.items.length : (c.items || 0);
    var totalLabel = (c.totalQ && c.totalQ > 0) ? 'Q' + Number(c.totalQ).toFixed(2) : (c.totalUSD ? '$' + Number(c.totalUSD).toFixed(2) + ' USD' : 'Q' + (c.total || '0'));
    html += '<div class="item-card" style="flex-wrap:wrap">'
      + '<div class="item-info"><strong>' + _esc(c.ref || '') + ' - ' + _esc(c.cliente) + '</strong>'
      + '<small>' + _esc(c.fecha) + ' - ' + nItems + ' item(s)</small></div>'
      + '<div style="text-align:right;margin-right:8px;"><strong style="color:#1a6b45;font-size:15px">' + totalLabel + '</strong></div>'
      + '<div class="actions">'
      + (Array.isArray(c.items) ? '<button class="btn btn-warning btn-sm" onclick="duplicarCot(' + i + ')">Copiar al presupuesto</button>' : '')
      + '<button class="btn btn-danger btn-sm" onclick="eliminarCot(' + i + ')">X</button>'
      + '</div></div>';
  }
  el.innerHTML = html;
};

// ── Arranque: si ya hay sesión guardada entra directo, si no muestra el login ──
window.addEventListener('load', function(){
  var sesion = _cargarSesion();
  if (sesion && sesion.token) { _mostrarApp(sesion); } else { _mostrarLogin(); }
});
