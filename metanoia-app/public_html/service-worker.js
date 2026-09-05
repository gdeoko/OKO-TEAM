/* ══════════════════════════════════════════════════════════════
   МЕТАНОЙЯ · service-worker.js

   Зачем: ребёнок открывает школу с телефона, где интернет то есть,
   то нет. Оболочка приложения лежит в памяти телефона и открывается
   без сети. Урок, который уже слушали и читали, тоже остаётся, потому
   что картинки и озвучка кладутся в память по мере обращения.

   Правила:
   - страница и код: сначала сеть, потом память. Так обновление
     доезжает сразу, а без сети открывается вчерашняя версия;
   - картинки, звук, шрифты: сначала память, потом сеть. Их адреса не
     меняются, а весят они много;
   - озвучка урока около 250 КБ на файл, всех 105 в памяти держать
     незачем, поэтому склад ограничен и старое вытесняется.
   ══════════════════════════════════════════════════════════════ */

const ВЕРСИЯ = 'metanoya-v2';
const СКЛАД_ОБОЛОЧКИ = ВЕРСИЯ + '-shell';
const СКЛАД_ФАЙЛОВ = ВЕРСИЯ + '-media';
const ПРЕДЕЛ_ФАЙЛОВ = 160; // примерно 40 МБ картинок и озвучки

const ОБОЛОЧКА = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/main.css',
  './assets/css/fonts.css',
  './assets/js/sync.js',
  './assets/js/icons.js',
  './assets/js/magic.js',
  './assets/js/lessons.js',
  './assets/js/tasks.js',
  './assets/js/gamedata.js',
  './assets/js/app.js',
  './assets/img/logo.png',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(СКЛАД_ОБОЛОЧКИ)
      // Один недоступный файл не должен рушить установку целиком.
      .then((c) => Promise.all(ОБОЛОЧКА.map((u) => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((кл) => Promise.all(кл.filter((k) => !k.startsWith(ВЕРСИЯ)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** Держим склад файлов в разумном размере: лишнее выбрасываем по очереди. */
async function подрезать(имя, предел) {
  const c = await caches.open(имя);
  const ключи = await c.keys();
  for (let i = 0; i < ключи.length - предел; i++) await c.delete(ключи[i]);
}

async function сначалаСеть(запрос) {
  try {
    const ответ = await fetch(запрос);
    if (ответ && ответ.ok) {
      const c = await caches.open(СКЛАД_ОБОЛОЧКИ);
      c.put(запрос, ответ.clone());
    }
    return ответ;
  } catch (e) {
    const из_памяти = await caches.match(запрос);
    if (из_памяти) return из_памяти;
    if (запрос.mode === 'navigate') {
      const главная = await caches.match('./index.html');
      if (главная) return главная;
    }
    throw e;
  }
}

async function сначалаПамять(запрос) {
  const из_памяти = await caches.match(запрос);
  if (из_памяти) return из_памяти;
  const ответ = await fetch(запрос);
  if (ответ && ответ.ok) {
    const c = await caches.open(СКЛАД_ФАЙЛОВ);
    await c.put(запрос, ответ.clone());
    подрезать(СКЛАД_ФАЙЛОВ, ПРЕДЕЛ_ФАЙЛОВ);
  }
  return ответ;
}

self.addEventListener('fetch', (e) => {
  const запрос = e.request;
  if (запрос.method !== 'GET') return;

  const адрес = new URL(запрос.url);
  if (адрес.origin !== self.location.origin) return; // чужие адреса не трогаем
  if (адрес.pathname.includes('/api/')) return;      // ответы сервера не храним

  const медиа = /\.(?:jpg|jpeg|png|webp|svg|mp3|mp4|woff2?)$/i.test(адрес.pathname);
  e.respondWith(медиа ? сначалаПамять(запрос) : сначалаСеть(запрос));
});
