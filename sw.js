/* ============================================================
   FamFi — sw.js (service worker)
   • The page (index.html): network-first — that's how an update is
     found — with the phone's copy after 3 s on a slow connection,
     or at once offline.
   • Versioned files (?v=) and pictures: cache-first. They never
     change within a version, so an open needs no network for them
     (before: ~45 requests and ~1.3 MB rewritten on every open).
     Network fetches revalidate with the server (cache: 'no-cache'):
     the browser's HTTP cache must never hand back an old version.
   • Google Fonts and the (versioned) Firebase SDK: cache-first —
     they never change, and the app opens offline with them.
   Bump VERSION when files are renamed or removed.
   ============================================================ */
var VERSION = 'famfi-v2.25.0';
var SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'css/tokens.css?v=2.25', 'css/app.css?v=2.25', 'css/village.css?v=2.25',
  'js/core.js?v=2.25', 'js/data.js?v=2.25', 'js/calc.js?v=2.25', 'js/ledger.js?v=2.25', 'js/play.js?v=2.25', 'js/lucky.js?v=2.25', 'js/blast.js?v=2.25', 'js/news.js?v=2.25', 'js/grid.js?v=2.25', 'js/store.js?v=2.25', 'js/fb-config.js?v=2.25', 'js/cloud.js?v=2.25', 'js/market.js?v=2.25', 'js/i18n.js?v=2.25',
  'js/strings-en.js?v=2.25', 'js/strings-zh.js?v=2.25', 'js/strings-th.js?v=2.25', 'js/art.js?v=2.25', 'js/art-shop.js?v=2.25', 'js/art-lucky.js?v=2.25', 'js/art-news.js?v=2.25', 'js/art-sage.js?v=2.25', 'js/ui.js?v=2.25', 'js/charts.js?v=2.25',
  'js/screens-money.js?v=2.25', 'js/screens-manage.js?v=2.25', 'js/screens-menu.js?v=2.25', 'js/screens-family.js?v=2.25', 'js/screens-hall.js?v=2.25', 'js/screens-shop.js?v=2.25', 'js/screens-blast.js?v=2.25', 'js/screens-lucky.js?v=2.25', 'js/screens-news.js?v=2.25', 'js/screens-spin.js?v=2.25', 'js/screens-sage.js?v=2.25', 'js/screens-help.js?v=2.25', 'js/village.js?v=2.25', 'js/app.js?v=2.25',
  // the Mystery Man's facts: loaded only when he talks, but kept so he can talk offline too
  'js/facts-en.js?v=2.25', 'js/facts-zh.js?v=2.25', 'js/facts-th.js?v=2.25',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-64.png'
];
var FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
var SDK_PREFIX = 'https://www.gstatic.com/firebasejs/';

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL.map(function (u) { return new Request(u, { cache: 'reload' }); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (FONT_HOSTS.indexOf(url.hostname) !== -1 || e.request.url.indexOf(SDK_PREFIX) === 0) {
    e.respondWith(caches.match(e.request).then(function (hit) {
      return hit || fetch(e.request).then(function (r) { var copy = r.clone(); caches.open(VERSION).then(function (c) { c.put(e.request, copy); }); return r; });
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  if (url.pathname.indexOf('/api/') !== -1) return; // live prices: never from the SW cache
  var fresh = function () {
    return fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }).then(function (r) {
      if (r && r.status === 200) { var copy = r.clone(); caches.open(VERSION).then(function (c) { c.put(e.request, copy); }); }
      return r;
    });
  };
  // versioned files (?v=) and pictures never change within a version: straight from the phone,
  // no network at all (index.html names the new ?v= files when there's an update)
  if (/[?&]v=/.test(url.search) || /\.(png|jpe?g|svg|webmanifest)$/.test(url.pathname)) {
    e.respondWith(caches.match(e.request).then(function (hit) { return hit || fresh(); }));
    return;
  }
  // the page itself: asked for fresh (that's how an update is found); on a slow or missing
  // connection the phone's copy opens after 3 s instead of a long wait
  var fallback = function () { return caches.match(e.request).then(function (hit) { return hit || caches.match('index.html'); }); };
  e.respondWith(new Promise(function (resolve) {
    var settled = false;
    var done = function (r) { if (!settled && r) { settled = true; resolve(r); } };
    var t = setTimeout(function () { fallback().then(done); }, 3000);
    fresh().then(function (r) { clearTimeout(t); done(r); }, function () { clearTimeout(t); fallback().then(function (r) { done(r || Response.error()); }); });
  }));
});
