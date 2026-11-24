/* sw.js — App instalable TMS SSI (v135, 24/11/2026)
 * Solo para que el celular la reconozca como app y abra aunque la señal sea mala:
 * - Archivos de esta página: primero la red (siempre lo más nuevo); si no hay señal, la copia guardada.
 * - Los datos (servidor de Google) NO se guardan: siempre van directo.
 */
const CACHE = 'tms-ssi-v1';
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(fetch(req).then(function (res) {
    if (res && res.ok) { const copia = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copia); }); }
    return res;
  }).catch(function () {
    return caches.match(req).then(function (r) { return r || caches.match('./'); });
  }));
});
