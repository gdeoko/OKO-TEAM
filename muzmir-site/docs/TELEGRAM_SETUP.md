# Подключение Telegram-бота и Mini App

Бот: **@kc_muz_mir_bot**. Mini App открывается по адресу `<base_url>/tma`.
Webhook принимает апдейты на `<base_url>/api/v1/webhook_telegram.php`.

## 1. Токен и секреты

Токен бота выдаёт @BotFather (`/token` или `/newbot`). Он НЕ хранится в git.
Задаётся через окружение (или `config.local.php`):

```
MUZMIR_TG_BOT_TOKEN=123456:AA...      # токен @kc_muz_mir_bot
MUZMIR_TG_ADMIN_CHAT=123456789        # chat_id админа для уведомлений
MUZMIR_BASE_URL=https://<боевой-домен>
```

Узнать свой `chat_id`: написать боту, затем открыть
`https://api.telegram.org/bot<token>/getUpdates` и взять `message.chat.id`.
Если токен пуст — все функции работают тихо (фолбэк), сайт не падает.

## 2. Регистрация Mini App в BotFather

1. `/newapp` → выбрать @kc_muz_mir_bot.
2. Название, короткое описание, иконка (640×360) и, при желании, GIF-демо.
3. **Web App URL:** `https://<боевой-домен>/tma`
4. Короткое имя приложения (`short name`) — латиницей, например `muzmir`.
   Прямая ссылка на приложение: `https://t.me/kc_muz_mir_bot/muzmir`.

## 3. Установка webhook и меню (скрипт)

Домен должен работать по **HTTPS** (Telegram не принимает http).
На боевом сервере, с заданными переменными окружения:

```bash
MUZMIR_BASE_URL=https://<домен> \
MUZMIR_TG_BOT_TOKEN=<token> \
MUZMIR_TG_ADMIN_CHAT=<chat_id> \
php scripts/tg_setup.php
```

Скрипт делает:
- `setWebhook` → `<base_url>/api/v1/webhook_telegram.php` (updates: message, callback_query);
- `setMyCommands` → список команд (start, apply, my, help, support);
- `setChatMenuButton` → кнопка меню открывает Web App `/tma`;
- печатает `getWebhookInfo` для проверки.

Проверка вручную:
```bash
curl "https://api.telegram.org/bot<token>/getWebhookInfo"
```
Поля `url` и `pending_update_count` должны быть корректными, `last_error_message` — пустым.

## 4. Команды бота

| Команда    | Действие |
|------------|----------|
| `/start`   | Приветствие + кнопка Web App `/tma` |
| `/apply`   | Ссылки на форму заявки (Web App и сайт) |
| `/my`      | Статус заявок пользователя по его `tg_id` |
| `/help`    | Справка и кнопки |
| `/support` | Текст после команды уходит админу (`tg_admin_chat`) |

## 5. Обработчик апдейтов

Файл `api/v1/webhook_telegram.php` (создаёт API-агент) должен принять POST,
разобрать JSON и вызвать готовый обработчик из `core/telegram.php`:

```php
<?php
declare(strict_types=1);
define('BASE_PATH', dirname(__DIR__, 2));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/telegram.php';

$update = json_decode(file_get_contents('php://input') ?: '[]', true);
if (is_array($update)) tg_handle_update($update);
http_response_code(200);           // всегда 200, чтобы Telegram не ретраил
echo 'ok';
```

## 6. Проверка initData в Mini App

Фронт Mini App присылает `Telegram.WebApp.initData` на бэкенд.
Валидация подписи — `tg_check_init_data(string $initData): ?array`
(HMAC-SHA256 по `bot_token`, проверка свежести до 24ч). Возвращает массив
пользователя (`id`, `first_name`, ...) при валидной подписи или `null`.
По `user.id` бэкенд связывает Telegram-профиль с таблицей `users` (`tg_id`).

## 7. Функции `core/telegram.php`

- `tg_api($method, $params)` — низкоуровневый вызов Bot API (cURL, тихий фолбэк).
- `tg_send($chatId, $text, $opt)` — sendMessage (HTML, inline-клавиатуры, web_app-кнопки).
- `tg_send_photo($chatId, $photo, $opt)` — sendPhoto (URL/file_id, caption).
- `tg_notify_admin($text)` — сообщение в `tg_admin_chat`.
- `tg_answer_callback($id, $text, $alert)` — answerCallbackQuery.
- `tg_set_webhook($url)` — setWebhook.
- `tg_check_init_data($initData)` — валидация Mini App initData.
- `tg_handle_update($update)` — маршрутизация входящих (команды + callback).
