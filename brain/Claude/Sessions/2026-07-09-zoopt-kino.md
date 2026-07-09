# ЗооОпт — кино-версия: первое видео-влёт (scroll-scrub)

#проект/зооопт #статус/в-работе 2026-07-09

## Сделано
- Kling 3.0 Turbo: влёт камеры по проходу магазина (сцена 3), 1284x716 24fps 5s.
  Расход по балансу: 2988.5 → 2973.5 = **15 cr** (вероятно дубль из-за обрыва MCP при первом
  вызове — сервер создал job, клиент потерял ответ; на ретрае ещё один. Использую один клип).
- Энкод all-intra: WebM VP9 + MP4 H.264 (`-g 1 +faststart -an`) под мгновенный seek.
- Движок `zoopt/site/js/film.js`: blob-seek scroll-scrub — currentTime ведётся скроллом,
  окно сцены [i-1,i+1], seekable в любом хосте (чинит Safari/без-Range). Универсально
  для всех будущих видео-сцен (просто `<video class=vid data-scrub data-mp4 data-webm>`).
- QA Playwright ПК 1440x900 + телефон 390x844: video ready, currentTime 0.76→2.52→4.29,
  3/3 разных кадра = реальное движение камеры от скролла. PASS.
- Деплой: промо film.html → корень витрины. Live: https://spicy-panther-317.higgsfield.app
  (build zoopt-kino-v6-live). curl: index/film.js/vendor/mp4/webm/jpg — все 200.

## Дальше (ждём ОК Даниэля на кредиты)
- Ещё 7 сцен-влётов (фасад/двери/собаки/кошки/аквариум/опт/пьедестал) @~7.5cr = ~52 cr.
- Видео-разлёт пачки (бургер) — 1 клип. Живые пёс/рыбы — опц.
- Итого весь кино-сайт настоящим видео: ~60–80 cr. В бюджет <500 укладываемся с запасом.

## Грабли среды
- MCP Higgsfield/github рвётся и переподключается — вызовы «stream closed». Лечить ретраем,
  не окном подтверждения (в settings.json уже bypassPermissions + allow на всё).
- Playwright headless НЕ ходит через HTTPS_PROXY → живой сайт curl'ом, локально Playwright.
- Chromium бинарь: /opt/pw-browsers/chromium-1194/chrome-linux/chrome.
