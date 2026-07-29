/* OKO Service Worker — production-grade PWA
   Version бампается на любое изменение SW, чтобы клиенты подхватили новую версию.
   Стратегии:
     • navigation / index.html  → network-first, fallback на кэш, затем offline.html
     • картинки, шрифты, css, js, glb → cache-first + stale-while-revalidate
     • всё остальное → network-first + runtime кэш
   PHP-API (/api.php, *.php) вообще не кэшируем.
*/
const VERSION = 'oko-sw-v1.0.0';
const CORE_CACHE    = `oko-core-${VERSION}`;
const ASSET_CACHE   = `oko-assets-${VERSION}`;
const RUNTIME_CACHE = `oko-runtime-${VERSION}`;

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/oko-manifest.json',
  '/oko-icon-192.png',
  '/oko-icon-512.png',
  '/oko-maskable-192.png',
  '/oko-maskable-512.png',
  '/oko-logo-512.png',
  '/oko-eye.glb'
];

/* ---------- install: прекэш ядра ---------- */
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CORE_CACHE);
    await Promise.all(CORE_ASSETS.map(u =>
      cache.add(new Request(u, { cache: 'reload' })).catch(() => null)
    ));
    self.skipWaiting();
  })());
});

/* ---------- activate: чистим старые кэши ---------- */
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => k.startsWith('oko-') && !k.endsWith(VERSION))
        .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

/* ---------- helpers ---------- */
const isImageOrFont = url =>
  /\.(png|jpg|jpeg|gif|svg|webp|avif|ico|woff2?|ttf|otf|eot)(\?|$)/i.test(url.pathname);

const isStaticAsset = url =>
  /\.(css|js|mjs|glb|gltf|json)(\?|$)/i.test(url.pathname);

const isPhpOrApi = url =>
  url.pathname.startsWith('/api.php') ||
  url.pathname.endsWith('.php') ||
  url.pathname.startsWith('/admin/') ||
  url.pathname.startsWith('/anketa/') ||
  url.pathname.startsWith('/resume/');

const isDocument = (req, url) =>
  req.mode === 'navigate' ||
  req.destination === 'document' ||
  url.pathname === '/' ||
  url.pathname === '/index.html';

async function networkFirst(req, cacheName){
  const cache = await caches.open(cacheName);
  try {
    const resp = await fetch(req);
    if (resp && resp.ok) cache.put(req, resp.clone()).catch(() => {});
    return resp;
  } catch (e) {
    const cached = await cache.match(req);
    if (cached) return cached;
    throw e;
  }
}

async function cacheFirstSWR(req, cacheName){
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) {
    /* фоновая ревалидация */
    fetch(req).then(r => {
      if (r && r.ok && r.type === 'basic') cache.put(req, r.clone()).catch(() => {});
    }).catch(() => {});
    return cached;
  }
  try {
    const resp = await fetch(req);
    if (resp && resp.ok && resp.type === 'basic') cache.put(req, resp.clone()).catch(() => {});
    return resp;
  } catch (e) {
    /* последняя надежда — корневой кэш */
    const core = await caches.open(CORE_CACHE);
    const fb = await core.match(req);
    if (fb) return fb;
    throw e;
  }
}

/* ---------- fetch: главная маршрутизация ---------- */
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (isPhpOrApi(url)) return;                /* PHP/админку — прямиком в сеть */
  if (url.pathname === '/service-worker.js') return; /* сам себя не кэшируем */

  if (isDocument(req, url)) {
    event.respondWith((async () => {
      const cache = await caches.open(CORE_CACHE);
      try {
        const resp = await fetch(req);
        if (resp && resp.ok) cache.put('/index.html', resp.clone()).catch(() => {});
        return resp;
      } catch (e) {
        const cached = await cache.match('/index.html') || await cache.match('/');
        if (cached) return cached;
        const offline = await cache.match('/offline.html');
        return offline || new Response('offline', { status: 503, statusText: 'offline' });
      }
    })());
    return;
  }

  if (isImageOrFont(url) || isStaticAsset(url)) {
    event.respondWith(cacheFirstSWR(req, ASSET_CACHE).catch(() => new Response('', { status: 504 })));
    return;
  }

  /* всё прочее — network-first + runtime кэш */
  event.respondWith(networkFirst(req, RUNTIME_CACHE).catch(() => new Response('', { status: 504 })));
});

/* ---------- сообщения от страницы ---------- */
self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  if (data.type === 'PING') {
    if (event.ports && event.ports[0]) event.ports[0].postMessage({ type: 'PONG', version: VERSION });
  }
  if (data.type === 'CLEAR_ASSETS') {
    caches.delete(ASSET_CACHE).then(() => caches.delete(RUNTIME_CACHE));
  }
});

/* ---------- background sync: будим страницу ---------- */
self.addEventListener('sync', event => {
  if (event.tag === 'oko-sync-queue') {
    event.waitUntil(broadcastToClients({ type: 'oko-sync-request' }));
  }
});

async function broadcastToClients(msg){
  const list = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  list.forEach(c => { try { c.postMessage(msg); } catch (e) {} });
}
