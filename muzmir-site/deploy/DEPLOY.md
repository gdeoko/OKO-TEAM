# Деплой КЦ «Музыкальный Мир»

Прод: **https://музыкальный-мир.рф** (punycode `xn----7sbugdeiegh1b0a9hen.xn--p1ai`)
VPS Timeweb `176.124.200.169`, PHP 8.3-fpm + nginx + SQLite, web-root `/var/www/muzmir/public`.

## Схема доступа из песочницы
Порт 22 напрямую закрыт прокси. SSH идёт через бастион OKO-poster:
`vexec 'export SSHPASS="…"; sshpass -e ssh root@176.124.200.169 "…"'`
(обёртка `vexec` — в корневом `OKO_BOOTSTRAP.md`).

## nginx
Канонический конфиг — `deploy/nginx-muzmir.conf`. Копировать в
`/etc/nginx/sites-available/muzmir`, симлинк в `sites-enabled`, `nginx -t && systemctl reload nginx`.
**Критично:** блок `location ^~ /api/` — без него вебхуки `/api/v1/*.php`
отдают nginx-404 (файлы лежат вне `public/`, роутинг только через `index.php`).

## Вебхуки (чистые URL, работают и с `.php`, и без)
- Telegram: `https://музыкальный-мир.рф/api/v1/webhook_telegram`
- ЮKassa:   `https://музыкальный-мир.рф/api/v1/webhook_yukassa`

### Telegram — ставится по API (сделано)
setWebhook + setChatMenuButton (Mini App → `/tma`) через Bot API.

### ЮKassa — вписать URL в ЛК вручную
API `POST /v3/webhooks` требует OAuth (Basic shopId:secret не пускает —
`invalid_credentials`). Поэтому URL уведомлений задаётся в личном кабинете:
**Настройки → HTTP-уведомления →** URL `https://музыкальный-мир.рф/api/v1/webhook_yukassa`,
события: `payment.succeeded`, `payment.waiting_for_capture`, `payment.canceled`, `refund.succeeded`.
Опционально — секрет подписи в `MUZMIR_YUKASSA_WEBHOOK_SECRET` (иначе ЮKassa опирается на IP-whitelist).

## Почта / SMTP — БЛОКЕР
Timeweb закрывает исходящие 25/465/587/2525 → Gmail SMTP не отправляет.
Очередь писем (`mail_queue`) копится, но не уходит. Варианты:
1. Заявка в поддержку Timeweb на открытие 587 (submission).
2. Перейти на HTTP-API отправки (Gmail API / SMTP2GO / Unisender) поверх 443.

## Секреты
Только в `/var/www/muzmir/config.local.php` (chmod 640, вне git). В репозиторий не коммитить.
