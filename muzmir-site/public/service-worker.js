const CACHE = 'muzmir-v32';
const CORE = ['/offline.html', '/assets/img/logo_muzmir_256.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    // Радикально: сносим ВСЕ старые кэши.
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
    // Просим все открытые вкладки/мини-аппы перезагрузиться на свежую версию.
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    list.forEach(c => c.postMessage({ type: 'mz-sw-reload', ver: CACHE }));
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // HTML — NETWORK ONLY (никакого кэша HTML, чтобы старая вёрстка не вылезала).
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    e.respondWith(fetch(req).catch(() => caches.match('/offline.html')));
    return;
  }
  // CSS/JS — NETWORK-FIRST (свежее, кэш — только оффлайн-страховка).
  if (/\.(css|js)(\?|$)/.test(url.pathname)) {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }
  // Прочие /assets/ (изображения, шрифты) — stale-while-revalidate.
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(req).then(hit => {
          const fetching = fetch(req).then(res => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          }).catch(() => hit);
          return hit || fetching;
        })
      )
    );
    return;
  }
  // Всё остальное — просто из сети.
  e.respondWith(fetch(req).catch(() => caches.match(req)));
});
