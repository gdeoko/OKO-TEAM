const CACHE = 'muzmir-v2';
const CORE = ['/', '/assets/css/style.css', '/assets/js/app.js', '/assets/img/logo_muzmir_256.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // POST/не-GET не кэшируем
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;             // сторонние запросы — как есть

  // Статика /assets/ — stale-while-revalidate.
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

  // Остальное — cache-first с сетевым обновлением и оффлайн-fallback на '/'.
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
      return res;
    }).catch(() => caches.match('/')))
  );
});
