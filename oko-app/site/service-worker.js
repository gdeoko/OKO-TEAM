/* OKO Service Worker — production-grade PWA
   Version бампается на любое изменение SW, чтобы клиенты подхватили новую версию.
   Стратегии:
     • navigation / index.html  → network-first, fallback на кэш, затем offline.html
     • картинки, шрифты, css, js, glb → cache-first + stale-while-revalidate
     • всё остальное → network-first + runtime кэш
   PHP-API (/api.php, *.php) вообще не кэшируем.
*/
const VERSION = 'oko-sw-v2.4.0';
const CORE_CACHE    = `oko-core-${VERSION}`;
const ASSET_CACHE   = `oko-assets-${VERSION}`;
const RUNTIME_CACHE = `oko-runtime-${VERSION}`;

/* ПОЧЕМУ ЭТОТ СПИСОК ТАКОЙ КОРОТКИЙ.
   Раньше здесь лежали все 30+ файлов приложения, и install тянул каждый через
   `cache: 'reload'` — то есть в обход HTTP-кэша, гарантированно из сети. А
   страница в этот самый момент качала те же файлы сама. На первом заходе
   человек платил за приложение ДВАЖДЫ: ~10 МБ на отрисовку и ещё ~10 МБ на
   прогрев кэша, одновременно, деля и без того узкий мобильный канал.

   Теперь на install кладём только оболочку офлайна — то, без чего нечего
   показать при обрыве связи. Всё остальное (app.js, app.css, слои, glb,
   three.js) само осядет в кэше при первом же обращении: обработчик fetch
   ниже кладёт любой статический файл в ASSET_CACHE по стратегии
   cache-first + фоновая ревалидация. Второй заход всё так же мгновенный,
   а первый стал вдвое дешевле. */
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/oko-manifest.json',
  '/oko-icon-192.png',
  '/oko-icon-512.png',
  '/oko-maskable-192.png',
  '/oko-maskable-512.png'
];

/* ---------- install: прекэш оболочки офлайна ---------- */
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CORE_CACHE);
    /* index.html берём свежим — он меняется каждый деплой и именно по нему
       страница узнаёт про новые файлы. Иконки и манифест пусть приходят
       из HTTP-кэша, если они там уже есть: заново качать их незачем. */
    await Promise.all(CORE_ASSETS.map(u => {
      const свежим = (u === '/' || u === '/index.html');
      return cache.add(свежим ? new Request(u, { cache: 'reload' }) : u).catch(() => null);
    }));
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

/* ---------- Web Push: показ уведомления (VAPID) ---------- */
self.addEventListener('push', event => {
  let data = {};
  try {
    if (event.data) {
      const txt = event.data.text();
      try { data = JSON.parse(txt); }
      catch (e) { data = { title: 'OKO', body: txt }; }
    }
  } catch (e) { data = {}; }

  const title = data.title || 'OKO';
  const opts = {
    body:    data.body || '',
    icon:    data.icon    || '/oko-icon-512.png',
    badge:   data.badge   || '/oko-icon-192.png',
    image:   data.image   || undefined,
    tag:     data.tag     || 'oko',
    renotify: data.renotify != null ? !!data.renotify : true,
    requireInteraction: !!data.requireInteraction,
    silent:   !!data.silent,
    vibrate:  data.vibrate  || [80, 40, 80],
    actions:  Array.isArray(data.actions) ? data.actions : [],
    data: {
      url:    data.url    || '/',
      cat:    data.cat    || null,
      pushId: data.pushId || null
    }
  };
  event.waitUntil(self.registration.showNotification(title, opts));
});

/* Клик по уведомлению — фокус на уже открытую вкладку OKO или открытие новой */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) {
      try {
        const u = new URL(c.url);
        if (u.origin === self.location.origin) {
          await c.focus();
          try { c.postMessage({ type: 'oko-push-click', url: targetUrl, action: event.action || '', data: event.notification.data || {} }); } catch (e) {}
          return;
        }
      } catch (e) {}
    }
    try { await self.clients.openWindow(targetUrl); } catch (e) {}
  })());
});

/* iOS/Safari шлёт pushsubscriptionchange — просим страницу пере-подписаться */
self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil(broadcastToClients({ type: 'oko-push-resubscribe' }));
});
