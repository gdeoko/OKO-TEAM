# МЕТАНОЙЯ · мобильное приложение (PWA)

Онлайн-школа духовно-нравственного воспитания детей 5–14 лет.
Заказчик: Екатерина Павленко. Исполнитель: OKO TEAM.

**Единственный источник правды — `METANOYA_CONTEXT.txt` в корне репозитория.**
Перед любой работой: прочитать контекстный файл целиком (правило 3).

## Локальное тестирование (без хостинга)

Открой `metanoia-app/public_html/index.html` двойным кликом — приложение
работает прямо из браузера по `file://`, без сервера и без сборки.
Для шрифтов Google Fonts нужен интернет (без него включаются системные fallback-шрифты).

## Структура (раздел 21 контекста)

```
metanoia-app/
  public_html/        ← корень поддомена app.metanoia-180.ru
    index.html        ← SPA-точка входа (открывается локально!)
    manifest.json     ← PWA-манифест
    service-worker.js ← SW (заглушка, этап 8)
    assets/css|js|svg|img|fonts
    api/v1/           ← PHP REST API (этап 1-бэк)
    admin/            ← админ-панель Екатерины (этап 7)
    games/            ← Phaser.js мини-игры (этап 5)
    uploads/          ← пользовательский контент
  db/                 ← schema.sql, seed.sql, migrations/ (этап 1-бэк)
  cron/               ← cron-скрипты (этап 4+)
  config/             ← .env (ключи НЕ в git)
  docs/               ← техдокументация
```

## Стек

- Frontend: HTML5 + CSS3 + чистый JS ES6+ (без фреймворков), Web Components
- Backend: PHP 8.1+ (нативный), MySQL 8.0 — деплой на shared-hosting
- Библиотеки: Phaser.js, Chart.js, Quill.js, SortableJS, Firebase (только messaging)
- Палитра: navy `#1A3A52` · terracotta `#C97064` · gold `#D4A574` · cream `#FAF8F5`
- Шрифты: Playfair Display (заголовки) + Montserrat (текст)

## Статус

Этап 1 (фундамент): фронтенд-каркас готов — 5 табов, палитра, шапка,
заглушки всех экранов. Дальше по плану из раздела 21 контекстного файла.
