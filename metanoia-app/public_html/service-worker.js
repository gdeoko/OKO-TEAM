/* МЕТАНОЙЯ · service-worker.js · Этап 1: заглушка.
   Offline-кэширование и push-handler — этап 8 (нативный SW, без Workbox). */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
