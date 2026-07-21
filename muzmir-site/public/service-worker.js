const CACHE = 'muzmir-v1';
const CORE = ['/', '/assets/css/style.css', '/assets/js/app.js', '/assets/img/logo_muzmir_256.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(()=>self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok && new URL(req.url).origin === location.origin) { const cp = res.clone(); caches.open(CACHE).then(c=>c.put(req, cp)); }
      return res;
    }).catch(()=>caches.match('/')))
  );
});
