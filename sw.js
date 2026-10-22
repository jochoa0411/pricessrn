// Service worker del Cotizador LGM: permite instalarlo como app y abrirlo aunque no haya señal.
// Estrategia: SIEMPRE se intenta la red primero (así las actualizaciones llegan en cuanto se publican) y, si no hay conexión,
// se usa la última copia guardada. Las llamadas al sistema (otro dominio) y los envíos (POST) nunca se guardan.
var CACHE = 'lgm-cotizador-v1';
var BASE = ['./cotizador.html', './version.js', './html2pdf.bundle.min.js', './pdf-share.js', './listas-ui.js', './precios-ui.js', './medidas-iguales.js', './flujo-compacto.js', './precio-final.js', './descripcion-linea.js', './vendedor-ui.js', './real-quote.js', './tela-ui.js', './carrito-ui.js', './paso-a-paso.js', './selector-producto.js', './paso-envio.js', './instalar-app.js', './avisos.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-180.png', './logo.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return Promise.all(BASE.map(function (u) { return c.add(u).catch(function () {}); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return;
  var u = new URL(r.url);
  if (u.origin !== self.location.origin) return;                     // el sistema (API) y otros dominios: directo a la red
  e.respondWith(
    fetch(r, { cache: 'no-cache' }).then(function (resp) {     // no-cache: revalida con el servidor (GitHub Pages deja copias hasta 10 min)
      if (resp && resp.ok) { var copia = resp.clone(); caches.open(CACHE).then(function (c) { c.put(r, copia); }); }
      return resp;
    }).catch(function () {
      return caches.match(r, { ignoreSearch: false }).then(function (m) { return m || caches.match(r, { ignoreSearch: true }) || (r.mode === 'navigate' ? caches.match('./cotizador.html') : undefined); });
    })
  );
});

// ── Avisos push (Web Push) ──
// El servidor manda { title, body, url, tag, badge }. Se muestra la notificación y, al tocarla, se abre (o se enfoca) la app en la pantalla indicada.
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'Cotizador LGM', body: e.data ? e.data.text() : '' }; }
  var opciones = { body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag || undefined, renotify: !!d.tag, data: { url: d.url || 'cotizador.html' } };
  var tareas = [self.registration.showNotification(d.title || 'Cotizador LGM', opciones)];
  try { if (typeof d.badge === 'number' && self.navigator && self.navigator.setAppBadge) tareas.push(self.navigator.setAppBadge(d.badge)); } catch (x) {}
  e.waitUntil(Promise.all(tareas));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = new URL((e.notification.data && e.notification.data.url) || 'cotizador.html', self.registration.scope).href;
  var ir = new URL(url).searchParams.get('ir');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) {
      if (cs[i].url.indexOf(self.registration.scope) === 0 && 'focus' in cs[i]) { cs[i].postMessage({ ir: ir }); return cs[i].focus(); }
    }
    return self.clients.openWindow(url);
  }));
});
