# PandaGo Cargo · /order/ (клиент Сергей)

Теги: #проект/pandago #статус/в-работе

## Суть
Лид-ген лендинг cargo-pandago.online/order/ (карго техники из Китая).
Премиум-редизайн: скролл-путешествие Гуанчжоу-Монголия-Москва в одной
постоянной Three.js-сцене, байк-проводник, игровой HUD, GLSL-аврора.

## Где что
- Код: `pandago-order/` на ветке `claude/new-session-xxozd5`
- Превью (публичная ссылка): https://forest-beach-360.higgsfield.app
  (website_id 96269fa0-7465-4a92-89d5-bdc51f4cec87, статика в app/public/)
- Прод: FastPanel, деплой = zip в чат Даниэлю. PHP-бэкенд ГОТОВ, не трогать.
  config.php с сервера НЕ перезаписывать (в git плейсхолдеры вместо секретов).
- Мастер-правила клиента: reference-materials/PANDAGO_RULES_AND_CONTEXT.txt
  (в zip-хэндоффе, в git не лежит — там секреты).

## Бренд и правила
- Палитра: navy #0A1E42, electric #1A6BE0, cyan #3B9EFF, порцелан #F5F8FC.
  Тёплых цветов НЕТ. Зелёный #1DB954 только внутри логотипа.
- Шрифты: Unbounded 700/800, Golos Text, JetBrains Mono.
- Текст: без длинных тире, без "не X, а Y", без эмодзи, только "вы".
  Проверка: `python3 tools/copy-check.py` ПЕРЕД каждым коммитом.
- Контракт API (не ломать): POST api.php?action=newLead
  {name, phone, tg, email, service, msg, contact, website(honeypot)};
  trackEvent: page_view, calc_use, chat_open. Успех = редирект thanks.html.

## Архитектура фронта
index.html + styles.css + ES-модули: app.js (оркестратор), catalog-data.js
(прайс 84 позиции), calculator.js, chatbot.js (принимает заявку в чате),
three-scene.js (мир-путешествие), fx.js (скрэмблинг/курсор/магниты/Lenis),
hud.js (этапы, координаты, звук WebAudio), animations.js (GSAP reveals).
Модель: assets/models/moto.glb (Zsky, CC BY, перекрашена кодом; кредит в футере).

## Незакрытое
- Фотореал: HF-видео-пролёт (склад -> горы -> Москва) со scroll-scrub — ждёт команды.
- 3D из фото реальной техники — ждёт кредитов Higgsfield.
- Персонажи Mixamo — ждёт ручного скачивания пака от Даниэля.
