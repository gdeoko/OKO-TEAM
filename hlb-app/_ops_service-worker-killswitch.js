/* KILL-SWITCH Service Worker (v2.0.0) — 30.07.2026
   Прежний SW кэшировал js/css cache-first: клиенты (включая Telegram WebView)
   получали СТАРЫЙ app.js после любых деплоев ХЛБ APP. Этот SW:
   1) мгновенно активируется, 2) удаляет ВСЕ кэши, 3) снимает свою регистрацию,
   4) НЕ перехватывает fetch. Дальше всё ходит напрямую в сеть. */
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){
  e.waitUntil((async function(){
    try{ const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))); }catch(_){}
    try{ await self.registration.unregister(); }catch(_){}
    try{
      const cs = await self.clients.matchAll({type:'window'});
      cs.forEach(c => { try{ c.navigate(c.url); }catch(_){} });
    }catch(_){}
  })());
});
