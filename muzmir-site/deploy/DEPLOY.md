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

### ЮKassa — работает БЕЗ настройки дашборда (pull-реконсилер)
API `POST /v3/webhooks` требует OAuth (Basic shopId:secret не пускает —
`invalid_credentials`), а в ЛК HTTP-уведомления могли быть не настроены. Поэтому
оплата подтверждается **опросом статуса**: `cron/reconcile_payments.php` (каждые 2 мин)
дёргает `GET /v3/payments/{id}` по «висящим» платежам и применяет статус той же
`payment_apply_status()` из `core/payments.php`, что и вебхук (→ заявка/заказ `paid`,
письмо об оплате, уведомление админу). Ничего в кабинете ЮKassa настраивать не нужно.

Вебхук (push) тоже жив — если позже вписать в ЛК **Настройки → HTTP-уведомления →**
URL `https://музыкальный-мир.рф/api/v1/webhook_yukassa` (события `payment.succeeded`,
`payment.waiting_for_capture`, `payment.canceled`, `refund.succeeded`), подтверждение
будет приходить мгновенно, а реконсилер останется страховкой. Опционально —
секрет подписи в `MUZMIR_YUKASSA_WEBHOOK_SECRET` (иначе ЮKassa опирается на IP-whitelist).

## Почта / SMTP — РАБОТАЕТ
На этом VPS исходящие 465/587 **открыты** (проверено), Gmail SMTP отправляет
(тест-письмо доставлено). `cron/process_newsletter_queue.php` разгребает `mail_queue`
каждую минуту. Если Timeweb когда-нибудь закроет порты — фолбэк: HTTP-API отправки
(Gmail API / SMTP2GO / Unisender) поверх 443.

## Cron (полный набор — восстанавливать при ребуте VPS, crontab может слетать)
```
* * * * *   process_newsletter_queue   # очередь писем
*/2 * * * * reconcile_payments         # сверка статусов ЮKassa (без вебхука)
*/5 * * * * health_check
*/5 * * * * publish_scheduled_posts
0 9 * * *   check_competitions_dates
0 10 * * *  send_reminders
0 3 * * *   daily_backup
0 4 * * 1   weekly_backup
0 8 1 * *   monthly_report
```
Все — `php /var/www/muzmir/cron/<name>.php >/dev/null 2>&1`. Проверить: `crontab -l`, `systemctl is-active cron`.

## Секреты
Только в `/var/www/muzmir/config.local.php` (chmod 640, вне git). В репозиторий не коммитить.
