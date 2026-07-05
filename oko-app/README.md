# OKO APP

Приложение-экосистема для блогеров и предпринимателей: мессенджер, лента,
мини-аппы с нейронками, партнёрская программа, конвейеры автоматизации.
Мастер-документы: `docs/OKO_APP_CONTEXT.txt` (концепция, тарифы, экономика)
и `docs/OKO_APP_TZ.md` (что и как собираем). Читать перед любой работой.

## Структура монорепо

```
apps/mobile      Ядро клиента — React Native + Expo (iOS / Android / Web из одного кода)
apps/tg-adapter  Telegram Mini App — веб-сборка того же ядра + @telegram-apps/sdk
server           Backend API — Node.js (Fastify + TypeScript), VPS Timeweb Cloud
agents           ИИ-штат: системные промпты и конфиги агентов
infra            docker-compose, деплой, мониторинг
docs             мастер-документы проекта + архитектура
```

## Ключевые решения (детали в docs/ARCHITECTURE.md)

- **БД + Realtime + Auth:** Supabase (Postgres, Realtime channels).
- **Медиа:** presigned upload напрямую в S3 (multipart для крупных), файлы не проходят через API-сервер.
- **Тарифы:** единый middleware лимитов на сервере (`server/src/middleware/tier.ts`) — один источник правды.
- **Звонки:** LiveKit Cloud SDK.
- **Автоматизации:** n8n self-hosted (в `infra/docker-compose.yml`).
- **ИИ:** Claude API (системы, тексты, агенты), Gemini (анализ видео, обложки), Fliki (рендер), Whisper + ffmpeg.
- **Платежи:** Lava.top / крипта / эквайринг → вебхуки → активация подписки. В TG Mini App дополнительно Stars.

## Локальный прототип (этап 0 — без хостинга и сборки)

Открой `prototype/index.html` двойным кликом в браузере — работает с диска,
ничего ставить не нужно. Внутри: чаты, лента, мини-аппы (видео-премодератор,
система, партнёрка), тарифы — на мок-данных. Все правки интерфейса делаем
здесь, после утверждения переносим в ядро `apps/mobile`.

## Запуск (dev)

```bash
npm install                # корень, ставит все workspace-пакеты
cp .env.example .env       # заполнить ключи

npm run dev -w server      # API на :3000
npm run web -w apps/mobile # веб-версия ядра (Expo web)
```

Миграции БД: `server/src/db/migrations/*.sql` — применяются в Supabase
(SQL editor или supabase cli `supabase db push`).

## Витрины

Один сервер + одно ядро клиента. Все витрины — «морды» к одному API:
веб (сайт = версия для ПК), Telegram Mini App (фул-версия), далее RuStore,
Google Play, App Store. Данные только на сервере.
