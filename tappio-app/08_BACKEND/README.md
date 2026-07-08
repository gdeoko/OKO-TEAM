# Tappio · Backend

PHP-бэкенд для сайта tappio.app. Подход тот же что и в OKO:
JSON-файлы как БД, Gmail SMTP, Telegram Bot API для уведомлений.

## Файлы

```
/api.php          — главный роутер (saveLead, drip, newsletter, download...)
/cron.php         — запускалка дожимов (для cron)
/.htaccess        — security + кэш + CORS
/data.json        — БД лидов (создаётся автоматически)
/api.log          — лог (создаётся автоматически)
/partials/        — partial-заявки (создаётся автоматически)
/lead-magnets/    — PDF лид-магниты
    spy-airbnb-hidden-cameras.pdf
    brain-7day-starter-plan.pdf
    tape-furniture-checklist.pdf
    tappio-starter-bundle.pdf
```

## Установка на хостинг

1. Залить файлы в корень домена.
2. Открыть `api.php` и заменить плейсхолдеры в начале файла:
   - `SITE_URL` — адрес сайта (например `https://tappio.pro`)
   - `GMAIL` — почта-отправитель
   - `GMAIL_PASS` — app-password Gmail (генерится в Google Account → Security)
   - `ADMIN_KEY` — секретный ключ для крона (длинная строка, не словарная)
   - `CLIENT_TG_ID` — Telegram ID Александра (если хочет получать уведомления)
3. Сделать `chmod 644` на `api.php`, `cron.php`, `.htaccess`.
4. Создать пустые `data.json` (или дать права 666 чтобы PHP смог создать).
5. Создать папки:
   ```
   mkdir partials  &&  chmod 755 partials
   ```
6. Настроить cron на хостинге (cPanel → Cron Jobs):
   ```
   1,31 * * * * php /home/USER/public_html/cron.php
   ```
   Запускается каждые 30 минут. Каждый запуск проверяет все лиды,
   шлёт drip-1 через 1 час и drip-2 через 24 часа.

## Действия API

| action       | метод | описание |
|--------------|-------|----------|
| `saveLead`   | POST  | Сохраняет лид + шлёт лид-магнит на email |
| `drip`       | GET   | Запускает дожимы (нужен `?key=ADMIN_KEY`) |
| `newsletter` | POST  | Рассылка по сегменту (нужен `key` в body) |
| `download`   | GET   | Отдаёт PDF: `?action=download&product=spy&email=...` |
| `unsubscribe`| GET   | Отписка: `?action=unsubscribe&email=...` |
| `getStats`   | GET   | Статистика (нужен `?key=ADMIN_KEY`) |
| `getLeads`   | GET   | Список 50 последних лидов (нужен `?key=ADMIN_KEY`) |

## Пример saveLead запроса (из сайта)

```js
fetch('/api.php?action=saveLead', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    name: 'Sarah',
    email: 'sarah@example.com',
    product: 'tappio_spy',     // или tappio_brain / tappio_tape / tappio_bundle
    source: 'exit_popup'          // chatbot / exit_popup / welcome_popup / etc.
  })
})
```

## Email-логика

После saveLead отправляется одно из писем:
- `spy` → guide "5 Places Hidden Cameras Hide in Airbnbs"
- `brain` → "Your 7-Day Brain Workout starts now"
- `tape` → "Furniture Measurement Checklist"
- `bundle` (или unknown) → "Welcome to Tappio"

Через 1 час: drip-1 (напоминание с социальным доказательством).
Через 24 часа: drip-2 (история использования + CTA).

Все письма с кнопкой "Unsubscribe" в footer'е.

## Telegram уведомления

При новом лиде Даниэлю (ADMIN_TG_ID) приходит:
```
📥 New Tappio lead
Name: Sarah
Email: sarah@example.com
Product: Spy Camera Finder
Source: exit_popup
Time: 28.06.2026 14:33
[Email back] [All leads]
```

Опционально — Александру (CLIENT_TG_ID) короткое уведомление.

## Тестирование локально

PHP 8+:
```bash
php -S localhost:8080
# затем открыть http://localhost:8080/api.php?action=getStats&key=tappio_2026_secret_key
```

## Безопасность

- `data.json`, `api.log`, `.env` закрыты в `.htaccess`
- Папка `partials/` закрыта от прямого доступа
- Папка `lead-magnets/` закрыта (только через `?action=download`)
- `cron.php` тоже закрыт от прямого HTTP-доступа (запускается только через cron CLI)
- ADMIN_KEY обязателен для drip/newsletter/getStats/getLeads
- CORS открыт только для `api.php`

## Дальше

- Если будет нужна сегментация — можно расширить newsletter action
- Если понадобятся аналитические виджеты — можно сделать `/admin.html`
  с авторизацией по ADMIN_KEY и пользоваться getStats/getLeads
